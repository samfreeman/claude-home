---
description: Reply to the sender of the last inbox message, in the same thread
argument-hint: [message]
allowed-tools: Bash(date -u +%Y-%m-%dT%H%M), mcp__fs__fs_list, mcp__fs__fs_read, mcp__fs__fs_info,
  mcp__claude-inbox__inbox_list,
  mcp__claude-inbox__inbox_read
---

# Reply

Reply to the sender of the last message, in that message's thread.

## The Spec

The inbox is specified in `~/Dropbox/Claude/inbox/README.md`. Read it before replying.
This command follows it, and sends the same way `/send` does. If they disagree, the README wins.

## Step 1: Find the Last Message

The last message is the most recent message addressed to code:

1. **In this conversation:** the last message shown by `/inbox`, or received here some other way. Check that it's still where you saw it (`pending/` or `done/`), since the sender or another session may have moved it.
2. **Otherwise:** list `~/Dropbox/Claude/inbox/pending/` and `~/Dropbox/Claude/inbox/done/`, and take the file with the newest timestamp and `-to-code-` in its name. Also call `mcp__claude-inbox__inbox_list` with `target: "code"` and take the newest desktop item. The newer of the two is the last message. If claude-inbox-mcp isn't connected, say so and use the Dropbox message.

If there's no message for code anywhere, say so and stop.

Replies work like email. The last message stays the last message after it's moved to `done/`, and after code has already replied to it. Reply to it again whenever the user asks. Don't refuse because it's done, already answered, or because the other side hasn't answered yet.

Name the message you're replying to in your reply to the user (slug or title, sender, time in America/New_York). If which one is last is unclear, ask the user in plain text and wait for their answer.

## Step 2: Work Out Recipient and Thread

- **Recipient:** the sender of the last message. For a Dropbox message, that's the `<from>` in its filename. For a desktop item, it's `desktop`.
- **Thread (Dropbox only):** copy the last message's `thread` value. If it has none, use its filename. Never guess a thread from titles or slugs.
- **Desktop** has no threads. Send the reply under the same `project` as the item.

## Step 3: Write the Reply

- If `$ARGUMENTS` has text, that's the reply.
- If not, write the reply from the conversation: answer what the last message asked or reported, with what was found and done since.

Write it for what the recipient can reach:

- **voice** reads only Dropbox under `/Claude`, through db4cv. It can't run commands or read local files outside Dropbox. claude-home is visible to it only as the mirror at `/Claude/claude-home`, which tracks `origin/dev` and may lag local work.
- **desktop** gets claude.ai connectors and its own local MCP servers. It can't run commands.

## Step 4: Show the Draft, Then Send

Show the full draft in your reply, then call the send tool in the same turn. The tool's permission popup is where the user approves or rejects it. Don't ask "send this?" in text as well.

If the user rejects the popup, ask what to change, revise, and show the new draft before sending again.

### To a Dropbox recipient (voice)

1. Get the UTC timestamp by running `date -u +%Y-%m-%dT%H%M` as its own Bash call.
2. Build the filename `<timestamp>-code-to-<recipient>-<slug>.md`. The slug is a few lowercase words joined by hyphens.
3. List `~/Dropbox/Claude/inbox/pending/` with `mcp__fs__fs_list`. If the name is taken, add `-2` (then `-3`, and so on) after the slug.
4. Frontmatter: `thread` from Step 2 always. Add `title` only when the slug isn't enough, and `project` only when the message is about a specific project (the workspace root from the environment context, with the home directory replaced by `~`). Never put the timestamp, from or to in frontmatter.
5. Show the draft:
   ```
   Replying to: <slug or title> (from <sender>, <local time>)
   File: inbox/pending/<filename>
   ---
   thread: <thread>
   ---
   <body>
   ```
6. Create the file with the Write tool. Code uses a real clock, so it never uses the README's one-time rename.

### To desktop

1. Show the draft:
   ```
   Replying to: <title> (desktop item <id>, <local time>)
   To: desktop
   Project: <the item's project>
   Title: <short summary, under 60 chars>
   Content: <full message>
   ```
2. Call `mcp__claude-inbox__inbox_send` with `source: "code"`, `target: "desktop"`, and the `title`, `content` and `project` shown.

## Step 5: Mark the Replied-to Message Done

Replying deals with the message. If it's still pending, mark it done:

- **Dropbox message:** move it from `pending/` to `done/` with `mcp__fs__fs_move`, keeping the filename. Never edit or delete it.
- **Desktop item:** call `mcp__claude-inbox__inbox_update` with its id and `status: "done"`.

The permission popup is the approval. Don't ask in text as well.

## Step 6: Confirm

Tell the user what was sent: the filename for a Dropbox reply, or the returned id for desktop. Name the message it replied to. Give times in America/New_York, not UTC.
