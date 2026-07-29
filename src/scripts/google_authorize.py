"""
브라우저 없이(원격 서버 등) Google Drive 연결을 해야 할 때 쓰는 CLI 대안.
평소에는 `python -m src.setup_server` 웹 마법사의 "Google 계정으로 로그인" 버튼을 쓰면 된다.
"""
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

from src import config, store
from src.services import google_drive


def main() -> None:
    if not config.google_app.client_id or not config.google_app.client_secret:
        print(".env 에 GOOGLE_APP_CLIENT_ID / GOOGLE_APP_CLIENT_SECRET 이 없습니다. README를 참고해 먼저 발급하세요.")
        sys.exit(1)

    redirect_uri = config.google_app.redirect_uri
    parsed_redirect = urlparse(redirect_uri)
    port = parsed_redirect.port or 80
    callback_path = parsed_redirect.path

    print("아래 URL을 브라우저에서 열어 Google 계정으로 로그인/동의를 완료하세요:\n")
    print(google_drive.generate_auth_url(), "\n")
    print(f"(로컬 {redirect_uri} 로 리디렉션을 기다리는 중...)")

    result: dict = {}

    class CallbackHandler(BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802
            url = urlparse(self.path)
            if url.path != callback_path:
                self.send_response(404)
                self.end_headers()
                return

            code = (parse_qs(url.query).get("code") or [None])[0]
            if not code:
                self.send_response(400)
                self.end_headers()
                self.wfile.write("code 파라미터가 없습니다.".encode("utf-8"))
                return

            try:
                result["tokens"] = google_drive.exchange_code(code)
            except Exception as err:
                result["error"] = str(err)
                self.send_response(500)
                self.end_headers()
                self.wfile.write("토큰 교환 실패".encode("utf-8"))
                return

            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write("<h1>인증 완료</h1>이 창은 닫아도 됩니다.".encode("utf-8"))

        def log_message(self, format, *args):  # noqa: A002 - 조용히
            pass

    server = HTTPServer(("localhost", port), CallbackHandler)
    server.handle_request()  # 콜백 요청 하나만 처리하고 종료
    server.server_close()

    if "error" in result:
        print(f"토큰 교환 중 오류: {result['error']}")
        sys.exit(1)

    tokens = result.get("tokens")
    if not tokens or not tokens.get("refresh_token"):
        print(
            "\nrefresh_token 이 발급되지 않았습니다. 이미 한 번 인가한 계정이면 Google 계정 설정에서"
            " 이 앱의 액세스 권한을 제거한 뒤 다시 시도하세요."
        )
        sys.exit(1)

    store.update_section("google", {"refreshToken": tokens["refresh_token"]})
    print("\nrefresh_token 을 data/config.json 에 저장했습니다.")


if __name__ == "__main__":
    main()
