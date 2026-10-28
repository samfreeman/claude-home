# Mockups — a picture of every page before anything is built

Every WAG web project gets a visual preview of the app before a line of it is built. The
mockups do two jobs. They make the user confident about what's being built, and they tell
the user story cleanly enough to expose flow problems while they're still cheap. They also
feed the PRD: every route in its UI pages section carries a picture, so the `.docx` the
user sends to stakeholders has words that sell the idea and images that make the words
obvious.

Init runs this as **Phase B2**, after viability (B1) has said go and before the rest of
research and Architecture (B3). Don't mock up an app that hasn't passed viability. A
project with no web UI skips it.

## Who does what

Each step has a **voice** part and a **CC** part. Voice (Claude voice) can read and write
the project's `.wag/` files in Dropbox and render HTML, but it can't run commands or take
screenshots; CC can. The project has to live in Dropbox for voice to reach it. When the
user works in CC alone, CC does the voice parts too (it writes the HTML; the user opens it
in a browser).

## Inputs

- `~/.claude/wag/references/ui-standard.md`: the foundation (shadcn look, theme tokens,
  light and dark), the full landing-page spec, and the signed-in rules.
- Architecture's **`Design direction`** section: the brand (tweakcn theme) and any
  departures. The mockups are built to it; they don't replace it.
- The PRD: User Flow (the story the pages must tell) and the **UI pages** route table.

## Where it lives

```
.wag/mockups/
├── options/option-1.html … option-5.html   round one: one page, 4–5 looks
├── mockup.html                             the chosen look: every route + the landing page
└── screens/                                PNGs, one per route and per landing section
```

Every HTML file starts from `~/.claude/wag/templates/mockup.html`. It loads Tailwind from a
CDN and maps the tweakcn theme's CSS variables for light and dark, and its controls are
styled to look like shadcn. The match with real shadcn doesn't have to be one-to-one; the
mockup has to make the user confident, not be the build.

## The markup contract

The screenshot script reads this, so `mockup.html` keeps to it:

- `data-route="<route>"` on one element per route in the UI pages table. That element is
  the screenshot.
- `data-page="<page name>"` gives the PRD's page name, which becomes the image's alt text
  and caption.
- `data-state="<state>"` is used only when one route has two looks, e.g. `/` as
  `signed-out` (landing) and `signed-in` (dashboard).
- `data-landing="<section>"` goes on each landing-page section (navbar, hero, stats, …)
  inside the signed-out `/` route. Each section is its own screenshot.
- `data-review` marks review-only chrome: the **visible route label** placed between
  sections (so the user always knows which route they're looking at) and the light/dark
  switch. It's hidden in every screenshot.
- **Static, not clickable.** No navigation between routes, no `fixed`/`sticky`
  positioning (it bleeds into every screenshot), and no animation that hides content until
  it runs.
- **Realistic fake data.** Use one cast of people and items carried across every page, so
  the story reads through, and never lorem ipsum.

## Steps

### 1. Design direction first

- **Voice:** settle with the user what Design direction can already say: the brand (the
  tweakcn theme's primary and accent) and any known departure. Write it into
  `.wag/docs/Architecture.md`'s `Design direction` section; the rest of Architecture
  comes in B3, so the file can hold just that section for now. If the brand is still
  open, say so there, and the options in step 2 can each carry a candidate theme.
- **CC:** nothing.

### 2. Round one: options

- **Voice:** build 4–5 looks of **one** representative signed-in page in
  `options/option-N.html`. Pick the page the user story leans on most, and fill it with
  realistic data. Every look stays inside the standard. They vary what the standard leaves
  open for signed-in pages: layout and navigation chrome, density, how cards, tables and
  forms look, and which landing-page traits carry over (plus the theme, if the brand is
  open). Render them and the user picks one.
- **CC:** nothing. Options aren't screenshotted.

The point is a representative look and feel. Don't cover every route until the user has
picked a look and worked through their changes.

### 3. Tweak the pick

- **Voice:** go back and forth with the user on the chosen option until they're happy.
  Then record the choice in `Design direction`: which option was picked, its answers to
  the open signed-in items, and any departure with its reason. The other options stay in
  `options/` as the record of what was considered.
- **CC:** nothing.

### 4. Every route

- **Voice:** build `mockup.html` in the chosen look. It covers every route in the PRD's UI
  pages table, plus the landing page per the standard's landing-page spec as
  `data-landing` sections of the signed-out `/` route, all with realistic fake data.
- **Flow problems get fixed now.** Building a page can expose a gap: a flow step with no
  page, a page with no way in, data a page shows that no flow creates, or two sections of
  the PRD that disagree. When that happens, voice fixes the PRD (User Flow and UI pages)
  in the same session, alongside the mockup, and tells the user what changed.
- **CC:** nothing.

### 5. The PRD's UI pages section

- **Voice:** write the section as a table listing each route with a description, then one
  subsection per route holding its image as a linked image:

  ```markdown
  ### `/messages` — Messages

  [![Messages](../mockups/screens/messages.png)](../mockups/mockup.html)
  ```

  The landing page gets one subsection with one image per section, in the spec's order.
  Image names are predictable, so voice writes the lines before the PNGs exist:
  - take the route, drop `[ ]`, turn every run of other non-alphanumerics into `-`, trim
    the ends and lowercase it (`/` becomes `index`, `/calls/[id]` becomes `calls-id`);
  - append `-<data-state>` when the route has one (`index-signed-in`);
  - name landing sections `landing-<data-landing>` (`landing-hero`).
- **CC:** nothing yet; step 6 checks the lines.

### 6. Screenshots

- **Voice:** nothing. It can't take screenshots.
- **CC:** run, from the project root:

  ```
  node ~/.claude/scripts/mockup-shots/shots.mjs .wag/mockups/mockup.html
  ```

  It loads the page in Chromium at a **1024px** width, light mode and reduced motion. It
  hides `data-review` chrome and writes one PNG per route (per landing section for the
  landing page) to `.wag/mockups/screens/`. It then prints the linked-image line for each
  PNG; compare those lines with the PRD's, and fix any mismatch in the PRD. Pass `--dark`
  for a dark set (`<name>-dark.png`). Look at every PNG before calling it done.

  One-time setup per machine:

  ```
  npm install --prefix ~/.claude/scripts/mockup-shots
  ~/.claude/scripts/mockup-shots/node_modules/.bin/playwright install chromium-headless-shell
  ```

  Use the script, not the Playwright MCP: the MCP saves screenshots into its own output
  folder, not the path it's given.

### 7. The stakeholder document

- **Voice:** nothing.
- **CC:** run `python3 ~/.claude/scripts/md2docx.py .wag/docs/PRD.md`, which writes
  `.wag/docs/PRD.docx` with every image embedded and captioned. Open it, or inspect it,
  before handing it over. The image links aren't kept, since a mockup path means nothing
  to someone reading the sent file.

**Transition:** the user approves the mockups and any PRD changes they caused. Then B3.

## Later

When the UI pages change after init (`/wag:docs`), update `mockup.html` and the PRD
section together, then re-run steps 6 and 7.
