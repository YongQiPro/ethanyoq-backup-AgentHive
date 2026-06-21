<div align="center">

# AgentHive - AI Roundtable Workspace for Multi-Agent Strategy

**AgentHive is a local executive AI workspace for founders, product leaders, and strategy teams: give one business question to configurable agents and let them reason through views, evidence, risks, and final synthesis.**

[中文](README.md) | [Screenshots](#screenshots) | [Quick Start](#quick-start) | [Custom Agents](#custom-agents) | [Privacy](#privacy-and-boundaries)

**Search fit:** built for teams looking for `AI roundtable`, `AI executive roundtable`, `AI advisory board`, `multi-agent strategy`, `multi-agent discussion`, `business strategy agent`, `strategy discussion agent`, and `executive AI workspace`.

**Quick start:** run `.\Start-Roundtable-UI-Only.cmd` from the repository root, then open `http://localhost:3001/roundtable`.

**Trust boundary:** AgentHive provides a local Next.js workspace and replaceable Agent Skill templates; private business materials stay in local `context/`, credentials are not included, and executive-style agents are not official endorsements.

![GitHub Repo stars](https://img.shields.io/github/stars/EthanYoQ/AgentHive?style=flat&logo=github&logoColor=white)
![GitHub forks](https://img.shields.io/github/forks/EthanYoQ/AgentHive?style=flat&logo=github&logoColor=white)
![GitHub top language](https://img.shields.io/github/languages/top/EthanYoQ/AgentHive?style=flat&logo=github&logoColor=white)
![GitHub language count](https://img.shields.io/github/languages/count/EthanYoQ/AgentHive?style=flat&logo=github&logoColor=white)
![GitHub repo size](https://img.shields.io/github/repo-size/EthanYoQ/AgentHive?style=flat&logo=github&logoColor=white)
![GitHub package.json version](https://img.shields.io/github/package-json/v/EthanYoQ/AgentHive?filename=workspace%2Ffrontend%2Fpackage.json&style=flat&logo=npm&logoColor=white)
![License](https://img.shields.io/github/license/EthanYoQ/AgentHive?style=flat&logo=apache&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16.2.9-black?style=flat&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19.2.1-149eca?style=flat&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.2-3178c6?style=flat&logo=typescript&logoColor=white)

</div>

---

## <img src="https://api.iconify.design/lucide:brain-circuit.svg?color=%230f172a" width="20" alt=""> What AgentHive Is

AgentHive is not a fixed set of chatbot personas. It is a local AI roundtable runtime for strategy discussions. You can place an idea, meeting note, business context file, or decision question into one discussion space, then let different agents contribute across multiple rounds according to their roles.

It is useful for:

- Product direction debates: bring product, market, execution, dissent, and synthesis agents into one room.
- Strategy reviews: load meeting notes, sales data, or research material into `context/`, then ask agents to separate facts from unverified assumptions.
- Pre-decision pressure tests: ask dissent, fact-pack, policy research, and market research agents to surface risks and evidence gaps first.
- Agent Skill prototyping: create, replace, or remove role templates through `roundtable-skills/`.

> Important: the executive-style agents, fact-pack agents, policy research agents, market research agents, and summary agents in this repository are replaceable templates. Users can create, customize, replace, or delete any agent.

## <img src="https://api.iconify.design/lucide:github.svg?color=%230f172a" width="20" alt=""> Project Profile

| Dimension | Details |
| --- | --- |
| Product form | Locally running Roundtable Web workspace |
| Core objects | Configurable agents, Skills, context files, discussion topics, evidence requests, synthesis output |
| Default frontend | Next.js 16, React 19, TypeScript |
| Default entry | `http://localhost:3001/roundtable` |
| License | Apache License 2.0 |
| Data policy | Real business materials stay in local `context/` and are not committed by default |

## <img src="https://api.iconify.design/lucide:file-text.svg?color=%230f172a" width="20" alt=""> Screenshots

### Roundtable Discussion

![AgentHive roundtable discussion](docs/assets/screenshots/roundtable-discussion.png)

### Agent Registry

![AgentHive agent registry](docs/assets/screenshots/agent-registry.png)

## <img src="https://api.iconify.design/lucide:users-round.svg?color=%230f172a" width="20" alt=""> Core Capabilities

| Capability | Details |
| --- | --- |
| <img src="https://api.iconify.design/lucide:users-round.svg?color=%230f172a" width="16" alt=""> Multi-agent roundtable | Coordinate executive-style agents, expert agents, evidence agents, dissent agents, and synthesis agents. |
| <img src="https://api.iconify.design/lucide:settings-2.svg?color=%230f172a" width="16" alt=""> Configurable roles | Each agent can have its own name, avatar, responsibilities, participant status, background-research mode, and Skill document. |
| <img src="https://api.iconify.design/lucide:book-open.svg?color=%230f172a" width="16" alt=""> Skill templates | `roundtable-skills/` provides role templates that can be copied and rewritten. |
| <img src="https://api.iconify.design/lucide:database-search.svg?color=%230f172a" width="16" alt=""> Context import | Load `.md`, `.txt`, `.json`, `.jsonl`, `.csv`, and similar files from local `context/`. |
| <img src="https://api.iconify.design/lucide:search-check.svg?color=%230f172a" width="16" alt=""> Evidence requests | Track facts, unverified assumptions, uncertainty, and follow-up validation tasks during discussion. |
| <img src="https://api.iconify.design/lucide:download.svg?color=%230f172a" width="16" alt=""> Discussion export | Export the full discussion record and decision-oriented synthesis. |

## <img src="https://api.iconify.design/lucide:workflow.svg?color=%230f172a" width="20" alt=""> Discussion Workflow

```text
Input topic / context material
        |
        v
Select or edit participating agents
        |
        v
Multi-round discussion: views, challenges, evidence requests, risks
        |
        v
Fact-boundary cleanup and unverified-claim labeling
        |
        v
Export discussion record and decision synthesis
```

## <img src="https://api.iconify.design/lucide:rocket.svg?color=%230f172a" width="20" alt=""> Quick Start

### Option 1: Windows launcher

Run from the repository root:

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

## <img src="https://api.iconify.design/lucide:square-terminal.svg?color=%230f172a" width="20" alt=""> Optional Runtimes

The AgentHive frontend can run on its own. To let discussion agents call external runtimes, configure the relevant CLIs locally:

| Runtime | Purpose | Credentials included |
| --- | --- | --- |
| Codex CLI | Codex-powered agent turns and local task execution | No |
| Claude Code CLI | Claude-powered agent turns and local task execution | No |
| Tavily CLI | Web research and evidence collection | No |

Install, authenticate, and manage these tools on your own machine. This repository does not include API keys, cookies, or login credentials.

## <img src="https://api.iconify.design/lucide:box.svg?color=%230f172a" width="20" alt=""> Repository Layout

```text
AgentHive/
|-- context/                      # Local context files; real business data is ignored by default
|-- docs/assets/screenshots/       # README screenshots
|-- roundtable-skills/             # Agent Skill templates
|-- scripts/                       # Launch scripts
|-- workspace/frontend/            # Roundtable web frontend
|-- Start-Roundtable.cmd
`-- Start-Roundtable-UI-Only.cmd
```

## <img src="https://api.iconify.design/lucide:settings-2.svg?color=%230f172a" width="20" alt=""> Custom Agents

You can customize agents in two ways:

1. Edit the agent name, avatar, responsibilities, participant status, and background-research mode in the Agent Registry UI.
2. Add a new directory under `roundtable-skills/`, create your own `SKILL.md`, and register it in `roundtable-skills/manifest.json`.

A useful agent Skill usually includes:

- role definition
- discussion responsibilities
- decision principles
- evidence boundaries
- output style
- trigger conditions

## <img src="https://api.iconify.design/lucide:shield-check.svg?color=%230f172a" width="20" alt=""> Privacy And Boundaries

This repository does not include real business data, private meeting notes, API keys, credentials, or local context files. The default `.gitignore` excludes:

- real files under `context/*`
- `.env` / `.env.*`
- `node_modules/`
- `.next/`
- runtime output and logs

If you use private business materials, keep them in your local `context/` directory and do not commit them to a public repository.

## <img src="https://api.iconify.design/lucide:lock-keyhole.svg?color=%230f172a" width="20" alt=""> Disclaimer

The executive-style agents in this repository are AI discussion templates abstracted from public materials. They are intended for product prototyping and strategy-discussion research. They do not represent, impersonate, or imply endorsement by any real person or company.

## <img src="https://api.iconify.design/lucide:circle-check.svg?color=%230f172a" width="20" alt=""> MCP Icon Verification

The README body icons use Lucide line icons verified through `better-icons` search results and referenced through Iconify URLs, keeping one icon family, size system, and visual weight. Verified icons include:

```text
lucide:brain-circuit
lucide:github
lucide:file-text
lucide:users-round
lucide:settings-2
lucide:book-open
lucide:database-search
lucide:search-check
lucide:download
lucide:workflow
lucide:rocket
lucide:square-terminal
lucide:box
lucide:shield-check
lucide:lock-keyhole
lucide:circle-check
```

`iconfont-mcp` was also verified with public Chinese search and download flows: search keywords were `圆桌 讨论 证据` and `搜索`, and the downloaded verification file is `docs/assets/icons/iconfont-verification/iconfont-search-verification.svg`. The downloaded iconfont asset was not mixed into the README visual system to avoid inconsistent icon styles.

## <img src="https://api.iconify.design/lucide:book-open.svg?color=%230f172a" width="20" alt=""> License

Apache License 2.0. See [LICENSE](LICENSE).
