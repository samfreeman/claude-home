# WAG Snag Resolution — The TRI Protocol

The canonical 4-step flow for resolving a snag. It runs inside the TRI phase (`/wag:tri`) — either as a mid-cycle excursion when a snag blocks work, or as part of the cycle-end drain. Commands that hit an open snag (`/wag:docs`, `/wag:adr`, `/wag:dev`, `/wag:rvw`) halt and route here; they may drive this flow inline in the same session — that *is* TRI.

**A snag is not a joke.** It marks a defect in the WAG system — the commands or templates let something wrong through. Resolution is mandatory before downstream work proceeds.

**Snags originate in docs, propagate to backlog.** A snag is always a defect in an upstream doc (PRD, Architecture, or a decision therein) whose consequences have leaked into the backlog. Resolution fixes the doc (Step 1), then propagates downhill to affected backlog items (Steps 2+3). A PBI that just needs authoring cleanup without a doc defect upstream is authoring work for `/wag:docs`, not a snag.

**There is no corpus.** Issues get resolved into living artifacts, never parked in archives. A closed snag's file is deleted — the record is the doc changelog line plus git history.

**There is no `/wag:snag` command.** Snags are captured inline by the active command whenever a defect is discovered; resolution happens in TRI.

## When to enter this flow

1. **Preflight finds an open snag** in `.wag/snags/`. The command halts, surfaces the snag, and routes to TRI. If the user says "resolve" / "tri," this protocol runs inline.
2. **Template drift is detected** — the command sees the project's docs don't match the current template shape. This is a defect (either template-evolved or hand-edit drift); halt and ask the user. If the user says "resolve," a snag is captured and this protocol runs.
3. **Inline capture during work** — while authoring, designing, or implementing, the command discovers an upstream assumption is wrong. Capture a snag immediately and go straight to TRI.

## The 4 steps

Run all four in one session. **Atomic.** No walking away with partial state.

### Step 1 — Resolve (or attempt to resolve)

1. Read the snag file end-to-end. Understand **Assumed** vs **Reality**.
2. With the user, discuss the problem. Propose a fix. Challenge assumptions. Agree on a concrete resolution.
3. Execute the fix against the impacted artifact (doc section, PBI file, config, whatever the snag's **Target** field names).
4. If the attempt fails — the fix doesn't actually resolve the defect, or a new defect surfaces — **loop back to step 1** with a new approach. A failed attempt is not a close.
5. On success, write the outcome into the snag's `## Resolution` section: what was changed, where, why.

**No resolution, no progression.** Steps 2–4 do not run until step 1 succeeds.

### Step 2 — Propagate to docs

**Scan-read-edit protocol.** Never discover a file mid-edit. The scan is always step 1. Serial read-then-edit-then-find-another-file is what burns hours on otherwise-trivial propagations.

1. **Scan.** `grep -rn` the affected term, pattern, or section name across `.wag/` (skip `.wag/snags/`) and project source. Collect ALL `file:line` hits — do not stop at the first few.
2. **Read.** Open every hit file in full. Understand the context of each occurrence before proposing changes.
3. **Present.** Show the user the complete edit set upfront in one message: "Here are N files and the specific change in each." Full list, no trickle.
4. **Apply.** After user approval, execute all edits in one pass. For each affected doc (`PRD.md`, `Architecture.md`, `RESEARCH.md`), bump the version number and append a changelog entry — a **one-line pointer to the resolving commit**, not a re-narration of the change.
5. If the fix invalidates an active ADR, flag it — the ADR may need revisiting or its own snag.

### Step 3 — Propagate to backlog

**Scan-read-edit protocol** (same shape as Step 2 — scan first, read all, present the full edit set, then apply).

1. **Scan.** `grep -rn` the affected term or pattern across `.wag/backlog/` (including the active epic, if any). Collect ALL `file:line` hits.
2. **Read.** Open every hit PBI or epic file in full.
3. **Present.** Show the user the complete edit set upfront — every affected PBI, the disposition for each (update in place / close and replace / leave alone), and the specific change if updating.
4. **Apply.** After approval, apply all changes in one pass. If the fix affects PBI numbering or dependency order (e.g. a new forward dependency), renumber per the forward-dependency rule.

### Step 4 — Disposition: local, global, or both

Ask: **where does this resolution belong?**

- **Local** — the defect and its fix live entirely in this project. Steps 1–3 already landed it. Done.
- **Global** — the rule that would have prevented this defect belongs in the WAG system. Embed it **mechanically, now, in this session**:
  - **Commands** — a check the relevant command (`/wag:docs`, `/wag:adr`, `/wag:dev`, `/wag:rvw`) runs at pre-flight or end-of-authoring. Edit the command file.
  - **Templates** — a shape change or authoring-rule in a PRD/Architecture/Backlog/snag template. Edit the template.
- **Both** — the project fix (Steps 1–3) *and* the global embedding.

A global rule earns its keep **only by embedding mechanically** — never as prose in a corpus someone must remember to read. There is no "pending" state: if the rule is worth keeping, the template or command changes before the snag closes. Record the disposition in the snag's `## Disposition` section before closure.

## Closure

After all four steps, the snag is closed. **Delete the file:**

```bash
git rm .wag/snags/SNAG-NNN.md
```

Commit the full resolution in one commit — snag deletion, doc updates, PBI changes, any global template/command edits — with a message naming the snag and summarising the fix. Git history is the archive; there is no `_resolved/` directory.

## Key rules

1. **A resolution cannot persist without closing the snag.** If the fix is known, the snag closes (file deleted) in the same session. Never leave a resolved-but-open snag on disk.
2. **All four steps run in one session.** No walking away partway through. If the user must stop, capture state in the snag's Resolution section so the next session resumes cleanly — the snag stays open and keeps blocking until then.
3. **User + Claude together.** Every step is collaborative. Claude proposes, user approves. No unilateral moves, no menus of options — the snag file's default fix is the starting point; the user redirects if they want something else.
4. **Failed attempts loop, don't abandon.** If step 1 fails, start again. Unresolvable snags are a big problem that must be addressed — not quietly dropped.
5. **One authoritative narrative, then it's git's.** While open, the snag's `## Resolution` section is the working source of truth. At closure the narrative lives in the closing commit; changelog entries are one-line pointers to it — never re-narrations. Stop writing the same change four ways.
6. **Open snags halt all dev work — no exceptions.** While any file exists in `.wag/snags/`, every WAG command halts at pre-flight and routes to TRI. No "different disposition," no "acknowledge and proceed." The blocking is global (not scoped to the snag's target) because an open snag signals the system has an unpatched defect. Until the snag file is deleted, no forward progress.