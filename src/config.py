"""
설정값이 두 종류로 나뉜다:
- googleApp 계열: 배포자가 .env 에 한 번만 채우는 값 (Google OAuth 클라이언트)
- discord/google/notion 계열: setup 마법사가 data/config.json 에 저장한 값 (설치별로 다름)
"""
import os

from src import store
from src.load_env import load_env

load_env()


def _list(value: str) -> list:
    return [v.strip() for v in (value or "").split(",") if v.strip()]


class GoogleApp:
    @property
    def client_id(self) -> str:
        return os.environ.get("GOOGLE_APP_CLIENT_ID", "")

    @property
    def client_secret(self) -> str:
        return os.environ.get("GOOGLE_APP_CLIENT_SECRET", "")

    @property
    def redirect_uri(self) -> str:
        return os.environ.get("GOOGLE_APP_REDIRECT_URI", "http://localhost:4600/auth/google/callback")


class Discord:
    @property
    def _data(self) -> dict:
        return store.load().get("discord", {})

    @property
    def client_id(self) -> str:
        return self._data.get("clientId", "")

    @property
    def bot_token(self) -> str:
        return self._data.get("botToken", "")

    @property
    def channel_id(self) -> str:
        return self._data.get("channelId", "")

    @property
    def enabled(self) -> bool:
        return bool(self.bot_token and self.channel_id)


class Google:
    @property
    def _data(self) -> dict:
        return store.load().get("google", {})

    @property
    def refresh_token(self) -> str:
        return self._data.get("refreshToken", "")

    @property
    def enabled(self) -> bool:
        return bool(google_app.client_id and google_app.client_secret and self.refresh_token)


class Notion:
    @property
    def _data(self) -> dict:
        return store.load().get("notion", {})

    @property
    def api_key(self) -> str:
        return self._data.get("apiKey", "")

    @property
    def page_ids(self) -> list:
        return self._data.get("pageIds", [])

    @property
    def database_ids(self) -> list:
        return self._data.get("databaseIds", [])

    @property
    def enabled(self) -> bool:
        return bool(self.api_key and (self.page_ids or self.database_ids))


google_app = GoogleApp()
discord = Discord()
google = Google()
notion = Notion()

poll_interval_ms = int(os.environ.get("POLL_INTERVAL_MS") or 120000)
setup_port = int(os.environ.get("SETUP_PORT") or 4600)
