---
description: Build a working POC before the real app — intake, viability, mockups, architecture, then a clickable HTML showcase deployed for business review; once approved, hands off to the real Next.js build. The alternative to /wag:init.
allowed-tools: Read, Write, Edit, Bash, Agent, WebSearch, WebFetch, Grep, Glob, Skill
---

# WAG POC — a working showcase before the real build

You are running the WAG POC flow. It takes an idea to a running, clickable HTML POC with fake
data, working links, the user flow, and the PRD and Architecture readable inside it. Business
people open it from a link. Once they approve it, the real application is built from it the
WAG way.

A project runs `/wag:poc` **or** `/wag:init`, not both.

## Who's reading this

- **Voice** reads this file and the workflow from the claude-home copy in Dropbox, and does
  every step marked Voice, getting the project to a working HTML site.
- **CC** runs this as `/wag:poc` for the steps marked CC: deploying, and the handoff after
  approval.

## Before you start

1. Read `wag/workflows/poc.md` for the full procedure. It points into
   `wag/workflows/init.md` for the steps the two commands share; read those parts when you
   reach them.
2. Read `wag/references/questioning.md` if the product still needs describing.
3. **Find where the project is** (workflow Step 0). Unlike init, an existing `.wag/` is not
   a reason to stop: read `.wag/state.json`'s `poc` stage, or work out the stage from
   what's on disk, and resume there. In CC:
   - **`building`:** the next CC step is the deploy, once voice has the site working.
   - **`deployed`:** redeploy after changes.
   - **`approved`:** do the handoff.

## The process lives in the workflow

`wag/workflows/poc.md` is the single source of truth for the steps, who does each, the
`.wag/` layout and the handoff. Follow it; don't restate it here.

## Non-negotiables

- **Viability before mockups; a chosen look before the POC.**
- **No repo until approval.** The project lives in Dropbox; the handoff creates the repo.
- **The POC is plain HTML from `wag/templates/poc/`.** It has no build step and no backend,
  and it's written in the real app's vocabulary (Tailwind, theme tokens, shadcn `data-slot`,
  Lucide).
- **Approval-gated.** No step advances without the user's approval.

## When you're done

- **After the deploy:** give the user the POC's URL to review and send.
- **After the handoff:** tell the user what was created and where: the repo at
  `~/source/<project>`, the scaffolded app, and the backlog whose first PBI ports the POC.
  Suggest running `/wag:adr` on that first PBI.
