@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\start-roundtable.ps1" -NoBackend
if errorlevel 1 (
  echo.
  echo Failed to start AgentHive Roundtable UI.
  echo Press any key to close this window.
  pause >nul
)
