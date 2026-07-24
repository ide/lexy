#!/usr/bin/env python3
"""Small, one-shot Lexus 21MM remote-control client."""

from __future__ import annotations

import argparse
import base64
import fcntl
import json
import os
import subprocess
import sys
import time
import uuid
from pathlib import Path


TOKEN_URL = (
    "https://login.lexusdriverslogin.com/oauth2/realms/root/realms/"
    "tmna-native/access_token"
)
API_ROOT = "https://onecdn.telematicsct.com"
VEHICLE_URL = f"{API_ROOT}/oneapi/v2/vehicle/guid"
STATUS_URL = f"{API_ROOT}/v1/remote/route/status"
COMMAND_URL = f"{API_ROOT}/v1/remote/route/command"
KEYCHAIN_ACCOUNT = "Lexus OneApp"
STATE_PATH = Path.home() / "Library/Application Support/Tuft/lexusctl/state.json"
LOCK_PATH = Path("/tmp/tuft-lexusctl-command.lock")


def now_epoch() -> float:
    return time.time()


class Keychain:
    service_prefix = "tuft.lexus."

    def get(self, name: str) -> str:
        result = subprocess.run(
            [
                "security",
                "find-generic-password",
                "-a",
                KEYCHAIN_ACCOUNT,
                "-s",
                self.service_prefix + name,
                "-w",
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        return result.stdout.rstrip("\n")

    def set(self, name: str, value: str) -> None:
        subprocess.run(
            [
                "security",
                "add-generic-password",
                "-U",
                "-a",
                KEYCHAIN_ACCOUNT,
                "-s",
                self.service_prefix + name,
                "-w",
                value,
            ],
            check=True,
            capture_output=True,
            text=True,
        )


class Transport:
    def form(self, url: str, data: dict[str, str]) -> dict:
        arguments = [
            "curl",
            "-sS",
            "--max-time",
            "120",
            "-X",
            "POST",
            url,
            "-H",
            "Content-Type: application/x-www-form-urlencoded",
        ]
        for name, value in data.items():
            arguments.extend(["--data-urlencode", f"{name}={value}"])
        return self._curl(arguments)

    def json(
        self,
        url: str,
        *,
        headers: dict[str, str],
        method: str,
        body: dict | None = None,
    ) -> dict:
        arguments = [
            "curl",
            "-sS",
            "--max-time",
            "120",
            "-X",
            method,
            url,
        ]
        for name, value in headers.items():
            arguments.extend(["-H", f"{name}: {value}"])
        if body is not None:
            arguments.extend(
                ["--data-binary", json.dumps(body, separators=(",", ":"))]
            )
        return self._curl(arguments)

    @staticmethod
    def _curl(arguments: list[str]) -> dict:
        result = subprocess.run(
            arguments + ["-w", "\n%{http_code}"],
            capture_output=True,
            text=True,
            check=False,
        )
        body, separator, code = result.stdout.rpartition("\n")
        if result.returncode or not separator:
            raise RuntimeError(f"Network error: {result.stderr.strip()[:300]}")
        if not code.startswith("2"):
            raise RuntimeError(f"HTTP {code}: {body[:300]}")
        return json.loads(body)


def refresh_tokens(keychain: Keychain, transport: Transport) -> dict:
    refresh_token = keychain.get("refresh-token")
    tokens = transport.form(
        TOKEN_URL,
        {
            "grant_type": "refresh_token",
            "client_id": "oneappsdkclient",
            "refresh_token": refresh_token,
        },
    )
    if "access_token" not in tokens or "id_token" not in tokens:
        raise RuntimeError(f"Token refresh failed: {tokens.get('error', 'unknown error')}")
    if tokens.get("refresh_token"):
        keychain.set("refresh-token", tokens["refresh_token"])
    return tokens


def jwt_claim(token: str, name: str) -> str:
    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    claims = json.loads(base64.urlsafe_b64decode(payload))
    value = claims.get(name)
    if not value:
        raise RuntimeError(f"Missing ID-token claim: {name}")
    return value


def base_headers(access_token: str, id_token: str, api_key: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {access_token}",
        "X-API-KEY": api_key,
        "X-LOCALE": "en-US",
        "X-GUID": jwt_claim(id_token, "extension_tmsguid"),
        "X-APPBRAND": "L",
        "X-OSVERSION": "16",
        "X-APPVERSION": "3.4.0",
        "X-OSNAME": "Android",
        "X-CHANNEL": "ONEAPP",
        "X-DEVICE-TIMEZONE": "PST",
        "X-CORRELATIONID": str(uuid.uuid4()).upper(),
        "Content-Type": "application/json",
    }


def vehicle_headers(headers: dict[str, str], vehicle: dict) -> dict[str, str]:
    return headers | {
        "VIN": vehicle["vin"],
        "X-GENERATION": vehicle["generation"],
        "X-BRAND": vehicle["brand"],
    }


def load_vehicle(
    keychain: Keychain, transport: Transport, headers: dict[str, str]
) -> dict:
    try:
        return json.loads(keychain.get("vehicle"))
    except (subprocess.CalledProcessError, json.JSONDecodeError, KeyError):
        response = transport.json(VEHICLE_URL, headers=headers, method="GET")
        vehicles = response.get("payload") or []
        if len(vehicles) != 1:
            raise RuntimeError(f"Expected one vehicle, received {len(vehicles)}")
        source = vehicles[0]
        vehicle = {
            "vin": source["vin"],
            "generation": source["generation"],
            "brand": source["brand"],
        }
        keychain.set("vehicle", json.dumps(vehicle, separators=(",", ":")))
        return vehicle


def door_states(response: dict) -> list[str]:
    states = []
    status = response.get("payload", {}).get("status", {})
    for group in status.get("vehicleStatus", []):
        for section in group.get("sections", []):
            if "door" not in section.get("section", "").lower():
                continue
            for value in section.get("values", []):
                if value.get("value") in {"Locked", "Unlocked"}:
                    states.append(value["value"])
    return states


def occurrence(response: dict) -> str:
    return response.get("payload", {}).get("status", {}).get("occurrenceDate", "")


def guard_cooldown(state_path: Path, cooldown_seconds: int = 90) -> None:
    if not state_path.exists():
        return
    try:
        state = json.loads(state_path.read_text())
        remaining = cooldown_seconds - (now_epoch() - state["submitted_at"])
    except (json.JSONDecodeError, KeyError, OSError):
        return
    if remaining > 0:
        raise RuntimeError(f"Command cooldown active for {remaining:.0f}s")


def save_submission(state_path: Path, action: str) -> None:
    state_path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    state_path.write_text(
        json.dumps({"submitted_at": now_epoch(), "action": action}),
        encoding="utf-8",
    )
    os.chmod(state_path, 0o600)


def run_command(
    transport: Transport,
    *,
    headers: dict[str, str],
    action: str,
    state_path: Path = STATE_PATH,
    cooldown_seconds: int = 90,
    poll_seconds: int = 5,
    max_polls: int = 18,
) -> dict:
    guard_cooldown(state_path, cooldown_seconds)
    before = transport.json(STATUS_URL, headers=headers, method="GET")
    desired = "Locked" if action == "lock" else "Unlocked"

    save_submission(state_path, action)
    # Deliberately one POST only. Network failures are not retried.
    command = transport.json(
        COMMAND_URL,
        headers=headers,
        method="POST",
        body={"command": f"door-{action}", "autoFixPopup": False},
    )
    if command.get("payload", {}).get("returnCode") != "000000":
        raise RuntimeError("Lexus rejected the command")

    before_time = occurrence(before)
    for _ in range(max_polls):
        if poll_seconds:
            time.sleep(poll_seconds)
        current = transport.json(STATUS_URL, headers=headers, method="GET")
        states = door_states(current)
        if states and all(value == desired for value in states):
            if not before_time or occurrence(current) > before_time:
                return {
                    "submitted": True,
                    "verified": True,
                    "already": False,
                    "occurrenceDate": occurrence(current),
                }
    return {"submitted": True, "verified": False, "already": False}


def acquire_lock():
    handle = LOCK_PATH.open("w")
    try:
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError as error:
        raise RuntimeError("Another Lexus command is already running") from error
    return handle


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="lexusctl")
    parser.add_argument("action", choices=["lock", "unlock", "status"])
    args = parser.parse_args(argv)

    keychain = Keychain()
    transport = Transport()
    tokens = refresh_tokens(keychain, transport)
    headers = base_headers(
        tokens["access_token"], tokens["id_token"], keychain.get("api-key")
    )
    vehicle = load_vehicle(keychain, transport, headers)
    headers = vehicle_headers(headers, vehicle)

    if args.action == "status":
        response = transport.json(STATUS_URL, headers=headers, method="GET")
        print(
            json.dumps(
                {
                    "occurrenceDate": occurrence(response),
                    "doors": door_states(response),
                }
            )
        )
        return 0

    command_lock = acquire_lock()
    try:
        result = run_command(transport, headers=headers, action=args.action)
    finally:
        command_lock.close()
    print(json.dumps(result))
    return 0 if result["verified"] else 2


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        raise SystemExit(1)
