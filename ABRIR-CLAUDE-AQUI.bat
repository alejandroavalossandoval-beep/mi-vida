@echo off
REM Abre PowerShell en esta carpeta y arranca Claude Code
cd /d "%~dp0"
title Mi Vida - Claude Code
powershell -NoExit -Command "claude"
