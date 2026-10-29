# POC Workflow — a working showcase before the real build

## Purpose

Take a product idea to a **running, clickable POC** that business people can open from a link,
before any real application exists. The POC shows the look and feel and the user experience:
every page in the PRD, realistic fake data, working links, the user flow end to end, and the
project's PRD, Architecture and draft backlog readable (and downloadable) inside it. First the user is happy
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
- **Voice's Dropbox reader strips anything that looks like a tag** from some file types,
  HTML and Markdown included, but not from others (a JavaScript file full of markup came back
  intact). So the claude-home copy in Dropbox is encoded for it: in every Markdown file there
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

The same reader can stop voice from reading back markup it wrote. So:

- **Every HTML file has a readable sibling `NAME.md`:** every mockup option under
  `.wag/mockups/` (the chosen one included), every POC page in `.wag/poc/pages/` (one file per
  route), and the root redirect `.wag/poc/index.html`. That makes `items.html.md`,
  `index.html.md` and so on.
- **Any other file is tested by reading it back.** When voice first writes it, it reads it
  back and compares. If it comes back exactly as written, it gets no sibling, and voice works
  on the file directly. If anything was stripped (then, or on any later read), it gets a
  readable `NAME.md` from then on, written first, as below. `shell.js` and the parts in
  `.wag/poc/scripts/` have come back intact so far.

The sibling holds the same source with every less-than sign (U+003C) replaced by U+2039 and
every greater-than sign (U+003E) by U+203A, and nothing else.

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
  deployed: `.vercelignore` excludes `*.html.md` and `*.js.md` (see Step 7).

### The docs copies (voice)

`.wag/docs/PRD.md`, `.wag/docs/Architecture.md` and `.wag/docs/Backlog.md` are the sources
of truth. The POC shows them on its Project Documents page from **generated copies**,
`.wag/poc/docs/PRD.js`, `Architecture.js` and `Backlog.js`. These are build output: never
edit them by hand.

- **Why a `.js` copy.** A page opened from disk (`file://`) can't fetch a `.md` file, and
  there's no local server. A script tag can load a `.js` file from disk.
- **Every write regenerates.** Any step that writes `PRD.md`, `Architecture.md` or
  `Backlog.md` regenerates its copy in the same step, never one without the other. Create
  `.wag/poc/docs/` first if it doesn't exist yet.
- **No readable sibling.** Like `data.js`, they carry no markup, so voice reads them back
  intact.
- **The format.** `PRD.js` sets `prd`, from `.wag/docs/PRD.md`; `Architecture.js` sets
  `architecture`, from `.wag/docs/Architecture.md`; `Backlog.js` sets `backlog`, from
  `.wag/docs/Backlog.md`. `generated` is the date written as `Mon D, YYYY`, and `markdown`
  is the whole source:

  ```js
  // GENERATED from .wag/docs/PRD.md — DO NOT EDIT. PRD.md is the source of truth; this is a copy
  // so the Project Documents page can show it when opened from disk (a page opened from disk
  // cannot read PRD.md itself). Regenerate this file every time PRD.md changes.
  window.POC_DOCS = window.POC_DOCS ?? {}
  window.POC_DOCS.prd = {
  	source: '.wag/docs/PRD.md',
  	file: 'PRD.md',
  	generated: 'Oct 29, 2026',
  	markdown: `…the whole of PRD.md…`
  }
  ```
