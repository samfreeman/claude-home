# WSL2 Setup for Claude Code

This guide walks through setting up WSL2 on a Windows machine to run Claude Code with a shared configuration.

## Prerequisites

- Windows 10 (version 2004+) or Windows 11
- Administrator access

## Step 1: Install WSL2

Open PowerShell as Administrator (right-click Start → "Windows Terminal (Admin)" or "PowerShell (Admin)"):

```powershell
wsl --install
```

This installs WSL2 with Ubuntu by default. Restart when prompted.

## Step 2: Initial Ubuntu Setup

After restart, Ubuntu will launch automatically. Create a username and password when prompted.

Update packages:

```bash
sudo apt update && sudo apt upgrade -y
```

## Step 3: Install Dependencies

Install git and Node.js:

```bash
sudo apt install git nodejs npm -y
```

Verify installations:

```bash
git --version
node --version
npm --version
```

## Step 4: Clone claude-home Configuration

```bash
git clone https://github.com/samfreeman/claude-home.git ~/.claude
```

Configure git identity:

```bash
cd ~/.claude
git config user.email "sam.freeman.55@gmail.com"
git config user.name "Sam Freeman"
```

## Step 5: Install Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

## Step 6: Run Claude Code

```bash
claude
```

On first run, you'll need to authenticate with your Anthropic account.

---

## VS Code Integration

### Install VS Code (on Windows)

Download and install VS Code from https://code.visualstudio.com/ if not already installed.

### Install WSL Extension

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "WSL" or "Remote - WSL"
4. Install the **WSL** extension by Microsoft

### Open Projects in WSL

**Option A: From VS Code**
1. Press F1 or Ctrl+Shift+P
2. Type "WSL: Connect to WSL"
3. Once connected, File → Open Folder → navigate to your project

**Option B: From WSL Terminal**
Navigate to your project and run:

```bash
code .
```

This opens VS Code connected to WSL with that folder.

### Recommended: Set WSL as Default Terminal

1. In VS Code, press Ctrl+Shift+P
2. Type "Terminal: Select Default Profile"
3. Choose "Ubuntu (WSL)"

---

## Syncing Configuration Between Machines

To pull latest changes from another machine:

```bash
cd ~/.claude
git pull
```

To push changes made on this machine:

```bash
cd ~/.claude
git add -A
git commit -m "Description of changes"
git push
```

---

## Troubleshooting

### WSL2 not available

Ensure virtualization is enabled in BIOS and Windows features are enabled:

```powershell
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
```

Restart and try again.

### Node.js version too old

If npm install fails, install a newer Node.js:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Permission errors with npm global install

```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

Then retry the npm install.
