"""
Line-delimited JSON IPC Worker spawned by the server runtime.
Provides sub-millisecond Python NLP inference, slot optimization, and session analytics.
"""

from __future__ import annotations

import json
import os
import platform
import sys

from nlp_engine import MultilingualNlpEngine


def main() -> None:
    engine = MultilingualNlpEngine()

    # Announce readiness on stdout
    sys.stdout.write(
        json.dumps(
            {
                "type": "ready",
                "pythonVersion": platform.python_version(),
                "pid": os.getpid(),
            }
        )
        + "\n"
    )
    sys.stdout.flush()

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        req_id = None
        try:
            payload = json.loads(line)
            req_id = payload.get("id")
            action = payload.get("action")
            params = payload.get("params") or {}

            if action == "analyze":
                result = engine.analyze_utterance(
                    text=str(params.get("text", "")),
                    language_hint=str(params.get("languageHint", "auto")),
                    time_zone=str(params.get("timeZone", "Asia/Kolkata")),
                )
            elif action == "suggest_slots":
                result = engine.suggest_optimal_slots(
                    busy_slots=list(params.get("busySlots") or []),
                    target_date=params.get("targetDate"),
                    duration_minutes=int(params.get("durationMinutes", 30)),
                    time_zone=str(params.get("timeZone", "Asia/Kolkata")),
                    max_suggestions=int(params.get("maxSuggestions", 5)),
                )
            elif action == "status":
                result = {
                    **engine.get_status(),
                    "pythonVersion": platform.python_version(),
                    "pid": os.getpid(),
                }
            else:
                raise ValueError(f"Unknown action: {action}")

            response = {"id": req_id, "ok": True, "result": result}
        except Exception as exc:  # noqa: BLE001
            response = {"id": req_id, "ok": False, "error": str(exc)}

        sys.stdout.write(json.dumps(response) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
