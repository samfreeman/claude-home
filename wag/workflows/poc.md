# POC Workflow — a working showcase before the real build

## Purpose

Take a product idea to a **running, clickable POC** that business people can open from a link,
before any real application exists. The POC shows the look and feel and the user experience:
every page in the PRD, realistic fake data, working links, the user flow end to end, and the
project's PRD and Architecture readable (and downloadable) inside it. First the user is happy
with it; then they send the link and see if the business people are.

Only once the POC is approved does the real build start. Then the POC becomes the real app's
visual spec, its theme and fake data carry straight over, and the WAG process builds the
real thing.

`/wag:poc` is the alternative to `/wag:init`: a project runs one or the other. It reuses
init's opening steps from `wag/workflows/init.md` rather than restating them.

## Who does what

Every step below is marked **Voice** or **CC**.

- **Voice** (Claude voice) reads and writes the project's files in Dropbox, reads these WAG
  files from the claude-home copy in Dropbox, and renders HTML. It can't run commands. Voice
  gets the project all the way to a working HTML site. Voice's Dropbox reader strips HTML
  tags (even inside code fences), so it reads the starter through copies in the same folder:
  `data.js.md` is `data.js` unmodified, and `index.html.md` is `index.html` with every `<`
  written as `‹` and every `>` as `›`. Voice turns them back when it writes `.wag/poc/index.html`.
- **CC** (Claude Code) runs commands: it deploys the POC, and after approval it does the
  handoff to the real build.

When the user works in CC alone, CC does the voice steps too.

### The readable-copy rule (voice)

The same reader stops voice from reading back HTML it wrote. So **every time voice writes or
edits an `.html` file** in the project, under `.wag/mockups/` (every option, the chosen one
included) or `.wag/poc/` (including `poc/docs/`), it also writes a sibling `<name>.html.md`.
The sibling holds the same source with every `<` written as `‹` (U+2039) and every `>` as
`›` (U+203A), and nothing else.

- **Keep the pair in step.** Every edit to the `.html` rewrites its `.html.md` in the same
  turn. A sibling that's out of date is worse than none.
- **Read the sibling, write the original.** To look at or change a page, voice reads the
  `.html.md` and turns `‹›` back into `<>`. It then writes the result to the `.html`, and the
  re-encoded version to the `.html.md`.
- **The siblings are for voice only.** The site never links to them, and they aren't
  deployed: `.vercelignore` excludes `*.html.md` (see Step 6).

## Where it lives

The project is a folder in **Dropbox**, so voice can reach it. There's **no git repo** until
the POC is approved.

```
<Dropbox>/Claude/<…>/<Project>/
└── .wag/
    ├── state.json              app_name, wag_version, poc stage, poc_url
    ├── docs/
    │   ├── PRD.md
    │   ├── RESEARCH.md
    │   └── Architecture.md
    ├── mockups/
    │   └── option-1.html … option-5.html    the round-one looks (+ .html.md siblings)
    └── poc/                    the site — this folder is what gets deployed
        ├── index.html          (+ index.html.md)
        ├── theme.css           the theme, tweakcn format
        ├── data.js             the one fake data set
        ├── vercel.json
        ├── .vercelignore       keeps the .html.md siblings off the site
        └── docs/
            ├── PRD.html            self-contained, downloadable (+ .html.md)
            └── Architecture.html   self-contained, downloadable (+ .html.md)
```

Every `.html` has a readable `.html.md` sibling for voice (the readable-copy rule above).

`state.json`'s `poc` field tracks the stage: `building` → `deployed` → `approved` →
`handed-off`. It's how voice and CC know where the project is, and the approval signal.

---

## Steps

### Step 0: Pick up where the project is — Voice

`/wag:poc` starts from whatever already exists; it never refuses because `.wag/` exists.

- **No folder yet:** ask for the project's name and where in Dropbox it goes, and create it.
- **`.wag/state.json` exists:** read its `poc` stage and resume there. If it says
  `approved`, the next step is CC's handoff (Step 7).
- **Docs exist but no state:** work out how far the project got from what's on disk — a PRD,
  RESEARCH, Architecture, mockups, a POC — and resume at the first step whose output is
  missing or doesn't meet its template.

Write `.wag/state.json` if it's missing:

```json
{ "app_name": "<Project>", "wag_version": "<~/.claude/wag/config.json version>", "poc": "building", "poc_url": null }
```

### Step 1: Describe the product → PRD — Voice

