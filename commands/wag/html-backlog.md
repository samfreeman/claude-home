---
description: Render the .wag/backlog/ tree as polished HTML — nested epic + PBI accordions with filter pills and search
allowed-tools: Read, Write, Bash, Glob, Grep
---

# WAG HTML Backlog — Polished HTML render of the backlog

Generate `.wag/docs/Backlog.html` from the project's `.wag/backlog/` tree (both active epics + the `_completed/` mirror). The Markdown files stay the source of truth; HTML is a render for sharing and skim-reading.

The backlog render is structurally different from PRD/Architecture renders — it aggregates many files into one HTML page, has near-zero diagram content, and benefits from interactive filtering. The shared procedure (`~/.claude/wag/references/html-render.md`) still handles theme detection, shell loading, and write conventions; this command provides the body, the filter UI, and the search JS.

## Phase 1: Survey

1. Confirm `.wag/backlog/` exists. If missing, tell the user to run `/wag:init` first.
2. List the contents:
   - Active epics: `.wag/backlog/epic-*/` folders (each containing `epic.md` and `PBI-*.md` files).
   - Completed mirrors: `.wag/backlog/_completed/epic-*/` folders (with `epic.md` if the whole epic completed, plus closed `PBI-*.md` files).
3. Check whether `.wag/docs/Backlog.html` exists.
4. Classify:
   - **First render** — no `.html`, or uncommitted.
   - **Refresh** — `.html` exists and has git history.
5. Read `~/.claude/wag/references/html-render.md` if you haven't this session.

## Phase 2: Shared theme + baseline

Run Shared-1 (theme source) from the shared procedure.

For Shared-2 (baseline diff), the backlog version diffs per-file across the whole `.wag/backlog/` tree:

