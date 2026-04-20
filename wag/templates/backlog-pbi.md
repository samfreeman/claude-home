# PBI-NNN: [Title]

**Priority:** P1 | P2 | P3
**Dependencies:** [other PBIs, or "None"]

## Description

[What and why. Reference the epic (if this PBI belongs to one), PRD sections, Architecture decisions, or previous PBIs as relevant. Be specific — this is the input an ADR is designed against.]

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

1. **Dependency direction.** `Dependencies:` must reference only PBIs with numbers **lower than** this PBI's own number. Forward dependencies only. (LEARNING-005)
2. **Epic membership is file location.** A PBI inside `backlog/epic-NNN-slug/` belongs to that epic. A PBI at `backlog/` root is standalone. No in-file frontmatter for epic membership.
3. **Numbering is sequential and never reused.** Scan `.wag/backlog/` including `_completed/` to find the next PBI number. Epic and PBI numbering sequences are independent.
4. **Platform features name their tier.** Any deliverable that names a platform feature (GitHub, Vercel, Turso, Neon, etc.) must also name the tier it assumes, and that feature must be confirmed available on that tier. (LEARNING-003)
