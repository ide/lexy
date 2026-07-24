import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from tools import lexusctl


class FakeKeychain:
    def __init__(self, values):
        self.values = dict(values)

    def get(self, name):
        return self.values[name]

    def set(self, name, value):
        self.values[name] = value


class LexusCtlTests(unittest.TestCase):
    def test_refresh_rotates_saved_refresh_token(self):
        keychain = FakeKeychain({"refresh-token": "old"})
        transport = mock.Mock()
        transport.form.return_value = {
            "access_token": "access",
            "id_token": "id",
            "refresh_token": "new",
        }

        tokens = lexusctl.refresh_tokens(keychain, transport)

        self.assertEqual(tokens["access_token"], "access")
        self.assertEqual(keychain.values["refresh-token"], "new")

    def test_command_is_submitted_once_and_verified(self):
        transport = mock.Mock()
        transport.json.side_effect = [
            {"payload": {"status": status("Unlocked", "2026-07-23T19:00:00Z")}},
            {"payload": {"returnCode": "000000"}},
            {"payload": {"status": status("Locked", "2026-07-23T19:00:05Z")}},
        ]
        with tempfile.TemporaryDirectory() as directory:
            result = lexusctl.run_command(
                transport,
                headers={},
                action="lock",
                state_path=Path(directory) / "state.json",
                poll_seconds=0,
                max_polls=1,
            )

        posts = [
            call
            for call in transport.json.call_args_list
            if call.kwargs.get("method") == "POST"
        ]
        self.assertEqual(len(posts), 1)
        self.assertTrue(result["verified"])

    def test_recent_command_is_not_resubmitted(self):
        with tempfile.TemporaryDirectory() as directory:
            state_path = Path(directory) / "state.json"
            state_path.write_text(json.dumps({"submitted_at": lexusctl.now_epoch()}))
            with self.assertRaisesRegex(RuntimeError, "cooldown"):
                lexusctl.guard_cooldown(state_path, cooldown_seconds=90)

    def test_explicit_command_is_sent_even_if_snapshot_matches(self):
        transport = mock.Mock()
        transport.json.side_effect = [
            {"payload": {"status": status("Locked", "2026-07-23T19:00:00Z")}},
            {"payload": {"returnCode": "000000"}},
            {"payload": {"status": status("Locked", "2026-07-23T19:00:05Z")}},
        ]
        with tempfile.TemporaryDirectory() as directory:
            result = lexusctl.run_command(
                transport,
                headers={},
                action="lock",
                state_path=Path(directory) / "state.json",
                poll_seconds=0,
                max_polls=1,
            )
        posts = [
            call
            for call in transport.json.call_args_list
            if call.kwargs.get("method") == "POST"
        ]
        self.assertEqual(len(posts), 1)
        self.assertTrue(result["verified"])


def status(lock_state, occurrence):
    return {
        "occurrenceDate": occurrence,
        "vehicleStatus": [
            {
                "category": "Doors",
                "sections": [
                    {
                        "section": "Door",
                        "values": [
                            {"value": "Closed", "status": 0},
                            {"value": lock_state, "status": 0},
                        ],
                    }
                ],
            }
        ],
    }


if __name__ == "__main__":
    unittest.main()