Init's **Phase A** (`wag/workflows/init.md`). For a project that already has a PRD, don't
redo intake. Check the PRD against the required-content manifest at the top of
`~/.claude/wag/templates/prd.md`, and grill the user on whatever it leaves unanswered. The
UI pages item (the route table and menu) matters more here than anywhere: it's the list of
pages the POC builds.

**Transition:** the user approves the PRD.

### Step 2: Viability → go / no-go — Voice

Init's **Phase B1**. Don't mock up an app that hasn't passed viability.

**Transition:** the user says go.

### Step 3: Mockups → a look — Voice

Build **4–5 looks** in `.wag/mockups/option-N.html`.

- **Each look shows** the landing page's hero plus a few signed-in pages, chosen to cover the
  kinds of page the app has: a list, a detail page, a form, a dashboard. The point is to see
  how each look carries the variety it will actually have to carry, not just one page.
- **Use realistic content** from the PRD, never lorem ipsum.
- **Start from the starter.** Copy the `<head>` of `~/.claude/wag/templates/poc/index.html`
  and its `theme.css` so each look renders the way the POC will.
- **Static.** Lay the pages out one after another, with a small label above each naming its
  route. No routing yet.
- **Dark mode first.** Build every look in dark mode only: put the `dark` class on `<html>`
  and fill in the `.dark` colour block. Light mode comes after the pick.
- **Inside the house UI standard** (`~/.claude/wag/references/ui-standard.md`). The looks vary
  what the standard leaves open for signed-in pages: layout and navigation chrome, density,
  how cards, tables and forms look, and which landing-page traits carry over. They also vary
  the theme, if the brand isn't settled.

The user picks one, then you go back and forth on it until they're happy. The other options
stay in `mockups/` as the record of what was considered.

**Then design the light mode, in the same file.** The standard wants both modes *designed*,
not one derived from the other, so light is worked out with the user rather than generated
from dark:

- **The colours.** Fill in the chosen look's `:root` (light) colour block alongside its
  `.dark` block, with the same tokens.
- **The toggle.** Add a working light/dark toggle: the starter's `toggle-theme` button and
  its theme script. It's the only control in a mockup that works; nothing navigates.
- **Check both modes.** Go back and forth until every page in the look reads well in both.

The finished mockup is **one file with both modes and a working toggle**. Its two colour
blocks are what Step 4 writes to `theme.css`.

**Readable copies:** every option file, and every edit to one (the chosen look's tweaks
included), gets its `.html.md` sibling written in the same turn.

**Transition:** the user approves the chosen look in both light and dark.

### Step 4: Research + Architecture — Voice

Init's **Phase B2**. Architecture's `Design direction` records the chosen look: which
option, its answers to the standard's open signed-in items, and any departure with its
reason. Write the theme to `.wag/poc/theme.css` in tweakcn's format, taking the chosen
mockup's `:root` and `.dark` blocks as they stand. Its first line names the
tweakcn preset, or says `custom` if the theme was edited.

**Transition:** the user approves the architecture.

### Step 5: Build the POC → a working site — Voice

Copy `~/.claude/wag/templates/poc/` to `.wag/poc/` and build on it. Its opening comment is the
markup contract; follow it. The POC is:

- **Every route in the PRD's UI pages table**, as `data-route` sections in `index.html`, in
  the chosen look, with the menu as the PRD describes it.
- **Working links and the user flow.** Every link goes somewhere (`href="#/route"`), and a
  person can walk the PRD's User Flow from the landing page through sign-in to every page.
  A dynamic route (`/calls/[id]`) renders whichever record its link names.
- **One fake data set** in `data.js`, seen by one signed-in user. Use one cast of people and
  items carried across every page. No per-user variations: this shows look, feel and
  experience, not permissions. After approval this data set becomes the real app's dev and
  QA seed, so make it realistic.
- **The landing page** per the standard's landing-page spec, signed out at `/`.
- **Simulated sign-in.** The sign-in page's button signs you in; there's no real auth.
- **The standard signed-in chrome**, in every POC:
  - sign out;
  - the light/dark toggle;
  - a **Development** section holding **Project Plan & Status**.
- **Project Plan & Status** is an accordion:
  - **PRD** and **Architecture**, each a self-contained HTML render in `poc/docs/`, shown in
    its accordion item and downloadable as that one file. Render them by the
    `/wag:html-prd` and `/wag:html-architecture` procedure (`~/.claude/commands/wag/`), but
    write them to `poc/docs/`.
  - **Backlog**, which says the backlog (epics and PBIs) is written once the POC is approved.
