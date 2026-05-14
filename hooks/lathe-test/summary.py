#!/usr/bin/env python3
"""
Lathe Hook Test — Summary Report
Reads events.jsonl and shows what fired, what didn't, latency patterns.
"""
import json
import os
import sys
from collections import defaultdict

LOG_FILE = os.path.expanduser("~/.claude/hooks/lathe-test/events.jsonl")

def main():
    if not os.path.exists(LOG_FILE):
        print("No events logged yet. Wire up hooks and use CC normally.")
        return

    events = []
    with open(LOG_FILE) as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    events.append(json.loads(line))
                except:
                    pass

    if not events:
        print("Event log is empty.")
        return

    # Group by event type
    by_type = defaultdict(list)
    for e in events:
        by_type[e.get("event", "unknown")].append(e)

    # Group by tool
    by_tool = defaultdict(int)
    for e in events:
        tool = e.get("tool", "none")
        if tool:
            by_tool[tool] += 1

    # All known CC hook events
    all_events = [
        "SessionStart", "SessionEnd",
        "UserPromptSubmit", "Stop", "StopFailure",
        "PreToolUse", "PostToolUse", "PostToolUseFailure",
        "SubagentStart", "SubagentStop",
        "Notification", "PreCompact", "PermissionRequest"
    ]

    print("=" * 60)
    print("LATHE HOOK TEST — SUMMARY")
    print("=" * 60)
    print(f"\nTotal events captured: {len(events)}")
    print(f"Time span: {events[0].get('iso', '?')} → {events[-1].get('iso', '?')}")

    print(f"\n{'Event Type':<25} {'Count':>6}  Status")
    print("-" * 50)
    for evt in all_events:
        count = len(by_type.get(evt, []))
        status = "✅ FIRED" if count > 0 else "❌ NOT SEEN"
        print(f"{evt:<25} {count:>6}  {status}")

    # Unknown events
    for evt in by_type:
        if evt not in all_events:
            count = len(by_type[evt])
            print(f"{evt:<25} {count:>6}  ⚠️  UNEXPECTED")

    print(f"\n{'Tool':<30} {'Count':>6}")
    print("-" * 40)
    for tool, count in sorted(by_tool.items(), key=lambda x: -x[1]):
        print(f"{tool:<30} {count:>6}")

    # Timing analysis for PreToolUse/PostToolUse pairs
    pre_times = {}
    post_times = {}
    for e in events:
        ts = e.get("ts", 0)
        tool = e.get("tool", "")
        if e.get("event") == "PreToolUse" and tool:
            pre_times[tool] = pre_times.get(tool, [])
            pre_times[tool].append(ts)
        elif e.get("event") == "PostToolUse" and tool:
            post_times[tool] = post_times.get(tool, [])
            post_times[tool].append(ts)

    # Check for blocking/redirect tests
    blocked = [e for e in events if e.get("mode") == "block"]
    redirected = [e for e in events if e.get("mode") == "redirect"]
    if blocked:
        print(f"\n🚫 Block tests: {len(blocked)} events")
    if redirected:
        print(f"↪️  Redirect tests: {len(redirected)} events")

    # Show recent events
    print(f"\n--- Last 10 events ---")
    for e in events[-10:]:
        evt = e.get("event", "?")
        tool = e.get("tool", "")
        iso = e.get("iso", "?")
        mode = e.get("mode", "")
        suffix = f" [{mode}]" if mode else ""
        tool_str = f" → {tool}" if tool else ""
        print(f"  {iso}  {evt}{tool_str}{suffix}")

    print(f"\nLog: {LOG_FILE}")
    print(f"Clear with: rm {LOG_FILE}")

if __name__ == "__main__":
    main()
