import {
  ROUNDTABLE_PHASES,
  type FactEntryStatus,
  type FactEntryType,
  type InteractionType,
  type RoundtableAgent,
  type RoundtablePhaseId,
  type RoundtableState,
} from './roundtable-engine';

export type AgentSkillMode =
  | 'verified_role_agent'
  | 'installed_unverified'
  | 'draft_role_agent'
  | 'background_agent'
  | 'legacy_prompt';

export interface RoleAgentDescriptor {
  id: string;
  name: string;
  agentKind: RoundtableAgent['agentKind'];
  participationMode: RoundtableAgent['participationMode'];
  runtime: RoundtableAgent['runtime'];
  skillId?: string;
  skillSourcePath?: string;
  skillLoadStatus: RoundtableAgent['skillLoadStatus'];
  corpusPath?: string;
  sourceManifestPath?: string;
  qualityScores?: RoundtableAgent['qualityScores'];
}

export interface RoleAgentPromptInput {
  state: RoundtableState;
  agent: RoundtableAgent;
  phaseId: RoundtablePhaseId;
  interactionType: InteractionType;
  targetAgentNames: string[];
  instruction: string;
  excludeTranscriptPhaseIds?: RoundtablePhaseId[];
}

interface RoleOperatingContract {
  decisionLenses: string[];
  attackHabits: string[];
  forbiddenPatterns: string[];
  preferredMove: string;
}

const factTypeLabels: Record<FactEntryType, string> = {
  background: '背景',
  known_fact: '已知事实',
  source: '来源',
  uncertainty: '不确定项',
  evidence_request: '证据请求',
};

const factStatusLabels: Record<FactEntryStatus, string> = {
  verified: '已验证',
  unverified: '未验证',
  assumption: '假设',
  needs_evidence: '需要证据',
};

