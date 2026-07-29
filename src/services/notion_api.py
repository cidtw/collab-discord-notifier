"""Notion REST API를 표준 라이브러리(urllib)만으로 직접 호출한다."""
import json
import urllib.error
import urllib.request

API_BASE = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"


def _call(api_key: str, endpoint: str, method: str = "GET", body: dict | None = None) -> dict:
    headers = {"Authorization": f"Bearer {api_key}", "Notion-Version": NOTION_VERSION}
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(f"{API_BASE}{endpoint}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8") if e.fp else ""
        try:
            parsed = json.loads(text) if text else {}
        except ValueError:
            parsed = {}
        message = parsed.get("message") or f"Notion API {endpoint} 실패 ({e.code})"
        raise RuntimeError(message) from None


def retrieve_page(api_key: str, page_id: str) -> dict:
    return _call(api_key, f"/pages/{page_id}")


def query_database(api_key: str, database_id: str, start_cursor: str | None = None) -> dict:
    body = {"page_size": 100}
    if start_cursor:
        body["start_cursor"] = start_cursor
    return _call(api_key, f"/databases/{database_id}/query", method="POST", body=body)


def search(api_key: str, start_cursor: str | None = None) -> dict:
    body = {
        "page_size": 100,
        "sort": {"direction": "descending", "timestamp": "last_edited_time"},
    }
    if start_cursor:
        body["start_cursor"] = start_cursor
    return _call(api_key, "/search", method="POST", body=body)


def retrieve_user(api_key: str, user_id: str) -> dict:
    return _call(api_key, f"/users/{user_id}")
