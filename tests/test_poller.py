"""poller.tick: 소스별 폴링 → Discord 알림 → 상태 저장 흐름 (외부 호출 모킹)."""
import unittest
from types import SimpleNamespace
from unittest import mock

from src import poller


def _state(page_token=None, notion_times=None):
    return {"google": {"pageToken": page_token}, "notion": {"lastEditedTimes": notion_times or {}}}


class TickTest(unittest.TestCase):
    def setUp(self):
        self.cfg = SimpleNamespace(google=SimpleNamespace(enabled=True), notion=SimpleNamespace(enabled=True))
        self.saved = []
        self.notified = []
        self.patches = [
            mock.patch.object(poller, "config", self.cfg),
            mock.patch.object(poller.state, "save", side_effect=self.saved.append),
            mock.patch.object(poller.discord, "notify_change", side_effect=self.notified.append),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()

    def test_google_first_run_only_takes_start_token(self):
        with mock.patch.object(poller.state, "load", return_value=_state()), \
             mock.patch.object(poller.google_drive, "get_start_page_token", return_value="tok-1"), \
             mock.patch.object(poller.google_drive, "poll_changes") as poll_changes, \
             mock.patch.object(poller.notion, "poll_notion", return_value={"changes": [], "lastEditedTimes": {}}):
            poller.tick()
        poll_changes.assert_not_called()
        self.assertEqual(self.notified, [])
        self.assertEqual(self.saved[-1]["google"]["pageToken"], "tok-1")

    def test_changes_are_notified_and_tokens_advanced(self):
        drive_change = {"source": "google-drive", "title": "a"}
        notion_change = {"source": "notion", "title": "b"}
        with mock.patch.object(poller.state, "load", return_value=_state("tok-1", {"p": "t1"})), \
             mock.patch.object(poller.google_drive, "poll_changes",
                               return_value={"changes": [drive_change], "newPageToken": "tok-2"}), \
             mock.patch.object(poller.notion, "poll_notion",
                               return_value={"changes": [notion_change], "lastEditedTimes": {"p": "t2"}}):
            poller.tick()
        self.assertEqual(self.notified, [drive_change, notion_change])
        self.assertEqual(self.saved[-1], _state("tok-2", {"p": "t2"}))

    def test_missing_new_page_token_keeps_previous(self):
        with mock.patch.object(poller.state, "load", return_value=_state("tok-1")), \
             mock.patch.object(poller.google_drive, "poll_changes", return_value={"changes": [], "newPageToken": None}), \
             mock.patch.object(poller.notion, "poll_notion", return_value={"changes": [], "lastEditedTimes": {}}):
            poller.tick()
        self.assertEqual(self.saved[-1]["google"]["pageToken"], "tok-1")

    def test_one_source_failing_does_not_block_the_other_and_state_is_saved(self):
        notion_change = {"source": "notion", "title": "b"}
        with mock.patch.object(poller.state, "load", return_value=_state("tok-1", {"p": "t1"})), \
             mock.patch.object(poller.google_drive, "poll_changes", side_effect=RuntimeError("drive down")), \
             mock.patch.object(poller.notion, "poll_notion",
                               return_value={"changes": [notion_change], "lastEditedTimes": {"p": "t2"}}):
            poller.tick()
        self.assertEqual(self.notified, [notion_change])
        self.assertEqual(self.saved[-1], _state("tok-1", {"p": "t2"}))

    def test_disabled_sources_are_skipped(self):
        self.cfg.google.enabled = False
        self.cfg.notion.enabled = False
        with mock.patch.object(poller.state, "load", return_value=_state()), \
             mock.patch.object(poller.google_drive, "get_start_page_token") as start, \
             mock.patch.object(poller.notion, "poll_notion") as poll_notion:
            poller.tick()
        start.assert_not_called()
        poll_notion.assert_not_called()


if __name__ == "__main__":
    unittest.main()
