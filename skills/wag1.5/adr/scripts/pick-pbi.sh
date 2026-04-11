#!/bin/bash
# Lists available PBIs from the backlog.
# Usage: pick-pbi.sh [PBI-number]
# Without args: lists all PBIs
# With arg: displays full content of that PBI

BACKLOG=".wag/backlog"

if [ ! -d "$BACKLOG" ]; then
    echo "No .wag/backlog/ directory found."
    exit 1
fi

if [ -z "$1" ]; then
    echo "## Available PBIs"
    echo ""
    for f in "$BACKLOG"/PBI-*.md; do
        [ -f "$f" ] || continue
        name=$(basename "$f" .md)
        title=$(head -1 "$f" | sed 's/^#\s*//')
        echo "- **$name**: $title"
    done
else
    FILE="$BACKLOG/PBI-$1.md"
    if [ ! -f "$FILE" ]; then
        FILE="$BACKLOG/$1.md"
    fi
    if [ -f "$FILE" ]; then
        cat "$FILE"
    else
        echo "PBI not found: $1"
        exit 1
    fi
fi
