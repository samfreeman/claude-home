@echo off
rem install.bat - adds "Convert to Word (.docx)" to the right-click menu
rem for .md files. Copies pandoc and the wrapper to a per-user folder and
rem registers the menu entry for the current user only. No admin needed.
rem Run uninstall.bat to remove it.

set "DEST=%LOCALAPPDATA%\md2docx"

echo Installing md2docx to %DEST% ...
mkdir "%DEST%" 2>nul
copy /y "%~dp0pandoc.exe" "%DEST%\" >nul
copy /y "%~dp0md2docx.cmd" "%DEST%\" >nul
copy /y "%~dp0uninstall.bat" "%DEST%\" >nul

reg add "HKCU\Software\Classes\SystemFileAssociations\.md\shell\md2docx" /ve /d "Convert to Word (.docx)" /f >nul
reg add "HKCU\Software\Classes\SystemFileAssociations\.md\shell\md2docx\command" /ve /d "\"%DEST%\md2docx.cmd\" \"%%1\"" /f >nul

echo.
echo Done. Right-click any .md file and choose "Convert to Word (.docx)".
echo On Windows 11 it is under "Show more options" unless you Shift+right-click.
echo.
pause
