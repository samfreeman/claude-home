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

- **Local** — this project: `.wag/docs/`, the backlog, the project's code. TRI doesn't *own* these planning surfaces — `/wag:docs` does. So a **blocking snag's** source fix lands in-session (it can't wait — it's halting all work), but a **non-blocking** cycle-end reconciliation (a review candidate that's a doc fix, a stash fold, a naming drift) is **breadcrumbed** to `.wag/docs/PENDING.md` for the next `/wag:docs` to apply. TRI *decides* the fix; DOCS *makes* the edit. The disposition is discovered here; the application happens where that surface lives.
- **Global** — the WAG system itself: `~/.claude/wag/templates/`, `~/.claude/commands/wag/`, references and workflows. **Only TRI can write the substrate** — that is its irreducible capability — so a global fix is **mechanically embedded here, now**: a template authoring-rule or a command pre-flight check, never prose someone must remember to read, never deferred.
- **Both** — the global rule embeds in the substrate now *and* the local doc reconciliation breadcrumbs to the next `/wag:docs`.

The resolution *is* the doc change, template rule, or check. The record is the doc's changelog line plus git history. When a snag closes, its file is deleted. Nothing accumulates.

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
4. **Disposition** — where does this resolution belong: **local, global, or both?** If global (or both), embed the rule mechanically into the wag template or command *now* — there is no "pending" state to defer to.

On close, **delete the snag file** (`git rm .wag/snags/SNAG-NNN.md`). The protocol file has the full step detail.

**Naming drift is a defect class.** When a resolution touches a name — a synonym slipped into a doc, the backlog, or the code; a referent acquired a second word; a bounded context got carved without a forcing function — reconcile it to the **one true term** across `.wag/docs/`, the backlog, and (local fixes) the code, and update Architecture's `Ubiquitous language` section so the glossary stays the authority. Disposition as usual (local / global / both); a global fix lands as a template rule or command check, not prose. See `~/.claude/wag/references/ubiquitous-language.md`. Reconcile *all* affected names at once — don't headline a single rename as "the fix."

## Phase 2: Disposition review snag-candidates

Read the latest review report (`.wag/reviews/REVIEW-EEE.PPP-*.md`, highest number) if one exists for the round. For each entry in its `Snag candidates` section:

1. Surface it: target doc + section, what's wrong, why it matters. **Check it's still live** — a review can lag the round (a docs pass may already have fixed what it flags); if the current doc no longer has the defect, dismiss it as already-resolved.
2. With the user, pick a disposition:
   - **Blocking** (invalidates an active ADR or an approved PBI's acceptance criteria) → capture a snag, resolve it now via Phase 1.
   - **Non-blocking local-docs fix** → **breadcrumb it** to `.wag/docs/PENDING.md`; the next `/wag:docs` applies it. Don't edit the doc here.
   - **Needs a global rule** → embed the template/command fix in the substrate now.
   - **Dismiss** → state the reason; it leaves no artifact.

**The breadcrumb (`.wag/docs/PENDING.md`)** is TRI's hand-off channel to DOCS for *already-decided* local-docs reconciliations — distinct from the stash (a triage queue DOCS re-litigates). Append one checklist line per deferred fix (`- [ ] **<doc> § <section>** — <change>. _(Source, date)_`), creating the file if absent. DOCS applies and clears it. Blocking snags are never breadcrumbed.

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

## One-time migration: draining the legacy `_resolved/` archive

Pre-TRI wag kept a per-project resolved-snag archive. It is **frozen** — nothing writes to it anymore. When the user wants, drain it in a TRI session:

- **`.wag/snags/_resolved/`** (per project) — history only. Optionally `git rm -r` it; the resolutions live in git history and doc changelogs.

## Key rules

1. **Resolution, not cataloguing.** An issue leaves TRI resolved into a living artifact or deliberately dismissed — never parked in a corpus.
2. **Local, global, or both.** Every resolution gets the disposition question. **Global** embeds in the substrate in-session — only TRI can write the machinery, so it never defers. **Local** planning-surface work isn't done in TRI: a non-blocking reconciliation breadcrumbs to `.wag/docs/PENDING.md` for the next `/wag:docs` to apply; only a blocking snag's source fix lands in-session (a blocker can't wait).
3. **Snags block; TRI unblocks.** Any open snag halts all dev work and routes here. Mid-cycle TRI is snags-only; cycle-end TRI is the full drain.
4. **User + Claude together.** Claude proposes, user approves. No unilateral resolutions, no unilateral dismissals.
5. **The doc changelog points, it doesn't narrate.** One line per resolution, pointing at the commit. Stop writing the same change four ways.