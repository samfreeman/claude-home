# Research Workflow — Phase B

## Purpose

Given a VISION.md, identify unknowns and investigate them in parallel across three research axes.

## Input

- `.wag/docs/VISION.md` — the project vision from Phase A

## Process

### 1. Identify research questions

Read the vision and identify what you don't know. Group questions by axis:

- **Ecosystem** — libraries, APIs, tools, community health, gotchas
- **Feasibility** — technical constraints, hard limits, what requires compromise
- **Architecture patterns** — how others built similar things, what worked/failed

For each axis, write 3-5 specific questions derived from the vision. These are not generic — they target the unknowns in THIS project.

### 2. Launch parallel research

Spawn one `wag-researcher` agent per axis. Each receives:
- Their axis name
- The full VISION.md content
- Their specific research questions

All three agents run in parallel, each in a fresh context.

### 3. Consolidate findings

When all agents return, synthesise their findings into a single RESEARCH.md:
- Organise by axis
- Note where findings from different axes reinforce or contradict each other
- Highlight key takeaways that will influence requirements and architecture
- Flag remaining unknowns — things research couldn't answer

### 4. Present to user

Show the user the consolidated research. This is a conversation:
- Walk through key findings
- Ask if anything surprises them or conflicts with their expectations
- Ask if there are areas they want deeper investigation on
- Incorporate their feedback before finalising

## Output

Write `.wag/docs/RESEARCH.md` using the research template.

## Fallback

If sub-agents are not available (no Agent Teams), run the three axes sequentially in the main context. Less ideal (context accumulates) but functional.
