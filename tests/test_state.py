import tempfile
import unittest
from pathlib import Path
from unittest import mock

from src import state


class StateTest(unittest.TestCase):
    def test_load_defaults_when_missing_or_corrupt_and_roundtrip(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "data" / "state.json"
            with mock.patch.object(state, "STATE_PATH", path):
                self.assertEqual(state.load(), state.DEFAULT_STATE)
                path.parent.mkdir(parents=True)
                path.write_text("{not json", encoding="utf-8")
                self.assertEqual(state.load(), state.DEFAULT_STATE)

                s = state.load()
                s["google"]["pageToken"] = "tok"
                s["notion"]["lastEditedTimes"]["p"] = "t"
                state.save(s)
                self.assertEqual(state.load(), s)
                # load() must return a fresh copy, not the module default
                self.assertIsNone(state.DEFAULT_STATE["google"]["pageToken"])


if __name__ == "__main__":
    unittest.main()
