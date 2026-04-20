# LEARNING-005: PBI numbering must flow with dependency direction

**Source snag:** SNAG-005 from chatr
**Applies to:** all (any WAG project with numbered PBIs)

## Standard

A PBI with filename number `N` must not list any PBI with filename number `M > N` in its `Dependencies:` line. Dependencies flow forward: each PBI's prerequisites are always lower-numbered than itself. A reader scanning the backlog in number order encounters each PBI before its dependents, not after.

The rule applies to both the explicit `Dependencies:` field and any prose `PBI-\d+` references inside the PBI body that describe prerequisite relationships.

## Check

Linear scan of each PBI file in an epic:

1. Read the `Dependencies:` line.
2. For each `PBI-\d+` reference on that line, compare the referenced number to the current file's number.
3. If any referenced number is higher, that's the violation.

Additional pass: grep each PBI body for `PBI-\d+` references and flag any that name a higher-numbered PBI as a prerequisite.

No project-specific knowledge required. Seconds per PBI.

## Violations look like

```markdown
# PBI-004: Service Foundation

**Dependencies:** PBI-001 (monorepo scaffold), PBI-005 (events package)
                                                ^^^^^^^
                                                higher than 004 — defect
```

A reader scanning the epic in number order hits PBI-004 first, learns it depends on PBI-005, but PBI-005 hasn't been read yet. Reading order doesn't match build order.

## Fix pattern

1. **List prerequisites for each PBI.** Build the dependency graph.
2. **Topologically sort.** Order PBIs so every prerequisite appears before its dependents.
3. **Renumber the files** via `git mv` to match the sort.
4. **Update cross-references** in PBI bodies and in `epic.md` if it cites PBI numbers.
5. **Update `.wag/state.json`** if `active_pbi` references a renumbered file.
6. **Update any open snags** that cite the renumbered files by their old names.

If renumbering is undesirable (e.g. PBIs already referenced in external docs / PRs), the alternative is to re-scope — fold the higher-numbered dependency into the lower-numbered PBI so the dependency disappears. Renumbering is the default fix.

## Authoring-time prevention

Run the linear scan at the end of any `/wag:docs` session that creates or modifies multiple PBIs in an epic. 10-second check before commit prevents the defect from being committed in the first place.

## Embedded into

- **Commands:** pending — `/wag:docs` should gain an end-of-session check that runs the linear scan across the epic's PBI files and halts on violation.
- **Templates:** `~/.claude/wag/templates/backlog-pbi.md` — "Authoring rules" section contains the Dependency direction rule as prose. Template is authoritative for PBI shape; downstream authoring must comply.
- **Learnings:** `~/.claude/wag/learnings/LEARNING-005.md` (this file) — portable baseline for cross-project reach.
