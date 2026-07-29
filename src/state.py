"""폴링 진행 상태(Google pageToken, Notion last_edited_time)를 저장하는 모듈."""
import json
from pathlib import Path

STATE_PATH = Path(__file__).resolve().parent.parent / "data" / "state.json"

DEFAULT_STATE = {
    "google": {"pageToken": None},
    "notion": {"lastEditedTimes": {}},
}


def load() -> dict:
    try:
        parsed = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return json.loads(json.dumps(DEFAULT_STATE))

    google = {**DEFAULT_STATE["google"], **parsed.get("google", {})}
    notion = {
        **DEFAULT_STATE["notion"],
        **parsed.get("notion", {}),
        "lastEditedTimes": dict(parsed.get("notion", {}).get("lastEditedTimes", {})),
    }
    return {"google": google, "notion": notion}


def save(state: dict) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")
