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
  gets the project all the way to a working HTML site.
- **Voice's Dropbox reader strips anything that looks like a tag,** in any file, Markdown
  included. So the claude-home copy in Dropbox is encoded for it: in every Markdown file there
  (this one too), each less-than sign (U+003C) appears as the single left-pointing angle
  quotation mark (U+2039), and each greater-than sign (U+003E) as the single right-pointing one
  (U+203A). Read them as less-than and greater-than. When copying code or markup out of these
  files, turn them back. The starter's files (the root `index.html`, `shell.js`, `data.js`,
  and the pages in `pages/`) are read through their encoded copies, `NAME.md`, beside each
  file.
- **CC** (Claude Code) runs commands: it deploys the POC, and after approval it does the
  handoff to the real build.

When the user works in CC alone, CC does the voice steps too.

### The readable-copy rule (voice)

The same reader stops voice from reading back markup it wrote. So **every project file that
contains markup has a readable sibling `NAME.md`**: every mockup option under
`.wag/mockups/` (the chosen one included), every POC page in `.wag/poc/pages/` (one file per
route), the root redirect `.wag/poc/index.html`, `shell.js` (it builds the nav from markup
strings), and the docs renders
in `.wag/poc/docs/`. That makes `items.html.md`, `shell.js.md` and so on. The sibling holds
the same source with every less-than sign (U+003C) replaced by U+2039 and every greater-than
sign (U+003E) by U+203A, and nothing else. A file with no markup in it, such as `data.js` or
`theme.css`, needs no sibling.

- **The `NAME.md` is voice's source; write it first.** The file can be derived from its
  sibling (swap the two characters back), but voice can't derive the sibling from the file,
  because it can't read the file. So for every new file and every edit:
  1. Write or edit the `NAME.md`.
  2. Decode it into the file.

  Never edit the file directly. A change made there is invisible to voice and gets lost the
  next time the file is regenerated from its sibling.
- **Keep the pair in step.** Both files change in the same turn, every time. If they ever
  disagree, the `NAME.md` is right; regenerate the file from it.
- **To look at a file,** read its `NAME.md` and read U+2039 and U+203A as less-than and
  greater-than.
