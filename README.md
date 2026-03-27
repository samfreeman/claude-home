# Claude Home

A batteries-included development environment for Claude Code. MCP servers, workflow automation, cross-project management, and opinionated defaults — so you can start building instead of configuring.

## What You Get

**MCP Servers** — purpose-built tools that extend Claude Code and Claude Desktop:

| Server | What it does |
|--------|-------------|
| **claude-memory** | Persistent memory across conversations — SQLite-backed, searchable, survives session resets |
| **claude-inbox** | Async messaging between Claude Code and Claude Desktop — think across sessions |
| **wag** | Structured product development workflow: docs, architecture decisions, implementation with gate checks |
| **google-ai** | Gemini integration — ask questions about YouTube videos, generate images |
| **playwright** | Browser automation — navigate, click, screenshot, test |

**WAG Workflow** — a repeatable process for building software with AI:

```
DOCS → ADR → DEV → GATE CHECK → COMMIT
```

Write your PRD and architecture docs. Create architecture decision records for each feature. Implement with a gate check before every commit. No cowboy coding.

**Opinionated Defaults** — permissions, code style, git hygiene:

- Read-only operations auto-approved — no permission fatigue
- Destructive git operations blocked — no force pushes, no commits to main
- TypeScript style enforced — single quotes, tabs, no semicolons, no trailing commas
- Every commit attributed and co-authored

**Cross-Platform** — WSL and macOS. Claude Desktop talks to MCP servers through WSL on Windows, natively on Mac. One config, both platforms.

## Quick Look

```bash
# From any project directory
claude

> "What's the status of all my projects?"        # Cross-project awareness
> "Apply the landing page standard to this app"   # Reusable patterns
> "Create an ADR for the new auth flow"           # Structured decisions
> "What did Desktop say?"                         # Check async messages
> "Remember that we chose Turso over Supabase"    # Persistent memory
```

## Getting Started

### Prerequisites

- Windows 10/11 or macOS
- [Claude Pro or Max](https://claude.ai/) account
- GitHub account

### Phase 1: Windows Foundation

> macOS users: install Node.js 22+ via Homebrew, skip WSL steps, and jump to Phase 2.

#### 1.1 Install Windows Terminal

Open Microsoft Store, search "Windows Terminal", install it. Supports WSL tabs, proper paste (Ctrl+V), and Unicode.

#### 1.2 Install WSL

Open PowerShell as Administrator:

```powershell
wsl --install
```

**Reboot required.** WSL is not available until you restart.

After reboot, open "Ubuntu" from the Start menu. Create a Unix username and password when prompted.

> **Tip:** In the default Ubuntu terminal, paste is right-click. Use Windows Terminal instead.

#### 1.3 Install Node.js in WSL

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

#### 1.4 Install git in WSL

```bash
sudo apt install -y git
```

#### 1.5 Install VS Code

Download from https://code.visualstudio.com/ and install. Then add the **WSL extension** (Extensions → search "WSL" → install by Microsoft).

Verify from WSL: `code --version`

#### 1.6 Install Node.js on Windows

Download from https://nodejs.org/ (LTS). Claude Desktop needs Windows-native Node.

#### 1.7 Install Claude Desktop

Download from https://claude.ai/download. Sign in with your Claude account.

### Phase 2: Development Environment

All steps below run in WSL (or native terminal on macOS).

```bash
# Avoid sudo for global installs
mkdir -p ~/.npm-global
npm config set prefix ~/.npm-global
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Global tools
npm install -g pnpm
npm install -g @anthropic-ai/claude-code

# Git identity
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# SSH key for GitHub
mkdir -p ~/.ssh && chmod 700 ~/.ssh
ssh-keygen -t ed25519 -C "your.email@example.com" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
# → Copy this to https://github.com/settings/keys

# Verify
ssh -T git@github.com

# GitHub CLI
sudo apt update && sudo apt install -y gh
gh auth login

# Project home
mkdir -p ~/source
```

### Phase 3: Install Claude Home

Fork this repo, then:

```bash
git clone git@github.com:YOUR_USERNAME/claude-home.git ~/.claude
cd ~/.claude
git checkout dev
git remote add upstream git@github.com:samfreeman/claude-home.git
```

**Continue setup** in [documents/onboarding-guide.md](documents/onboarding-guide.md) — build MCP servers, configure Claude Desktop, set up your project management.

## Staying Updated

```bash
cd ~/.claude
git fetch upstream
git merge upstream/dev
```

Rebuild any updated MCP servers:

```bash
cd ~/.claude/mcp-servers/SERVERNAME
npm install && npm run build
```

## Contributing

Push to your fork's `dev` branch, open a PR to `samfreeman/claude-home`. All improvements welcome — MCP servers, skills, workflow enhancements, documentation.

## What's Inside

```
~/.claude/
├── mcp-servers/        MCP server implementations
│   ├── claude-memory/  Persistent memory (SQLite)
│   ├── claude-inbox/   Desktop ↔ Code messaging
│   ├── wag-mcp/        Product development workflow
│   ├── google-ai-mcp/  Gemini integration
│   └── playwright-mcp/ Browser automation
├── commands/           Custom slash commands
├── agents/             Agent definitions
├── documents/          Shared standards and guides
├── hooks/              Git and pre-commit hooks
├── setup/              Automated setup scripts
└── context/            Shared context files
```

## License

MIT
