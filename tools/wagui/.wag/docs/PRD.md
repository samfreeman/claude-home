# WAGUI - Product Requirements Document

## Vision

WAGUI is trust infrastructure for AI-assisted development.

When you use AI to build software, you can't make promises to employers or customers unless you can guarantee results. AI is non-deterministic - it drifts, ignores instructions, forgets steps. WAGUI exists to close that gap.

**The Problem:** AI output is unpredictable. You tell it something 500 times and it still forgets. You can't build a business on "maybe it works."

**The Solution:** Deterministic boundaries around AI execution. Well-defined inputs. Validated outputs. AI operates freely in the middle, but the boundaries are enforced by code, not trust.

**Core Principle (Design by Contract - Bertrand Meyer):**
```
Preconditions → AI (free) → Postconditions
     ↓              ↓              ↓
  Validate      Execute       Validate
   Input        Freely         Output
```

WAGUI serves two purposes:
1. **Visibility** - Watch AI work, see where it drifts, understand how to instruct it better
2. **Enforcement** - Validate inputs and outputs so you can make promises you can keep

## Target Users

- Developers who need to deliver reliable results using AI
- Teams that need accountability for AI-generated code
- Anyone building products where "it usually works" isn't good enough

## Core Architecture

### The Contract System

Every workflow mode (DOCS, ADR, DEV) is a function with a contract:

- **Preconditions** - Validated before AI starts (branch correct, required files exist, state clean)
- **Execution** - AI operates freely, using judgment and creativity
- **Postconditions** - Validated before completion (quality gates pass, criteria met, files in correct locations)

If preconditions fail: reject before AI wastes cycles.
If postconditions fail: reject the output, AI retries or fallback runs.

### wag_cop - The Enforcement Layer

`wag_cop` validates postconditions before allowing completion:

1. AI calls `wag_cop` when it thinks it's done
2. Server runs postcondition checks (deterministic code)
3. If checks pass: complete the mode, move files, clear state
4. If checks fail: return error, AI must fix and retry
5. After N failures: deterministic fallback (revert, escalate)

**Validation Levels:**
- **Structural** - Files exist, lint passes, types pass, tests pass
- **Coverage** - Changed files relate to ADR scope
- **Semantic** - Behavior matches intent (requires testable criteria in ADR)

The cop can only validate what's testable. This forces ADRs to contain specific, testable acceptance criteria. Vague specs can't be validated.

### Learning from Corrections

Every time you repeat an instruction, that's a constraint the system doesn't enforce yet.

WAGUI logs corrections. Patterns of correction become candidate rules for the cop. The system learns what to enforce by watching you correct AI.

## Features

### Real-time Workflow Visibility
- Connect to wag-mcp SSE server on port 3099
- Display messages from all roles (User, PM, Architect, Dev)
- Show what AI is doing as it works
- Auto-scroll to latest messages

### Header Status Bar
- Connection status
- Current mode (DOCS/ADR/DEV)
- App name and branch
- Active PBI and task progress

### Message Types
- **chat** - Discussion
- **proposal** - Proposed changes
- **review** - Code reviews (approve/reject)
- **diff** - Code changes
- **decision** - Decisions made
- **system** - State changes
- **context** - Dividers between workflow segments

### Precondition Validation (Mode Entry)
- Verify branch is correct
- Verify required files exist (PBI for ADR, ADR for DEV)
- Verify git status is clean
- Reject mode entry if preconditions fail

### Postcondition Validation (wag_cop)
- Run quality gates (format, lint, typecheck, test)
- Verify acceptance criteria checked
- Verify files moved to correct locations
- Verify semantic match between ADR and code changes
- Block completion until all pass

### Deterministic Fallbacks
- When AI fails postconditions after N attempts
- Revert to last known good state
- Report what failed
- Escalate to human
- Known outcome, not undefined behavior

### I/O Logging
- Capture successful contract executions
- Input: state when mode started
- Output: what changed when mode completed
- Build corpus for learning and improvement

## Technical Stack
- Next.js 15 with App Router
- TypeScript
- Tailwind CSS v4
- shadcn/ui components
- SQLite via better-sqlite3
- SSE for real-time updates

## Ports
- **3098** - wagui web server
- **3099** - wag-mcp API + SSE server

## Success Criteria

WAGUI succeeds when you can say to a customer: "This will work" - and mean it. Not because AI is perfect, but because the system guarantees the output falls within acceptable parameters. AI capability with deterministic delivery.
