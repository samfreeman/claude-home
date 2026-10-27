@echo off
rem md2docx.cmd - converts one Markdown file to Word using pandoc.
rem Called by the Explorer right-click entry with the .md path as %1.
rem The .docx is written next to the .md with the same name.
"%~dp0pandoc.exe" "%~1" -o "%~dpn1.docx"
if errorlevel 1 echo.
if errorlevel 1 echo Conversion failed for: %~1
if errorlevel 1 pause
