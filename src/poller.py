import threading

from src import config, state
from src import discord_notifier as discord
from src.services import google_drive, notion


def _check_google_drive(current: dict) -> dict:
    if not config.google.enabled:
        return current

    page_token = current["google"].get("pageToken")
    if not page_token:
        # 최초 실행: 지금 이 시점을 기준선으로 잡고, 과거 변경 이력은 알리지 않는다.
        current["google"]["pageToken"] = google_drive.get_start_page_token()
        print("[google-drive] 최초 실행: 기준 pageToken 확보, 이후 변경분부터 알림")
        return current

    result = google_drive.poll_changes(page_token)
    for change in result["changes"]:
        discord.notify_change(change)
    if result["changes"]:
        print(f"[google-drive] {len(result['changes'])}건 알림 전송")

    current["google"]["pageToken"] = result["newPageToken"] or page_token
    return current


def _check_notion(current: dict) -> dict:
    if not config.notion.enabled:
        return current

    is_first_run = len(current["notion"]["lastEditedTimes"]) == 0
    result = notion.poll_notion(current["notion"]["lastEditedTimes"])

    for change in result["changes"]:
        discord.notify_change(change)
    if is_first_run:
        print("[notion] 최초 실행: 기준선 기록, 이후 변경분부터 알림")
    if result["changes"]:
        print(f"[notion] {len(result['changes'])}건 알림 전송")

    current["notion"]["lastEditedTimes"] = result["lastEditedTimes"]
    return current


def tick() -> None:
    current = state.load()

    try:
        current = _check_google_drive(current)
    except Exception as err:
        print(f"[google-drive] 폴링 실패: {err}")

    try:
        current = _check_notion(current)
    except Exception as err:
        print(f"[notion] 폴링 실패: {err}")

    state.save(current)


class Poller:
    def __init__(self, interval_ms: int):
        self._interval_s = interval_ms / 1000
        self._stop_event = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True)

    def _run(self) -> None:
        tick()  # 시작 즉시 1회 실행
        while not self._stop_event.wait(self._interval_s):
            tick()

    def start(self) -> "Poller":
        self._thread.start()
        return self

    def stop(self) -> None:
        self._stop_event.set()


def start(interval_ms: int) -> Poller:
    return Poller(interval_ms).start()
