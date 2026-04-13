---
description: Kill MCP subprocess(es) for this CC session so they respawn with fresh code. Preserves CC context — no save/load needed.
---

# Kill MCP — Restart MCP Subprocess Without Restarting CC

Kills one or more MCP server subprocesses that belong to the **current** CC session. CC automatically respawns them on the next MCP tool call, loading the latest `dist/index.js`. This preserves CC's conversation context while picking up freshly-built MCP code — the advantage over a full CC restart.

Accepts an optional MCP server name as argument (e.g. `/kill-mcp google-ai-mcp`). If omitted, lists running MCPs and asks which to kill.

## Step 1: Identify the current CC process

Walk up the Bash shell's process tree to find the ancestor `claude` binary. This scopes everything that follows to **only this session's** subprocesses — never touches subprocesses belonging to other CC instances running on the same machine.

```bash
pid=$$
cc_pid=""
while [ -n "$pid" ] && [ "$pid" != "1" ]; do
  comm=$(ps -o comm= -p "$pid" 2>/dev/null | tr -d ' ')
  if [ "$comm" = "claude" ]; then cc_pid="$pid"; break; fi
  pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
done
echo "cc_pid=$cc_pid"
```

If `cc_pid` is empty: stop and tell the user "Could not find parent CC process — are you running inside Claude Code?"

## Step 2: Find this session's MCP subprocess(es)

List direct children of CC whose command line matches an `mcp-servers/*/dist` path:

```bash
ps -eo pid,ppid,cmd | awk -v cc="$cc_pid" '$2 == cc && /mcp-servers\/[^ ]+\/dist/ {
  # Extract server name from the path
  match($0, /mcp-servers\/([^/]+)\/dist/, m)
  print $1, m[1]
}'
```

Each line has `<PID> <server-name>`. If there are zero matches: tell the user "No MCP subprocesses running for this CC session." Stop.

## Step 3: Select what to kill

- **Argument provided** (e.g. `google-ai-mcp`): filter the list to that server name. If no match, show the running MCPs and stop.
- **No argument**: show the list of running MCPs with PIDs, then ask plain-text which to kill. Accept a server name, a PID, or `all`. Do not use `AskUserQuestion`.

## Step 4: Kill

For each selected PID, run `kill <pid>`. Then verify it's gone with `ps -p <pid>` (exit code 1 = gone; success = still alive, which would be an unexpected failure).

## Step 5: Report and prompt

Tell the user:

- Which PID(s) were killed and which MCP server each belonged to
- That CC will respawn the subprocess automatically on the next MCP tool call for that server
- To force the respawn immediately, call any harmless tool from the server (e.g. `mcp__google-ai-mcp__list_transcripts` for `google-ai-mcp`) — CC will spawn a fresh subprocess that loads the current `dist/index.js`

Do NOT attempt to trigger the respawn yourself — let the next real tool call from the user (or a verification call they explicitly ask for) do it.

## Safety invariants

- Never kill subprocesses belonging to other CC sessions. The `$2 == cc_pid` filter in Step 2 is the guardrail — do not remove it.
- Never kill the CC process itself. Only its direct MCP children.
- Never kill non-MCP children (e.g. the shell running this command). The `mcp-servers/.*/dist` pattern filter is the guardrail — do not remove it.
- If anything looks wrong (no `cc_pid` resolved, unexpected process list, `kill` denied), stop and report. Do not guess.
