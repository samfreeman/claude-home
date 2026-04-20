# LEARNING-004: OS-shell processes must not own application business logic

**Source snag:** SNAG-004 from chatr
**Applies to:** all (any WAG project building on an OS shell — Electron, Tauri, VS Code extension host, browser extension, native wrapper, etc.)

## Standard

OS-shell processes (Electron main, VS Code extension host, Tauri main, browser-extension service worker, native packagers wrapping a webview, etc.) must **not** own application business logic. The shell's only roles are: window/UI hosting, OS integration (menus, file dialogs, notifications), and supervising the application lifecycle. Business logic — services, event store, provider adapters, runtime composition — runs in a **separate process the shell spawns and supervises**. The shell connects the UI bundle (loaded into a webview) to the application via a transport-agnostic channel (loopback WebSocket, gRPC, named pipes, etc.).

This split makes the application:
1. **Portable across shells** — swapping Electron for VS Code, Tauri, or a browser tab is a launch-config change, not a runtime refactor.
2. **Runnable headless** — the application can run without any shell at all, exposing its transport for browser-hosted UIs or remote clients.
3. **Crash-isolated** — the shell crashing doesn't take down the application, and vice versa.

The cost is one extra process and a small amount of supervision plumbing. The cost of *not* doing this is that every cross-shell port becomes a refactor of the runtime composition — exactly what the WebSocket-not-IPC decision (often present in such projects) was supposed to prevent at the transport layer but failed to enforce at the process layer.

## Check

For each shell entry point in the project (e.g., `apps/<shell>/src/main.ts`, the Electron `main` process, the VS Code extension `activate()` function):

1. **Search for application-logic imports.** Does the shell entry import:
   - Effect runtime composition (`Effect.runFork`, `ManagedRuntime`, `Layer.provide`, `pipe(...)` of services)?
   - DB clients (`@effect/sql-*`, Drizzle, Prisma, Kysely, raw `better-sqlite3`)?
   - Domain modules (event store, decider, projector, reactor, provider adapters)?
   - DI container / service locator?
   - Any package whose name describes business concerns (`chat-core`, `auth-core`, `payment-core`, etc.)?

   If yes — that's the violation. The shell is owning logic it should be supervising.

2. **Search for the application entrypoint.** Is there a separate `apps/service/`, `apps/server/`, `apps/backend/`, or similar workspace whose `main` runs as a Node/Bun/Deno process and exposes the application via a transport? If not — the architecture has not yet split.

3. **Search for the spawn handoff.** Does the shell entry call `child_process.spawn` (or platform equivalent) to launch the application process? If not — they're sharing a process.

4. **Read the cited reference architecture (if any).** Many WAG projects cite an external pattern source (T3 Code, KitJS, etc.). Verify the cited source actually does what the project claims; don't lean on alignment claims that haven't been verified.

## Violations look like

```ts
// apps/host/src/main.ts (Electron main)  — VIOLATION
import { app, BrowserWindow } from 'electron'
import { Layer, Effect, ManagedRuntime } from 'effect'
import { EventStoreLive } from '@chatr/chat-core'      // ← business logic in shell
import { ClaudeAdapterLive } from '@chatr/provider-claude'  // ← business logic in shell
import { WSServerLive } from './ws-server'

const AppLive = Layer.mergeAll(EventStoreLive, ClaudeAdapterLive, WSServerLive)
const runtime = ManagedRuntime.make(AppLive)         // ← runtime in the shell

app.whenReady().then(() => {
  runtime.runPromise(startService)                   // ← shell drives application lifecycle
  new BrowserWindow({ /* ... */ }).loadURL(/* ... */)
})
```

The shell is now bound to Effect-TS, to the event store, to the provider adapters. Swapping Electron for VS Code requires re-creating that runtime composition inside the VS Code extension host — a refactor, not a config change. Running headless requires extracting the WS server out of the Electron main process — another refactor.

Other common shapes:

- **Tauri** project where `src-tauri/main.rs` directly invokes business-logic Rust modules (instead of forking a separate `app-core` process).
- **VS Code extension** where `activate()` instantiates an entire DI container of services (instead of spawning a child process whose API the extension calls into).
- **Browser-extension** service worker that runs the full app logic instead of communicating with a backend over fetch / WebSocket.

In all cases the symptom is: the shell entrypoint imports modules whose names describe business concerns.

## Fix pattern

1. **Split processes.** Extract business logic into a `service` (or `backend`, `core` — pick one name and stick to it) workspace. Its entry runs as a Node/Bun/Deno process. It exposes a transport (loopback WebSocket is a good default — works across Electron, VS Code, browser, and headless without modification).

2. **Make the shell procedural.** The shell entry holds *only*: window creation, OS integration, and child-process supervision (spawn, wait-for-ready, crash handling, graceful shutdown). No Effect runtime, no DB, no business modules.

3. **Webview points at the service.** The shell loads the UI bundle into a webview; the bundle connects to the service's transport. The bundle is shell-agnostic — same bundle works in Electron, VS Code webview, browser tab.

4. **Document the split as a key decision.** A KD that names the principle ("shell is a hosting provider, not the application") and lists the three runtime parts (service, app/UI, shell) makes the boundary visible to future readers and prevents drift.

5. **Verify against the cited reference.** If the project cites an upstream pattern (T3 Code, etc.), read the reference's actual entry points and confirm the split is real. Cited alignment that turns out to be myth is a snag in itself.

## Template patch — Architecture KD

```markdown
| N | **Shell is a hosting provider, not the application. Service runs as its own process; app runs inside the shell's webview.** | Single shell process owning service + app + lifecycle; shells importing service code as a library so they share a process. | The single-process design couples the runtime to the shell — the same problem the WebSocket transport choice was meant to head off, but committed at the process layer. Adopting the shell+separate-backend pattern: shell launches service as a child process and loads app into a webview pointed at service's transport port. Service has no shell imports. Three runtime parts, three responsibilities — service (business core), app (presentation), shell (hosting provider). Shells are interchangeable; service and app are the product. |
```

## Template patch — directory structure

```
<repo>/
├── service/                # the application's core process — Node/Bun, owns business logic
│   └── src/
│       └── ...             # event store, providers, runtime composition all live here
├── app/                    # the UI bundle (React/Vue/Svelte/etc.) — loaded into the shell's webview
├── shells/                 # OS-agnostic hosting providers — each spawns service + loads app
│   ├── electron/           # Electron shell
│   └── vscode/             # VS Code extension shell
└── packages/               # shared workspaces (event types, public SDK, etc.)
```

Use plural `shells/` even with a single shell — it signals the architecture anticipates multiple coexisting shells. Use singular `service/` and `app/` when those are locked at one implementation each.
