---
description: Build a working POC before the real app — intake, viability, mockups, architecture, a draft backlog, then a clickable HTML showcase deployed for business review; once approved, hands off to the real build, which starts at PBI 000.001. The alternative to /wag:init.
allowed-tools: Read, Write, Edit, Bash, Agent, WebSearch, WebFetch, Grep, Glob, Skill
---

# WAG POC — a working showcase before the real build

You are running the WAG POC flow. It takes an idea to a running, clickable HTML POC with fake
data, working links, the user flow, and the PRD, Architecture and draft backlog readable
inside it. Business
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

- **Viability before mockups; a chosen look, then an approved backlog, before the POC.** The
  backlog is drafted after the Architecture is approved (workflow Step 5), straight into
  WAG's epic folders under `.wag/backlog/`, one folder per epic and one file per PBI.
- **No repo until PBI 000.001.** The project lives in Dropbox. The handoff copies `.wag/`,
  backlog included, to `~/source/<project>`; standing up the app, repo included, is the
  backlog's first PBI.
- **The POC is plain HTML from `wag/templates/poc/`.** It has no build step and no backend,
  and it's written in the real app's vocabulary (Tailwind, theme tokens, shadcn `data-slot`,
  Lucide).
- **Approval-gated.** No step advances without the user's approval.
- **One small file per page, in `pages/`.** The POC is one HTML file per route, all in
  `.wag/poc/pages/` (`/` is `pages/index.html`, `/x` is `pages/x.html`, and `/x/[id]` is
  `pages/x.html?id=`), plus the shared files one level up (`shell.js`, `data.js`,
  `theme.css`). It's never one large page, because voice can't write a large file in one go.
  The root `.wag/poc/index.html` only redirects to `pages/index.html`.
- **Voice writes the readable copy first.** Every HTML file (each page, the root redirect,
  the mockups) has a `NAME.md` sibling with less-than and greater-than signs written as
  U+2039 and U+203A, because voice's Dropbox reader strips anything tag-like from HTML. Any
  other file gets one only if reading it back shows something stripped. The `NAME.md` is
  voice's source: it's written or edited first, and the file is decoded from it, never the
  other way round. See the workflow's readable-copy rule.
- **The PRD, Architecture and backlog shown in the POC are generated copies.**
  `.wag/docs/PRD.md`, `Architecture.md` and the epic folders under `.wag/backlog/` stay the
  sources of truth. `.wag/poc/docs/PRD.js`, `Architecture.js` and the files in
  `.wag/poc/docs/backlog/` carry their markdown so the Project Documents page can render it
  in place, even opened from disk. Whatever writes a
  doc regenerates its copy in the same step, and the copies are never edited by hand. See the workflow's docs-copies rule. The
  POC doesn't use `/wag:html-prd`, `/wag:html-architecture` or `/wag:html-docs`.

## When you're done

- **After the deploy:** give the user the POC's URL to review and send.
- **After the handoff:** tell the user what was created and where: `~/source/<project>/.wag/`
  with the backlog in its epic folders. Suggest running `/wag:adr` on PBI
  000.001, which stands up the app.
