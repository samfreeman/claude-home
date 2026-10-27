@echo off
rem uninstall.bat - removes the "Convert to Word (.docx)" right-click entry
rem added by install.bat.

reg delete "HKCU\Software\Classes\SystemFileAssociations\.md\shell\md2docx" /f >nul 2>&1

echo Removed the right-click entry.
echo The program files are still in %LOCALAPPDATA%\md2docx
echo Delete that folder if you want them gone as well.
echo.
pause
