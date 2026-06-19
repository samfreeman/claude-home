# The Branch Transcript

The load-bearing record of an unattended (`wagh:`) run. It exists so that when you wake and evaluate the PR stack, you have **a complete — if terse — record of everything that transpired.** No step is invisible. That completeness requirement is the design constraint that dictates where actors consult guardians.

**Location:** `.wag/transcripts/PBI-EEE.PPP.md`, one per PBI. Append-only. It rides *in* the feature branch, so the PR self-documents and the record survives the squash-merge.

## The court model

Every `wagh:` step is a courtroom. Four roles:

| Role | Who | Does |
|---|---|---|
| **Defendant** | the work — the ADR, the file, the gate result, the tests, the Review | is judged |
| **Defense** | the **actor** (ADR, DEV, CQ, TESTER, RVW) | produces the work, argues it's safe, *may push back* |
| **Prosecution** | the **guardian** (ADRG, DEVG, CQG, TESTERG, RVWG) | pessimistically presses the case that proceeding is dangerous |
| **Judge** | the **human** | rules at escalation and at the back-gate; **merge is the verdict** |

**Burden is two-tier:**
1. **Production — on the prosecution.** The guardian must *produce* a real objection (a charge against its indictment). No objection produced → no case → **the defendant goes free** (clean pass).
2. **Persuasion — on the defense, once a charge is on the table.** Now the actor must rebut or rework; the work is presumed unsafe *with respect to that charge* until cleared.

**We hope the defendant goes free.** The guardian's pessimism is in how hard it *looks*, not a drive to *block*. A loop where guardians manufacture fights never converges — exactly wrong for unattended runs. As precedent accrues in the reasoning docs, more calls are obvious, fewer objections get produced, escalation falls run-over-run.

## Guardians author nothing but the transcript

Actors produce artifacts (the ADR, code, tests, the Review). **Guardians write nothing else** — they object, approve, and record. A guardian never writes an ADR, a line of `src`, a test, or a review of its own.

## What gets recorded — every step, terse; fights, verbatim

The artifact **is** the agreement — the ADR file, the code, the tests sit in the branch, so the transcript never re-pastes them. But **every step still writes the guardian's digest**, even a clean pass, or that step becomes a blind spot in your wake-up read.

- **Clean pass (acquittal):** one terse digest line from the guardian — *what it reviewed, its verdict, the blast-radius rating.* e.g. `DEVG · src/loop/schedule.ts · conforms to ADR D-3, no objection · blast-radius: low`.
- **Contested step:** the digest header **plus the verbatim turns** — each party records its own turn: the actor's proposal, the guardian's objection + reasoning, the defense (rework or push-back), the ruling. Append in order.

### Entry format

```markdown
## <ACTORG> · <step label> · <YYYY-MM-DD>
**Verdict:** agreed | reworked | escalated | snagged
**Blast-radius:** low | medium | high
**Digest:** <one-line summary of what happened at this step>

<!-- verbatim turns below — only when contested -->
**[ACTOR]** <proposal>
**[ACTORG]** <objection + reasoning>
**[ACTOR]** <defense: rework or push-back>
**[ACTORG]** <ruling>
```

## The loop and its exits

Each pair runs `(actor → guardian)` rounds. **N is a per-*contestation* deadlock counter, not a per-step cap.** It bounds the rounds spent on **one unresolved charge**, and **resets to 0 the moment that charge resolves.** A long, productive negotiation — many charges, each settled — never trips N; only a *single* charge that won't resolve does. **N = 3.**

- **A charge resolves** (the actor reworks, or pushes back and the guardian withdraws) → the counter **resets to 0**; the next charge starts fresh.
- **No charge raised / all charges resolved** → the defendant goes free; the step's digest is written; the loop advances.
- **Blast-radius too big** (irreversible — touches `main`/data/external side-effects; or foundational surface — shared/schema/public-interface files or >~5 files; or would require editing Architecture/PRD, which is itself a snag) → the guardian escalates to the human **immediately**, without burning rounds.
- **A single charge deadlocked at N** (still contested after N rounds on *that* charge) → escalate to the human via `hwag.ask`.
- **No human answer** (`[hwag:no-answer]`) → the guardian writes a **PBI-scoped snag**; that PBI **stops**, and a dependency recheck lets the rest of the DAG continue (graceful degradation, not a batch halt).

Every escalation the human resolves promotes into the reasoning docs (`~/.claude/wag/reasoning/global.md` / `.wag/reasoning/local.md`) — reviewing the transcript at the back-gate *is* the precedent-promotion step.

## The per-PBI grammar

```
(ADR → ADRG)*  →  [ ( (DEV → DEVG)* | (CQ → CQG)* | (TESTER → TESTERG)* )  →  (RVW → RVWG) ]*
```

The outer `[…]*` **is** the base cycle's `[DEV → RVW]*` (`ADR → [DEV → RVW]* → TRI`), with every actor guarded. RVWG agreeing on a clean Review **exits** the bracket; a REQUEST_CHANGES verdict **remands to DEV** and the bracket repeats. RVW in-loop is a loop-control signal — distinct from the human's back-gate review.

**Consult-points** (derived from "the record must be complete" — the actor consults its guardian at every point that creates or changes an artifact or a verdict):

| Actor | Consults its guardian at | Mode |
|---|---|---|
| ADR | each design decision; the finished ADR for approval; any grill question | artifact gate + live grill |
| DEV | the implementation plan; **then each file, before the edit** | pair-programmer **hard gate** |
| CQ | after the gates run — all applied + green | post-gate sanity check |
| TESTER | each test file | pair-programmer hard gate |
| RVW | the Review, before it's accepted | verdict double-check |