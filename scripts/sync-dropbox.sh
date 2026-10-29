#!/usr/bin/env bash
# sync-dropbox.sh — copy claude-home's dev branch into Dropbox/Claude/claude-home
#
# The Dropbox copy exists so tools that can't read GitHub (wag voice) can read
# claude-home. It is a plain file copy, not a git clone, and is refreshed only
# when this script is run. Dropbox then syncs it on its own schedule.
#
#   ~/.claude/scripts/sync-dropbox.sh            sync the Dropbox copy to dev
#   ~/.claude/scripts/sync-dropbox.sh --dry-run  show what would change
#
# Mirrors exactly what is on origin/dev (fetched first), so uncommitted or
# unpushed work never lands in Dropbox, and files no longer in dev are removed.
# Only files whose content changed are rewritten, so a routine run touches a
# handful of files.
#
# Voice's Dropbox reader strips anything tag-like from any file it reads, even
# inside code fences. So the Dropbox copy is encoded for it
# (scripts/readable-copies.mjs): in every .md file, less-than and greater-than
# become U+2039 and U+203A, and every .html and .js under wag/templates/ gets a
# readable NAME.md copy encoded the same way. Only the Dropbox copy is encoded;
# the repo keeps real angle brackets. Standing rule: tracked Markdown never
# contains U+2039 or U+203A itself (write "less-than" in words), or the sync
# stops.
#
# The Dropbox folder differs per machine (C:\Users\samfr\Dropbox here,
# D:\Dropbox elsewhere). It is resolved in order:
#   1. CLAUDE_DROPBOX env var — explicit override
#   2. Dropbox's own info.json — %LOCALAPPDATA%\Dropbox\info.json under WSL,
#      ~/.dropbox/info.json on macOS/Linux

set -euo pipefail

repo="$HOME/.claude"
branch="origin/dev"
rsync_flags=(-rc --no-perms --delete --itemize-changes)

for arg in "$@"
do
	case "$arg" in
		--dry-run) rsync_flags+=(-n) ;;
		*) echo "unknown option: $arg" >&2; exit 2 ;;
	esac
done

dropbox_from_info() {
	local info
	for info in /mnt/*/Users/*/AppData/Local/Dropbox/info.json "$HOME/.dropbox/info.json"
	do
		[ -f "$info" ] || continue
		local path
		path="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')).personal.path)" "$info")"
		if command -v wslpath > /dev/null && [[ "$path" == *:\\* ]]
		then
			path="$(wslpath -u "$path")"
		fi
		echo "$path"
		return 0
	done
	return 1
}

dropbox="${CLAUDE_DROPBOX:-}"
if [ -z "$dropbox" ]
then
	dropbox="$(dropbox_from_info)" || {
		echo "Can't find Dropbox. Set CLAUDE_DROPBOX to the Dropbox folder." >&2
		exit 1
	}
fi

if [ ! -d "$dropbox" ]
then
	echo "Dropbox folder not found: $dropbox" >&2
	exit 1
fi

dest="$dropbox/Claude/claude-home"
mkdir -p "$dest"

git -C "$repo" fetch --quiet origin

# Export the branch to a temp dir so rsync compares against committed content
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
git -C "$repo" archive "$branch" | tar -x -C "$tmp"
node "$tmp/scripts/readable-copies.mjs" "$tmp"

echo "$branch ($(git -C "$repo" rev-parse --short "$branch")) -> $dest"
rsync "${rsync_flags[@]}" "$tmp/" "$dest/"
