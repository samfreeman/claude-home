# WAG Snag Resolution — Shared Protocol

The canonical 4-step flow for resolving a snag. Every halting command (`/wag:docs`, `/wag:adr`, `/wag:dev`) reads this file when it hits an open snag and drives the flow inline with the user.

**A snag is not a joke.** It marks a defect in the WAG system — the commands or templates let something wrong through. Resolution is mandatory before downstream work proceeds.

**Snags originate in docs, propagate to backlog.** A snag is always a defect in an upstream doc (PRD, Architecture, or a decision therein) whose consequences have leaked into the backlog. Resolution fixes the doc (Step 1), then propagates downhill to affected backlog items (Steps 2+3). A PBI that just needs authoring cleanup without a doc defect upstream is authoring work for `/wag:docs`, not a snag.

**There is no `/wag:snag` command.** Snags are captured inline by the active command (`/wag:docs`, `/wag:adr`, `/wag:dev`) whenever a defect is discovered, and this protocol runs inline in the same session.

## When to enter this flow

A command enters this flow when:

1. **Preflight finds an open snag** in `.wag/snags/` (any file with `**Status:** open`) that applies to the current work. The command halts, surfaces the snag, and asks the user for guidance. If the user says "resolve," this protocol runs.
2. **Template drift is detected** — the command sees the project's docs don't match the current template shape. This is a defect (either template-evolved or hand-edit drift); halt and ask the user. If the user says "resolve," a snag is captured and this protocol runs.
3. **Inline capture during work** — while authoring or designing, the command discovers an upstream assumption is wrong. Capture a snag immediately and enter this protocol.

## The 4 steps

Run all four in one session. **Atomic.** No walking away with partial state.

### Step 1 — Resolve (or attempt to resolve)

1. Read the snag file end-to-end. Understand **Assumed** vs **Reality**.
2. With the user, discuss the problem. Propose a fix. Challenge assumptions. Agree on a concrete resolution.
3. Execute the fix against the impacted artifact (doc section, PBI file, config, whatever the snag's **Target** field names).
4. If the attempt fails — the fix doesn't actually resolve the defect, or a new defect surfaces — **loop back to step 1** with a new approach. A failed attempt is not a close.
5. On success, write the outcome into the snag's `## Resolution` section: what was changed, where, why. Update **Status:** from `open` to `resolved`.

**No resolution, no progression.** Steps 2–4 do not run until step 1 succeeds.

### Step 2 — Propagate to docs

**Scan-read-edit protocol.** Never discover a file mid-edit. The scan is always step 1. Serial read-then-edit-then-find-another-file is what burns hours on otherwise-trivial propagations.

1. **Scan.** `grep -rn` the affected term, pattern, or section name across `.wag/` (skip `.wag/snags/_resolved/`) and project source. Collect ALL `file:line` hits — do not stop at the first few.
2. **Read.** Open every hit file in full. Understand the context of each occurrence before proposing changes.
3. **Present.** Show the user the complete edit set upfront in one message: "Here are N files and the specific change in each." Full list, no trickle.
4. **Apply.** After user approval, execute all edits in one pass. For each affected doc (`PRD.md`, `Architecture.md`, `RESEARCH.md`), bump the version number and append a changelog entry — the changelog entry is a **one-line pointer to the SNAG Resolution section**, not a re-narration of the change.
5. If the fix invalidates an active ADR, flag it — the ADR may need revisiting or its own snag.

### Step 3 — Propagate to backlog

**Scan-read-edit protocol** (same shape as Step 2 — scan first, read all, present the full edit set, then apply).

1. **Scan.** `grep -rn` the affected term or pattern across `.wag/backlog/` (including the active epic, if any). Collect ALL `file:line` hits.
2. **Read.** Open every hit PBI or epic file in full.
3. **Present.** Show the user the complete edit set upfront — every affected PBI, the disposition for each (update in place / close and replace / leave alone), and the specific change if updating.
4. **Apply.** After approval, apply all changes in one pass. If the fix affects PBI numbering or dependency order (e.g. a new forward dependency), renumber per the forward-dependency rule.

### Step 4 — Promote (if portable)

1. Ask: is the rule this snag taught us generalizable — would future WAG projects benefit from it?
2. If **no**: done. The snag is closed, docs and PBIs are updated, learning stays project-local.
3. If **yes**: promote to a learning.
   - Determine the next LEARNING-NNN number by scanning `~/.claude/wag/learnings/`.
   - Write `~/.claude/wag/learnings/LEARNING-NNN.md` using the learning template (`~/.claude/wag/templates/learning.md`).
   - Update the snag's `## Promotion candidate` section to record the LEARNING-NNN link.
4. Decide where the learning embeds — the three surfaces:
   - **Commands** — does the learning produce a mechanical `Check` the halting command (e.g. `/wag:docs`) should run at end-of-authoring? If so, update the command.
   - **Templates** — does the learning change the shape of a PRD/Architecture/Backlog doc? If so, update the template.
   - **Learnings** — the learning file itself is the portable record for future projects. Always.
5. **Scan for pending embeddings.** After writing LEARNING-NNN, `grep -l 'pending' ~/.claude/wag/learnings/LEARNING-*.md` to find any prior learning with a `pending` entry in its **Embedded into** section. Surface the list to the user. Each pending entry either gets embedded now (while context is warm) or stays flagged for the next resolution cycle — the metadata is only worth keeping if it gets checked every time.

## Closure

After all four steps, the snag is closed. Move the file:

```bash
git mv .wag/snags/SNAG-NNN.md .wag/snags/_resolved/SNAG-NNN.md
```

Commit the full resolution in one commit — snag move, doc updates, PBI changes, learning file — with a message naming the snag and summarising the fix.

## Key rules

1. **A resolution cannot persist without closing the snag.** If the fix is known, the snag moves to resolved. Never leave a resolved-but-open snag on disk.
2. **Locally resolvable, globally not.** A project can close its snag locally (steps 1–3) even if the WAG system fix (command/template edit from step 4) is deferred to a separate session. But the resolution lands *here* regardless.
3. **All four steps run in one session.** No walking away partway through. If the user must stop, capture state in the snag's Resolution section so the next session resumes cleanly.
4. **User + Claude together.** Every step is collaborative. Claude proposes, user approves. No unilateral moves, no menus of options — the snag file's default fix is the starting point; the user redirects if they want something else.
5. **Failed attempts loop, don't abandon.** If step 1 fails, start again. Unresolvable snags are a big problem that must be addressed — not quietly dropped.
6. **One authoritative narrative.** The snag's `## Resolution` section is the single source of truth for the fix. Changelog entries (in `Architecture.md`, `PRD.md`), commit messages, and any inbox messages about this snag are **one-line summaries that point to the snag file** — never re-narrations. Stop writing the same change four ways.
7. **Open snags halt all work — no exceptions.** While any `**Status:** open` file exists in `.wag/snags/`, every WAG command (`/wag:init`, `/wag:docs`, `/wag:adr`, `/wag:dev`) halts at pre-flight. No "different disposition," no "acknowledge and proceed." The blocking is global (not scoped to the snag's target) because an open snag signals the system has an unpatched defect. Resolution is atomic: Steps 1–3 (fix + doc propagation + PBI propagation) plus Step 4 assessment and LEARNING file creation (if the rule is portable) complete fully before the halted command resumes. Only embedding the learning into commands/templates may be deferred (see rule #2). Until the snag moves to `.wag/snags/_resolved/`, no forward progress.
