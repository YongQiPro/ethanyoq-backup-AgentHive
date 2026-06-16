# AgentHive

AgentHive（圆桌智策）是一个面向商业策略讨论的 AI 圆桌工作台。它把一个 idea、会议纪要或业务背景材料放到同一个讨论场里，让多位可配置 Agent 围绕观点、挑战、证据请求、风险和最终结论进行多轮讨论。

> 重要说明：本项目中的所有 Agent 角色都可以由用户自建、自定义、替换或删除。仓库内的商业领袖风格 Agent、事实包 Agent、政策研究 Agent、市场研究 Agent 等都只是模板，不是固定配置。

## 界面预览

### 圆桌讨论

![AgentHive roundtable discussion](docs/assets/screenshots/roundtable-discussion.png)

### Agent Registry

![AgentHive agent registry](docs/assets/screenshots/agent-registry.png)

## 核心能力

- 多 Agent 圆桌：支持商业领袖风格 Agent、专家 Agent、事实/证据 Agent 和总结 Agent 协同讨论。
- 自定义角色：每个 Agent 都可以绑定自己的角色描述、职责、头像和 Skill 文档。
- 自定义 Skill：可以把本仓库的 `roundtable-skills/` 当作模板，新增或改写自己的 Agent Skill。
- 背景材料导入：支持从本地 `context/` 目录导入 `.md`、`.txt`、`.json`、`.jsonl`、`.csv` 等材料。
- 讨论 Topic 导入：可以把会议纪要、方案草稿或调研材料作为讨论主题。
- 事实包与证据请求：讨论中可以登记事实、未证实假设、不确定性和证据请求。
- 讨论记录导出：支持导出完整讨论记录，并生成面向决策复盘的总结。

## 运行方式

### 方式一：启动脚本

在 Windows 上可以直接运行：

```powershell
.\Start-Roundtable-UI-Only.cmd
```

然后打开：

```text
http://localhost:3001/roundtable
```

### 方式二：手动启动

```powershell
cd workspace/frontend
npm install
npm run dev
```

默认地址：

```text
http://localhost:3001/roundtable
```

## 可选运行时

AgentHive 的前端可以独立运行。若要让讨论 Agent 调用外部运行时，需要在本机额外配置对应 CLI：

- Codex CLI：用于 Codex Agent 发言或执行本地任务。
- Claude Code CLI：用于 Claude Agent 发言或执行本地任务。
- Tavily CLI：用于联网检索和证据补充。

这些运行时不是仓库内置凭据；请在自己的机器上单独安装和登录。

## 项目结构

```text
AgentHive/
├─ context/                      # 本地背景材料目录，默认不提交真实业务资料
├─ docs/assets/screenshots/       # README 截图
├─ roundtable-skills/             # Agent Skill 模板
├─ scripts/                       # 启动脚本
├─ workspace/frontend/            # Roundtable Web 前端
├─ Start-Roundtable.cmd
└─ Start-Roundtable-UI-Only.cmd
```

## 自定义 Agent

你可以通过两种方式自定义 Agent：

1. 在前端 Agent Registry 中编辑 Agent 的名称、头像、职责、是否参会、是否后台研究等信息。
2. 在 `roundtable-skills/` 中新增一个目录，并放入自己的 `SKILL.md`。再参考 `roundtable-skills/manifest.json` 注册该 Skill。

建议一个 Agent Skill 至少包含：

- 角色定位
- 讨论职责
- 判断原则
- 证据边界
- 输出风格
- 触发条件

## 隐私与数据

本仓库不包含真实业务数据、私有会议记录、API key、登录凭据或本机上下文文件。默认 `.gitignore` 会忽略：

- `context/*` 中的真实材料
- `.env` / `.env.*`
- `node_modules/`
- `.next/`
- 运行输出和日志

如果你要把自己的业务资料加入讨论，请放到本地 `context/` 目录，并确认不要提交到公开仓库。

## 免责声明

仓库中的商业领袖风格 Agent 是基于公开资料抽象出的 AI 讨论模板，仅用于产品原型和策略讨论研究。它们不代表任何真实个人或公司，也不构成真实个人或公司的授权、认可或背书。

## License

Apache License 2.0. See [LICENSE](LICENSE).
