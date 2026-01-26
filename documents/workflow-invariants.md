# Workflow Invariants

## The Problem

When following workflow skills (like WAGU), certain rules must **always** be enforced - not as guidelines to remember, but as invariants that cannot be violated.

### Case Study: The mkdir Mistake

**What happened:**
1. WAGU skill says: "All bash commands must be prefixed with `cd [appRoot] &&`"
2. AI forgot this rule and ran commands from wrong directory (`/home/samf/.claude` instead of `/home/samf/.claude/tools/wagui`)
3. From wrong directory, relative paths like `adr/completed/` didn't resolve correctly
4. AI defensively added `mkdir -p` to create directories that already existed in the correct location
5. User stopped the command, AI misdiagnosed the problem as "skill paths are wrong"
6. AI tried to "fix" the skill by adding `.wag/` prefixes - completely wrong direction
7. Root cause: not following the `cd [appRoot] &&` rule

**The cascade:**
- Wrong directory → wrong context → defensive guessing → wrong diagnosis → wrong fix → wasted time

### Why Guidelines Fail

The skill clearly states the rule. But "should" and "must" feel the same when reading instructions. There's no enforcement - nothing prevents the AI from forgetting.

When the AI makes a mistake:
1. It doesn't immediately recognize its own error
2. It asks the user "what needs to be fixed?" instead of diagnosing itself
3. It blames the instructions rather than its failure to follow them

## The Need for Invariants

Some rules need to be **invariants** - things that are always true, mechanically enforced, not optional guidelines.

For WAGU, one such invariant:
```
INVARIANT: Every Bash command during WAGU workflow must start with `cd [appRoot] &&`
```

### Characteristics of Invariants

1. **Always enforced** - not "try to remember"
2. **Self-checking** - AI should verify before executing
3. **Failure = stop** - if invariant can't be satisfied, don't proceed

### Potential Invariants for WAGU

| Invariant | Check |
|-----------|-------|
| Commands run from appRoot | Every Bash starts with `cd [appRoot] &&` |
| Source changes use Write tool | No Edit tool on non-.wag files |
| Gate before commit | wag_gate must pass before any commit |
| No direct push to protected branches | Deny list enforces this |

## Open Question

How to make invariants enforceable rather than just documented? Options:
1. Pre-execution hooks that validate commands
2. Self-check prompts before tool use
3. Wrapper functions that enforce preconditions
4. Post-hoc validation that catches violations

The deny list in settings.json is one example of mechanical enforcement. But most rules currently rely on the AI remembering them.