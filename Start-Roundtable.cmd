@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\start-roundtable.ps1"
if errorlevel 1 (
  echo.
  echo Failed to start AgentHive Roundtable.
  echo Press any key to close this window.
  pause >nul
)
