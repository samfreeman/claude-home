# Claude Code Environment Setup

Interactive setup script that bootstraps a full Claude Code development environment on a new machine. Supports WSL (Windows) and macOS.

## Prerequisites

### WSL (Windows)

Before running the script, you need WSL installed with Ubuntu:

1. Open PowerShell as Administrator:
   ```powershell
   wsl --install
   ```
2. Restart, then open Ubuntu from the Start menu
3. Install Node.js inside WSL:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   ```
4. Install git:
   ```bash
   sudo apt install git -y
   ```

You'll also need the following installed **on the Windows side** (the script will verify these):
- [Dropbox](https://www.dropbox.com/install) — syncing your Claude/creds folder
- [Node.js](https://nodejs.org/) — for Windows-native MCP servers
- [VS Code](https://code.visualstudio.com/) — with the WSL extension

### macOS

- Node.js 20+ (`brew install node`)
- git (included with Xcode Command Line Tools)
- [Homebrew](https://brew.sh/) (used to install GitHub CLI)
- [Dropbox](https://www.dropbox.com/install) — syncing your Claude/creds folder

## Quick Start

Clone the repo and run:

```bash
git clone git@github.com:samfreeman/claude-home.git ~/.claude
node ~/.claude/setup/setup.js
```

The script walks you through each step interactively. Every step explains what it will do and asks for confirmation before proceeding.

## Usage

```bash
node ~/.claude/setup/setup.js            # run setup (resumes from last incomplete step)
node ~/.claude/setup/setup.js --status   # show which steps are complete
node ~/.claude/setup/setup.js --reset    # clear state and start fresh
```

## What It Does

The script runs through 10 steps. Steps that don't apply to your platform are skipped automatically.

| Step | Name | WSL | Mac | Description |
|------|------|:---:|:---:|-------------|
| 0 | Windows Prerequisites | x | — | Verifies Dropbox, Node.js (Windows-side), and VS Code are installed. Detects Windows `%APPDATA%` path. |
| 1 | Base Setup | x | x | Configures npm global prefix, installs pnpm, claude-code CLI, Playwright browsers. Creates `~/source/` directory. Sets git identity. |
| 2 | GitHub CLI & SSH Keys | x | x | Installs `gh` CLI. Generates two SSH key pairs (personal + PayOnward). Writes `~/.ssh/config` with host aliases. |
| 3 | GitHub Auth | x | x | Manual step: add SSH public keys to GitHub, then the script validates SSH connectivity to both accounts. |
| 4 | Clone Repos | x | x | Clones samx, cs-bounce, dragonpay-api, text-expander (WSL only). Creates `~/source/unity` container. Fixes claude-home remote to use SSH alias. |
| 5 | Verify Dropbox | x | x | Confirms the Dropbox credentials path (you can change the default). Validates that expected `.env` files exist. |
| 6 | Build & Configure | x | x | Builds MCP servers (claude-memory, wag). Installs playwright-mcp dependencies. Copies credentials from Dropbox. Writes `.mcp.json` for Claude Code. Installs project dependencies. |
| 7 | Deploy to Windows | x | — | Copies MCP server builds to Windows side with platform-specific `npm install`. Writes `claude_desktop_config.json` to the detected AppData location. |
| 8 | Claude Desktop | x | x | Manual step: install Claude Desktop app. Verifies config is in place. On Mac, writes the config file. |
| 9 | Unity (Optional) | x | — | Optional: instructions for Unity Hub setup and project directory creation. |

## State & Resume

Progress is saved to `setup/state.json` after each completed step. If you interrupt the script (Ctrl+C) or it fails, re-running picks up where you left off.

## Path Detection

The script detects paths dynamically rather than hardcoding them:

- **Windows AppData**: detected via `cmd.exe /c echo %APPDATA%`
- **Dropbox location**: default is derived from the detected user home, but you're always asked to confirm or change it
- **Playwright browser version**: detected from `~/.cache/ms-playwright/`
- **Home directory and username**: from `os.homedir()` and `os.userInfo()`

## File Structure

```
setup/
  setup.js              Entry point and orchestrator
  utils.js              Shared utilities (OS detection, paths, prompts, state)
  configs.js            Config generators (.mcp.json, claude_desktop_config.json)
  step-0-prereqs.js     Windows Prerequisites
  step-1-base.js        Base Setup
  step-2-github-keys.js GitHub CLI & SSH Keys
  step-3-github-auth.js GitHub Auth
  step-4-repos.js       Clone Repos
  step-5-dropbox.js     Verify Dropbox
  step-6-build.js       Build & Configure
  step-7-deploy-win.js  Deploy to Windows
  step-8-desktop.js     Claude Desktop
  step-9-unity.js       Unity (Optional)
```
