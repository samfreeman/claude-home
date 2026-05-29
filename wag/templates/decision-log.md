# Decision Log — <PBI EEE.PPP> — run <YYYY-MM-DD-N>

Per-run trace of every design call an unattended `hadr` run made while self-playing the grill. This is the **evidence** the on-demand log-grill reviews; the user's corrections during that grill get promoted into the global / local reasoning docs.

**How to read it:** scan the **Confidence** and **Blast radius** columns first. High-confidence, rule-sourced calls are skimmable. The ones to grill are **low confidence** and/or **high blast radius** — and anything marked `escalated-SMS`, where the agent already judged it couldn't decide alone.

**Run header**
- **PBI:** <PBI EEE.PPP — title>
- **ADR:** <path to the ADR this run produced>
- **Reasoning docs in effect:** global `~/.claude/wag/reasoning/global.md` @ <commit/date> · local `.wag/reasoning/local.md` @ <commit/date>
- **Outcome:** PR opened <url> | halted at <stop> | <other>

---

## Decision entry format

```
### D<n>: <short decision title>
- **Question:** <the design question the grill raised>
- **Options:**
  - A — <option> · <one-line tradeoff>
  - B — <option> · <one-line tradeoff>
- **Chosen:** <A/B/…>
- **Justification:** <why this option, in the agent's words>
- **Source:** [G-NNN] | [L-NNN] | none (novel call)
- **Confidence:** high | medium | low
- **Blast radius:** low | medium | high   (how much rework if this is wrong)
- **Disposition:** decided-by-rule | decided-self | escalated-SMS → <resolution>
```

**Stop rule (must be honoured by the run):** if **Confidence = low AND Blast radius = high**, the agent does **not** self-decide — it escalates via the `hwag` `ask` SMS bridge and records the resolution under Disposition. Snags and template drift are separate hard-stops handled at pre-flight, not logged as decisions.

---

## Decisions

<!-- Example entry — delete when the run writes real ones:

### D1: State storage for the onboarding wizard
- **Question:** Where does multi-step wizard state live between steps?
- **Options:**
  - A — URL search params · shareable/back-button-safe, but ugly for nested data
  - B — server session record · clean, survives refresh, but a new table + migration
  - C — client-only store · simplest, but lost on refresh
- **Chosen:** A
- **Justification:** Fewer moving parts than B (no migration), and survives refresh unlike C. Wizard state is flat (3 scalar fields), so the search-param ugliness doesn't bite.
- **Source:** [G-001]
- **Confidence:** high
- **Blast radius:** low
- **Disposition:** decided-by-rule
-->
