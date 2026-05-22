---
description: Read the results document written back by the counterpart session.
argument-hint: <optional focus for the debrief>
---

# handoff:result

Run this in the original session after the other agent has finished. Reads `handoff.results.md` from `$TMPDIR/handoffs/` (or `/tmp/handoffs/` if `$TMPDIR` is unset).

If the file is missing, say so and stop — the counterpart hasn't returned yet.

Summarise what the other session did, the outcomes and artifacts produced, and anything surprising or worth following up on. Propose next steps based on what was accomplished.

If `$ARGUMENTS` is present, focus the debrief through that lens.