- **Written in the real app's vocabulary**, so porting it is translation rather than redesign:
  - Tailwind classes, theme tokens only, no hardcoded colors;
  - every control marked `data-slot` (plus `data-variant`) with the shadcn component it
    stands in for, its classes taken from that component;
  - Lucide icons by name;
  - the signed-in shell as one region (it becomes the real app's `layout.tsx`).

**Readable copies:** `index.html`, `docs/PRD.html` and `docs/Architecture.html` each get
their `.html.md` sibling, rewritten on every edit.

**Flow problems get fixed now.** Building the pages can expose a gap: a flow step with no
page, a page with no way in, data a page shows that no flow creates, or two parts of the PRD
that disagree. When that happens, fix the PRD in the same session, alongside the POC,
re-render `poc/docs/PRD.html`, and tell the user what changed.

**Transition:** the user has clicked through the whole POC locally and is happy with it.

### Step 6: Deploy → a link to send — CC

From the project root:

```
vercel link --yes --project <project>-poc --cwd .wag/poc
vercel deploy --prod --yes --cwd .wag/poc
```

- **The URL.** The first deploy creates the Vercel project. A production deploy is public at
  `https://<project>-poc.vercel.app`; previews sit behind a Vercel login by default, so they
  won't open for business people.
- **Before deploying,** make sure `.wag/poc/.vercelignore` exists and holds `*.html.md`
  (copy it from `~/.claude/wag/templates/poc/` if not), so voice's readable copies stay off
  the site.
- **Unlisted, not protected.** The URL is open to anyone who has it. The POC asks not to be
  indexed (a `noindex` meta tag, plus the `X-Robots-Tag` header in `vercel.json`).
- **Record it.** Write the URL to `state.json`'s `poc_url` and set `poc` to `deployed`.
- **Changes.** For a tweak, voice edits the files and CC re-runs `vercel deploy --prod`. The
  URL stays the same, so there's nothing new to send.

**Transition:** the user sends the link. The business people's answer is the approval.

### Step 7: Approved → the handoff — CC

**The signal.** `state.json`'s `poc` is set to `approved`. Voice sets it when the user says
the POC is approved, or CC does. The user then runs `/wag:poc` in CC from the project's
Dropbox folder. It sees `approved` and does the handoff:

1. **Copy `.wag/` into the repo folder.** Create `~/source/<project>/` and copy the
   project's `.wag/` into it, leaving `poc/.vercel/` behind.
2. **Scaffold the real app.** Run `/wag:create-nextjs` there, init's **Phase C**. It creates
   the single root git repo (which tracks the copied `.wag/`), scaffolds the baseline from
   Architecture.md, and offers the GitHub repo. The theme layer installs from
   `.wag/poc/theme.css` (`/wag:add-theme` reads it). If the baseline includes a database,
   `/wag:add-db` sets up seed and reset; the seed is `.wag/poc/data.js`'s data set.
3. **Write the backlog.** Init's **Phase D**, with one addition:
   - **The first PBI ports the POC into the real app**, still on its fake data: the shell to
     `layout.tsx`, every page, the standard chrome, each `data-slot` element swapped for its
     shadcn component. The real app then looks and clicks like the POC from the start.
   - **Later PBIs swap fake data for real**, one feature at a time. Each UI PBI names the
     POC page it ports.
4. **Finalise `.wag/`.** Init's **Phase E**. `state.json` keeps its `poc` and `poc_url` fields;
   set `poc` to `handed-off`.

**From here on the repo's `.wag/` is the source of truth.** The Dropbox folder stays as the
POC that was approved, not kept in step with the repo.

**Data in the real app:** production has real data and is never seeded or reset. Dev and QA
run on real databases (or local server-side ones) seeded from the POC's fake data, and
resettable back to it.

---

## Rules

1. **The user approves every transition.** Never auto-advance.
2. **Viability before mockups; a look before the POC.**
3. **The POC is a showcase, not the app.** It's plain HTML with no build step and no backend.
   After approval it's the visual spec the real app ports, never the real app's code.
4. **No repo until approval.** The project lives in Dropbox until the handoff.
5. **One data set, one user's view.** It's what the POC shows, what the ported shell shows,
   and what dev and QA are seeded with.
6. **Flow problems are fixed in the PRD on the spot.** The PRD stays the source of truth.
