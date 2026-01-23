# pw - Playwright Browser Control

Control Chrome browser via Playwright MCP with GUI display via WSLg.

## Usage

```
/pw <prompt describing what to do>
```

## Examples

```
/pw Navigate to https://example.com and take a screenshot
/pw Open localhost:3000 and check if the login form is visible
/pw Take an accessibility snapshot of the current page
/pw Click the submit button and wait for the response
```

## How it works

Playwright MCP automatically launches Chrome in WSL2, which displays on Windows via WSLg (GUI subsystem). The browser window appears on Windows while the browser process runs in WSL2.

## Requirements

- WSLg enabled (default on Windows 11)
- Playwright browsers installed: `npx playwright install chrome`
- MCP configuration in `.mcp.json` without `--cdp-endpoint` parameter
