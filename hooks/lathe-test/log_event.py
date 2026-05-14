#!/usr/bin/env python3
"""
Lathe Hook Tester — logs every CC hook event to ~/.claude/hooks/lathe-test/events.jsonl
Run /lathe:hook-test to see results.
"""
import sys
import json
import time
import os

LOG_DIR = os.path.expanduser("~/.claude/hooks/lathe-test")
LOG_FILE = os.path.join(LOG_DIR, "events.jsonl")

def main():
    event_type = os.environ.get("CLAUDE_HOOK_EVENT", "unknown")
    tool_name = os.environ.get("CLAUDE_TOOL_NAME", "")
    session_id = os.environ.get("CLAUDE_SESSION_ID", "")
    
    # Read stdin payload
    payload = {}
    try:
        raw = sys.stdin.read()
        if raw.strip():
            payload = json.loads(raw)
    except:
        payload = {"raw": raw[:500] if raw else "empty"}
    
    # Build event record
    event = {
        "ts": time.time(),
        "iso": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "event": event_type,
        "tool": tool_name,
        "session": session_id,
        "payload_keys": list(payload.keys()) if isinstance(payload, dict) else [],
        "payload_size": len(json.dumps(payload)),
        "payload_preview": json.dumps(payload)[:300]
    }
    
    os.makedirs(LOG_DIR, exist_ok=True)
    with open(LOG_FILE, "a") as f:
        f.write(json.dumps(event) + "\n")
    
    # Always allow — we're just observing
    sys.exit(0)

if __name__ == "__main__":
    main()
