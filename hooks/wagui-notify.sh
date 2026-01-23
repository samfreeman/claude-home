#!/bin/bash
# Notify wagui when Claude is about to use a tool
# This provides visibility into what Claude is "thinking about"

WAGUI_URL="http://localhost:3099/api/v1/messages"

# Read hook input from stdin
HOOK_DATA=$(cat)

# Extract tool info
TOOL=$(echo "$HOOK_DATA" | jq -r '.tool_name // "unknown"')
TOOL_INPUT=$(echo "$HOOK_DATA" | jq -r '.tool_input // {}')

# Skip certain tools to avoid noise
case "$TOOL" in
    TodoWrite|mcp__wag__*)
        # Skip todo updates and wag messages (would be recursive)
        exit 0
        ;;
esac

# Build a human-readable description
case "$TOOL" in
    Read)
        FILE=$(echo "$TOOL_INPUT" | jq -r '.file_path // "unknown"')
        DESC="Reading: ${FILE##*/}"
        ;;
    Write)
        FILE=$(echo "$TOOL_INPUT" | jq -r '.file_path // "unknown"')
        DESC="Writing: ${FILE##*/}"
        ;;
    Edit)
        FILE=$(echo "$TOOL_INPUT" | jq -r '.file_path // "unknown"')
        DESC="Editing: ${FILE##*/}"
        ;;
    Bash)
        CMD=$(echo "$TOOL_INPUT" | jq -r '.command // "unknown"' | head -c 50)
        DESC="Running: $CMD"
        ;;
    Glob)
        PATTERN=$(echo "$TOOL_INPUT" | jq -r '.pattern // "unknown"')
        DESC="Searching: $PATTERN"
        ;;
    Grep)
        PATTERN=$(echo "$TOOL_INPUT" | jq -r '.pattern // "unknown"')
        DESC="Grepping: $PATTERN"
        ;;
    Task)
        SUBAGENT=$(echo "$TOOL_INPUT" | jq -r '.subagent_type // "unknown"')
        TASK_DESC=$(echo "$TOOL_INPUT" | jq -r '.description // "task"')
        DESC="Spawning $SUBAGENT: $TASK_DESC"
        ;;
    *)
        DESC="Using: $TOOL"
        ;;
esac

# Send to wagui (fire and forget, don't block Claude)
curl -X POST "$WAGUI_URL" \
    -H "Content-Type: application/json" \
    --max-time 1 \
    --silent \
    -d "{
        \"role\": \"dev\",
        \"type\": \"context\",
        \"content\": \"$DESC\"
    }" \
    2>/dev/null &

exit 0
