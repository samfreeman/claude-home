---
description: Enter VÖRSANN mode — load everything about VÖRSANN, sweep email, and treat every later question as VÖRSANN research
---

# Vor — VÖRSANN Mode

VÖRSANN (formerly DPAL) is heard by voice as "Vorson", "Vorsan", "Warson", "void"; DPAL as "Depaul", "D Paul", "depot". All the same project.

Typing `/vor` puts this session into **VÖRSANN mode** until Sam says otherwise. Two parts: load the core now, then research VÖRSANN for every question that follows.

## Part 1: Load the core (read-only)

From Dropbox `/Claude/VÖRSANN/`, read in this order:
1. `README.md` — front door. It's a claim, not a fact; if the folder disagrees, the folder wins. Tell Sam.
2. `players.md` — every player and **every** email address (some have more than one).
3. `handoff.md` — latest handoff
4. `Email.md` — the thread log and its "Last swept" date
5. The newest file in `daily/`
6. List the folder root and `attachments/`. Sam saves files in both.

If any of these cannot be read, say which one failed and stop.

## Part 2: Email sweep (read-only)

Search sam.freeman.55@gmail.com for ALL of the following, attachments or not, from the "Last swept" date to today:
- mail **from** any address in players.md (read fresh, never hardcoded)
- mail **Sam sent to** any address in players.md
- mail from anyone mentioning `VÖRSANN`, `Vorsann`, `DPAL`, `CarbonPura`, `RSC2`, `WellGuard`, or `Metamorphic`

Also include older threads with attachments that Email.md flags "not read — download" and that are still not in Dropbox.

Open and read every matching thread. Don't work from snippets. Search shows at most the 5 oldest messages in a thread, so open long threads to see the newest replies.

The Gmail connector can't read attachments. Sam downloads them by hand into `/Claude/VÖRSANN/attachments/`.

## Part 3: Report to Sam

Answer first, briefly:

**A. Attachments to download**: newest first. For each: filename, sender, date, subject, and one line on why it matters. Mark each **NEW** or **FLAGGED** (Email.md already said download it). Give files already in Dropbox only as a count. Skip inline image.png screenshots unless they're the substance.

**B. What the emails say**: newest first, one short entry per thread not already in Email.md. Who, when, what it says, and any **ACTION ON SAM**.

**C. Flags**: addresses not in players.md, Drive or Docusign links, anything contradicting README.md or players.md.

End with: "Download what you want into /Claude/VÖRSANN/attachments/ and tell me when." Offer, as one line, to add the new threads to Email.md. Write only on Sam's go.

## Part 4: For the rest of the session

Every question Sam asks is a VÖRSANN question, **even if it seems unrelated**. Before answering, research it across all VÖRSANN sources. You don't need to read everything up front; go find what the question needs:
- Dropbox `/Claude/VÖRSANN/`: everything, including `attachments/`, `website/`, `Patents/`, `dashboard/`, `daily/`, and the audit documents
- Dropbox `/Claude/DPAL/`: the pre-rename history
- Gmail: any thread, any date, not just the sweep window
- the vorsann code repos

Say where an answer came from. If the sources don't cover it, say so. Don't guess.

## Rules

- Read-only until Sam says go (checkpoint writes).
- Narrate before each tool call.
- If a call fails, say it failed first. No workarounds.
- One question at a time.
- Names, not numbers.
