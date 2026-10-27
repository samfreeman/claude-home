# md2docx for Windows

Adds **Convert to Word (.docx)** to the Windows Explorer right-click menu
for any `.md` file. Pure Windows, no WSL, no Python, no admin rights.

Conversion is done by [pandoc](https://pandoc.org), which handles the full
Markdown spec: headings, tables, code blocks, nested and numbered lists,
block quotes, images, links and footnotes.

## Install

1. Copy this whole folder somewhere on the target machine (anywhere works,
   it is only needed during install).
2. Double-click `install.bat`.

That copies `pandoc.exe` and `md2docx.cmd` to `%LOCALAPPDATA%\md2docx`
and registers the menu entry for the current user.

## Use

Right-click a `.md` file, choose **Convert to Word (.docx)**. The `.docx`
appears next to the `.md` with the same name. On Windows 11 the entry is
under **Show more options**, or Shift+right-click to go straight there.

## Uninstall

Double-click `uninstall.bat` (a copy is also left in `%LOCALAPPDATA%\md2docx`).

## Files

| File | Purpose |
|------|---------|
| `pandoc.exe` | pandoc 3.12.1 Windows x86_64 build, from the official GitHub release |
| `md2docx.cmd` | wrapper the menu entry calls; runs pandoc on the clicked file |
| `install.bat` | copies files to the per-user folder and adds the registry entry |
| `uninstall.bat` | removes the registry entry |

`pandoc.exe` is not kept in this git folder because of its size. The full
distributable, with the binary, lives in
`Dropbox\Claude\tools\md2docx-win`.