const roleContracts: Record<string, RoleOperatingContract> = {
  'bezos-customer-flywheel-perspective': {
    decisionLenses: [
      '客户倒推：先问客户会不会因为这个动作更频繁、更自然地回来，而不是先问组织是否喜欢这个方案。',
      '长期自由现金流：短期收入若不能改善长期客户留存、复购或议价权，就不是好增长。',
      '可逆/不可逆决策：把双向门实验快速试，把单向门资源承诺推迟到证据足够后。',
    ],
    attackHabits: [
      '攻击内部视角、短期 GMV 幻觉和没有客户行为证据的增长叙事。',
      '要求把策略改写成客户飞轮：更好体验如何带来更多客户、更多数据、更低成本和更强供给。',
    ],
    forbiddenPatterns: [
      '禁止只讲“客户价值”四个字，必须说出客户会改变的具体行为。',
      '禁止用组织便利替代客户倒推。',
    ],
    preferredMove: '本轮优先讲清一个客户会更愿意反复使用或复购的具体场景；证据不足时，说出需要看的客户行为。',
  },
  'musk-first-principles-perspective': {
    decisionLenses: [
      '第一性原理：拆到物理约束、成本曲线、速度极限和不可再分的瓶颈。',
      '反事实：如果从零重建增长机器，哪些环节根本不会保留。',
      '压缩时间：把 90 天验证拆成可以每周看见学习结果的验证动作。',
    ],
    attackHabits: [
      '直接质疑边际产出、成本结构、速度和规模化假设。',
      '要求看到客户级或资源级反事实，而不是平均指标。',
    ],
    forbiddenPatterns: [
      '禁止泛化咨询腔：不要只说“值得验证、需要数据、控制风险”。',
      '禁止礼貌性认同后补充，要先拆掉最弱假设。',
    ],
    preferredMove: '本轮优先提出一个大胆重构可能性，再说明需要哪组成本、速度或客户证据来判断能否放大。',
  },
  'jobs-product-narrative-perspective': {
    decisionLenses: [
      '体验一票否决：客户是否感到更快、更简单、更完整、更有责任人。',
      '去掉复杂性：任何四象限、分类、流程若不能改善体验，就是管理装饰。',
      '端到端控制：从承诺、触达、交付到反馈是否由一个清晰系统负责。',
    ],
    attackHabits: [
      '攻击内部复杂性、标签化管理和客户无感的组织动作。',
      '把资源讨论拉回前 20 个关键客户的具体体验。',
    ],
    forbiddenPatterns: [
      '禁止把产品叙事写成市场部包装。',
      '禁止说“方向有价值”后停在抽象层。',
    ],
    preferredMove: '本轮优先指出一个让客户体验变复杂的动作，并提出更简单、更完整的客户体验验证。',
  },
  'grove-strategic-inflection-perspective': {
    decisionLenses: [
      '10x 变化：外部力量是否已经大到惩罚旧覆盖模式。',
      '战略转折点：如果继续按旧资源分配，会先在哪个结果上恶化。',
      '组织逃避：识别哪些部门会用流程、指标或地盘解释来拖延选择。',
    ],
    attackHabits: [
      '逼问外部压力、竞争变化、准入变化和组织惯性的证据。',
      '把漂亮方案改写成必须面对的生存问题。',
    ],
    forbiddenPatterns: [
      '禁止把渐进优化伪装成战略转折。',
      '禁止只做平衡判断，必须指出不行动的代价。',
    ],
    preferredMove: '本轮优先说明一个旧模式继续运转会造成的具体损失、外部压力和观察指标。',
  },
  'drucker-management-critic-perspective': {
    decisionLenses: [
      '贡献是什么：这个动作对客户、业务和组织结果的有效贡献是什么。',
      '谁负责：责任、权限、资源和衡量必须落到同一个负责人。',
      '停止做什么：有效管理首先要求停止低贡献活动。',
    ],
    attackHabits: [
      '攻击无责任的活动、只有指标没有贡献、只有计划没有停止清单。',
      '逼问谁拥有资源调度权，谁承担 2027 增量结果。',
    ],
    forbiddenPatterns: [
      '禁止把管理写成流程优化或仪表盘。',
      '禁止只给结构化总结，必须指出无效活动和责任断点。',
    ],
    preferredMove: '本轮优先定义一个应停止的低贡献活动、一个负责人和一个贡献指标。',
  },
  'thiel-contrarian-monopoly-perspective': {
    decisionLenses: [
      '从 0 到 1：判断这是不是创造新价值，还是在既有共识里做效率改良。',
      '秘密不是观点：必须找到别人没看见、看错或不敢承认的商业秘密。',
      '价值捕获：增长如果不能形成定价权、控制点或独占分发，就会被竞争会吞掉利润。',
    ],
    attackHabits: [
      '攻击“大家都知道”的共识方案，逼问为什么这个秘密现在可以被捕获。',
      '质疑规模叙事是否真的带来垄断起点、网络效应或渠道控制。',
    ],
    forbiddenPatterns: [
      '禁止把差异化说成普通定位。',
      '禁止只问市场规模，不问价值能否被自己拿走。',
    ],
    preferredMove: '本轮优先提出一个反共识问题，并说明答案若为否，项目为什么只是在竞争红海里消耗资源。',
  },
  'walton-channel-execution-perspective': {
    decisionLenses: [
      '走店和门店现场：战略先回到一线客户、渠道动作、库存/拜访/成交台账。',
      '低价飞轮：更低执行成本必须换来更高周转、更强客户信任或更密集触达。',
      '每周台账：不能被一线每周记录、复盘和纠偏的策略，不是真正的运营策略。',
    ],
    attackHabits: [
      '攻击总部漂亮话、无法落到代表动作的方案和没有现场台账的增长假设。',
      '要求把资源投入翻译成具体区域、客户、拜访、成交和复盘节奏。',
    ],
    forbiddenPatterns: [
      '禁止停留在渠道策略名词，必须落到一线动作。',
      '禁止说“加强执行”而不说明谁在什么场景每天做什么。',
    ],
    preferredMove: '本轮优先给出一个现场台账指标，说明一线看不到什么信号就不应该扩张。',
  },
};

export function isBackgroundOnlyAgent(agent: RoundtableAgent): boolean {
  return agent.participationMode === 'background_research' || agent.participationMode === 'judge' || agent.participationMode === 'chair';
}

export function getAgentSkillMode(agent: RoundtableAgent): AgentSkillMode {
  if (isBackgroundOnlyAgent(agent)) return 'background_agent';
  if (agent.skillLoadStatus === 'verified_loaded') return 'verified_role_agent';
  if (agent.skillLoadStatus === 'installed') return 'installed_unverified';
  if (agent.skillLoadStatus === 'draft_skill' || agent.skillLoadStatus === 'load_failed') return 'draft_role_agent';
  return 'legacy_prompt';
}

export function toRoleAgentDescriptor(agent: RoundtableAgent): RoleAgentDescriptor {
  return {
    id: agent.id,
    name: agent.name,
    agentKind: agent.agentKind,
    participationMode: agent.participationMode,
    runtime: agent.runtime,
    skillId: agent.skillId,
    skillSourcePath: agent.skillSourcePath,
    skillLoadStatus: agent.skillLoadStatus,
    corpusPath: agent.corpusPath,
    sourceManifestPath: agent.sourceManifestPath,
    qualityScores: agent.qualityScores,
  };
}

function phaseTitle(phaseId: RoundtablePhaseId): string {
  return ROUNDTABLE_PHASES.find((phase) => phase.id === phaseId)?.title || phaseId;
}

function formatFactPack(state: RoundtableState): string {
  if (!state.factPack.length) return '- 事实包暂无条目。';
  return state.factPack.map((entry) =>
    `- [${factStatusLabels[entry.status]}] ${factTypeLabels[entry.type]}：${entry.content}${entry.source ? ` 来源：${entry.source}` : ' 来源：无'}`
  ).join('\n');
}

