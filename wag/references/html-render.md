# HTML render — shared procedure for `/wag:html-*` commands

This reference captures the parts of HTML rendering that are the same across every doc-specific render command (`/wag:html-prd`, `/wag:html-architecture`, `/wag:html-backlog`, and any future siblings). The per-doc commands invoke this procedure for theme detection, shell loading, diff baseline, write conventions, and the closing summary. They provide the doc-specific bits: which source files to read, how the body is rendered, what kinds of diagrams or UI the page needs.

## When to use this procedure

Inside a `/wag:html-*` command, after its Phase 1 (which decides what doc to render and confirms the source file exists), run the steps below. Phase numbering here is **shared-N** to distinguish from the per-doc phases.

---

## Shared-1: Theme source

Locate the app's theme tokens. Check, in order:

1. `src/app/globals.css`
2. `app/globals.css`
3. `src/globals.css`
4. `styles/globals.css`

If found, extract the `:root { ... }` block and any `.dark { ... }` (or equivalent) block containing `--background`, `--foreground`, `--primary`, `--card`, `--border`, `--muted`, `--muted-foreground`, `--destructive`, `--radius`. These tokens get injected into the HTML shell as `{{THEME_TOKENS}}`.

If no `globals.css` is found, use `~/.claude/wag/templates/html-theme-default.css` verbatim. Tell the user which source is being used.

---

## Shared-2: Baseline diff (per existing `.html`)

This step only applies if the target `.html` already exists *and* is committed to git. For first renders, skip this step — the per-doc command renders from scratch.

For each existing committed `.html`:

1. Find the last commit that touched it:
   ```bash
   git log -1 --format=%H -- .wag/docs/<DocName>.html
   ```
2. Read each source file (`.md`) as it was at that commit:
   ```bash
   git show <sha>:.wag/docs/<SourceFile>.md
   ```
   For commands rendering multiple source files (the backlog command), repeat for each source path.
3. Diff against the current source. Identify which sections (by `## ` heading, or by file in the backlog's case) have changed.

A section is "changed" if any prose inside it differs. Sections with no diff are stable — their existing rendering (including any diagrams or hand-tuned HTML) should be preserved verbatim into the new render.

If the `.html` is uncommitted (working-tree-only) or no git history exists, surface this and treat it as a first render.

---

## Shared-3: Load the shell

Read `~/.claude/wag/templates/html-shell.html`. This is the scaffold — topbar with title/eyebrow/TOC-chip/theme-toggle, theme-detection pre-paint script, typography/code/details/SVG/table CSS, theme-toggle JS. Six placeholders to fill:

- `{{TITLE}}` — typically "ProjectName — DocName" (e.g., "DragonPay API — Architecture")
- `{{EYEBROW}}` — short kicker, e.g., a project tagline from PRD, or the plain doc type ("PRD", "Architecture", "Backlog")
- `{{META_DESCRIPTION}}` — one-line description of the render. Mention the source `.md` path(s) so readers know where the canonical content lives.
- `{{THEME_TOKENS}}` — from Shared-1.
- `{{TOC_ITEMS}}` — `<li><a href="#section-id">Section title</a></li>` per top-level section. The TOC chip in the topbar anchors to `#toc` regardless of where the TOC block sits in the body.
- `{{BODY}}` — the rendered body content. Provided by the per-doc command's Phase 4 (render session).

Per-doc commands may inject additional `<style>` or `<script>` blocks **inside the body** (between `{{BODY}}`'s start and end). For example, the backlog command injects filter-pill UI and search JS this way. The shell itself stays generic.

---

## Shared-4: Write and summarise

After the per-doc command produces the final HTML:

1. Write to `.wag/docs/<DocName>.html`. The `.html` lives alongside the `.md` source, not in a separate `out/` or `dist/` location.
2. Tell the user, concisely:
   - What was rendered (first render vs. refresh; if refresh, what changed vs. what was preserved)
   - Which theme source was used
   - Any noteworthy decisions made during the render (diagram regenerations, layout adjustments, etc.)
3. Remind the user to commit the `.html`. The diff baseline in Shared-2 relies on the `.html` being in git, so the next render against an uncommitted `.html` will fall back to first-render mode and lose any in-flight polish.

---

## Conventions for all `/wag:html-*` commands

- **Source-of-truth invariant.** This command never edits the source `.md` files. If the user wants to change content, they run `/wag:docs` (for PRD/Architecture/backlog authoring), then re-render.
- **Self-contained output.** No external CSS, no web fonts, no JS frameworks. The HTML works opened directly in any browser, no dev server or build step.
- **Per-doc commands stay focused.** Each `/wag:html-*` command handles the rendering of one doc type. The runner `/wag:html-docs` invokes them in sequence.
- **Theme is lifted, not invented.** Pull from `globals.css` when the app has one; fall back to the WAG default only when it doesn't.
