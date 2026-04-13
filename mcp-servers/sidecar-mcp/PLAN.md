# sidecar-mcp — plan

## Standing rules

- **Empirical.** Verify before claiming. "Looks correct" is a guess.
- **No flattery, no reassurance.** Don't decorate. Don't soothe.
- **Grill at every fork.** A tangent is a proposal, not an action.
- **CC thinks and acts; CD thinks.** CC goes direct. CD/Cowork go through MCP layers.

## Context

CC has skills (in `~/.claude/skills/`) and commands (in `~/.claude/commands/`). They look different on disk but serve the same purpose: text instructions a model reads and follows. CD and Cowork can't see nested namespace layouts (like `skills/wag1.5/adr/`) — CC's native loader is flat and closed-source, so those skills are invisible to every client except the raw filesystem.

**Sidecar** is the unified abstraction that hides the skill/command distinction, hides the file/folder distinction, and delivers a uniform payload (body + references) to any MCP client.

This project (`sidecar-mcp`) replaces the existing `skills-mcp`. It is built fresh, not renamed. `skills-mcp` stays running until `sidecar-mcp` is validated, then is retired.

## Canary

`wag1.5:adr` — nested namespace + colocated template + scripts. Currently invisible to both CC (nested skill) and CD. If sidecar-mcp resolves `wag1.5:adr` end-to-end from CD and returns the body plus references to `adr-template.md` and `scripts/`, the design is validated.

## Design decisions (from grilling)

1. **Name:** `sidecar`. Replaces `skills-mcp` fully (new project, old one retired after validation).
2. **Tools:** two — `list` and `read`. No skill/command split at the API layer.
3. **Addressing:** `namespace:name` (e.g. `wag1.5:adr`, `kwiki:capture`). Bare `name` for flat top-level entries.
4. **Source of truth:** live filesystem state under CC's `skills/` and `commands/`. No manifests, no duplication.
5. **Resolution order:** look in `commands/` first (command wins on collision), then `skills/`.
6. **Response shape:** `{ body: string, supports: string[] }`. Body is the main instruction set. `supports` is a list of absolute paths to sidecar files (templates, scripts, binaries) the client can fetch via its filesystem MCP on demand. **No inlining, no base64.**
7. **File vs folder is transparent.** File-shaped entries (`commands/kwiki/capture.md`) return `body` only, `supports: []`. Folder-shaped entries (`skills/wag1.5/adr/`) return `body` (from `SKILL.md`) + populated `supports`.
8. **Client responsibility:** read `body`, follow the instructions, fetch items from `supports` on demand via its filesystem MCP, optionally cache.
9. **CC access model:** native-first. CC uses slash commands and its native Skill tool for everything the native loader can see. CC only falls through to sidecar-mcp for namespaces the native loader can't resolve (e.g. `/wag1.5:adr` fails natively → sidecar lookup).
10. **CD / Cowork access model:** exclusively via sidecar-mcp. Cowork inherits CD's MCP config automatically, so no separate wiring needed.
11. **Filesystem-paths reminder:** `read` prepends the client's filesystem-MCP-accessible paths to every response, pulled from `CLAUDE_DESKTOP_CONFIG` env var (as `skills-mcp` already does).

## Implementation steps

1. Scaffold `sidecar-mcp` project: `package.json`, `tsconfig.json`, `src/index.ts`, `.gitignore`.
2. Copy and adapt the `parseDoc` frontmatter helper and the `getClientFilesystemPaths` / filesystem-reminder helper from `skills-mcp`.
3. Build the unified `list` tool: walks `commands/` and `skills/`, collects every entry with its namespace and description. Entries from `commands/` win on name collision.
4. Build the unified `read` tool: takes `name`, resolves to either a file (returns `body` only) or a folder (returns `body` from `SKILL.md` or `<name>.md` + `supports` list of sibling files and files under `scripts/`). Always prepends the filesystem-paths reminder.
5. Register the sidecar-mcp server in CC's `.mcp.json` alongside the existing `skills` entry (both run in parallel during validation).
6. Register the sidecar-mcp server in CD's `claude_desktop_config.json` alongside the existing `skills` entry (pass `CLAUDE_DESKTOP_CONFIG` env var via `WSLENV`).
7. Build, restart CC, restart CD.
8. Run the canary: from CD, call `mcp__sidecar__read` with `name: "wag1.5:adr"`. Verify body + supports are returned. Verify CD can then fetch the template and scripts through its filesystem MCP.
9. Once validated: retire `skills-mcp` (remove from both configs, delete `mcp-servers/skills-mcp/`).

## Open questions — grill these

- **a.** Does `list` return a flat list (`wag1.5:adr`, `kwiki:capture`, `push`, ...) or a grouped tree (`wag1.5: [adr, dev, docs, init, ...]`)? Flat is simpler; tree preserves structure for UI consumers.
- **b.** On a collision between `commands/foo.md` and `skills/foo/SKILL.md`, we said "commands wins." Should this be an error instead? Collisions probably indicate a mistake.
- **c.** What counts as a "support" file in a folder-shaped entry? Everything alongside `SKILL.md` recursively (`scripts/**/*`)? Only files at the same level (`adr-template.md`) plus `scripts/` as a whole? Something else?
- **d.** How does CC's "fall through to sidecar" actually happen mechanically? CC's slash command dispatcher is closed source. Options: (i) model-level behavior — CC sees an unknown slash, notices the `:` and calls sidecar.read; (ii) a hook that rewrites unknown slashes; (iii) require the user to explicitly call `mcp__sidecar__read` rather than `/wag1.5:adr`.
- **e.** Does sidecar-mcp recurse into `commands/` more than one level deep? Right now `listCommands` in skills-mcp only recurses one level (top-level + one nested namespace). Should the same cap apply here, or should sidecar-mcp support deeper trees like `commands/wag/ns/sub/thing.md`?
- **f.** Caching policy: sidecar-mcp is stateless; it just returns paths. Does the client write cache files anywhere specific, or is it free-form? Do we standardize a cache location under `~/.claude/cache/sidecar/`?

## Verification

- Canary (see above) is the primary end-to-end test.
- Smoke from CC: `mcp__sidecar__list` returns at least `wag1.5:adr`, `kwiki:capture`, `push`. `mcp__sidecar__read` returns `body + supports` for the canary and `body + []` for a flat file like `kwiki:capture`.
- Smoke from CD: same two calls after restart, same expected outputs. CD must also be able to read one of the `supports` paths via its filesystem MCP.
