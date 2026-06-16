# AgentHive

AgentHive is an AI roundtable workspace for business strategy discussions. It turns an idea, meeting note, or background document into a structured multi-agent conversation with views, challenges, evidence requests, risks, and final synthesis.

> Important: every agent role in AgentHive can be created, customized, replaced, or removed by users. The executive-style agents, fact-pack agents, policy research agents, market research agents, and summary agents in this repository are templates, not fixed roles.

## Screenshots

### Roundtable Discussion

![AgentHive roundtable discussion](docs/assets/screenshots/roundtable-discussion.png)

### Agent Registry

![AgentHive agent registry](docs/assets/screenshots/agent-registry.png)

## Features

- Multi-agent roundtable: coordinate executive-style agents, expert agents, evidence agents, and synthesis agents.
- Custom roles: each agent can have its own name, description, responsibilities, avatar, and Skill document.
- Custom Skills: use `roundtable-skills/` as templates to create or rewrite your own agent Skills.
- Context import: load `.md`, `.txt`, `.json`, `.jsonl`, `.csv`, and similar files from the local `context/` directory.
- Topic import: use meeting notes, strategy drafts, or research notes as the discussion topic.
- Fact pack and evidence requests: track facts, unverified assumptions, uncertainty, and evidence tasks.
- Export: export the complete discussion record and decision-oriented summary.

## Quick Start

### Option 1: Windows launcher

Run:

```powershell
.\Start-Roundtable-UI-Only.cmd
```

Then open:

```text
http://localhost:3001/roundtable
```

### Option 2: Manual start

```powershell
cd workspace/frontend
npm install
npm run dev
```

Default URL:

```text
http://localhost:3001/roundtable
```

## Optional Runtimes

The AgentHive frontend can run on its own. To let agents call external runtimes, configure the relevant CLIs locally:

- Codex CLI: for Codex-powered agents and local task execution.
- Claude Code CLI: for Claude-powered agents and local task execution.
- Tavily CLI: for web research and evidence collection.

No runtime credentials are included in this repository. Install and authenticate these tools on your own machine.

## Repository Layout

```text
AgentHive/
├─ context/                      # Local context files; real business data is ignored by default
├─ docs/assets/screenshots/       # README screenshots
├─ roundtable-skills/             # Agent Skill templates
├─ scripts/                       # Launch scripts
├─ workspace/frontend/            # Roundtable web frontend
├─ Start-Roundtable.cmd
└─ Start-Roundtable-UI-Only.cmd
```

## Custom Agents

You can customize agents in two ways:

1. Edit the agent name, avatar, responsibilities, participant status, and background-research status in the Agent Registry UI.
2. Add a new directory under `roundtable-skills/`, create your own `SKILL.md`, and register it in `roundtable-skills/manifest.json`.

A useful agent Skill should usually include:

- role definition
- discussion responsibilities
- decision principles
- evidence boundaries
- output style
- trigger conditions

## Privacy And Data

This public repository does not include real business data, private meeting notes, API keys, credentials, or local context files. The default `.gitignore` excludes:

- real files under `context/*`
- `.env` / `.env.*`
- `node_modules/`
- `.next/`
- runtime output and logs

If you use private business materials, keep them in your local `context/` directory and do not commit them to a public repository.

## Disclaimer

The executive-style agents in this repository are AI discussion templates abstracted from public materials. They are intended for product prototyping and strategy-discussion research. They do not represent, impersonate, or imply endorsement by any real person or company.

## License

Apache License 2.0. See [LICENSE](LICENSE).
