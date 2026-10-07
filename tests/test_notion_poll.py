"""Notion 변경 감지 로직 (HTTP 호출은 notion_api 모킹)."""
import unittest
from types import SimpleNamespace
from unittest import mock

from src.services import notion


def _page(page_id, edited, title="문서"):
    return {
        "id": page_id,
        "url": f"https://notion.so/{page_id}",
        "last_edited_time": edited,
        "last_edited_by": {"id": "user-1"},
        "properties": {"Name": {"type": "title", "title": [{"plain_text": title}]}},
    }


class PollNotionTest(unittest.TestCase):
    def setUp(self):
        notion._user_name_cache.clear()
        cfg = SimpleNamespace(notion=SimpleNamespace(api_key="k", page_ids=["p1"], database_ids=["db1"]))
        self.patches = [
            mock.patch.object(notion, "config", cfg),
            mock.patch.object(notion.notion_api, "retrieve_user", return_value={"name": "홍길동"}),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()

    def _run(self, pages_by_id, db_pages, last):
        with mock.patch.object(notion.notion_api, "retrieve_page", side_effect=lambda k, pid: pages_by_id[pid]), \
             mock.patch.object(notion.notion_api, "query_database", return_value={"results": db_pages, "has_more": False}):
            return notion.poll_notion(last)

    def test_first_run_records_baseline_without_notifying(self):
        result = self._run({"p1": _page("p1", "t1")}, [_page("d1", "t1")], {})
        self.assertEqual(result["changes"], [])
        self.assertEqual(result["lastEditedTimes"], {"p1": "t1", "d1": "t1"})

    def test_changed_page_is_reported_once(self):
        last = {"p1": "t1", "d1": "t1"}
        result = self._run({"p1": _page("p1", "t2", "회의록")}, [_page("d1", "t1")], last)
        self.assertEqual(len(result["changes"]), 1)
        change = result["changes"][0]
        self.assertEqual(change["source"], "notion")
        self.assertEqual(change["title"], "회의록")
        self.assertEqual(change["editor"], "홍길동")
        self.assertEqual(change["editedAt"], "t2")
        self.assertEqual(result["lastEditedTimes"]["p1"], "t2")
        self.assertEqual(last["p1"], "t1", "input dict must not be mutated")

    def test_new_database_row_after_baseline_is_not_reported(self):
        # 기준선 이후 새로 생긴 행은 이전 값이 없으므로 기준선만 기록 (현재 동작)
        result = self._run({"p1": _page("p1", "t1")}, [_page("d1", "t1"), _page("d2", "t5")], {"p1": "t1", "d1": "t1"})
        self.assertEqual(result["changes"], [])
        self.assertEqual(result["lastEditedTimes"]["d2"], "t5")

    def test_failing_page_fetch_does_not_abort_poll(self):
        def boom(k, pid):
            raise RuntimeError("network")

        with mock.patch.object(notion.notion_api, "retrieve_page", side_effect=boom), \
             mock.patch.object(notion.notion_api, "query_database",
                               return_value={"results": [_page("d1", "t2")], "has_more": False}):
            result = notion.poll_notion({"d1": "t1"})
        self.assertEqual(len(result["changes"]), 1)


if __name__ == "__main__":
    unittest.main()
