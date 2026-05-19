# LEARNING-005: PBI numbering must flow with dependency direction

**Source snag:** SNAG-005 from chatr
**Applies to:** all (any WAG project with numbered PBIs)

## Standard

Within a single epic, a PBI with local number `P` must not list any PBI with local number `Q > P` (in the same epic) in its `Dependencies:` line. Dependencies flow forward: each PBI's prerequisites within the same epic are always lower-numbered than itself. A reader scanning the epic's PBIs in number order encounters each PBI before its dependents, not after.

The rule applies to both the explicit `Dependencies:` field and any prose `PBI <epic>.<pbi>` references inside the PBI body that describe prerequisite relationships within the same epic.

**Cross-epic dependencies** are exempt — they're named with the full `PBI EEE.PPP` form (different epic number on the left side of the dot), and the linear-scan rule doesn't extend across folders.

## Check

Linear scan of each PBI file in an epic:

1. Read the `Dependencies:` line.
2. For each `PBI EEE.PPP` reference on that line, if `EEE` matches the current epic's number, compare `PPP` to the current file's local number.
3. If any referenced same-epic `PPP` is higher than the current file's number, that's the violation.

Additional pass: grep each PBI body for `PBI EEE.PPP` references and flag any same-epic refs that name a higher-numbered PBI as a prerequisite.

No project-specific knowledge required. Seconds per PBI.

## Violations look like

Inside `epic-001-services/PBI-004.md`:

```markdown
# PBI 001.004: Service Foundation

**Dependencies:** PBI 001.001 (monorepo scaffold), PBI 001.005 (events package)
                                                  ^^^^^^^^^^^
                                                  same epic, higher local number — defect
```

A reader scanning the epic in number order hits PBI 001.004 first, learns it depends on PBI 001.005, but PBI 001.005 hasn't been read yet. Reading order doesn't match build order.

## Fix pattern

1. **List prerequisites for each PBI in the epic.** Build the dependency graph (intra-epic edges only).
2. **Topologically sort.** Order PBIs so every prerequisite appears before its dependents.
3. **Renumber the open PBI files** via `git mv` to match the sort.
   - Closed PBIs in `_completed/<epic-slug>/` keep their existing numbers — they are immutable in steady state. Build the sort around their fixed positions.
4. **Update cross-references** in PBI bodies and in `epic.md` if it cites PBI numbers.
5. **If an active ADR exists for a renumbered PBI**, rename it (`ADR-EEE.OLD.md` → `ADR-EEE.NEW.md`) and update its header. The feature branch may be renamed in parallel (`git branch -m feature/PBI-EEE.OLD feature/PBI-EEE.NEW`).
6. **Update `.wag/state.json`** if `active_pbi` or `feature_branch` references a renumbered file.
7. **Update any open snags** that cite the renumbered files by their old IDs.

If renumbering an open PBI is undesirable (e.g. already heavily referenced in external docs / PRs), the alternative is to re-scope — fold the higher-numbered dependency into the lower-numbered PBI so the dependency disappears. Renumbering is the default fix.

## Immutability of completed PBIs

In steady state, **only open PBIs can be renumbered**. Once a PBI is moved into `_completed/<epic-slug>/`, its number and epic membership are frozen. If a violation involves a completed PBI as a prerequisite, the violation is resolved by renumbering the *open* PBI that points at it, not the closed one.

The one exception is `/wag:migrate-backlog`, which performs a one-time renumbering of an entire project's pre-existing backlog (open and closed) as it adopts the per-epic numbering scheme.

## Authoring-time prevention

Run the linear scan at the end of any `/wag:docs` session that creates or modifies multiple PBIs in an epic. 10-second check before commit prevents the defect from being committed in the first place.

## Embedded into

- **Commands:** pending — `/wag:docs` should gain an end-of-session check that runs the linear scan across the epic's PBI files and halts on violation.
- **Templates:** `~/.claude/wag/templates/backlog-pbi.md` — "Authoring rules" section contains the Dependency direction rule as prose. Template is authoritative for PBI shape; downstream authoring must comply.
- **Learnings:** `~/.claude/wag/learnings/LEARNING-005.md` (this file) — portable baseline for cross-project reach.
