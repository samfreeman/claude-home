#!/usr/bin/env bash
# SessionStart hook — make kwiki ambiently visible.
#
# kwiki is otherwise pull-only: nothing consults it unless explicitly queried,
# so the model rarely thinks to. This emits a minimal catalog of concept-page
# slugs (no descriptions — slugs are self-describing) so the model knows what
# kwiki holds and can run /kwiki query <topic> when a topic matches.
#
# Live-generated from the wiki directory on every session start, so it is
# always current. Stdout is injected into the session context by Claude Code.

wiki="/mnt/c/Users/samfr/Dropbox/Claude/kwiki/wiki"
[ -d "$wiki" ] || exit 0

slugs=$(cd "$wiki" && ls *.md 2>/dev/null | grep -vx 'index.md' | grep -vx 'log.md' | sed 's/\.md$//' | tr '\n' ' ')
[ -n "$slugs" ] || exit 0

printf 'kwiki (your personal knowledge wiki) holds pages on these topics. When one is relevant to the conversation, run `/kwiki query <topic>` to pull the full page:\n%s\n' "$slugs"
