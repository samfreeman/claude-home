---
description: TRI phase — tackle what the round surfaced, head-on. Resolve every snag and pending item; each fix lands local, global, or both
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# WAG TRI — Triage

The fifth phase of the cycle:

```
ADR → [DEV → RVW]* → TRI
```

TRI is where issues get **resolved, not catalogued**. Whatever the round surfaced — snags, review snag-candidates, stashed thoughts — gets tackled head-on here, and each resolution lands where it belongs:

- **Local** — this project: `.wag/docs/`, the backlog, the project's code.
- **Global** — the WAG system itself: `~/.claude/wag/templates/`, `~/.claude/commands/wag/`, references and workflows. A global fix is **mechanically embedded** — a template authoring-rule or a command pre-flight check — never prose someone must remember to read.
- **Both** — the project doc gets fixed *and* the rule that would have prevented the defect embeds upstream.

**There are no corpuses.** No learning files, no resolved-snag archive. The resolution *is* the doc change, template rule, or check. The record is the doc's changelog line plus git history. When a snag closes, its file is deleted.

## Two entry modes

### Mid-cycle excursion (a snag is blocking)

A snag captured during ADR, DEV, or RVW blocks all dev work. The halting command documents the snag and comes straight here — either by driving this command's flow inline in the same session, or via a fresh `/wag:tri`.

Scope: **snags only.** Resolve every open snag (they all block — there is no reason to leave one open), then return to the halted phase. Stash and review candidates wait for cycle end.

### Cycle-end drain (the round is done)

After the PBI merges (Phase 6 of `/wag:dev`), before the next `/wag:adr`. Runs on `dev`. Scope: the full drain — Phases 1–3 below.

## Phase 1: Resolve open snags

Glob `.wag/snags/SNAG-*.md`. For each, drive the resolution protocol at `~/.claude/wag/workflows/snag-resolution.md` with the user:

1. **Resolve** — fix the defect at its source. No resolution, no progression.
2. **Propagate to docs** — scan-read-edit across `.wag/docs/`.
3. **Propagate to backlog** — scan-read-edit across `.wag/backlog/`.
4. **Disposition** — where does this resolution belong: **local, global, or both?** If global (or both), embed the rule mechanically into the wag template or command *now* — there is no "pending" state and no learning file to defer to.

On close, **delete the snag file** (`git rm .wag/snags/SNAG-NNN.md`). The protocol file has the full step detail.

**Naming drift is a defect class.** When a resolution touches a name — a synonym slipped into a doc, the backlog, or the code; a referent acquired a second word; a bounded context got carved without a forcing function — reconcile it to the **one true term** across `.wag/docs/`, the backlog, and (local fixes) the code, and update Architecture's `Ubiquitous language` section so the glossary stays the authority. Disposition as usual (local / global / both); a global fix lands as a template rule or command check, not prose. See `~/.claude/wag/references/ubiquitous-language.md`. Reconcile *all* affected names at once — don't headline a single rename as "the fix."

## Phase 2: Disposition review snag-candidates

Read the latest review report (`.wag/reviews/REVIEW-EEE.PPP-*.md`, highest number) if one exists for the round. For each entry in its `Snag candidates` section:

1. Surface it: target doc + section, what's wrong, why it matters.
2. With the user: **capture and resolve it now** (it becomes a snag, loop through Phase 1), or **dismiss it** (state the reason; it leaves no artifact).

## Phase 3: Triage the stash

Glob `.wag/stash/STASH-*.md` (exclude `_processed/`). If non-empty, walk the items with the user per the triage procedure in `/wag:docs` Phase 4 (promote to PBI / defer to future bucket / fold into docs / discard / keep stashed). Per-item, user can stop anytime — items left untouched stay stashed.

## Phase 4: Exit check and commit

The round is closed when:

- `.wag/snags/` is empty — no snag files at all.
- The latest review's snag candidates are each resolved or dismissed.
- The stash has been offered for triage (clearing it is optional).

Commit the TRI work on `dev` in one commit per resolved snag (the protocol's closure rule), or one commit for the drain if only candidates/stash moved:

```bash
git add -A
git commit -m "tri: close the round — [summary]"
git push origin dev
```

Then tell the user: "Round closed. Next `/wag:adr` is clear."

If open snags remain (user stopped mid-drain), say so plainly — the next WAG command will halt on them.

## One-time migration: draining the legacy corpuses

Pre-TRI wag accumulated two corpuses. They are **frozen** — nothing writes to them anymore. When the user wants, drain them in a TRI session:

- **`~/.claude/wag/learnings/LEARNING-*.md`** — for each: embed it mechanically (template rule or command check), fold it into the relevant project docs, or delete it as no longer worth its keep. Entries marked `pending` in "Embedded into" either embed now or die with the file.
- **`.wag/snags/_resolved/`** (per project) — history only. Optionally `git rm -r` it; the resolutions live in git history and doc changelogs.

When `learnings/` is empty, the corpus reads in `/wag:adr`, `/wag:dev`, and `/wag:rvw` naturally no-op and can be stripped.

## Key rules

1. **Resolution, not cataloguing.** An issue leaves TRI resolved into a living artifact or deliberately dismissed — never parked in a corpus.
2. **Local, global, or both.** Every resolution gets the disposition question. Global means mechanical embedding, done in-session.
3. **No new corpus entries, ever.** No learning files, no `_resolved/` archive. Closed snag files are deleted; git history is the archive.
4. **Snags block; TRI unblocks.** Any open snag halts all dev work and routes here. Mid-cycle TRI is snags-only; cycle-end TRI is the full drain.
5. **User + Claude together.** Claude proposes, user approves. No unilateral resolutions, no unilateral dismissals.
6. **The doc changelog points, it doesn't narrate.** One line per resolution, pointing at the commit. Stop writing the same change four ways.