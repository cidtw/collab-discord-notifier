"""urllib.request 로 JSON API를 호출하는 공용 헬퍼. google_drive.py 에서 쓴다."""
import json
import urllib.error
import urllib.request


class HttpJsonError(Exception):
    def __init__(self, message: str, status: int | None = None, body=None):
        super().__init__(message)
        self.status = status
        self.body = body


def http_json(url: str, method: str = "GET", headers: dict | None = None, body: bytes | None = None) -> dict:
    req = urllib.request.Request(url, data=body, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req) as res:
            text = res.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8") if e.fp else ""
        data = _parse_json(text)
        message = (
            data.get("error_description")
            or data.get("message")
            or data.get("error")
            or data.get("raw")
            or f"HTTP {e.code}"
        )
        raise HttpJsonError(str(message), status=e.code, body=data) from None

    return _parse_json(text)


def _parse_json(text: str) -> dict:
    if not text:
        return {}
    try:
        return json.loads(text)
    except ValueError:
        return {"raw": text}
