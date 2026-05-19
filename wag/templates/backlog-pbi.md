# PBI 001.003: [Title]

**Priority:** P1 | P2 | P3
**Dependencies:** [other PBIs (e.g., PBI 001.001), or "None"]

## Description

[What and why. Reference the epic, PRD sections, Architecture decisions, or previous PBIs as relevant. Be specific — this is the input an ADR is designed against.]

## Deliverables

- [Concrete files/features to be produced. Specific enough that an ADR can be written from this — not "build the thing," but "ship X workspace with Y shape and Z public surface."]

## Acceptance Criteria

- [ ] [Specific, testable outcomes. Each item is a checkbox that can be verified.]

## Testing Requirements

- [ ] [Specific test coverage the implementation must include — unit, integration, lifecycle, negative cases.]

## Technical Notes

[Optional — implementation hints, gotchas, reference patterns, open questions the ADR should resolve. Not a design — that's the ADR's job. Leave this section out if there's nothing useful to note.]

---

## Authoring rules

*These apply when `/wag:docs` creates or modifies PBI files. Failed checks halt the command and raise a snag per the snag-resolution protocol.*

1. **Dependency direction (within an epic).** Inside a single epic, `Dependencies:` must reference only PBIs with a lower local number than this PBI's own number. A reader scanning the epic's PBIs in number order encounters each PBI before its dependents, not after. Cross-epic dependencies are fine — they're named with the full `PBI EEE.PPP` form. (LEARNING-005)
2. **Epic membership is file location.** A PBI inside `backlog/epic-NNN-word/` belongs to that epic. Loose work — bug fixes, small UI tweaks, afterthoughts — lives in `epic-000-general/`. No in-file frontmatter for epic membership.
3. **Per-epic numbering.** Each epic numbers its PBIs starting at 001. The canonical PBI ID is `PBI EEE.PPP` where `EEE` is the epic number and `PPP` is the per-epic PBI number, both zero-padded triples. The filename inside the epic folder is `PBI-PPP.md` — the epic number comes from the folder. Scan the epic's `_completed/` mirror when picking the next number; closed PBI numbers are never reused.
4. **Completed PBIs are immutable.** Once a PBI is moved into `_completed/`, its number and epic membership are locked forever. Open PBIs can be renumbered or moved between epics; closed ones cannot. (Migration of a project's pre-existing backlog via `/wag:migrate-backlog` is the one exception.)
5. **Platform features name their tier.** Any deliverable that names a platform feature (GitHub, Vercel, Turso, Neon, etc.) must also name the tier it assumes, and that feature must be confirmed available on that tier. (LEARNING-003)
