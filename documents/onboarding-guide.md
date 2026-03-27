# Developer Onboarding Guide

From a fresh Windows machine to a fully running Claude Code + CP system.

> **Phases 1-2** (WSL, Node, git, SSH, GitHub, Claude Code) are in the [README](../README.md). Complete those first, then continue here from Phase 3.

---

## Phase 3: Claude Home (Shared Tooling)

### 3.1 Fork claude-home

Go to https://github.com/samfreeman/claude-home and click **Fork**.

### 3.2 Clone your fork

```bash
git clone git@github.com:YOUR_USERNAME/claude-home.git ~/.claude
cd ~/.claude
git checkout dev
```

### 3.3 Set upstream remote

This lets you pull updates from the original repo:

```bash
git remote add upstream git@github.com:samfreeman/claude-home.git
```

To pull updates later:

```bash
git fetch upstream
git merge upstream/dev
```

To submit improvements back:

```bash
git push origin dev
# Then open a PR from your fork to samfreeman/claude-home
```

### 3.4 Build MCP servers

```bash
# claude-memory-mcp
cd ~/.claude/mcp-servers/claude-memory-mcp
npm install
npm run build

# claude-inbox-mcp
cd ~/.claude/mcp-servers/claude-inbox-mcp
npm install
npm run build

# wag-mcp
cd ~/.claude/mcp-servers/wag-mcp
npm install
npm run build

# google-ai-mcp
cd ~/.claude/mcp-servers/google-ai-mcp
npm install
npm run build

# playwright-mcp
cd ~/.claude/mcp-servers/playwright-mcp
npm install
npm run build
npx playwright install chromium
sudo npx playwright install-deps
```

### 3.5 Configure environment files

Each MCP server that needs API keys has a `.env` file. Create them:

