from src import config
from src.services import notion_api

_user_name_cache: dict = {}


def _resolve_user_name(api_key: str, user_id: str | None) -> str | None:
    if not user_id:
        return None
    if user_id in _user_name_cache:
        return _user_name_cache[user_id]
    try:
        user = notion_api.retrieve_user(api_key, user_id)
        name = user.get("name") or (user.get("person") or {}).get("email") or user_id
        _user_name_cache[user_id] = name
        return name
    except Exception:
        return None


def _extract_title(page: dict) -> str:
    for prop in (page.get("properties") or {}).values():
        if prop.get("type") == "title":
            text = "".join(t.get("plain_text", "") for t in prop.get("title") or [])
            return text or "(제목 없음)"
    return "(제목 없음)"


def _page_to_change(api_key: str, page: dict) -> dict:
    return {
        "source": "notion",
        "title": _extract_title(page),
        "url": page.get("url"),
        "editor": _resolve_user_name(api_key, (page.get("last_edited_by") or {}).get("id")),
        "editedAt": page.get("last_edited_time"),
    }


def _fetch_all_database_pages(api_key: str, database_id: str) -> list:
    pages = []
    cursor = None
    while True:
        res = notion_api.query_database(api_key, database_id, cursor)
        pages.extend(res.get("results", []))
        cursor = res.get("next_cursor") if res.get("has_more") else None
        if not cursor:
            break
    return pages


def list_accessible_targets(api_key: str) -> list:
    """이 Integration이 현재 공유(Share)받은 페이지/데이터베이스 목록을 가져온다."""
    results = []
    cursor = None
    while True:
        res = notion_api.search(api_key, cursor)
        for item in res.get("results", []):
            if item.get("object") == "database":
                title = "".join(t.get("plain_text", "") for t in item.get("title") or []) or "(제목 없음)"
                results.append({"id": item["id"], "type": "database", "title": title, "url": item.get("url")})
            elif item.get("object") == "page":
                results.append(
                    {"id": item["id"], "type": "page", "title": _extract_title(item), "url": item.get("url")}
                )
        cursor = res.get("next_cursor") if res.get("has_more") else None
        if not cursor:
            break
    return results


def poll_notion(last_edited_times: dict) -> dict:
    """config.notion.page_ids / database_ids 를 폴링해 last_edited_time 이 바뀐 항목을 찾는다."""
    api_key = config.notion.api_key
    changes = []
    updated = dict(last_edited_times)
    all_pages = []

    for page_id in config.notion.page_ids:
        try:
            all_pages.append(notion_api.retrieve_page(api_key, page_id))
        except Exception as err:
            print(f"[notion] 페이지 {page_id} 조회 실패: {err}")

    for database_id in config.notion.database_ids:
        try:
            all_pages.extend(_fetch_all_database_pages(api_key, database_id))
        except Exception as err:
            print(f"[notion] 데이터베이스 {database_id} 조회 실패: {err}")

    for page in all_pages:
        prev = updated.get(page["id"])
        if prev != page.get("last_edited_time"):
            if prev is not None:
                # 최초 실행이 아닐 때만 알림 (첫 실행은 기준선만 기록)
                changes.append(_page_to_change(api_key, page))
            updated[page["id"]] = page.get("last_edited_time")

    return {"changes": changes, "lastEditedTimes": updated}
