# SNAG-NNN: [short title — one line]

**Status:** open *(the only on-disk state — resolution deletes this file)*
**Mode:** discovery | propagation
**Source:** [where the defect was discovered — `/wag:adr` preflight, `/wag:dev` implementation, user testing, code review]
**Target:** [impacted artifact(s) — e.g. `Architecture.md > Data Model`, `.wag/backlog/epic-002-bootstrap/`, a specific PBI file]
**PBI:** [related PBI number, or "none"]

## Mode

Pick **discovery** when the fix direction is unknown — fill `Impact` + `Fix options` below so the resolution protocol can deliberate.
Pick **propagation** when the user has already stated the fix direction in conversation before the snag was captured (e.g. "yes, use effect.Schema") — skip `Impact` + `Fix options` and fill `Affected files` instead. The work is grep-and-update, not deliberation.

## Assumed

[What the upstream document(s) said would be true. Quote the specific prose or structure the downstream work relied on.]

## Reality

[What was actually encountered. Be specific — filenames, line numbers, quoted text, failure mode. Root-cause if clear.]

## Impact *(discovery mode)*

[Which sections of which documents are wrong, and how. Where does the wrongness leak downstream — what PBIs, ADRs, or implementations rely on the broken assumption?]

## Fix options *(discovery mode)*

[One or more concrete fix paths. For each, name what changes and what the tradeoff is. Mark one as the **Default recommendation** if there's a clear preferred path.]

- **Option 1: [name]** — [what it does, what it costs]
- **Option 2: [name]** — [alternative, tradeoff vs option 1]

**Default recommendation:** [option N, with one-line reasoning]

## Affected files *(propagation mode)*

[The complete file list from the scan-read-edit protocol (Steps 2–3 of `~/.claude/wag/workflows/snag-resolution.md`). Every file the grep scan surfaced, with the specific change for each. Populated upfront — no trickle.]

- `path/to/file.md` — [specific change]
- `path/to/other.md` — [specific change]

## Resolution

[Filled during TRI as the resolution lands. Summarise what was changed, where, why. **While the snag is open this section is the working source of truth**; at closure the file is deleted and the narrative lives in the closing commit — changelog entries and commit messages are one-line pointers, not re-narrations.]

## Disposition

[Filled at TRI Step 4: **local** (this project only — steps 1–3 covered it), **global** (a rule embedded mechanically into a wag template or command — name the file and the rule), or **both**. There is no pending state — a global rule embeds before this snag closes.]