**google-ai-mcp** (requires a Gemini API key from https://aistudio.google.com/apikey):

```bash
echo "GEMINI_API_KEY=your_key_here" > ~/.claude/mcp-servers/google-ai-mcp/.env
```

**claude-memory-mcp** (uses local SQLite by default — no config needed unless using Turso):

The database will be created automatically at `~/.claude/mcp-servers/claude-memory-mcp/data/memory.db`.

### 3.6 Verify .mcp.json

The repo includes `.mcp.json` which configures MCP servers for Claude Code. Verify the paths match your home directory:

```bash
cat ~/.claude/.mcp.json
```

All paths should reference `/home/YOUR_USERNAME/`. If your username isn't `samfr`, you'll need to update the paths. The easiest way:

```bash
cd ~/.claude
claude
```

Then ask Claude Code to update `.mcp.json` with your correct home directory paths.

### 3.7 Symlink .mcp.json

Claude Code looks for `.mcp.json` in your home directory:

```bash
ln -sf ~/.claude/.mcp.json ~/.mcp.json
```

---

## Phase 4: Claude Desktop Configuration

Claude Desktop runs on Windows but can invoke WSL commands. All MCP servers run through WSL for consistency.

Create or update the Claude Desktop config. From WSL:

```bash
# Detect your Windows AppData path
WIN_APPDATA=$(cmd.exe /c "echo %APPDATA%" 2>/dev/null | tr -d '\r')
WIN_APPDATA_WSL=$(wslpath "$WIN_APPDATA")

cat > "$WIN_APPDATA_WSL/Claude/claude_desktop_config.json" << 'DESKTOP_EOF'
{
  "mcpServers": {
    "claude-memory": {
      "command": "wsl",
      "args": ["-e", "bash", "-c", "node /home/YOUR_USERNAME/.claude/mcp-servers/claude-memory-mcp/dist/index.js"]
    },
    "claude-inbox": {
      "command": "wsl",
      "args": ["-e", "bash", "-c", "node /home/YOUR_USERNAME/.claude/mcp-servers/claude-inbox-mcp/dist/index.js"]
    },
    "wag": {
      "command": "wsl",
      "args": ["-e", "bash", "-c", "node /home/YOUR_USERNAME/.claude/mcp-servers/wag-mcp/dist/index.js"]
    },
    "filesystem": {
      "command": "wsl",
      "args": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/home/YOUR_USERNAME"]
    }
  },
  "preferences": {
    "coworkScheduledTasksEnabled": false,
    "sidebarMode": "chat"
  }
}
DESKTOP_EOF
```

**Replace `YOUR_USERNAME` with your WSL username** in all four places.

Restart Claude Desktop to pick up the new config.

### 4.1 Verify MCP servers in Claude Desktop

Open Claude Desktop and start a new conversation. Type:

> What MCP tools do you have available?

It should list tools from claude-memory, claude-inbox, wag, and filesystem. If any are missing, check the Claude Desktop logs:

- Windows: `%APPDATA%\Claude\logs\`

---

## Phase 5: Claude Code Configuration

### 5.1 Personalize settings.json

The repo includes `settings.json` with permission rules. Review it:

```bash
cat ~/.claude/settings.json
```

This file controls what Claude Code can do without asking. The defaults are sensible — read-only operations are auto-allowed, destructive git operations are denied.

### 5.2 Update CLAUDE.md (optional)

`~/.claude/CLAUDE.md` contains global instructions for Claude Code. Review it and adjust for your preferences. Key rules you may want to keep:

- Questions get answers, not actions (if prompt has `?`)
- Never commit to main — always use `dev`
- TypeScript style rules (single quotes, tabs, no semicolons)

Rules you should personalize:

- Git commit authorship — change the Co-Authored-By email to yours

### 5.3 First run

```bash
cd ~/source
claude
```

Claude Code will authenticate with your Claude account on first run. Follow the browser-based auth flow.

---

## Phase 6: CP (Claude Projects)

### 6.1 Create your CP repo

```bash
cd ~/source
mkdir claude-projects
cd claude-projects
git init
git checkout -b dev
```

### 6.2 Initialize CP structure

```bash
mkdir -p playbook
mkdir -p snapshots
```

- `playbook/` — your living standards library (architecture patterns, landing page spec, WAG doc templates)
- `snapshots/` — on-demand project status snapshots

### 6.3 Create initial CLAUDE.md

Create `~/source/claude-projects/CLAUDE.md` with instructions for how CP should behave. This will evolve as you use it.

### 6.4 Push to GitHub

```bash
gh repo create claude-projects --private --source=. --push
```

### 6.5 Wire CP into Claude Code

Add CP to your additional directories so Claude Code can access it from any project:

Edit `~/.claude/settings.json` and add to the `additionalDirectories` array:

```json
"additionalDirectories": [
  "/home/YOUR_USERNAME/source/claude-projects"
]
```

---

## Phase 7: Verification

Run through these checks to confirm everything works:

| Check | Command / Action | Expected |
|-------|-----------------|----------|
| WSL | `wsl --status` from PowerShell | Shows Ubuntu running |
| Node (WSL) | `node --version` | v22.x |
| Node (Windows) | `node --version` from PowerShell | v22.x |
| pnpm | `pnpm --version` | Installed |
| Claude Code | `claude --version` | Installed |
| Git SSH | `ssh -T git@github.com` | Authenticated |
| GitHub CLI | `gh auth status` | Logged in |
| VS Code + WSL | `code .` from WSL | Opens VS Code |
| MCP servers | Start Claude Code, ask "what tools do you have?" | Lists MCP tools |
| Claude Desktop | Open CD, ask "what tools do you have?" | Lists MCP tools |
| CP repo | `ls ~/source/claude-projects/` | Shows playbook/, snapshots/ |

---

## Pulling Updates from Upstream

When the shared tooling gets updates:

```bash
cd ~/.claude
git fetch upstream
git merge upstream/dev
```

If MCP servers were updated, rebuild:

```bash
cd ~/.claude/mcp-servers/SERVERNAME
npm install
npm run build
```

Restart Claude Desktop to pick up rebuilt MCP servers.

## Submitting Improvements

```bash
cd ~/.claude
git push origin dev
```

Then open a PR from your fork's `dev` branch to `samfreeman/claude-home` `dev` branch on GitHub.

---

## Troubleshooting

### WSL won't start after install
You must reboot. `wsl --install` requires a restart before WSL is on PATH.

### VS Code `code` command not found in WSL
Install the WSL extension in VS Code on Windows. Then restart your WSL terminal.

### Paste doesn't work in WSL
Right-click to paste. Ctrl+V doesn't work in the default Ubuntu terminal. Use Windows Terminal for better paste support (Ctrl+V works there).

### MCP server not showing in Claude Desktop
1. Check the config path: `%APPDATA%\Claude\claude_desktop_config.json`
2. Verify the WSL username in all paths
3. Restart Claude Desktop (fully quit from system tray, reopen)
4. Check logs: `%APPDATA%\Claude\logs\`

### npm install fails with permission errors
Make sure you configured the npm global prefix (Phase 2, step 2.1). Never use `sudo npm install -g`.

### SSH key rejected by GitHub
Make sure you added the `.pub` file contents (not the private key). Check with `cat ~/.ssh/id_ed25519.pub`.
