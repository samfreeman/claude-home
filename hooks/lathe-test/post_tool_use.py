#!/usr/bin/env python3
"""
PostToolUse hook — logs what just happened and tests feedback injection.
Set LATHE_HOOK_FEEDBACK=1 to test injecting additionalContext.
"""
import sys
import json
import time
import os

LOG_DIR = os.path.expanduser("~/.claude/hooks/lathe-test")
LOG_FILE = os.path.join(LOG_DIR, "events.jsonl")
FEEDBACK = os.environ.get("LATHE_HOOK_FEEDBACK", "0") == "1"

def main():
    raw = sys.stdin.read()
    payload = {}
    try:
        if raw.strip():
            payload = json.loads(raw)
    except:
        payload = {"raw": raw[:500]}

    tool_name = payload.get("tool_name", "unknown")
    tool_input = payload.get("tool_input", {})
    tool_output = payload.get("tool_output", "")

    event = {
        "ts": time.time(),
        "iso": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "event": "PostToolUse",
        "tool": tool_name,
        "input_keys": list(tool_input.keys()) if isinstance(tool_input, dict) else [],
        "output_size": len(str(tool_output)),
        "output_preview": str(tool_output)[:200],
        "payload_size": len(raw)
    }

    os.makedirs(LOG_DIR, exist_ok=True)
    with open(LOG_FILE, "a") as f:
        f.write(json.dumps(event) + "\n")

    if FEEDBACK:
        result = {
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": f"[LATHE TEST] Observed {tool_name} — output was {len(str(tool_output))} chars"
            }
        }
        print(json.dumps(result))

    sys.exit(0)

if __name__ == "__main__":
    main()
