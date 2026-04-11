#!/bin/bash
# On-complete: move files, commit, push.
# Run after user approves and checkboxes are marked.
# The commit will trigger the permission popup — that's the single approval point.

set -e

echo "📦 Running on-complete..."

# Move ADR from active to completed
ADR_FILE=$(ls .wag/adr/active/PBI-*-ADR.md 2>/dev/null | head -1)
if [ -n "$ADR_FILE" ]; then
    mkdir -p .wag/adr/completed
    mv "$ADR_FILE" .wag/adr/completed/
    echo "✅ ADR moved to completed"
else
    echo "⚠️ No active ADR found to move"
fi

# Extract PBI number from ADR filename
PBI_NUM=$(basename "$ADR_FILE" 2>/dev/null | grep -oP 'PBI-\d+' || echo "")

# Move PBI from backlog to completed
if [ -n "$PBI_NUM" ]; then
    PBI_FILE=".wag/backlog/${PBI_NUM}.md"
    if [ -f "$PBI_FILE" ]; then
        mkdir -p .wag/backlog/_completed
        mv "$PBI_FILE" .wag/backlog/_completed/
        echo "✅ PBI moved to completed"
    else
        echo "⚠️ PBI file not found: $PBI_FILE"
    fi
fi

# Stage everything
git add .

# Commit — this triggers the permission popup
BRANCH=$(git branch --show-current)
git commit -m "feat: ${PBI_NUM} implemented"

# Push
git push origin "$BRANCH"

echo "✅ Complete. ${PBI_NUM} committed and pushed to ${BRANCH}."
