#!/usr/bin/env bash
# ─── Azure Key Vault Setup for Claude MCP Secrets ───────────────────────────
# Run once to create vault and store your first secrets.
# Prerequisites: Azure CLI installed + logged in (az login)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

VAULT_NAME="${CLAUDE_VAULT_NAME:-claude-mcp-secrets-$(whoami)}"
RESOURCE_GROUP="${CLAUDE_VAULT_RG:-claude-secrets-rg}"
LOCATION="${CLAUDE_VAULT_LOCATION:-eastus}"

echo "──────────────────────────────────────────"
echo "  Azure Key Vault Setup for Claude MCP"
echo "──────────────────────────────────────────"
echo ""

# ── Check prereqs ──
if ! command -v az &>/dev/null; then
  echo "Azure CLI not found. Install it first:"
  echo "  curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash"
  exit 1
fi

if ! az account show &>/dev/null 2>&1; then
  echo "Not logged in. Run:  az login"
  exit 1
fi

ACCOUNT=$(az account show --query '{name:name, id:id}' -o tsv)
echo "Using Azure account: $ACCOUNT"
echo ""

# ── Create resource group ──
echo "Creating resource group: $RESOURCE_GROUP ..."
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" -o none

# ── Create vault ──
echo "Creating key vault: $VAULT_NAME ..."
az keyvault create \
  --name "$VAULT_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --enable-rbac-authorization false \
  -o none 2>/dev/null || {
    echo "Vault name '$VAULT_NAME' may be taken. Set CLAUDE_VAULT_NAME to override."
    exit 1
  }

# ── Store secrets interactively ──
echo ""
echo "Now let's store your secrets."
echo "(Leave blank to skip any key)"
echo ""

read -rp "Gemini API Key: " GEMINI_KEY
if [[ -n "$GEMINI_KEY" ]]; then
  az keyvault secret set --vault-name "$VAULT_NAME" --name "GEMINI-API-KEY" --value "$GEMINI_KEY" -o none
  echo "  ✓ GEMINI-API-KEY stored"
fi

# ── Add more keys here as needed ──
read -rp "Any other secret? Name (or Enter to skip): " OTHER_NAME
if [[ -n "$OTHER_NAME" ]]; then
  read -rp "  Value: " OTHER_VALUE
  az keyvault secret set --vault-name "$VAULT_NAME" --name "$OTHER_NAME" --value "$OTHER_VALUE" -o none
  echo "  ✓ $OTHER_NAME stored"
fi

# ── Write vault name to local config ──
CONFIG_DIR="$HOME/.claude/secrets"
mkdir -p "$CONFIG_DIR"
echo "$VAULT_NAME" > "$CONFIG_DIR/vault-name"
echo ""
echo "──────────────────────────────────────────"
echo "  Done! Vault name saved to:"
echo "  $CONFIG_DIR/vault-name"
echo ""
echo "  On each new machine, just run:"
echo "    az login"
echo "    echo '$VAULT_NAME' > ~/.claude/secrets/vault-name"
echo ""
echo "  Then restart Claude Desktop."
echo "──────────────────────────────────────────"
