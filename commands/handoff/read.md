---
description: Read a handoff document written by another session and pick up the work.
argument-hint: <optional extra instructions to layer on top>
---

# handoff:read

Run this at the start of a fresh session. Reads `handoff.md` from `$TMPDIR/handoffs/` (or `/tmp/handoffs/` if `$TMPDIR` is unset) and ingests it as context.

If the file is missing, say so and stop.

After reading, summarise what the handoff is asking for, note any suggested skills, propose a plan, and confirm with the user before starting work.

If `$ARGUMENTS` is present, layer it on top of the handoff as additional instructions from the user.
