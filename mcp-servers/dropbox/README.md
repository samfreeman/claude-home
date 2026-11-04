# dropbox-mcp

A remote MCP server for Dropbox, deployed on Cloudflare Workers and added to claude.ai as a custom connector, so it works on every Claude surface, including voice on iPhone and iPad. It replaces the official Dropbox connector for file work and adds what that connector lacks:

- **Verbatim reads.** `fetch` returns the file exactly as stored, byte for byte. HTML, XML, SVG and markdown keep their angle brackets. Non-UTF-8 files come back base64.
- **Rev-safe in-place edits.** `str_replace`, `append`, `insert` and `overwrite` each take `expected_rev` and write with Dropbox's rev-pinned update mode, so a stale rev fails instead of clobbering. Bytes outside the edit are preserved exactly.
- **Proof a write landed.** Every write returns the new `rev` and Dropbox's `content_hash`, checked against a hash of the bytes sent (`verified: true`). If they disagree, the call fails.
- **A hard scope.** Only `/Claude` (`SCOPE_ROOT`) and what's inside it can be read or changed. Paths, ns paths and file ids are all resolved and checked before anything is sent.

Failures are reported plainly. Nothing retries silently, and a refused call writes nothing.

## Tools

| Group | Tools |
|---|---|
| Read | `who_am_i`, `list_folder`, `search`, `fetch`, `get_file_metadata`, `file_preview`, `download_link` |
| Write | `create_file`, `create_folder`, `copy`, `move`, `delete`, `check_job_status` |
| Edit | `str_replace`, `append`, `insert`, `overwrite` |
| Sharing | `create_shared_link`, `list_shared_links`, `get_shared_link_metadata` |
| File requests | `create_file_request`, `get_file_request`, `list_file_requests` |

Names and arguments match the official connector's. Paper and Sign tools are deliberately left out.

## How auth works

```
claude.ai ──OAuth 2.1 (DCR or CIMD)──▶ this worker ──OAuth (offline)──▶ Dropbox
          (token this worker issues)              (refresh token kept in encrypted grant props)
```

Adding the connector sends you through Dropbox's own sign-in and consent page. The worker:

- admits only the Dropbox account in `ALLOWED_ACCOUNT_ID`, and admits no one when it's unset
- completes sign-ins only for redirect hosts in `ALLOWED_REDIRECT_HOSTS` (claude.ai, claude.com)
- keeps the Dropbox refresh token in the grant's encrypted props

Grants and registered clients don't expire, so the connector doesn't need re-adding. Dropbox access tokens are refreshed when they near expiry and cached in KV.

## Layout

- `src/tools/`, `src/dropbox/`, `src/scope.ts`, `src/text.ts`, `src/server.ts`: platform-neutral core. Web-standard `fetch`, `crypto.subtle`, and MCP SDK v2's `createMcpHandler`.
- `src/index.ts`, `src/auth.ts`, `src/mcp.ts`, `src/store.ts`: the Cloudflare layer (`@cloudflare/workers-oauth-provider`, KV). Moving to Vercel means replacing these: `Store` gets a Redis implementation, and the OAuth provider is swapped. The tools don't change.

## Develop

```
npm install
npm test          # vitest: every tool against an in-memory fake Dropbox
npm run typecheck
```

## Deploy

1. Log in to Cloudflare: `npx wrangler login`.
2. Create the KV namespace: `npx wrangler kv namespace create OAUTH_KV`. Put its id in `wrangler.jsonc`.
3. Deploy: `npx wrangler deploy`. Put the printed `https://dropbox-mcp.<subdomain>.workers.dev` URL in `PUBLIC_URL`.
4. Create a Dropbox app at https://www.dropbox.com/developers/apps:
   - Scoped access, Full Dropbox.
   - Redirect URI `<PUBLIC_URL>/callback`.
   - Permissions: `account_info.read`, `files.metadata.read`, `files.metadata.write`, `files.content.read`, `files.content.write`, `sharing.read`, `sharing.write`, `file_requests.read`, `file_requests.write`.
5. Set its credentials as secrets: `npx wrangler secret put DROPBOX_APP_KEY`, then `npx wrangler secret put DROPBOX_APP_SECRET`.
6. Redeploy, then add the connector in claude.ai: **Customize > Connectors > Add custom connector**, URL `<PUBLIC_URL>/mcp`.
7. The first sign-in is refused, and the refusal page names your `dbid:` account id. Set `ALLOWED_ACCOUNT_ID` to it, redeploy, and connect again.

Connectors added on claude.ai show up in the iOS and iPadOS apps automatically.
