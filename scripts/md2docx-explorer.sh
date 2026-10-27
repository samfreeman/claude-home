#!/usr/bin/env bash
# md2docx-explorer.sh — Windows Explorer right-click wrapper for md2docx.py
#
# Invoked by the registry entry installed from md2docx-install.reg:
#   wsl.exe bash ~/.claude/scripts/md2docx-explorer.sh "%1"
#
# Receives the Windows path of the selected .md file, converts it to a WSL
# path, and runs pandoc against it. Output .docx lands beside the .md.
# On failure the console stays open so the error is readable.
#
# pandoc lives in ~/.local/bin (user-space install, no sudo). wsl.exe runs
# this script non-interactively so PATH may not include it; add it here.

export PATH="$HOME/.local/bin:$PATH"

src="$(wslpath -u "$1")"
dst="${src%.md}.docx"

if pandoc "$src" -o "$dst"
then
	echo "wrote $dst"
	exit 0
fi

echo
echo "pandoc failed for: $src"
read -r -p "Press Enter to close..."
exit 1
