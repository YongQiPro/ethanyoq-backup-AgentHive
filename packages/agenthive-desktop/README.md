# AgentHive Desktop

This package wraps the existing AgentHive roundtable frontend in a Windows desktop application. It does not replace or redesign the frontend.

## Build

```powershell
cd openagents\packages\agenthive-desktop
npm install
npm run build:win
```

## Portable ZIP

```powershell
npm run build:portable
```

This produces `dist/AgentHive-Portable-<version>-x64.zip`. Extract the archive,
keep the resulting `AgentHive` folder intact, and run `AgentHive.exe`. No
installer or command-line startup is required.

The NSIS installer is written to `release/`. The installed application starts the bundled local Next server automatically and opens the existing AgentHive workbench in a native window.

## Runtime data and dependencies

- Discussion history, imported context, runtime artifacts, logs, and packaged role Skills are stored under the current user's AgentHive application-data directory. An optional `agenthive-evidence.json` in the local context folder can supply source-backed internal evidence without hard-coding a company or industry schema into the application.
- The installer intentionally does not package the repository-level `context/` directory or any existing discussion output.
- Codex CLI, Claude Code CLI, and Tavily CLI remain local signed-in runtime dependencies. AgentHive detects them through the current user PATH and loads the packaged role Skills into their normal runtime profile when a role runs.
