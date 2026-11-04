---
description: Send a message to Claude voice (Dropbox inbox) or Claude Desktop (claude-inbox-mcp)
argument-hint: [voice|desktop] <message>
allowed-tools: Bash(date -u +%Y-%m-%dT%H%M), mcp__fs__fs_list
---

# Send a Message

## The Spec

The inbox is specified in `~/Dropbox/Claude/inbox/README.md`. Read it before sending.
This command follows it. If the two disagree, the README wins.

## Step 1: Pick the Recipient

The first word of `$ARGUMENTS` may name the recipient: `voice` or `desktop`.

- If it does, that's the recipient and the rest of `$ARGUMENTS` is the message.
- If it doesn't, ask the user in plain text who the message is for, then wait for their answer.

How each recipient is reached:

- **voice**: a file in `~/Dropbox/Claude/inbox/pending/`, as the README describes.
- **desktop**: `mcp__claude-inbox__inbox_send`. Desktop stays on claude-inbox-mcp until Sam decides whether it moves to the Dropbox inbox.

## Step 2: Write the Message

- If there is message text, use it as the message.
- If not, write a short summary of what has been done and where things stand, based on the recent conversation.

Messages give the other session information. Write them for what the recipient can reach:

- **voice** reads only Dropbox under `/Claude`, through db4cv. It can't run commands or read local files outside Dropbox. claude-home is visible to it only as the mirror at `/Claude/claude-home`, which may lag behind local work.
- **desktop** gets claude.ai connectors and its own local MCP servers. It can't run commands.

## Step 3: Show the Draft, Then Send

Show the full draft in your reply, then call the send tool in the same turn. The tool's permission popup is where the user approves or rejects it. Don't ask "send this?" in text as well.

If the user rejects the popup, ask what to change, revise, and show the new draft before sending again.

### To voice

1. Get the UTC timestamp by running `date -u +%Y-%m-%dT%H%M` as its own Bash call.
2. Build the filename `<timestamp>-code-to-voice-<slug>.md`. The slug is a few lowercase words joined by hyphens.
3. List `~/Dropbox/Claude/inbox/pending/` with `mcp__fs__fs_list`. If the name is taken, add `-2` (then `-3`, and so on) after the slug.
4. Frontmatter is optional. Include only what has a value:
   - `title`, when the slug isn't enough of a summary
   - `project`, when the message is about a specific project: the workspace root from the environment context, with the home directory replaced by `~`. Don't use pwd or any other command for this.
   - `thread`, when the message replies to one from voice. Copy the replied-to message's `thread` value; if it has none, use its filename. A new topic starts a new thread and has no `thread` field. Never guess a thread from titles or slugs.

   Never put the timestamp, from or to in frontmatter.

   Code takes its timestamp from a real clock, so it never uses the README's one-time rename. That rule is for senders unsure of the time.
5. Show the draft:
   ```
   File: inbox/pending/<filename>
   ---
   <frontmatter, if any>
   ---
   <body>
   ```
6. Create the file with the Write tool.

### To desktop

1. Show the draft:
   ```
   To: desktop
   Project: <workspace root with ~>
   Title: <short summary, under 60 chars>
   Content: <full message>
   ```
2. Call `mcp__claude-inbox__inbox_send` with `source: "code"`, `target: "desktop"`, `title`, `content` and `project`, all as shown in the draft.

## Step 4: Confirm

Tell the user the message was sent: the filename for voice, or the returned id for desktop. Give any time in America/New_York, not UTC.