- **Escaping the markdown into the template literal,** in this order: each backslash becomes
  two backslashes (so a table's `\|` becomes `\\|`), each backtick becomes a backslash and a
  backtick, and each `${` becomes `\${`. Nothing else changes.

## Where it lives

The project is a folder in **Dropbox**, so voice can reach it. There's **no git repo** until
the POC is approved and PBI 000.001 stands up the app.

```
<Dropbox>/Claude/<…>/<Project>/
└── .wag/
    ├── state.json              app_name, wag_version, poc stage, poc_url
    ├── docs/
    │   ├── PRD.md
    │   ├── RESEARCH.md
    │   ├── Architecture.md
    │   └── Backlog.md          the draft backlog, one file until the handoff
    ├── mockups/
    │   └── option-1.html … option-5.html    the round-one looks (+ .html.md siblings)
    └── poc/                    the site — this folder is what gets deployed
        ├── index.html          only redirects to pages/index.html (the site's front door)
        ├── pages/              every page, one file per route
        │   ├── index.html          the "/" route: landing (signed out) + dashboard (signed in)
        │   ├── sign-in.html        the "/sign-in" route
        │   ├── ROUTE.html …        one file per other route in the PRD's UI pages table
        │   └── project-documents.html     the standard Development page (the docs viewer)
        ├── shell.js            the shared signed-in shell and page behaviour
        ├── scripts/            the rest of the shell, once shell.js is split (Step 6)
        │   └── PART.js …           one file per kind of thing
        ├── theme.css           the theme, tweakcn format
        ├── data.js             the one fake data set
        ├── vercel.json
        ├── .vercelignore       keeps the .md siblings off the site
        └── docs/
            ├── PRD.js              generated copy of docs/PRD.md, never edited
            ├── Architecture.js     generated copy of docs/Architecture.md, never edited
            └── Backlog.js          generated copy of docs/Backlog.md, never edited
```

Every HTML file (the mockups, the pages, the root redirect) has a readable `NAME.md` sibling
for voice, and any other file only if it failed the read-back test (the readable-copy rule
above). The docs copies have none (the docs-copies rule above).

**No READMEs anywhere in `.wag/`.** It's code that gets copied into the repo at the handoff,
not part of the `/Claude` README system, so don't write one in any folder under it.

`state.json`'s `poc` field tracks the stage: `building` → `deployed` → `approved` →
`handed-off`. It's how voice and CC know where the project is, and the approval signal.

---

## Steps

### Step 0: Pick up where the project is — Voice

`/wag:poc` starts from whatever already exists; it never refuses because `.wag/` exists.

- **No folder yet:** ask for the project's name and where in Dropbox it goes, and create it.
- **`.wag/state.json` exists:** read its `poc` stage and resume there. If it says
  `approved`, the next step is CC's handoff (Step 8).
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

Write `.wag/poc/docs/PRD.js` with the PRD, and again on every change to it (the docs-copies
rule).

**Transition:** the user approves the PRD.

### Step 2: Viability → go / no-go — Voice

Init's **Phase B1**. Don't mock up an app that hasn't passed viability.

**Transition:** the user says go.

### Step 3: Mockups → a look — Voice

**First, the brand.** Before building any look, check what the brand already has: a logo
mark or emblem, a wordmark, a favicon and an icon style. Tell the user what you found, or say
plainly that none of it exists; Step 4 records it. The looks use what exists.

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
reason. It also records the brand from Step 3: which of a logo mark, a wordmark, a favicon
and an icon style exist, or plainly that none do, and that the POC's mark is then a
placeholder. Write the theme to `.wag/poc/theme.css` in tweakcn's format, taking the chosen
mockup's `:root` and `.dark` blocks as they stand. Its first line names the
tweakcn preset, or says `custom` if the theme was edited.

Write `.wag/poc/docs/Architecture.js` with the Architecture, and again on every change to it
(the docs-copies rule).

**Transition:** the user approves the architecture.

### Step 5: Draft the backlog → Backlog.md — Voice

The real build's backlog, drafted now so the business people see the plan beside the POC.
Write it to `.wag/docs/Backlog.md`, and `.wag/poc/docs/Backlog.js` with it (the docs-copies
rule). It's **one file**, not WAG's backlog folders; the handoff converts it (Step 8).

- **Init's backlog principles** (`wag/workflows/init.md`, Phase D): an epic is a business
  outcome, a PBI is a vertical slice, and there are no horizontal-layer PBIs. Epic numbers
  follow init too: `000` General, `001`–`199` for feature epics, `501` Future for deferred
  work. Every PBI traces to the PRD or the Architecture.
- **Full epics and PBIs,** with the sections of `~/.claude/wag/templates/backlog-epic.md` and
  `backlog-pbi.md`, not just names. **No status lines:** nothing is done at POC time.
- **Feature PBIs build on the POC.** Each one turns a feature's fake data into real data and
  names the POC pages it builds on.

**The fixed shape.** The Project Documents page parses it, so keep to it exactly:

- **An epic** is `## Epic EEE — Name`, its one-line business goal on the next line, then its
  detail: the `**Priority:**` and `**Depends on:**` lines, and `#### Deliverables`,
  `#### Design Input Required` and `#### Non-goals`.
- **A PBI** is `### PBI EEE.PPP — Title`, its one-line description on the next line, then
  its detail: the `**Priority:**` and `**Dependencies:**` lines, and `#### Description`,
  `#### Deliverables`, `#### Acceptance Criteria`, `#### Testing Requirements` and, if
  there's anything to note, `#### Technical Notes`.
- **Before the first epic,** only the title `# Backlog — PROJECT` and an optional short
  intro.

```markdown
# Backlog — PROJECT

## Epic 000 — General
Standing up the real app from the approved POC, plus loose work with no epic of its own.

**Priority:** P1
**Depends on:** None

#### Deliverables
…

### PBI 000.001 — Stand up the app
The real app runs locally on the Architecture's tech stack, in its own GitHub repo.

**Priority:** P1
**Dependencies:** None

#### Description
…
```

**Epic 000 General always starts with these three PBIs,** written out in full for the
project:

1. **PBI 000.001 — Stand up the app.**
   - **First, understand the POC:** its pages, shell, data and theme, and how they affect
     every PBI in the backlog. Update any PBI they change.
   - **Then get the Next.js app running on Architecture.md's tech stack.** `/wag:create-nextjs`
     is a reference for how, not a requirement. The PBI spells out what gets installed
     (each layer of the stack, by name) and what's left for the feature epics, and why.
   - **One git repo** at `~/source/<project>`, tracking the app and `.wag/`, with `main`,
     `qa` and `dev` branches and a private GitHub repo, pushed. It's the repo's first commit,
     so this PBI is committed to those branches rather than through a feature branch.
   - **The theme** installs from `.wag/poc/theme.css`. If the stack has a database, dev and QA
     seed and reset from `.wag/poc/data.js`'s data set.
   - **The latest version of every CLI it runs** (`create-next-app`, `shadcn`, `gh` and the
     rest), checked at the time.
2. **PBI 000.002 — Port the POC.** The real app looks and clicks like the POC, still on its
   fake data. Each POC page goes to its app route (`pages/x.html` to `/x`, `?id=` to
   `/x/[id]`), `shell.js`'s shell to the app's layout (with the standard chrome), and each
   `data-slot` element is swapped for its shadcn component.
3. **PBI 000.003 — Deploy to dev and QA.** The app runs locally from the `dev` branch,
   and the `qa` branch deploys to Vercel so it can be tested: link the Vercel project (naming
   the plan tier it assumes), set the environment variables, and make the first QA build,
   using the latest `vercel` CLI. **Production is out of scope:** it's a separate, rare,
   manual process.

**Epic 501 Future** holds the PRD's later items as PBIs, each with a deferral dependency, as
init does.

**Transition:** the user approves the backlog. The POC isn't built until they do.

### Step 6: Build the POC → a working site — Voice

**Expect to go back and forth.** The final POC isn't the first build. It's reached by going
back and forth with the user on look and layout, page by page, until they're happy. Plan for
that.

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
- **Splitting the shell.** When `shell.js` grows too big for voice to write in one call (past
  about 10 KB, like a page), split it by kind of thing into `.wag/poc/scripts/`: for example,
  the message card in `card.js`, the compose dialogs in `compose.js`, and search in
  `search.js`. `shell.js` stays at the POC root and keeps storage,
  theme, the menu, the top bar, page rendering and sign-in. Pages still load only
  `../shell.js`; `shell.js` loads the parts itself, in order, right after itself, so no page
  changes:

  ```js
  // The rest of the shell, loaded from scripts/ right after this file, in order, so pages load only shell.js.
  const base = document.currentScript.src.replace(/shell\.js(\?.*)?$/, '')
  for (const file of ['card.js', 'compose.js', 'search.js'])
  	document.write(`<script src="${base}scripts/${file}"></script>`)
  ```

  `shell.js`'s opening comment lists the parts and what each holds. Each new part gets the
  read-back test (the readable-copy rule).

State the resulting page map back to the user (route, file, what's on it) as part of the
build discussion, before writing any pages.

**Then the starter.** Copy from `~/.claude/wag/templates/poc/` into `.wag/poc/`:

- **The HTML files, readable copy first,** each to the same place in `.wag/poc/`: the root
  `index.html` (the redirect), `pages/index.html`, `pages/sign-in.html` and
  `pages/project-documents.html`. For each one, take the encoded block from the starter's
  `NAME.md` (the part inside the code fence, without the note or the fence) and write it as the
  project's `NAME.md` beside where the file goes. Then decode that into the file.
- **`shell.js`, directly.** Take the encoded block from the starter's `shell.js.md`, decode it,
  and write it as the project's `shell.js`, with no sibling. Then give it the read-back test
  (the readable-copy rule).
- **The sample route page, `pages/items.html`,** shows how a list and its detail share one
  file. Use it as the pattern for each route in the page map: write each page's
  `pages/ROUTE.html.md` first, then decode it. Don't keep `items.html` unless the app has an
  items route.
- **Copy as is:** `data.js`, `vercel.json` and `.vercelignore`.
- **Don't copy:** `theme.css`, because Step 4 already wrote the project's theme there and the
  starter's neutral one would overwrite it. Also skip the starter's `data.js.md`; `data.js`
  has no markup, so the project doesn't need a copy of it.
- **Set the menu:** edit `NAV` at the top of `shell.js` directly to match the PRD's menu, and
  put the app's name, and its tagline if it has one, in `data.js`.

`shell.js`'s opening comment is the markup contract: each page's `data-auth`, `data-view`,
`data-page`, `data-list`/`data-record`/`data-fill`, `data-if`/`data-unless` for the id,
`data-logo` and `data-action`. Follow it. Every page loads `theme.css`, `data.js` and
`shell.js` in its head, exactly as the starter pages do.

**The logo is one shared piece, in `shell.js`.** Its `logo()` function draws the mark and the
app's name (and, where asked, `data.app.tagline` under it). The sidebar uses it, and it fills
any element marked `data-logo`, such as the landing page's header. Change the mark there, once,
and it changes everywhere.

- **The favicon is the same SVG.** `shell.js` adds it to every page's head as a
  `data:image/svg+xml` link: no icon file, no page changes. A `data:` image can't read the
  theme's CSS variables, so `shell.js` writes in the theme's `--primary` colour as the page
  loaded it.
- **No vector art yet?** If Step 3 found no logo mark as SVG, draw a simple placeholder SVG
  inline in `logo()`, mark it `PLACEHOLDER` in a comment, and say so in Architecture's Design
  direction. The starter's mark is such a placeholder.

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
- **The POC notice, always,** on the landing page, visible without scrolling: the starter's
  `data-poc-notice` in `pages/index.html`. How it looks is worked out with the user; what it
  says isn't optional. In plain language, it says:
  - what this is and isn't: a clickable preview, not the product;
  - why it exists: to agree on the flows and the design before the real build;
  - that sign-in is simulated, everyone sees the same made-up data, and nothing is saved or
    sent anywhere;
  - a link to **Project Documents** (the PRD, Architecture and Backlog), marked
    `data-action="open-docs"`, so it skips sign-in, with a small note that the link signs
    you in to the preview.
- **Simulated sign-in.** The sign-in page's button signs you in; there's no real auth.
- **The standard signed-in chrome**, in every POC:
  - sign out;
  - the light/dark toggle;
  - a **Development** section holding **Project Documents**.
- **Project Documents** is the starter's `pages/project-documents.html`, an accordion:
  - **PRD**, **Architecture** and **Backlog**, each rendered in place from its docs copy (see
    *The docs on the page* below), with a Download button that saves the markdown as
    `PRD.md`, `Architecture.md` or `Backlog.md`.
- **Written in the real app's vocabulary**, so porting it is translation rather than redesign:
  - Tailwind classes, theme tokens only, no hardcoded colors;
  - every control marked `data-slot` (plus `data-variant`) with the shadcn component it
    stands in for, its classes taken from that component;
  - Lucide icons by name;
  - the signed-in shell lives in `shell.js` (it becomes the real app's layout).

**The docs on the page.** Project Documents doesn't use `/wag:html-prd` or
`/wag:html-architecture`, and has no frames or links to rendered HTML docs. It loads `marked`
from the CDN, then `../docs/PRD.js`, `../docs/Architecture.js` and `../docs/Backlog.js`, and
renders each doc's markdown into its accordion item, in the POC's own theme. The starter page
does all of this; keep its script and its `.doc` styles (they restore the heading, list,
table and code styling that Tailwind strips), and restyle only to the chosen look.

- **A note above each doc:** "Rendered from SOURCE · generated DATE · a copy, do not edit
  here". A missing copy shows "Not generated yet."
- **Download** saves the markdown itself, under the source's name (`PRD.md`,
  `Architecture.md`, `Backlog.md`).
- **The backlog nests.** Built from its fixed shape (Step 5), each epic is a collapsible item
  showing its name and one-line goal; open, it shows its detail and its PBIs. Each PBI is a
  collapsible item showing its one-line description; open, it shows the whole PBI.
- **Directory trees are drawn, not printed.** A code block containing `├──` or `└──` is shown
  as a two-column tree: the names in monospace, indented by depth, with a Lucide `folder`
  icon (filled) or `file` icon (outline) in the same muted colour, and the comment after
  ` # ` in a muted column of its own. A line is a folder if its name ends in `/` or the next
  line is deeper. The markdown keeps its text tree; only the page changes it.

**Readable copies, written first:** every page's `NAME.html.md` is where voice writes and
edits, and the page is decoded from it every time. `shell.js`, the parts in `scripts/` and
`data.js` are edited directly, unless one has failed the read-back test and has a sibling.

**Flow problems get fixed now.** Building the pages can expose a gap: a flow step with no
page, a page with no way in, data a page shows that no flow creates, or two parts of the PRD
that disagree. When that happens, fix the PRD in the same session, alongside the POC, and
tell the user what changed.

**A PRD change carries through everything after it.** Whenever the PRD changes, at any
step, bring the Architecture, the backlog and the POC into line with it in the same session,
and regenerate the docs copy of each doc that changed.

**Transition:** the user has clicked through the whole POC locally and is happy with it.

### Step 7: Deploy → a link to send — CC

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

### Step 8: Approved → the handoff — CC

**The signal.** `state.json`'s `poc` is set to `approved`. Voice sets it when the user says
the POC is approved, or CC does. The user then runs `/wag:poc` in CC from the project's
Dropbox folder. It sees `approved` and does the handoff. It doesn't stand up the app:
that's PBI 000.001.

1. **Copy `.wag/` into the project folder.** Create `~/source/<project>/` and copy the
   project's `.wag/` into it, leaving `poc/.vercel/` behind.
2. **Convert the backlog.** Turn the approved `.wag/docs/Backlog.md` into WAG's backlog
   folders under `.wag/backlog/`, as init's Phase D and E define them, rather than writing a
   backlog from scratch:
   - each `## Epic EEE — Name` becomes `epic-EEE-word/epic.md` (one-word folder name, as
     init names them), headed `# Epic EEE: Name`. Its one-line goal opens `## Goal`, and it
     gains `**Status:** Ready` under its priority;
   - each `### PBI EEE.PPP — Title` becomes `PBI-PPP.md` in its epic's folder, headed
     `# PBI EEE.PPP: Title`. Its one-line description opens `## Description`;
   - every `####` section becomes `##`, as in the templates, and nothing else changes;
   - then delete `.wag/docs/Backlog.md` from the copy. The folders are the backlog now; the
     approved draft stays in Dropbox.
3. **Finalise `.wag/`.** Init's **Phase E**, with the backlog already in place.
   `state.json` keeps its `poc` and `poc_url` fields; set `poc` to `handed-off`.

**From here on `~/source/<project>/.wag/` is the source of truth.** The Dropbox folder stays
as the POC that was approved, not kept in step with it.

**Data in the real app:** production has real data and is never seeded or reset. Dev and QA
run on real databases (or local server-side ones) seeded from the POC's fake data, and
resettable back to it.

---

## Rules

1. **The user approves every transition.** Never auto-advance.
2. **Viability before mockups; a look, then an approved backlog, before the POC.**
3. **The POC is a showcase, not the app.** It's plain HTML with no build step and no backend:
   one small file per route in `pages/`, plus a shared `shell.js`. After approval it's the visual spec the
   real app ports, never the real app's code.
4. **No repo until PBI 000.001.** The project lives in Dropbox until the handoff, and the
   handoff creates no repo; standing up the app, repo included, is the backlog's first PBI.
5. **One data set, one user's view.** It's what the POC shows, what the ported shell shows,
   and what dev and QA are seeded with.
6. **Flow problems are fixed in the PRD on the spot.** The PRD stays the source of truth, and
   a change to it carries through the Architecture, the backlog and the POC.
