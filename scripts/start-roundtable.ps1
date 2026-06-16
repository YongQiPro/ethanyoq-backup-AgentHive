param(
  [switch]$NoBackend,
  [string]$UrlPath = "/roundtable"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$FrontendDir = Join-Path $RepoRoot "workspace\frontend"
$BackendDir = Join-Path $RepoRoot "workspace\backend"
$FrontendPort = 3001
$BackendPort = 8000
$FrontendUrl = "http://localhost:$FrontendPort$UrlPath"

function Test-PortListening {
  param([int]$Port)
  $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  return [bool]$connection
}

function Wait-Port {
  param(
    [int]$Port,
    [string]$Name,
    [int]$TimeoutSeconds = 90
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-PortListening -Port $Port) {
      Write-Host "$Name is listening on port $Port."
      return $true
    }
    Start-Sleep -Seconds 2
  }

  Write-Warning "$Name did not start listening on port $Port within $TimeoutSeconds seconds."
  return $false
}

function Require-Command {
  param(
    [string]$CommandName,
    [string]$InstallHint
  )

  if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    throw "Missing command '$CommandName'. $InstallHint"
  }
}

function Start-TerminalCommand {
  param(
    [string]$Title,
    [string]$WorkingDirectory,
    [string]$Command
  )

  $cmd = "title $Title && cd /d `"$WorkingDirectory`" && $Command"
  Start-Process -FilePath "cmd.exe" -ArgumentList @("/k", $cmd) | Out-Null
}

Write-Host "AgentHive Roundtable launcher"
Write-Host "Repo: $RepoRoot"

if (-not (Test-Path -LiteralPath $FrontendDir)) {
  throw "Frontend directory not found: $FrontendDir"
}

Require-Command -CommandName "npm.cmd" -InstallHint "Install Node.js, then try again."

if (-not $NoBackend) {
  if (-not (Test-Path -LiteralPath $BackendDir)) {
    Write-Warning "Backend directory not found, skipping backend: $BackendDir"
  } else {
    Require-Command -CommandName "python.exe" -InstallHint "Install Python 3.10+, then try again."
    if (Test-PortListening -Port $BackendPort) {
      Write-Host "Backend already appears to be running on port $BackendPort."
    } else {
      Write-Host "Starting backend on port $BackendPort..."
      Start-TerminalCommand `
        -Title "AgentHive Backend :$BackendPort" `
        -WorkingDirectory $BackendDir `
        -Command "python -m uvicorn app.main:app --reload --host 0.0.0.0 --port $BackendPort"
    }
  }
}

if (Test-PortListening -Port $FrontendPort) {
  Write-Host "Frontend already appears to be running on port $FrontendPort."
} else {
  Write-Host "Starting frontend on port $FrontendPort..."
  Start-TerminalCommand `
    -Title "AgentHive Frontend :$FrontendPort" `
    -WorkingDirectory $FrontendDir `
    -Command "set NEXT_PUBLIC_API_URL=http://localhost:$BackendPort&& npm run dev"
}

if (-not $NoBackend) {
  Wait-Port -Port $BackendPort -Name "Backend" -TimeoutSeconds 45 | Out-Null
}

$frontendReady = Wait-Port -Port $FrontendPort -Name "Frontend" -TimeoutSeconds 90
if ($frontendReady) {
  Write-Host "Opening $FrontendUrl"
  Start-Process $FrontendUrl
} else {
  Write-Warning "Frontend did not become ready. Check the opened terminal windows for errors."
}

Write-Host ""
Write-Host "Keep the opened terminal windows running while using the app."
Write-Host "Close those terminal windows, or press Ctrl+C inside them, to stop the app."
