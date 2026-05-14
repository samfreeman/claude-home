---
name: lathe:hook-test
description: Test CC hooks for Lathe. Activate, deactivate, or view hook test results.
allowed-tools: Bash Read
---

# Lathe Hook Test

Test which CC hook events actually fire, what payloads they carry, and whether blocking/redirection works.

## Usage

**Activate hooks** (requires CC restart after):
```bash
bash ~/.claude/hooks/lathe-test/activate.sh on
```

**View results:**
```bash
python3 ~/.claude/hooks/lathe-test/summary.py
```

**Deactivate hooks** (requires CC restart after):
```bash
bash ~/.claude/hooks/lathe-test/activate.sh off
```

**Test blocking** (set before activating):
```bash
export LATHE_HOOK_MODE=block
```

**Test feedback injection** (set before activating):
```bash
export LATHE_HOOK_FEEDBACK=1
```

## What It Tests

1. Which of the 12 hook events actually fire
2. What payload each event carries (keys, size, preview)
3. Which tools trigger Pre/PostToolUse
4. Whether exit code 2 blocks PreToolUse
5. Whether additionalContext injection works in PostToolUse
6. Session/subagent lifecycle events

## Files

```
~/.claude/hooks/lathe-test/
├── log_event.py       # Generic event logger (all hook types)
├── pre_tool_use.py    # PreToolUse with block/redirect modes
├── post_tool_use.py   # PostToolUse with feedback injection
├── summary.py         # Report generator
├── activate.sh        # Wire/unwire hooks in settings
└── events.jsonl       # Event log (created at runtime)
```
