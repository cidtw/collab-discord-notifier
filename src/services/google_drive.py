"""
googleapis / google-auth-library SDK 없이 OAuth2 + Drive REST API를 표준 라이브러리(urllib)만으로 호출한다.
"""
import urllib.parse

from src import config
from src.util.http_json import http_json

SCOPES = ["https://www.googleapis.com/auth/drive.metadata.readonly"]
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
DRIVE_API = "https://www.googleapis.com/drive/v3"


def generate_auth_url() -> str:
    params = {
        "client_id": config.google_app.client_id,
        "redirect_uri": config.google_app.redirect_uri,
        "response_type": "code",
        "access_type": "offline",
        "prompt": "consent",
        "scope": " ".join(SCOPES),
    }
    return f"{AUTH_URL}?{urllib.parse.urlencode(params)}"


def _post_form(body: dict) -> dict:
    encoded = urllib.parse.urlencode(body).encode("utf-8")
    return http_json(
        TOKEN_URL,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        body=encoded,
    )


def exchange_code(code: str) -> dict:
    """OAuth 콜백에서 받은 code를 access_token/refresh_token으로 교환한다."""
    return _post_form(
        {
            "code": code,
            "client_id": config.google_app.client_id,
            "client_secret": config.google_app.client_secret,
            "redirect_uri": config.google_app.redirect_uri,
            "grant_type": "authorization_code",
        }
    )


_cached_access_token: str | None = None
_cached_expires_at_ms: float = 0


def _now_ms() -> float:
    import time

    return time.time() * 1000


def get_access_token() -> str:
    global _cached_access_token, _cached_expires_at_ms

    if _cached_access_token and _now_ms() < _cached_expires_at_ms - 60_000:
        return _cached_access_token

    refresh_token = config.google.refresh_token
    if not refresh_token:
        raise RuntimeError("Google 계정이 연결되어 있지 않습니다. python -m src.setup_server 로 연결하세요.")

    data = _post_form(
        {
            "client_id": config.google_app.client_id,
            "client_secret": config.google_app.client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
    )

    _cached_access_token = data["access_token"]
    _cached_expires_at_ms = _now_ms() + data["expires_in"] * 1000
    return _cached_access_token


def _drive_get(endpoint: str, params: dict) -> dict:
    token = get_access_token()
    qs = urllib.parse.urlencode(params)
    return http_json(f"{DRIVE_API}{endpoint}?{qs}", headers={"Authorization": f"Bearer {token}"})


def get_start_page_token() -> str:
    data = _drive_get("/changes/startPageToken", {})
    return data["startPageToken"]


def poll_changes(page_token: str) -> dict:
    """저장된 pageToken 이후의 변경 사항을 모두 가져오고, 다음에 사용할 pageToken을 함께 반환한다."""
    changes = []
    token = page_token
    new_start_page_token = None

    while True:
        res = _drive_get(
            "/changes",
            {
                "pageToken": token,
                "pageSize": 100,
                "fields": (
                    "nextPageToken, newStartPageToken, "
                    "changes(fileId, removed, file(id, name, mimeType, modifiedTime, webViewLink, "
                    "trashed, lastModifyingUser))"
                ),
            },
        )

        for change in res.get("changes", []):
            file = change.get("file")
            if change.get("removed") or not file or file.get("trashed"):
                continue
            if file.get("mimeType") == "application/vnd.google-apps.folder":
                continue

            changes.append(
                {
                    "source": "google_drive",
                    "title": file.get("name"),
                    "url": file.get("webViewLink"),
                    "editor": (file.get("lastModifyingUser") or {}).get("displayName"),
                    "editedAt": file.get("modifiedTime"),
                }
            )

        token = res.get("nextPageToken")
        if res.get("newStartPageToken"):
            new_start_page_token = res["newStartPageToken"]

        if not token:
            break

    return {"changes": changes, "newPageToken": new_start_page_token}
