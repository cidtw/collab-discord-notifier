"""외부 패키지(python-dotenv) 없이 .env 를 읽는 최소 구현. KEY=VALUE, # 주석, 빈 줄만 지원."""
import os
from pathlib import Path


def load_env(env_path: str | None = None) -> None:
    path = Path(env_path) if env_path else Path(__file__).resolve().parent.parent / ".env"
    try:
        content = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return

    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip()
        is_quoted = (value.startswith('"') and value.endswith('"')) or (
            value.startswith("'") and value.endswith("'")
        )
        if is_quoted:
            value = value[1:-1]

        os.environ.setdefault(key, value)
