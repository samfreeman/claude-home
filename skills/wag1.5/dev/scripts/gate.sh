#!/bin/bash
# Gate check: lint → tests → build
# Exits with code 0 if all pass, 1 if any fail.
# Outputs which step failed and why.

set -e

echo "🔍 Running gate check..."
echo ""

# Step 1: Lint
echo "━━━ Step 1: Lint ━━━"
if pnpm lint 2>&1; then
    echo "✅ Lint passed"
else
    echo "❌ Lint failed"
    exit 1
fi
echo ""

# Step 2: Tests
echo "━━━ Step 2: Tests ━━━"
if pnpm test 2>&1; then
    echo "✅ Tests passed"
else
    echo "❌ Tests failed"
    exit 1
fi
echo ""

# Step 3: Build
echo "━━━ Step 3: Build ━━━"
if pnpm build 2>&1; then
    echo "✅ Build passed"
else
    echo "❌ Build failed"
    exit 1
fi
echo ""

echo "✅ All gates passed. Ready for architect review."
