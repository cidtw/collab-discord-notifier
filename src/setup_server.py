"""
로컬에서만 띄우는 1회성 설정 마법사. 관리자가 브라우저로 Discord 봇 토큰/채널,
Google 계정, Notion Integration을 연결하면 data/config.json 에 저장된다.
표준 라이브러리 http.server 만으로 라우팅한다 (Flask/FastAPI 불필요).
"""
import json
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from src import config, store
from src.services import discord_api, google_drive, notion

PUBLIC_DIR = Path(__file__).resolve().parent.parent / "public"

STATIC_FILES = {
    "/": ("setup.html", "text/html; charset=utf-8"),
    "/setup.html": ("setup.html", "text/html; charset=utf-8"),
    "/setup.js": ("setup.js", "application/javascript; charset=utf-8"),
}


def _mask(secret: str) -> str:
    if not secret:
        return ""
    return "••••" if len(secret) <= 8 else f"{secret[:4]}••••{secret[-4:]}"


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, body: dict):
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _send_text(self, status: int, text: str):
        payload = text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _send_redirect(self, location: str):
        self.send_response(302)
        self.send_header("Location", location)
        self.end_headers()

    def _serve_static(self, pathname: str) -> bool:
        entry = STATIC_FILES.get(pathname)
        if not entry:
            return False
        filename, content_type = entry
        try:
            body = (PUBLIC_DIR / filename).read_bytes()
        except FileNotFoundError:
            self._send_text(404, "not found")
            return True
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        return True

    def _read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if length == 0:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except ValueError:
            raise ValueError("잘못된 JSON 본문입니다.") from None

    def do_GET(self):  # noqa: N802 - http.server 규약
        url = urlparse(self.path)
        pathname, query = url.path, parse_qs(url.query)
        try:
            if pathname == "/auth/google/start":
                return self._handle_google_start()
            if pathname == "/auth/google/callback":
                return self._handle_google_callback(query)
            if pathname.startswith("/api/"):
                return self._handle_api_get(pathname, query)
            if self._serve_static(pathname):
                return
            self._send_text(404, "not found")
        except Exception as err:
            print(f"[setup] 처리 중 오류: {err}")
            self._send_json(500, {"error": str(err)})

    def do_POST(self):  # noqa: N802
        pathname = urlparse(self.path).path
        try:
            if pathname.startswith("/api/"):
                return self._handle_api_post(pathname)
            self._send_text(404, "not found")
        except Exception as err:
            print(f"[setup] 처리 중 오류: {err}")
            self._send_json(500, {"error": str(err)})

    # ---- Google ----

    def _handle_google_start(self):
        if not config.google_app.client_id or not config.google_app.client_secret:
            return self._send_text(
                400,
                "GOOGLE_APP_CLIENT_ID / GOOGLE_APP_CLIENT_SECRET 이 .env 에 없습니다. "
                "README를 참고해 먼저 발급하세요.",
            )
        self._send_redirect(google_drive.generate_auth_url())

    def _handle_google_callback(self, query: dict):
        code = (query.get("code") or [None])[0]
        error = (query.get("error") or [None])[0]
        if error:
            return self._send_text(400, f"Google 인증 실패: {error}")
        if not code:
            return self._send_text(400, "code 파라미터가 없습니다.")

        try:
            tokens = google_drive.exchange_code(code)
        except Exception as err:
            return self._send_text(500, f"토큰 교환 중 오류: {err}")

        if not tokens.get("refresh_token"):
            return self._send_text(
                400,
                "이 계정은 이전에 이미 동의를 완료해 refresh_token이 재발급되지 않았습니다. "
                "Google 계정 설정 → 보안 → 타사 앱 액세스에서 이 앱 연결을 해제한 뒤 다시 시도하세요.",
            )

        store.update_section("google", {"refreshToken": tokens["refresh_token"]})
        self._send_redirect("/?connected=google")

    # ---- API: GET ----

    def _handle_api_get(self, pathname: str, query: dict):
        if pathname == "/api/status":
            c = store.load()
            return self._send_json(
                200,
                {
                    "discord": {
                        "configured": bool(config.discord.bot_token and config.discord.channel_id),
                        "clientId": c.get("discord", {}).get("clientId", ""),
                        "botTokenMasked": _mask(c.get("discord", {}).get("botToken", "")),
                        "channelId": c.get("discord", {}).get("channelId", ""),
                        "channelName": c.get("discord", {}).get("channelName", ""),
                    },
                    "google": {
                        "appConfigured": bool(config.google_app.client_id and config.google_app.client_secret),
                        "connected": bool(config.google.refresh_token),
                    },
                    "notion": {
                        "configured": config.notion.enabled,
                        "apiKeyMasked": _mask(c.get("notion", {}).get("apiKey", "")),
                        "pageIds": config.notion.page_ids,
                        "databaseIds": config.notion.database_ids,
                    },
                },
            )

        if pathname == "/api/discord/guilds":
            bot_token = store.load().get("discord", {}).get("botToken")
            if not bot_token:
                return self._send_json(400, {"error": "먼저 봇 토큰을 저장하세요."})
            try:
                return self._send_json(200, {"guilds": discord_api.list_guilds(bot_token)})
            except Exception as err:
                return self._send_json(400, {"error": str(err)})

        if pathname == "/api/discord/channels":
            bot_token = store.load().get("discord", {}).get("botToken")
            guild_id = (query.get("guildId") or [None])[0]
            if not bot_token:
                return self._send_json(400, {"error": "먼저 봇 토큰을 저장하세요."})
            if not guild_id:
                return self._send_json(400, {"error": "guildId 가 필요합니다."})
            try:
                return self._send_json(200, {"channels": discord_api.list_text_channels(bot_token, guild_id)})
            except Exception as err:
                return self._send_json(400, {"error": str(err)})

        if pathname == "/api/notion/targets/available":
            api_key = store.load().get("notion", {}).get("apiKey")
            if not api_key:
                return self._send_json(400, {"error": "먼저 Notion API 키를 저장하세요."})
            try:
                return self._send_json(200, {"targets": notion.list_accessible_targets(api_key)})
            except Exception as err:
                return self._send_json(400, {"error": str(err)})

        self._send_json(404, {"error": "not found"})

    # ---- API: POST ----

    def _handle_api_post(self, pathname: str):
        try:
            body = self._read_json_body()
        except ValueError as err:
            return self._send_json(400, {"error": str(err)})

        if pathname == "/api/discord/token":
            client_id = body.get("clientId")
            bot_token = body.get("botToken")
            if not bot_token:
                return self._send_json(400, {"error": "botToken 이 필요합니다."})
            try:
                guilds = discord_api.list_guilds(bot_token)
                store.update_section("discord", {"clientId": client_id or "", "botToken": bot_token})
                return self._send_json(200, {"guilds": guilds})
            except Exception as err:
                return self._send_json(400, {"error": f"봇 토큰 확인 실패: {err}"})

        if pathname == "/api/discord/channel":
            channel_id = body.get("channelId")
            channel_name = body.get("channelName", "")
            if not channel_id:
                return self._send_json(400, {"error": "channelId 가 필요합니다."})
            store.update_section("discord", {"channelId": channel_id, "channelName": channel_name})
            return self._send_json(200, {"ok": True})

        if pathname == "/api/notion/key":
            api_key = body.get("apiKey")
            if not api_key:
                return self._send_json(400, {"error": "apiKey 가 필요합니다."})
            try:
                targets = notion.list_accessible_targets(api_key)
                store.update_section("notion", {"apiKey": api_key})
                return self._send_json(200, {"targets": targets})
            except Exception as err:
                return self._send_json(400, {"error": f"Notion 키 확인 실패: {err}"})

        if pathname == "/api/notion/targets":
            store.update_section(
                "notion", {"pageIds": body.get("pageIds", []), "databaseIds": body.get("databaseIds", [])}
            )
            return self._send_json(200, {"ok": True})

        self._send_json(404, {"error": "not found"})


def start() -> None:
    server = ThreadingHTTPServer(("localhost", config.setup_port), Handler)
    url = f"http://localhost:{config.setup_port}"
    print(f"[setup] 설정 마법사: {url}")

    threading.Timer(0.3, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    start()