- **The siblings are for voice only.** The site never links to them, and they aren't
  deployed: `.vercelignore` excludes `*.html.md` and `*.js.md` (see Step 6).

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
        ├── index.html          only redirects to pages/index.html (the site's front door)
        ├── pages/              every page, one file per route
        │   ├── index.html          the "/" route: landing (signed out) + dashboard (signed in)
        │   ├── sign-in.html        the "/sign-in" route
        │   ├── ROUTE.html …        one file per other route in the PRD's UI pages table
        │   └── project-plan-status.html   the standard Development page (the docs viewer)
        ├── shell.js            the shared signed-in shell and page behaviour
        ├── theme.css           the theme, tweakcn format
        ├── data.js             the one fake data set
        ├── vercel.json
        ├── .vercelignore       keeps the .md siblings off the site
        └── docs/
            ├── PRD.html            self-contained, downloadable
            └── Architecture.html   self-contained, downloadable
```

Every file with markup in it (the pages, `shell.js`, the docs renders) has a readable
`NAME.md` sibling for voice (the readable-copy rule above).

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
- **Start from the starter.** Copy the head of `~/.claude/wag/templates/poc/pages/index.html`
  (the Tailwind and Lucide scripts and the theme mapping; a mockup doesn't need `data.js` or
  `shell.js`) and the starter's `theme.css`, so each look renders the way the POC will.
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

**Readable copies, written first:** every option starts as its `.html.md`, and every edit
(the chosen look's tweaks included) is made there, then decoded into the `.html`.

**Transition:** the user approves the chosen look in both light and dark.

### Step 4: Research + Architecture — Voice

Init's **Phase B2**. Architecture's `Design direction` records the chosen look: which
option, its answers to the standard's open signed-in items, and any departure with its
reason. Write the theme to `.wag/poc/theme.css` in tweakcn's format, taking the chosen
mockup's `:root` and `.dark` blocks as they stand. Its first line names the
tweakcn preset, or says `custom` if the theme was edited.

**Transition:** the user approves the architecture.

### Step 5: Build the POC → a working site — Voice

**One small file per page.** Voice can't write one large file in a single call, so the POC is
a set of small pages sharing a few common files, never a single big `index.html`.

**First, the page map.** Once the PRD's routes are settled, the files follow mechanically:

- **One HTML file per route, all in `.wag/poc/pages/`:** `/` is `pages/index.html`, and `/x`
  is `pages/x.html`. Pages link to each other by bare name (`x.html`) and load the shared files
  one level up (`../theme.css`, `../data.js`, `../shell.js`). The root `.wag/poc/index.html`
  isn't a page: it only redirects to `pages/index.html`, so the POC's address opens the landing
  page.
- **A dynamic route folds into its parent's file:** `/x/[id]` lives in `pages/x.html` and
  reads the id from the query string, `x.html?id=…`.
- **Signed-out and signed-in views of the same route share one file:** for example, `/` holds
  both the landing page and the dashboard.
- **Each page holds only its own content.** The nav and the rest of the shell come from
  `shell.js`. Aim for under about 10 KB per file.

State the resulting page map back to the user (route, file, what's on it) as part of the
build discussion, before writing any pages.

**Then the starter.** Copy from `~/.claude/wag/templates/poc/` into `.wag/poc/`:

- **Files with markup, readable copy first,** each to the same place in `.wag/poc/`: the root
  `index.html` (the redirect), `shell.js`, and `pages/index.html`, `pages/sign-in.html` and
  `pages/project-plan-status.html`. For each one, take the encoded block from the starter's
  `NAME.md` (the part inside the code fence, without the note or the fence) and write it as the
  project's `NAME.md` beside where the file goes. Then decode that into the file.
- **The sample route page, `pages/items.html`,** shows how a list and its detail share one
  file. Use it as the pattern for each route in the page map: write each page's
  `pages/ROUTE.html.md` first, then decode it. Don't keep `items.html` unless the app has an
  items route.
- **Copy as is:** `data.js`, `vercel.json` and `.vercelignore`.
- **Don't copy:** `theme.css`, because Step 4 already wrote the project's theme there and the
  starter's neutral one would overwrite it. Also skip the starter's `data.js.md`; `data.js`
  has no markup, so the project doesn't need a copy of it.
- **Set the menu:** edit `NAV` at the top of `shell.js.md` (then decode `shell.js`) to match the
  PRD's menu, and put the app's name in `data.js`.

`shell.js`'s opening comment is the markup contract: each page's `data-auth`, `data-view`,
`data-page`, `data-list`/`data-record`/`data-fill`, and `data-if`/`data-unless` for the id.
Follow it. Every page loads `theme.css`, `data.js` and `shell.js` in its head, exactly as the
starter pages do.

The POC is:

- **Every route in the PRD's UI pages table**, as its own page per the page map, in the
  chosen look, with the menu as the PRD describes it.
- **Working links and the user flow.** Every link goes somewhere (`href="x.html"`, or
  `x.html?id=…` for a record), and a person can walk the PRD's User Flow from the landing page
  through sign-in to every page. A dynamic route renders whichever record its link names.
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
    its accordion item and downloadable as that one file (see *The docs renders* below).
  - **Backlog**, which says the backlog (epics and PBIs) is written once the POC is approved.
- **Written in the real app's vocabulary**, so porting it is translation rather than redesign:
  - Tailwind classes, theme tokens only, no hardcoded colors;
  - every control marked `data-slot` (plus `data-variant`) with the shadcn component it
    stands in for, its classes taken from that component;
  - Lucide icons by name;
  - the signed-in shell lives in `shell.js` (it becomes the real app's layout).

**The docs renders.** `poc/docs/PRD.html` and `poc/docs/Architecture.html` are the
high-quality version of each doc. The point is that a reader sees the design rather than
reading about it, so they're more than prose and tables. Render them by the `/wag:html-prd`
and `/wag:html-architecture` procedures (`~/.claude/commands/wag/`, which use
`~/.claude/wag/templates/html-shell.html` and `~/.claude/wag/references/html-render.md`), but
write them to `poc/docs/` and hold them to this bar:

- **Diagrams are required, as inline SVG** using the shell's `.d-*` and `.erd-*` classes.
  Wherever the doc has the content, draw it:
  - **Architecture:** the data model as an entity-relationship diagram (every schema), the
    main data flows (request → server → data, plus each external integration), a layer or
    host diagram of the app's structure, and a sequence diagram for each multi-actor flow
    (sign-in, anything with a third party).
  - **PRD:** the user flow end to end, a map of the UI pages and menu (the route tree), and
    the scope (v1 vs later vs non-goals).

  Propose the set, then review each diagram with the user, as the procedures say.
- **Tables are HTML tables** with the shell's styling: the tech stack, routes, data
  dictionaries, anything tabular.
- **Numbers become charts** where the docs carry them: viability's cost and capacity
  figures, phase timelines, volumes. Draw them as inline SVG bar or line charts, labelled,
  with no chart library, so the file stays self-contained.
- **On a re-render, the existing file is the baseline.** The procedures compare against git
  history, but the POC has no git. Instead, keep every diagram in the existing
  `poc/docs/*.html` whose section hasn't changed, and review only the changed ones with the
  user.
- **Self-contained and theme-matched:** no external files, and the POC's theme colours, so
  the downloaded file looks like the site it came from.

**Readable copies, written first:** every page's `NAME.html.md`, `shell.js.md`, and
`docs/PRD.html.md` and `docs/Architecture.html.md` are where voice writes and edits. The
pages, `shell.js` and the two renders are decoded from them every time.

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
- **Before deploying,** make sure `.wag/poc/.vercelignore` exists and holds `*.html.md` and
  `*.js.md` (copy it from `~/.claude/wag/templates/poc/` if not), so voice's readable copies
  stay off the site.
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
   - **The first PBI ports the POC into the real app**, still on its fake data. Each POC page
     goes to its app route (`pages/x.html` to `/x`, `?id=` to `/x/[id]`), `shell.js`'s shell to
     the app's layout (`layout.tsx`, with the standard chrome), and each `data-slot` element
     is swapped for its shadcn component. The real app then looks and clicks like the POC from
     the start.
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
3. **The POC is a showcase, not the app.** It's plain HTML with no build step and no backend:
   one small file per route in `pages/`, plus a shared `shell.js`. After approval it's the visual spec the
   real app ports, never the real app's code.
4. **No repo until approval.** The project lives in Dropbox until the handoff.
5. **One data set, one user's view.** It's what the POC shows, what the ported shell shows,
   and what dev and QA are seeded with.
6. **Flow problems are fixed in the PRD on the spot.** The PRD stays the source of truth.
