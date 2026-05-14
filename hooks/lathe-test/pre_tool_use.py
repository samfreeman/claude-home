#!/usr/bin/env python3
"""
PreToolUse hook — logs and optionally tests blocking/redirection.
Set LATHE_HOOK_MODE=block to test blocking.
Set LATHE_HOOK_MODE=redirect to test input rewriting.
Default: observe only.
"""
import sys
import json
import time
import os

LOG_DIR = os.path.expanduser("~/.claude/hooks/lathe-test")
LOG_FILE = os.path.join(LOG_DIR, "events.jsonl")
MODE = os.environ.get("LATHE_HOOK_MODE", "observe")

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

    event = {
        "ts": time.time(),
        "iso": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "event": "PreToolUse",
        "tool": tool_name,
        "mode": MODE,
        "input_keys": list(tool_input.keys()) if isinstance(tool_input, dict) else [],
        "payload_size": len(raw),
        "payload_preview": raw[:300]
    }

    os.makedirs(LOG_DIR, exist_ok=True)
    with open(LOG_FILE, "a") as f:
        f.write(json.dumps(event) + "\n")

    if MODE == "block" and tool_name == "Bash":
        # Test: block all bash commands
        result = {
            "decision": "block",
            "reason": "[LATHE TEST] Blocking Bash for testing purposes"
        }
        print(json.dumps(result))
        sys.exit(2)

    elif MODE == "redirect":
        # Test: inject context without blocking
        result = {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "allow",
                "additionalContext": "[LATHE TEST] Hook observed this tool call"
            }
        }
        print(json.dumps(result))
        sys.exit(0)

    # Default: observe only
    sys.exit(0)

if __name__ == "__main__":
    main()