1. Find the last commit that touched `.wag/docs/Backlog.html`.
2. Compare the file inventory and per-file contents of `.wag/backlog/` between that commit and the current working tree. Identify:
   - **New** PBIs/epics (didn't exist at last render)
   - **Removed** PBIs/epics (existed at last render, gone now — typically moved to `_completed/`, which counts as "moved" not "removed")
   - **Moved** PBIs (changed location: e.g., epic-000-general → epic-002-billing, or active → `_completed/`)
   - **Changed** PBIs/epics (file content differs)
   - **Stable** PBIs/epics (no change)

For stable accordions, the existing rendering can be copied verbatim from the prior `.html`. Changed/new/moved get re-rendered. Removed accordions get dropped.

If the `.html` is uncommitted or no git history, treat as first render.

## Phase 3: Build the model

Walk the file system and build an in-memory model of the backlog. For each epic (active or completed):

- Read `epic.md`, extract: title, status, priority, depends-on, goal, deliverables, design-input-required, non-goals.
- For each `PBI-*.md` in the epic folder, read it and extract: full canonical ID (`PBI EEE.PPP`), title, priority, dependencies, status (Open if in active folder, Closed if in `_completed/`), description, deliverables, acceptance criteria, testing requirements, technical notes, closure note (if present).
- For each PBI, check for an associated ADR:
  - `.wag/adr/active/ADR-EEE.PPP.md` → status: active, link: that path
  - `.wag/adr/completed/ADR-EEE.PPP.md` → status: completed, link: that path
  - Neither → no ADR yet

Sort epics by number: epic-000-general first if present, then epic-001, epic-002, ...; any `200+` special bucket (e.g. epic-501-future) sorts last by its number. Within each epic, sort PBIs by local number.

## Phase 4: Render session

Load `~/.claude/wag/templates/html-shell.html`. Populate placeholders per Shared-3:

- `{{TITLE}}` — "ProjectName — Backlog"
- `{{EYEBROW}}` — short kicker, e.g., "PBI registry" or the project tagline
- `{{META_DESCRIPTION}}` — "Self-contained HTML render of `.wag/backlog/`. Source of truth lives in the per-PBI Markdown files. Use the filter pills to scope by status; use the search box to find a specific PBI."
- `{{TOC_ITEMS}}` — one `<li>` per epic: `<li><a href="#epic-NNN-word">Epic NNN — Title</a></li>`
- `{{BODY}}` — see below.

### Body shape

The body begins with a controls block (filter pills + search input), followed by the epic accordions.

```html
<div class="backlog-controls">
    <div class="filter-pills">
        <button type="button" class="pill active" data-filter="active">Active</button>
        <button type="button" class="pill" data-filter="completed">Completed</button>
        <button type="button" class="pill" data-filter="all">All</button>
    </div>
    <input type="search" class="backlog-search" placeholder="Search PBIs…" aria-label="Search backlog">
    <p class="backlog-stats meta">{{N_OPEN}} open, {{N_DONE}} done across {{N_EPICS}} epics.</p>
</div>

<section class="epics">
    <!-- One <details> per epic -->
</section>
```

### Epic accordion

Each epic is a `<details>` block. The summary shows the epic's full title, status badge, and PBI count. The body shows the epic's metadata fields and the nested PBI accordions.

```html
<details class="epic" id="epic-001-auth" data-status="active">
    <summary>
        <span class="epic-id">Epic 001</span>
        <span class="epic-title">Auth</span>
        <span class="badge badge-active">Active</span>
        <span class="epic-pbi-count">7 PBIs · 4 open · 3 done</span>
    </summary>
    <div class="epic-body">
        <div class="epic-meta">
            <p><strong>Priority:</strong> P1</p>
            <p><strong>Status:</strong> In progress</p>
            <p><strong>Depends on:</strong> None</p>
        </div>
        <h4>Goal</h4>
        <p>...</p>
        <h4>Deliverables</h4>
        <ul>...</ul>
        <h4>Design Input Required</h4>
        <p>...</p>
        <h4>Non-goals</h4>
        <ul>...</ul>

        <div class="pbis">
            <!-- One <details> per PBI -->
        </div>
    </div>
</details>
```

For epics whose `epic.md` lives in `_completed/`, status badge is `Completed` and the data-status attribute is `completed`.

### PBI accordion

Each PBI is a `<details>` block inside its epic's `<div class="pbis">`. The summary shows the canonical ID, title, status badge, and priority. The body shows the full PBI content plus the ADR link if present.

```html
<details class="pbi" data-status="open" data-search="auth signin magic-link ...">
    <summary>
        <span class="pbi-id">PBI 001.003</span>
        <span class="pbi-title">Magic-link sign-in</span>
        <span class="badge badge-open">Open</span>
        <span class="pbi-priority">P1</span>
    </summary>
    <div class="pbi-body">
        <p class="pbi-meta">
            <strong>Dependencies:</strong> PBI 001.001
            · <a href="../adr/active/ADR-001.003.md">ADR (active)</a>
        </p>
        <h4>Description</h4>
        <p>...</p>
        <h4>Deliverables</h4>
        <ul>...</ul>
        <h4>Acceptance Criteria</h4>
        <ul class="ac-list">
            <li>- [ ] First criterion</li>
            <li>- [x] Met criterion</li>
        </ul>
        <h4>Testing Requirements</h4>
        <ul>...</ul>
        <h4>Technical Notes</h4>
        <p>...</p>
    </div>
</details>
```

The `data-search` attribute holds a lowercased, space-separated string of searchable keywords: title, description, deliverable bullets, technical notes. The search JS matches against this.

`data-status` is `open` or `completed` — used by the filter pills.

If the PBI has a closure note (in `_completed/`), render it as a `<blockquote class="closure-note">` at the top of the PBI body, before the meta line.

If the PBI has no ADR, omit the ADR link from the meta line.

### Inline CSS additions

Append to the shell's `<style>` block (insert at the end, before `</style>`):

```css
/* ── Backlog-specific styling ── */
.backlog-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin: 18px 0 24px;
    padding: 14px 18px;
    background: color-mix(in oklch, var(--primary) 6%, var(--background));
    border: 1px solid var(--border);
    border-radius: 8px;
}
.filter-pills { display: flex; gap: 6px; }
.pill {
    padding: 6px 14px;
    font: inherit;
    font-size: 0.84rem;
    color: var(--muted-foreground);
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 999px;
    cursor: pointer;
}
.pill:hover { color: var(--primary); border-color: var(--primary); }
.pill.active {
    color: var(--primary-foreground);
    background: var(--primary);
    border-color: var(--primary);
}
.backlog-search {
    flex: 1 1 240px;
    min-width: 200px;
    padding: 7px 12px;
    font: inherit;
    font-size: 0.9rem;
    color: var(--foreground);
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
}
.backlog-search:focus {
    outline: none;
    border-color: var(--primary);
}
.backlog-stats { margin: 0 0 0 auto; }

.epic {
    border: 1px solid var(--border);
    border-radius: 10px;
    margin: 14px 0;
    background: var(--card);
    overflow: hidden;
}
.epic > summary {
    padding: 12px 16px;
    background: color-mix(in oklch, var(--primary) 5%, var(--background));
    border-bottom: 1px solid var(--border);
}
.epic[open] > summary { border-bottom-color: var(--border); }
.epic .epic-id {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--primary);
    letter-spacing: 0.06em;
}
.epic .epic-title { font-weight: 600; font-size: 1rem; }
.epic .epic-pbi-count { margin-left: auto; font-size: 0.82rem; color: var(--muted-foreground); }
.epic-body { padding: 16px 20px; }
.epic-meta p { margin: 0.3em 0; font-size: 0.92rem; }
.epic-body h4 { margin: 1.4em 0 0.4em; font-size: 0.95rem; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.06em; }
.pbis { margin-top: 16px; }

.pbi {
    border: 1px solid var(--border);
    border-radius: 8px;
    margin: 8px 0;
    background: color-mix(in oklch, var(--muted) 25%, var(--background));
}
.pbi > summary { padding: 9px 14px; gap: 12px; }
.pbi .pbi-id {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--primary);
    letter-spacing: 0.04em;
}
.pbi .pbi-title { font-weight: 500; flex: 1; }
.pbi .pbi-priority { font-family: var(--font-mono); font-size: 0.74rem; color: var(--muted-foreground); }
.pbi-body { padding: 12px 16px; border-top: 1px solid var(--border); }
.pbi-meta { font-size: 0.88rem; color: var(--muted-foreground); }

.badge {
    display: inline-block;
    padding: 2px 8px;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    border-radius: 999px;
}
.badge-active { color: var(--primary-foreground); background: var(--primary); }
.badge-open { color: var(--primary); background: color-mix(in oklch, var(--primary) 18%, var(--background)); border: 1px solid color-mix(in oklch, var(--primary) 35%, var(--background)); }
.badge-completed,
.badge-done { color: var(--muted-foreground); background: color-mix(in oklch, var(--muted) 60%, var(--background)); border: 1px solid var(--border); }

.closure-note {
    background: color-mix(in oklch, var(--muted) 50%, var(--background));
    border-left: 4px solid var(--muted-foreground);
    margin: 0 0 12px;
    font-size: 0.9rem;
}

.ac-list { font-family: var(--font-mono); font-size: 0.86rem; }

/* ── Filter/search visibility ── */
.backlog-controls[data-filter="active"] ~ .epics .pbi[data-status="completed"] { display: none; }
.backlog-controls[data-filter="completed"] ~ .epics .pbi[data-status="open"] { display: none; }
.backlog-controls[data-filter="active"] ~ .epics .epic[data-status="completed"] { display: none; }
.backlog-controls[data-filter="completed"] ~ .epics .epic[data-status="active"] { display: none; }
.pbi.search-hidden { display: none; }
.epic.search-hidden { display: none; }
```

### Inline JS additions

Append to the shell's closing `<script>` block (or add a new `<script>` block before `</body>`):

```html
<script>
    (function () {
        var controls = document.querySelector('.backlog-controls')
        if (!controls) return
        var pills = controls.querySelectorAll('.pill')
        var search = controls.querySelector('.backlog-search')

        function setFilter(filter) {
            controls.setAttribute('data-filter', filter)
            pills.forEach(function (p) {
                p.classList.toggle('active', p.getAttribute('data-filter') === filter)
            })
        }

        function applySearch() {
            var q = (search.value || '').trim().toLowerCase()
            var pbis = document.querySelectorAll('.pbi')
            pbis.forEach(function (pbi) {
                if (q == '') {
                    pbi.classList.remove('search-hidden')
                    return
                }
                var hay = pbi.getAttribute('data-search') || ''
                pbi.classList.toggle('search-hidden', hay.indexOf(q) === -1)
            })
            // Hide epics whose visible-PBI count drops to zero
            document.querySelectorAll('.epic').forEach(function (epic) {
                var visible = epic.querySelectorAll('.pbi:not(.search-hidden)')
                epic.classList.toggle('search-hidden', q != '' && visible.length === 0)
            })
        }

        pills.forEach(function (p) {
            p.addEventListener('click', function () {
                setFilter(p.getAttribute('data-filter'))
            })
        })
        search.addEventListener('input', applySearch)
        setFilter('active')
    })()
</script>
```

The default view is `active`. Filter pills toggle. Search filters PBIs by their `data-search` attribute (substring match, case-insensitive). Epics with zero visible PBIs are themselves hidden so the page doesn't show empty epic accordions while searching.

## Phase 5: Write + summarise

Run Shared-4. Write to `.wag/docs/Backlog.html`. Tell the user:

- First render vs. refresh.
- Counts: N open, N done, N epics, N changed since last render.
- Theme source used.
- Remind them to commit `.wag/docs/Backlog.html` so the next refresh has a diff baseline.

## Key rules

1. **Backlog files are the source.** This command never edits anything in `.wag/backlog/`. If the user wants to change content, they run `/wag:docs` (or `/wag:dev` Phase 5 closes a PBI), then re-render.
2. **Per-file diff baseline.** The render is incremental at the file level — stable accordions are copied from the prior `.html`, changed/new/moved are re-rendered.
3. **No diagrams.** The backlog render almost never has diagrams. If an `epic.md` or PBI does contain a Mermaid-style block or an inline reference to a diagram, render it as a code block within the accordion body — don't try to author SVG for it.
4. **Filter + search UI is built in.** Active/Completed/All pills + search box are part of every backlog render.
5. **Self-contained output.** All CSS and JS inline.
