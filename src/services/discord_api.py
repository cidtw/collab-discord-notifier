"""
Discord REST API를 표준 라이브러리(urllib)만으로 직접 호출한다. 이 봇은 게이트웨이(실시간 이벤트)를
들을 필요가 없고 메시지 전송/조회만 하면 되므로 discord.py 같은 SDK가 필요 없다.
"""
import json
import urllib.error
import urllib.request

API_BASE = "https://discord.com/api/v10"
TEXTLIKE_CHANNEL_TYPES = {0, 5}  # GUILD_TEXT, GUILD_ANNOUNCEMENT

# Discord API 문서가 권장하는 형식의 User-Agent. 이게 없으면(=urllib 기본 UA) Cloudflare가
# 봇 트래픽으로 오인해 요청 자체를 403(에러코드 1010)으로 차단한다.
USER_AGENT = "DiscordBot (https://github.com/cidtw/collab-discord-notifier, 1.0)"


def _call(bot_token: str, endpoint: str, method: str = "GET", body: dict | None = None):
    headers = {"Authorization": f"Bot {bot_token}", "User-Agent": USER_AGENT}
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(f"{API_BASE}{endpoint}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as res:
            if res.status == 204:
                return None
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8") if e.fp else ""
        raise RuntimeError(f"Discord API {endpoint} 실패 ({e.code}): {text}") from None


def get_self(bot_token: str) -> dict:
    """토큰 유효성 확인 + 봇 자신의 정보"""
    return _call(bot_token, "/users/@me")


def list_guilds(bot_token: str) -> list:
    """봇이 초대되어 있는 서버 목록"""
    guilds = _call(bot_token, "/users/@me/guilds")
    return [{"id": g["id"], "name": g["name"]} for g in guilds]


def list_text_channels(bot_token: str, guild_id: str) -> list:
    """특정 서버의 텍스트 채널 목록"""
    channels = _call(bot_token, f"/guilds/{guild_id}/channels")
    text_channels = [c for c in channels if c.get("type") in TEXTLIKE_CHANNEL_TYPES]
    text_channels.sort(key=lambda c: c.get("position", 0))
    return [{"id": c["id"], "name": c["name"]} for c in text_channels]


def send_message(bot_token: str, channel_id: str, payload: dict):
    """채널에 메시지(임베드 포함) 전송"""
    return _call(bot_token, f"/channels/{channel_id}/messages", method="POST", body=payload)
