"""
setup 마법사가 저장하는 인스턴스별 자격 증명 저장소.
.env 는 앱을 배포하는 사람이 "한 번" 채우는 값(Google 공용 OAuth 클라이언트 등)만 담고,
팀 봇 토큰/채널/리프레시 토큰/Notion 키처럼 설치마다 달라지는 값은 여기 JSON 파일에 저장한다.
"""
import json
from pathlib import Path

CONFIG_PATH = Path(__file__).resolve().parent.parent / "data" / "config.json"


def load() -> dict:
    try:
        return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save(data: dict) -> dict:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    return data


def update_section(section: str, patch: dict) -> dict:
    """section 하나만 읽어서 수정한 뒤 다시 저장하는 편의 함수 (discord/google/notion 등)."""
    current = load()
    merged = {**current.get(section, {}), **patch}
    current[section] = merged
    save(current)
    return merged