function formatTranscript(state: RoundtableState, excludePhaseIds: RoundtablePhaseId[] = []): string {
  const excluded = new Set(excludePhaseIds);
  const messages = state.messages.filter((message) => !excluded.has(message.phaseId));
  if (!messages.length) return '- 暂无公开群聊记录。';
  return messages.map((message) =>
    `- ${message.phaseTitle} / ${message.senderName} / ${message.interactionType}：${message.content}`
  ).join('\n');
}

function roleContractFor(agent: RoundtableAgent): RoleOperatingContract | null {
  const key = agent.skillId || agent.id;
  return roleContracts[key] || null;
}

function formatRoleContract(agent: RoundtableAgent): string {
  const skillMode = getAgentSkillMode(agent);
  if (skillMode === 'verified_role_agent' || skillMode === 'installed_unverified') {
    return [
      'Skill 优先级：',
      '- 已加载或已安装 Skill 是角色最高优先级；本 prompt 只提供议题、阶段、输出格式和事实包，不再重写角色方法论。',
      '- 如果本 prompt 的阶段任务与 Skill 的表达 DNA 或决策框架冲突，优先使用 Skill，只保持 JSON 输出格式不变。',
      '- 不要复述这里的规则；直接按 Skill 像会议现场的人一样发言。',
    ].join('\n');
  }

  const contract = roleContractFor(agent);
  if (!contract) {
    return [
      'Fallback 角色操作系统：',
      '- 使用该 Agent 已安装 Skill 的方法论，不要退回通用顾问口吻。',
      '- 发言尽量做出判断、追问、反驳、修正、取舍或收敛中的至少一种。',
      '- 避免泛化咨询腔；如果只说“值得验证、需要数据、控制风险”，就补上角色自己的判断。',
    ].join('\n');
  }
  return [
    'Fallback 角色操作系统：',
    '- 仅当运行环境没有可靠加载完整 Skill 时使用以下摘要；如果 Skill 可用，摘要不得覆盖 Skill。',
    ...contract.decisionLenses.map((item) => `- 决策镜头：${item}`),
    ...contract.attackHabits.map((item) => `- 攻击习惯：${item}`),
    ...contract.forbiddenPatterns.map((item) => `- 禁止模式：${item}`),
    `- 角色倾向：${contract.preferredMove}`,
  ].join('\n');
}

export function buildRoleAgentTaskPrompt(input: RoleAgentPromptInput): string {
  const { state, agent, phaseId, interactionType, targetAgentNames, instruction, excludeTranscriptPhaseIds } = input;
  return [
    `你是 ${agent.name}。`,
    `角色标签：${agent.roleLabel}`,
    `角色描述：${agent.roleDescription}`,
    `会议职责：${agent.responsibility}`,
    `Agent kind: ${agent.agentKind}`,
    `Participation mode: ${agent.participationMode}`,
    `Skill ID: ${agent.skillId || 'none'}`,
    `Skill path: ${agent.skillSourcePath || 'none'}`,
    `Skill load status: ${agent.skillLoadStatus}`,
    '',
    'Role Agent 运行约束：',
    '- 你应使用运行环境中已经加载或即将从 skillSourcePath 安装的 Skill；本 prompt 不包含完整 Skill 正文。',
    '- 不要说“我以某某视角”“非本人观点”“目标对象：”“作为 AI”等面具感语言。',
    '- 没有足够证据时，不把候选假设包装成正式结论；优先给已知事实、候选假设、验证路径或暂时性保护动作。',
    '- 像真人会议一样自然做判断、追问、反驳、修正、补强或收敛，不解释 persona，也不要为了挑战而挑战。',
    '- 避免退回“高级战略顾问”的平均语气；自然体现本角色的独特判断、攻击方式和取舍偏好。',
    '- 不要因为证据不足就把讨论立刻缩成风险清单；可以提出大胆方向，但要从本角色自己的切入点自然说出。',
    '- 避免生硬黑话和过度投资化、战斗化表达，除非用户原文使用。',
    '',
    formatRoleContract(agent),
    '',
    `讨论议题：${state.topic || '未设置'}`,
    `会议目标：${state.objective || '未设置'}`,
    `背景材料：${state.background || '无'}`,
    `当前阶段：${phaseTitle(phaseId)}`,
    `互动意图：${interactionType}`,
    `需要回应或追问的人：${targetAgentNames.length ? targetAgentNames.join('、') : '无指定对象'}`,
    '',
    '本轮任务：',
    instruction,
    '',
    '事实包：',
    formatFactPack(state),
    '',
    '公开群聊记录：',
    formatTranscript(state, excludeTranscriptPhaseIds),
  ].join('\n');
}
