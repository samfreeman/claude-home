#!/bin/bash
# Lathe Hook Test — Setup/Teardown
# Usage: bash activate.sh [on|off|status]

HOOKS_DIR="$HOME/.claude/hooks/lathe-test"
SETTINGS="$HOME/.claude/settings.json"
BACKUP="$HOME/.claude/settings.json.pre-hooktest"

ACTION="${1:-status}"

HOOK_CONFIG='{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "CLAUDE_HOOK_EVENT=PreToolUse python3 ~/.claude/hooks/lathe-test/pre_tool_use.py"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "CLAUDE_HOOK_EVENT=PostToolUse python3 ~/.claude/hooks/lathe-test/post_tool_use.py"
          }
        ]
      }
    ],
    "PostToolUseFailure": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "CLAUDE_HOOK_EVENT=PostToolUseFailure python3 ~/.claude/hooks/lathe-test/log_event.py"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "CLAUDE_HOOK_EVENT=UserPromptSubmit python3 ~/.claude/hooks/lathe-test/log_event.py"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "CLAUDE_HOOK_EVENT=Stop python3 ~/.claude/hooks/lathe-test/log_event.py"
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "CLAUDE_HOOK_EVENT=SessionStart python3 ~/.claude/hooks/lathe-test/log_event.py"
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "CLAUDE_HOOK_EVENT=SessionEnd python3 ~/.claude/hooks/lathe-test/log_event.py"
          }
        ]
      }
    ],
    "SubagentStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "CLAUDE_HOOK_EVENT=SubagentStart python3 ~/.claude/hooks/lathe-test/log_event.py"
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "CLAUDE_HOOK_EVENT=SubagentStop python3 ~/.claude/hooks/lathe-test/log_event.py"
          }
        ]
      }
    ],
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "CLAUDE_HOOK_EVENT=Notification python3 ~/.claude/hooks/lathe-test/log_event.py"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "CLAUDE_HOOK_EVENT=PreCompact python3 ~/.claude/hooks/lathe-test/log_event.py"
          }
        ]
      }
    ],
    "PermissionRequest": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "CLAUDE_HOOK_EVENT=PermissionRequest python3 ~/.claude/hooks/lathe-test/log_event.py"
          }
        ]
      }
    ]
  }
}'

case "$ACTION" in
  on)
    # Backup existing settings
    if [ -f "$SETTINGS" ]; then
      cp "$SETTINGS" "$BACKUP"
      echo "Backed up existing settings to $BACKUP"
      # Merge hooks into existing settings
      python3 -c "
import json, sys
existing = json.load(open('$SETTINGS'))
hooks = json.loads('''$HOOK_CONFIG''')
existing['hooks'] = hooks['hooks']
json.dump(existing, open('$SETTINGS', 'w'), indent=2)
print('Hooks merged into existing settings')
"
    else
      echo "$HOOK_CONFIG" | python3 -c "import json,sys; json.dump(json.load(sys.stdin), open('$SETTINGS','w'), indent=2)"
      echo "Created settings with hooks"
    fi
    # Clear old logs
    rm -f "$HOOKS_DIR/events.jsonl"
    echo "✅ Hook test ON — restart CC session to activate"
    echo "   Logs: $HOOKS_DIR/events.jsonl"
    echo "   Summary: python3 $HOOKS_DIR/summary.py"
    ;;
  off)
    if [ -f "$BACKUP" ]; then
      mv "$BACKUP" "$SETTINGS"
      echo "✅ Hook test OFF — restored original settings"
    else
      # Remove hooks key from settings
      python3 -c "
import json
s = json.load(open('$SETTINGS'))
s.pop('hooks', None)
json.dump(s, open('$SETTINGS', 'w'), indent=2)
print('Removed hooks from settings')
"
    fi
    echo "   Restart CC session to deactivate"
    ;;
  status)
    if [ -f "$HOOKS_DIR/events.jsonl" ]; then
      COUNT=$(wc -l < "$HOOKS_DIR/events.jsonl")
      echo "Event log: $COUNT events captured"
      python3 "$HOOKS_DIR/summary.py"
    else
      echo "No events captured yet"
    fi
    # Check if hooks are wired
    if [ -f "$SETTINGS" ] && grep -q "lathe-test" "$SETTINGS" 2>/dev/null; then
      echo "Hooks: WIRED (in settings.local.json)"
    else
      echo "Hooks: NOT WIRED — run: bash $0 on"
    fi
    ;;
  *)
    echo "Usage: bash $0 [on|off|status]"
    ;;
esac
