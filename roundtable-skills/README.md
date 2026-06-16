# AgentHive Roundtable Skills


本目录按 `nuwa-skill` 方法为 AgentHive 项目开发文档中的示例圆桌角色生成可导入 Skill。生成时间：2026-06-12。

## 生成原则

- 公开人物 Skill 使用经典著作、公开发言或正式文档做来源萃取。
- 职能角色 Skill 使用 AgentHive PRD 和 P0 设计文档做岗位萃取。
- 所有 Skill 都遵守：证据纪律：没有足够证据判断根因时，不能给“修复方案”。最多只能输出：已知事实、候选假设、验证路径、临时止血方案，并明确标注哪些结论未证实。
- 这些角色是可删除、可替换的 demo templates，不是产品固定内置角色。
- 本次为单代理执行版，未使用女娲原流程的并行 subagent；但公开人物目录内保留了 `references/research/01-06.md` 六维研究文件。

## Skill 清单

- `musk-first-principles-perspective` (person): Musk-style First Principles Agent -> `musk-first-principles-perspective\SKILL.md`
- `bezos-customer-flywheel-perspective` (person): Bezos-style Customer & Flywheel Agent -> `bezos-customer-flywheel-perspective\SKILL.md`
- `jobs-product-narrative-perspective` (person): Jobs-style Product & Narrative Agent -> `jobs-product-narrative-perspective\SKILL.md`
- `thiel-contrarian-monopoly-perspective` (person): Thiel-style Contrarian & Monopoly Agent -> `thiel-contrarian-monopoly-perspective\SKILL.md`
- `grove-strategic-inflection-perspective` (person): Grove-style Strategic Inflection Agent -> `grove-strategic-inflection-perspective\SKILL.md`
- `walton-channel-execution-perspective` (person): Walton-style Channel & Execution Agent -> `walton-channel-execution-perspective\SKILL.md`
- `drucker-management-critic-perspective` (person): Drucker-style Management Critic -> `drucker-management-critic-perspective\SKILL.md`
- `fact-pack-keeper` (functional): Fact Pack Keeper -> `fact-pack-keeper\SKILL.md`
- `policy-research-agent` (functional): Policy Research Agent -> `policy-research-agent\SKILL.md`
- `market-research-agent` (functional): Market Research Agent -> `market-research-agent\SKILL.md`
- `medical-evidence-research-agent` (functional): Medical Evidence Research Agent -> `medical-evidence-research-agent\SKILL.md`
- `company-context-agent` (functional): Company Context Agent -> `company-context-agent\SKILL.md`
- `roundtable-chair` (functional): Roundtable Chair -> `roundtable-chair\SKILL.md`
- `summary-agent` (functional): Summary Agent -> `summary-agent\SKILL.md`
- `devils-advocate-agent` (functional): Devil's Advocate Agent -> `devils-advocate-agent\SKILL.md`
- `consensus-builder-agent` (functional): Consensus Builder Agent -> `consensus-builder-agent\SKILL.md`

## 导入方式

在 AgentHive 圆桌 Agent 配置里，将对应目录的 `SKILL.md` 内容粘贴到该 Agent 的 Skill 内容字段，或作为外部 Skill 文件导入。
