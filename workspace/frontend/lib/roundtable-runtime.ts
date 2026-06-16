import {
  ROUNDTABLE_PHASES,
  addFactEntry,
  buildAgentGenerationContext,
  buildFinalOutput,
  getSelectedAgents,
  renderAgentPrompt,
  type InteractionType,
  type FactEntryStatus,
  type FactEntryType,
  type RoundtableAgent,
  type RoundtableAgentRuntime,
  type RoundtableMessage,
  type RoundtablePhaseId,
  type EvidenceTaskStatus,
  type RoundtableState,
} from './roundtable-engine';
import { addEvidenceTaskForMessage } from './roundtable-evidence';
import { judgeRoundtableOutput, type JudgeResult } from './roundtable-quality-judge';
import { buildRoleAgentTaskPrompt, getAgentSkillMode } from './roundtable-role-agent';

export interface RoundtableRuntimePlan {
  id: string;
  agentId: string;
  agentName: string;
  runtime: RoundtableAgentRuntime;
  phaseId: RoundtablePhaseId;
  phaseTitle: string;
  interactionType: InteractionType;
  targetAgentIds: string[];
  targetAgentNames: string[];
  prompt: string;
}

export interface RoundtableEvidenceRuntimePlan extends RoundtableRuntimePlan {
  evidenceTaskId: string;
  evidenceRequest: string;
}

export interface RoundtableRuntimePlanOptions {
  promptState?: RoundtableState;
  excludeTranscriptPhaseIds?: RoundtablePhaseId[];
}

export interface NormalizedRuntimeOutput {
  content: string;
  interactionType: InteractionType;
  targetAgentIds: string[];
  relatedIdea?: string;
  evidenceRequest?: string;
  judge?: JudgeResult;
}

export interface NormalizedEvidenceRuntimeFact {
  type: FactEntryType;
  content: string;
  source: string;
  status: FactEntryStatus;
}

export interface NormalizedEvidenceRuntimeOutput {
  status: EvidenceTaskStatus;
  resultSummary: string;
  facts: NormalizedEvidenceRuntimeFact[];
  sourceRefs: string[];
}

export interface RuntimeMessageMeta {
  runtime?: RoundtableAgentRuntime;
  durationMs?: number;
}

export const runtimeLabels: Record<RoundtableAgentRuntime, string> = {
  demo: 'Demo 确定性',
  codex_cli: 'Codex CLI',
  claude_code_cli: 'Claude Code CLI',
};

const structuredInteractions: InteractionType[] = [
  'statement',
  'mention',
  'reply',
  'challenge',
  'evidence_request',
  'synthesis',
];

const evidenceTerminalStatuses: EvidenceTaskStatus[] = [
  'researched',
  'needs_external_research',
  'needs_user_data',
  'not_found',
  'out_of_scope',
  'research_failed',
];

const evidenceBackgroundSummaryLimit = 2_000;

function compactEvidenceText(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function truncateEvidenceText(value: string, limit: number): string {
  const compact = compactEvidenceText(value);
  return compact.length > limit ? `${compact.slice(0, limit - 3)}...` : compact;
}

function importedSourceTitle(content: string, source: string): string {
  const match = content.match(/导入资料：([^。\n]+)/);
  return match?.[1]?.trim() || source.replace(/\\/g, '/').split('/').filter(Boolean).at(-1) || '未命名资料';
}

function importedSourceIndexFromFactPack(state: RoundtableState): string[] {
  return state.factPack
    .filter((entry) => entry.type === 'source' && entry.source.trim() && /导入资料：/.test(entry.content))
    .map((entry) => `- ${importedSourceTitle(entry.content, entry.source)}：${entry.source}`);
}

function importedSourceIndexFromBackground(background: string): string[] {
  const lines: string[] = [];
  const pattern = /## 导入资料：([^\n]+)\n来源：([^\n]+)/g;
  let match: RegExpExecArray | null = pattern.exec(background);
  while (match) {
    const title = match[1]?.trim();
    const source = match[2]?.trim();
    if (title && source) lines.push(`- ${title}：${source}`);
    match = pattern.exec(background);
  }
  return lines;
}

function uniqueLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const line of lines) {
    if (!line || seen.has(line)) continue;
    seen.add(line);
    next.push(line);
  }
  return next;
}

function formatEvidenceSourceIndex(state: RoundtableState): string {
  const sources = uniqueLines([
    ...importedSourceIndexFromFactPack(state),
    ...importedSourceIndexFromBackground(state.background),
  ]);
  return sources.length ? sources.join('\n') : '- 暂无导入来源索引；可查看 Fact Pack 或 context/ 目录。';
}

function isImportedSourceFact(entry: RoundtableState['factPack'][number]): boolean {
  return entry.type === 'source' && /导入资料：/.test(entry.content);
}

function formatEvidenceFactPack(state: RoundtableState): string {
  if (!state.factPack.length) return '- 暂无事实包条目。';
  return state.factPack.slice(0, 24).map((entry) => {
    if (isImportedSourceFact(entry)) {
      return `- [${entry.status}] ${entry.type}: ${importedSourceTitle(entry.content, entry.source)}。来源：${entry.source}（全文请按导入来源索引读取 context 文件）`;
    }
    const line = `[${entry.status}] ${entry.type}: ${entry.content}${entry.source ? ` 来源：${entry.source}` : ' 来源：无'}`;
    return `- ${truncateEvidenceText(line, 700)}`;
  }).join('\n');
}

function summarizeEvidenceBackground(state: RoundtableState): string {
  const background = compactEvidenceText(state.background || '');
  if (!background) return '无';
  const withoutImportedBlocks = background.split(/\n## 导入资料：/)[0]?.trim() || background;
  const conciseLines = withoutImportedBlocks
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.length <= 500);
  return truncateEvidenceText(conciseLines.join('\n') || withoutImportedBlocks.slice(0, 500), evidenceBackgroundSummaryLimit);
}

function phaseById(phaseId: RoundtablePhaseId) {
  return ROUNDTABLE_PHASES.find((phase) => phase.id === phaseId) || ROUNDTABLE_PHASES[0];
}

function nextPhaseId(phaseId: RoundtablePhaseId): RoundtablePhaseId {
  const index = ROUNDTABLE_PHASES.findIndex((phase) => phase.id === phaseId);
  return ROUNDTABLE_PHASES[index + 1]?.id || ROUNDTABLE_PHASES.at(-1)?.id || 'round7';
}

function targetForAgent(agents: RoundtableAgent[], index: number): RoundtableAgent | null {
  if (agents.length < 2) return null;
  return agents[(index + 1) % agents.length];
}

function previousForAgent(agents: RoundtableAgent[], index: number): RoundtableAgent | null {
  if (agents.length < 2) return null;
  return agents[(index - 1 + agents.length) % agents.length];
}

function chooseSynthesizer(agents: RoundtableAgent[]): RoundtableAgent | null {
  return agents.find((agent) => /chair|synth|summary|consensus|主持|收敛|总结|共识/i.test(
    `${agent.name} ${agent.roleLabel} ${agent.responsibility}`
  )) || agents[0] || null;
}

function planInteraction(phaseId: RoundtablePhaseId, agents: RoundtableAgent[], index: number) {
  const agent = agents[index];
  if (phaseId === 'round1') {
    return { interactionType: 'statement' as InteractionType, targets: [] as RoundtableAgent[] };
  }
  if (phaseId === 'round2') {
    const target = targetForAgent(agents, index);
    if (!target) return { interactionType: 'challenge' as InteractionType, targets: [] as RoundtableAgent[] };
    return {
      interactionType: index === 0 ? 'evidence_request' as InteractionType : 'challenge' as InteractionType,
      targets: [target],
    };
  }
  if (phaseId === 'round3') {
    const target = previousForAgent(agents, index);
    return { interactionType: 'reply' as InteractionType, targets: target ? [target] : [] };
  }
  if (phaseId === 'round4') {
    const target = targetForAgent(agents, index + 1);
    return { interactionType: 'evidence_request' as InteractionType, targets: target ? [target] : [] };
  }
  if (phaseId === 'round5') {
    const target = previousForAgent(agents, index);
    return { interactionType: 'challenge' as InteractionType, targets: target ? [target] : [] };
  }
  if (phaseId === 'round6') {
    const target = targetForAgent(agents, index);
    return { interactionType: 'reply' as InteractionType, targets: target ? [target] : [] };
  }
  return {
    interactionType: 'synthesis' as InteractionType,
    targets: agents.filter((item) => item.id !== agent.id),
  };
}

function openingMoveForAgent(agent: RoundtableAgent): string {
  const key = agent.skillId || agent.id;
  const text = `${key} ${agent.name} ${agent.roleLabel} ${agent.responsibility}`.toLowerCase();
  if (/musk|马斯克|first-principles/.test(text)) {
    return '角色专属开场：先提出一个大胆重构可能性，再拆到底层约束、成本下限、速度瓶颈和规模化障碍。';
  }
  if (/bezos|贝索斯|customer|flywheel/.test(text)) {
    return '角色专属开场：从客户行为倒推，说明哪个客户痛点会带来复购、口碑或更低获客成本。';
  }
  if (/jobs|乔布斯|product|narrative/.test(text)) {
    return '角色专属开场：判断这个产品体验是否足够简单、完整、尖锐，并指出最该变清楚的一步。';
  }
  if (/thiel|蒂尔|contrarian|monopoly/.test(text)) {
    return '角色专属开场：找反共识秘密、价值捕获和垄断起点；指出这件事是否只是共识优化。';
  }
  if (/grove|格鲁夫|strategic|inflection/.test(text)) {
    return '角色专属开场：判断是否存在 10x 外部变化，说明继续旧模式会先在哪个结果上恶化。';
  }
  if (/drucker|德鲁克|management/.test(text)) {
    return '角色专属开场：定义有效贡献、责任人、资源权和必须停止的低贡献活动。';
  }
  if (/walton|沃尔顿|channel|execution/.test(text)) {
    return '角色专属开场：回到一线渠道、客户台账和执行纪律，说明哪条现场证据会决定是否加码。';
  }
  return '角色专属开场：用自己的专业职责提出一个独立判断、一个证据缺口和一个下一步动作，不要复述其他人。';
}

function conversationAnchorForAgent(agent: RoundtableAgent): string {
  const key = agent.skillId || agent.id;
  const text = `${key} ${agent.name} ${agent.roleLabel} ${agent.responsibility}`.toLowerCase();
  if (/musk|马斯克|first-principles/.test(text)) {
    return '从一个底层约束、成本曲线或速度瓶颈切入，直接说哪件事如果从零重建会完全不同。';
  }
  if (/bezos|贝索斯|customer|flywheel/.test(text)) {
    return '从客户会不会反复回来、复购或自发推荐切入，先说客户行为会怎样改变。';
  }
  if (/jobs|乔布斯|product|narrative/.test(text)) {
    return '从客户或一线代表实际体验切入，先判断这件事是否足够简单、清楚、完整。';
  }
  if (/thiel|蒂尔|contrarian|monopoly/.test(text)) {
    return '从一个别人没看见或不敢承认的反共识问题切入，先问价值是否能被独占。';
  }
  if (/grove|格鲁夫|strategic|inflection/.test(text)) {
    return '从外部变化和旧模式的惩罚切入，先说继续原样会在哪个结果上出问题。';
  }
  if (/drucker|德鲁克|management/.test(text)) {
    return '从贡献、责任人和停止事项切入，先问谁负责、资源从哪里挪、什么活动该停。';
  }
  if (/walton|沃尔顿|channel|execution/.test(text)) {
    return '从一线客户、拜访路线、库存或每周台账切入，先说现场哪条信号决定是否加码。';
  }
  return '从本角色最熟悉的一个现实观察切入，先说独立判断，再说需要补的证据。';
}

function instructionForPlan(
  phaseId: RoundtablePhaseId,
  agent: RoundtableAgent,
  interactionType: InteractionType,
  targetAgentNames: string[],
): string {
  const targetText = targetAgentNames.length ? targetAgentNames.join('、') : '无指定对象';
  const base = [
    '请只输出一个 JSON 对象，不要使用 Markdown 代码块，不要输出解释性前后缀。',
    'JSON schema: {"content":"中文发言正文","interactionType":"statement|mention|reply|challenge|evidence_request|synthesis","targetAgentNames":["目标 Agent 名称"],"relatedIdea":"可选","evidenceRequest":"可选"}',
    'content 用中文，控制在 120-260 字；像会议现场发言，不像报告摘要。',
    '自然选择一个会议动作：提出大胆机会、追问、反驳、修正、解释概念、要求证据、支持放大或建议暂缓；避免为了挑战而挑战。',
    '不要把发言自动缩成风险清单或小试点；可以提出大胆方向，但必须从本角色会自然先盯住的对象切入。',
    `现场开口锚点：${conversationAnchorForAgent(agent)}`,
    '避免复用同一套反转句式开场；如果上一轮或其他人已经用过相似开头，换一种更贴近本人习惯的第一句话。',
    '避免生硬黑话和过度投资化、战斗化表达，除非用户原文使用。',
    '不要复述、泄露或输出任何 *_SKILL_ACTIVE_ONLY 标识。',
    '不要在 content 中说“我以某某视角”“非本人观点”“目标对象：”“当前判断：”“依据 / 来源：”“未证实部分：”等协议或模板标签。',
    '不要使用“你的挑战成立”“我接受你的挑战”这类 AI 协作套话；要么直接反驳，要么直接修正主张。',
    '如果需要点名，直接用“彼得，你这里的问题是……”这类自然会议语言。',
    '新提出的无来源事实判断必须标注“未证实”或“需要证据”。',
    '公共证据边界要去重：如果事实包或公开记录已反复标注同一个不确定项，后续不要把同一句免责声明塞进每条发言；只有当它改变你的取舍、反驳对象或新增证据请求时才自然提到。',
    `本轮互动意图：${interactionType}。需要回应或追问的人：${targetText}。这个信息只用于组织发言，不要照抄成标签；如果自然讨论更适合支持、补充、追问或要求补证，可以输出更合适的 interactionType。`,
  ];
  if (phaseId === 'round1') {
    const round1Lines = [
      '第 1 轮：独立开场。不要复述其他人，不要按统一立场分类模板作答。',
      '像真人圆桌现场一样用你的第一反应切入；可以放大方向、质疑前提或要求补证，并自然体现你的角色方法论。',
    ];
    const skillMode = getAgentSkillMode(agent);
    if (skillMode !== 'verified_role_agent' && skillMode !== 'installed_unverified') {
      round1Lines.push(openingMoveForAgent(agent));
    }
    base.push(round1Lines.join('\n'));
  } else if (phaseId === 'round2') {
    base.push('第 2 轮：相互回应。只有在确实不同意、概念不清或证据不足时才挑战；也可以补强、追问或要求解释。避免为了挑战而挑战。');
  } else if (phaseId === 'round3') {
    base.push('第 3 轮：回应上一轮挑战。可以澄清、反驳、修正或要求补证；不是每个人都必须撤回观点。避免统一使用“我撤回……”句式。');
  } else if (phaseId === 'round4') {
    base.push('第 4 轮：证据深挖。围绕真正影响决策的证据缺口追问来源、样本、时间窗口、责任人或合规边界；不要把所有发言都压成指标清单。');
  } else if (phaseId === 'round5') {
    base.push('第 5 轮：取舍谈判。自然说明愿意放大的部分、暂缓的部分和代价；允许保留分歧，避免给两全其美答案。');
  } else if (phaseId === 'round6') {
    base.push('第 6 轮：最终立场。给出支持、反对或有条件支持；只在对决策必要时给验证指标、停止条件或补证要求。');
  } else {
    base.push('第 7 轮：收敛总结。不要套模板，要把真实冲突、最强结论和下一步决策写出来。');
  }
  return base.join('\n');
}

function buildPrompt(
  state: RoundtableState,
  agent: RoundtableAgent,
  phaseId: RoundtablePhaseId,
  interactionType: InteractionType,
  targetAgentNames: string[],
  instruction: string,
  excludeTranscriptPhaseIds: RoundtablePhaseId[] = [],
): string {
  if (getAgentSkillMode(agent) === 'legacy_prompt') {
    return [
      renderAgentPrompt(buildAgentGenerationContext(state, agent.id, phaseId)),
      '',
      'Runtime 输出要求：',
      instruction,
    ].join('\n');
  }
  return buildRoleAgentTaskPrompt({
    state,
    agent,
    phaseId,
    interactionType,
    targetAgentNames,
    instruction,
    excludeTranscriptPhaseIds,
  });
}

function isBackgroundEvidenceAgent(agent: RoundtableAgent): boolean {
  return agent.enabled && agent.participationMode === 'background_research';
}

function evidenceTaskNeedsRuntimeResearch(task: RoundtableState['evidenceTasks'][number]): boolean {
  if (task.status === 'queued') return true;
  if (task.status === 'researching') return true;
  const priorText = [task.resultSummary, ...task.sourceRefs].join('\n');
  return task.status !== 'researched' && /本地模拟|未联网|no source fetched|Evidence Broker demo/i.test(priorText);
}

function buildEvidenceResearchPrompt(
  state: RoundtableState,
  agent: RoundtableAgent,
  task: RoundtableState['evidenceTasks'][number],
): string {
  const factLines = formatEvidenceFactPack(state);
  const transcriptLines = state.messages.length
    ? state.messages.slice(-12).map((message) =>
      `- ${message.phaseTitle} / ${message.senderName} / ${message.interactionType}: ${message.content}`
    ).join('\n')
    : '- 暂无公开发言。';

  return [
    `你是后台证据研究 Agent：${agent.name}。`,
    `角色标签：${agent.roleLabel}`,
    `角色职责：${agent.responsibility}`,
    '',
    '后台证据研究任务：',
    task.request,
    '',
    '执行纪律：',
    '- 你不是圆桌公开发言者，不要参与观点争论，只做证据补充、来源核验和边界标注。',
    '- 优先使用用户导入的背景材料、Fact Pack、项目本地 context 目录（例如 ../context 或 context/）和公开来源。',
    '- prompt 只提供背景摘要和导入来源索引；需要精确取数时，优先读取导入来源索引里的 context 文件，而不是要求用户粘贴全文。',
    '- 对政策、市场、医学、竞品、指南、监管、价格、准入等外部事实，必须使用 Tavily CLI 快速检索：tvly search "<证据问题 + 关键词>" --depth fast --max-results 5 --json。',
    '- runtime API 可能已经附带 Tavily 预检索结果；你必须优先核验这些 URL，再决定是否继续补搜。',
    '- sourceRefs 必须给出可核验来源名称、URL 或文件路径。',
    '- 如果只能判断“需要外部检索”或“需要内部资料”，必须明确说不能补证完成，不能编造来源。',
    '- 没有来源的事实不能标记为 verified。',
    '',
    '只输出一个 JSON 对象，不要使用 Markdown 代码块，不要输出解释性前后缀。',
    'JSON schema: {"status":"researched|needs_external_research|needs_user_data|not_found|out_of_scope","resultSummary":"补证结论摘要","facts":[{"type":"known_fact|source|uncertainty|background","content":"可进入 Fact Pack 的事实或边界","source":"来源 URL / 文件路径 / 资料名","status":"verified|unverified|assumption|needs_evidence"}],"sourceRefs":["来源 URL / 文件路径 / 资料名"]}',
    '',
    `讨论议题：${state.topic || '未设置'}`,
    `会议目标：${state.objective || '未设置'}`,
    `背景材料摘要：${summarizeEvidenceBackground(state)}`,
    `搜索范围：${state.searchScope || '未设置'}`,
    '',
    '导入来源索引：',
    formatEvidenceSourceIndex(state),
    '',
    'Fact Pack：',
    factLines,
    '',
    '最近公开发言：',
    transcriptLines,
  ].join('\n');
}

export function getEvidenceResearchRuntimePlan(
  state: RoundtableState,
  options: { limitTasks?: number; limitAgentsPerTask?: number } = {},
): RoundtableEvidenceRuntimePlan[] {
  const limitTasks = Math.max(1, Math.floor(options.limitTasks ?? 2));
  const limitAgentsPerTask = Math.max(1, Math.floor(options.limitAgentsPerTask ?? 1));
  const agentById = new Map(state.agents.map((agent) => [agent.id, agent]));
  const tasks = state.evidenceTasks
    .filter(evidenceTaskNeedsRuntimeResearch)
    .slice(0, limitTasks);

  return tasks.flatMap((task) => {
    const agents = task.assignedAgentIds
      .map((agentId) => agentById.get(agentId))
      .filter((agent): agent is RoundtableAgent => Boolean(agent && isBackgroundEvidenceAgent(agent)))
      .filter((agent) => isCliRuntime(agent.runtime))
      .slice(0, limitAgentsPerTask);

    return agents.map((agent) => ({
      id: `evidence:${task.id}:${agent.id}`,
      evidenceTaskId: task.id,
      evidenceRequest: task.request,
      agentId: agent.id,
      agentName: agent.name,
      runtime: agent.runtime,
      phaseId: task.phaseId || state.currentPhaseId,
      phaseTitle: '后台证据研究',
      interactionType: 'mention' as InteractionType,
      targetAgentIds: [],
      targetAgentNames: [],
      prompt: buildEvidenceResearchPrompt(state, agent, task),
    }));
  });
}

export function isCliRuntime(runtime: RoundtableAgentRuntime): boolean {
  return runtime === 'codex_cli' || runtime === 'claude_code_cli';
}

export function getRuntimeRoundPlan(
  state: RoundtableState,
  options: RoundtableRuntimePlanOptions = {},
): RoundtableRuntimePlan[] {
  const selectedAgents = getSelectedAgents(state).filter((agent) => agent.participationMode === 'participant');
  const promptState = options.promptState || state;
  const phaseId = state.currentPhaseId;
  const phase = phaseById(phaseId);
  const finalPhaseId = ROUNDTABLE_PHASES.at(-1)?.id || 'round7';
  const plannedAgents = phaseId === finalPhaseId
    ? selectedAgents.filter((agent) => agent.id === chooseSynthesizer(selectedAgents)?.id)
    : selectedAgents;

  return plannedAgents.map((agent) => {
    const originalIndex = selectedAgents.findIndex((item) => item.id === agent.id);
    const interaction = planInteraction(phaseId, selectedAgents, originalIndex);
    const targetAgentIds = interaction.targets.map((target) => target.id);
    const targetAgentNames = interaction.targets.map((target) => target.name);
    const instruction = instructionForPlan(phaseId, agent, interaction.interactionType, targetAgentNames);
    return {
      id: `${phaseId}:${agent.id}`,
      agentId: agent.id,
      agentName: agent.name,
      runtime: agent.runtime,
      phaseId,
      phaseTitle: phase.title,
      interactionType: interaction.interactionType,
      targetAgentIds,
      targetAgentNames,
      prompt: buildPrompt(
        promptState,
        agent,
        phaseId,
        interaction.interactionType,
        targetAgentNames,
        instruction,
        options.excludeTranscriptPhaseIds,
      ),
    };
  });
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  const trimmed = value.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const candidates = [trimmed];
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {}
  }
  return null;
}

function scrubPrivateMarkers(value: string): string {
  return value.replace(/\b[A-Z0-9]+(?:_[A-Z0-9]+)*_SKILL_ACTIVE_ONLY\b/g, '[已隐藏私有 skill 标识]');
}

function scrubProtocolLanguage(value: string): string {
  return scrubPrivateMarkers(value)
    .replace(/^\s*我以[^\n。！？]*(?:视角|身份)[^\n。！？]*(?:非本人观点|公开材料推断)[。！？]?\s*/gm, '')
    .replace(/^\s*(?:目标对象|发言类型|当前判断|依据\s*\/\s*来源|未证实部分)\s*[:：][^\n]*(?:\n|$)/gm, '')
    .replace(/你的挑战成立/g, '这个问题说到关键处')
    .replace(/我接受你的挑战/g, '我会收窄判断')
    .replace(/我接受上一轮挑战/g, '上一轮问题说到关键处')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isProductEquivalenceEvidenceBoundary(value: string): boolean {
  const compact = value.replace(/\s+/g, '');
  return /(?:Product C|Product C).{0,18}ProductC.{0,24}(?:同一|等同|对应|同名|确认|证据|未证实|仍需|需要)|ProductC.{0,24}(?:Product C|Product C).{0,24}(?:同一|等同|对应|同名|确认|证据|未证实|仍需|需要)/i.test(compact);
}

function hasPriorProductEquivalenceBoundary(state: RoundtableState): boolean {
  return state.messages.some((message) => isProductEquivalenceEvidenceBoundary(message.content));
}

function dedupeRepeatedEvidenceBoundary(content: string, state: RoundtableState, plan: RoundtableRuntimePlan): string {
  if (plan.interactionType === 'synthesis') return content;
  if (!hasPriorProductEquivalenceBoundary(state) || !isProductEquivalenceEvidenceBoundary(content)) return content;

  const parts = content.match(/[^。！？!?；;]+[。！？!?；;]?/g) || [content];
  const filtered = parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !isProductEquivalenceEvidenceBoundary(part));
  return (filtered.join('') || content).trim();
}

function normalizeInteraction(value: unknown, fallback: InteractionType): InteractionType {
  if (typeof value !== 'string') return fallback;
  return structuredInteractions.includes(value as InteractionType) ? value as InteractionType : fallback;
}

function namesFromParsed(parsed: Record<string, unknown> | null): string[] {
  if (!parsed) return [];
  const direct = parsed.targetAgentNames || parsed.targets || parsed.targetAgents || parsed.targetAgentName;
  if (Array.isArray(direct)) return direct.filter((item): item is string => typeof item === 'string');
  return typeof direct === 'string' ? [direct] : [];
}

function idsForNames(names: string[], state: RoundtableState): string[] {
  const normalized = names.map((name) => name.trim().toLowerCase()).filter(Boolean);
  if (!normalized.length) return [];
  return state.agents
    .filter((agent) => normalized.some((name) =>
      agent.name.toLowerCase() === name ||
      agent.name.toLowerCase().includes(name) ||
      name.includes(agent.name.toLowerCase())
    ))
    .map((agent) => agent.id);
}

function normalizeEvidenceStatus(value: unknown): EvidenceTaskStatus {
  if (typeof value === 'string' && evidenceTerminalStatuses.includes(value as EvidenceTaskStatus)) {
    return value as EvidenceTaskStatus;
  }
  return 'not_found';
}

function normalizeFactType(value: unknown): FactEntryType {
  return ['known_fact', 'source', 'uncertainty', 'background', 'evidence_request'].includes(String(value))
    ? value as FactEntryType
    : 'uncertainty';
}

function normalizeFactStatus(value: unknown, source: string): FactEntryStatus {
  const requested = ['verified', 'unverified', 'assumption', 'needs_evidence'].includes(String(value))
    ? value as FactEntryStatus
    : 'unverified';
  return requested === 'verified' && !source.trim() ? 'unverified' : requested;
}

function stringsFromUnknownArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
    : [];
}

export function normalizeEvidenceRuntimeOutput(
  rawOutput: string,
  plan: RoundtableEvidenceRuntimePlan,
): NormalizedEvidenceRuntimeOutput {
  const parsed = parseJsonObject(rawOutput);
  const rawFacts = Array.isArray(parsed?.facts) ? parsed.facts : [];
  const facts = rawFacts
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
    .map((item) => {
      const source = typeof item.source === 'string' ? item.source.trim() : '';
      return {
        type: normalizeFactType(item.type),
        content: typeof item.content === 'string' ? item.content.trim() : '',
        source,
        status: normalizeFactStatus(item.status, source),
      };
    })
    .filter((fact) => fact.content.length > 0);
  const sourceRefs = stringsFromUnknownArray(parsed?.sourceRefs);
  const hasSourceBackedEvidence = sourceRefs.length > 0 || facts.some((fact) => fact.source.trim().length > 0);
  const requestedStatus = normalizeEvidenceStatus(parsed?.status);
  const status = requestedStatus === 'researched' && !hasSourceBackedEvidence ? 'not_found' : requestedStatus;
  const resultSummary = typeof parsed?.resultSummary === 'string' && parsed.resultSummary.trim()
    ? parsed.resultSummary.trim()
    : rawOutput.trim();

  return {
    status,
    resultSummary: resultSummary || `后台证据研究未返回摘要：${plan.evidenceRequest}`,
    facts,
    sourceRefs,
  };
}

export function compactRuntimeError(error: string): string {
  const raw = error.trim();
  if (!raw) return 'Runtime 调用失败，但未返回错误详情。';

  const timeoutMatch = raw.match(/Process timed out after \d+ms/i)
    || raw.match(/timed out after \d+ms/i);
  if (timeoutMatch) {
    return `${timeoutMatch[0]}。已隐藏 CLI stdout/stderr 中的 prompt、skill 与背景材料；完整日志保存在本地 runtime artifact。`;
  }

  const noisyLinePattern =
    /^(OpenAI Codex|Claude Code|ROLE_AGENT|ROLE_AGENT_EVIDENCE|skill_|resolved_skill_path|manifest_|profile_|codex_|claude_|workdir:|model:|provider:|approval:|sandbox:|reasoning |session id:|--------|user$)/i;
  const compacted = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !noisyLinePattern.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const text = compacted || raw.split(/\r?\n/).find((line) => line.trim())?.trim() || raw;
  return text.length > 600 ? `${text.slice(0, 597)}...` : text;
}

function unique(values: string[]): string[] {
  const next: string[] = [];
  for (const value of values) {
    if (value && !next.includes(value)) next.push(value);
  }
  return next;
}

function outputIsTargetSegmentLocalEvidence(output: NormalizedEvidenceRuntimeOutput): boolean {
  return output.sourceRefs.some((ref) => /targetSegment_four_product_coverage_amount_intermittent_zero_lists\.json/i.test(ref)) ||
    output.facts.some((fact) => /TARGET_SEGMENT\s+(ProductA|ProductB)|TARGET_SEGMENT主数据客户/i.test(fact.content + fact.source));
}

function taskCoveredByTargetSegmentLocalEvidence(
  task: RoundtableState['evidenceTasks'][number],
  plan: RoundtableEvidenceRuntimePlan,
): boolean {
  return task.assignedAgentIds.includes(plan.agentId) &&
    /TARGET_SEGMENT|segment_code|SEGMENT_CODE/i.test(task.request) &&
    /ProductA|ProductB|Product A|Product B|四个产品|客户|零销售|Top\s*客户|月趋势|覆盖/i.test(task.request);
}

export function markEvidenceTaskResearching(
  state: RoundtableState,
  plan: RoundtableEvidenceRuntimePlan,
): RoundtableState {
  const timestamp = new Date().toISOString();
  return {
    ...state,
    evidenceTasks: state.evidenceTasks.map((task) =>
      task.id === plan.evidenceTaskId
        ? {
          ...task,
          status: 'researching',
          assignedAgentIds: unique([...task.assignedAgentIds, plan.agentId]),
          updatedAt: timestamp,
        }
        : task
    ),
  };
}

export function applyRuntimeEvidenceResult(
  state: RoundtableState,
  plan: RoundtableEvidenceRuntimePlan,
  output: NormalizedEvidenceRuntimeOutput,
): RoundtableState {
  const task = state.evidenceTasks.find((item) => item.id === plan.evidenceTaskId);
  if (!task) return state;

  let nextState = state;
  const addedFactIds: string[] = [];
  for (const fact of output.facts) {
    const beforeCount = nextState.factPack.length;
    nextState = addFactEntry(nextState, {
      type: fact.type,
      content: fact.content,
      source: fact.source,
      status: fact.status,
      addedBy: plan.agentName,
      phaseId: task.phaseId,
    });
    if (nextState.factPack.length > beforeCount) {
      addedFactIds.push(nextState.factPack[nextState.factPack.length - 1].id);
    }
  }

  const timestamp = new Date().toISOString();
  const closesEquivalentTargetSegmentTasks = outputIsTargetSegmentLocalEvidence(output);
  return {
    ...nextState,
    evidenceTasks: nextState.evidenceTasks.map((item) =>
      item.id === plan.evidenceTaskId || (closesEquivalentTargetSegmentTasks && taskCoveredByTargetSegmentLocalEvidence(item, plan))
        ? {
          ...item,
          status: output.status === 'researched' || addedFactIds.length > 0 ? 'researched' : output.status,
          resultSummary: [item.resultSummary, `${plan.agentName}: ${output.resultSummary}`]
            .filter(Boolean)
            .join('\n'),
          factEntryIds: unique([...item.factEntryIds, ...addedFactIds]),
          sourceRefs: unique([...item.sourceRefs, ...output.sourceRefs, ...output.facts.map((fact) => fact.source).filter(Boolean)]),
          updatedAt: timestamp,
        }
        : item
    ),
  };
}

export function applyRuntimeEvidenceFailure(
  state: RoundtableState,
  plan: RoundtableEvidenceRuntimePlan,
  error: string,
): RoundtableState {
  const timestamp = new Date().toISOString();
  return {
    ...state,
    evidenceTasks: state.evidenceTasks.map((task) =>
      task.id === plan.evidenceTaskId
        ? {
          ...task,
          status: 'research_failed',
          resultSummary: [task.resultSummary, `${plan.agentName}: 后台补证执行失败：${compactRuntimeError(error)}`]
            .filter(Boolean)
            .join('\n'),
          updatedAt: timestamp,
        }
        : task
    ),
  };
}

export function normalizeRuntimeOutput(
  rawOutput: string,
  plan: RoundtableRuntimePlan,
  state: RoundtableState,
): NormalizedRuntimeOutput {
  const parsed = parseJsonObject(rawOutput);
  const agent = state.agents.find((item) => item.id === plan.agentId);
  const parsedContent = typeof parsed?.content === 'string' ? parsed.content : rawOutput;
  const targetIds = idsForNames(namesFromParsed(parsed), state);
  const evidenceRequest = typeof parsed?.evidenceRequest === 'string' ? parsed.evidenceRequest : undefined;
  const relatedIdea = typeof parsed?.relatedIdea === 'string' ? parsed.relatedIdea : undefined;
  const scrubbedContent = scrubProtocolLanguage(parsedContent.trim() || 'Runtime 未返回可展示内容。')
    || 'Runtime 未返回可展示内容。';
  const content = dedupeRepeatedEvidenceBoundary(scrubbedContent, state, plan)
    || 'Runtime 未返回可展示内容。';
  const interactionType = normalizeInteraction(parsed?.interactionType, plan.interactionType);

  const judged = {
    content,
    interactionType,
    targetAgentIds: targetIds.length ? targetIds : plan.targetAgentIds,
    relatedIdea,
    evidenceRequest: evidenceRequest || (interactionType === 'evidence_request' ? content : undefined),
  };
  return {
    ...judged,
    judge: judgeRoundtableOutput({
      ...judged,
      agentId: plan.agentId,
      agentName: plan.agentName,
      skillId: agent?.skillId,
    }),
  };
}

export function createDemoRuntimeOutput(plan: RoundtableRuntimePlan): NormalizedRuntimeOutput {
  const targetText = plan.targetAgentNames.length ? `@${plan.targetAgentNames.join('、')} ` : '';
  const contentByType: Record<InteractionType, string> = {
    statement: '这件事值得往前推，但先别扩大战线。支持理由、执行边界和验证问题必须放在同一张桌面上，否则大胆想法很快会变成口号。',
    mention: `${targetText}我想补充一个相关视角：先明确目标客户和证据边界，再讨论资源投入。`,
    reply: `${targetText}上一轮问题说到关键处，我会把主张收窄：先做小范围验证，再根据事实包决定是否扩大投入。`,
    challenge: `${targetText}这个假设现在太轻。如果没有客户采用、政策约束和现场执行证据，它仍属于未证实判断。`,
    evidence_request: `${targetText}先把政策边界、客户采用意愿、执行约束和样本来源补齐；没有这些，讨论不能进入承诺。`,
    synthesis: '我先收束：保留可快速验证的大胆假设，把反对意见、关键风险和下一步证据请求留在台面上。',
    user_interjection: '用户插话',
  };
  return {
    content: contentByType[plan.interactionType],
    interactionType: plan.interactionType,
    targetAgentIds: plan.targetAgentIds,
    evidenceRequest: plan.interactionType === 'evidence_request' ? contentByType.evidence_request : undefined,
  };
}

export function applyRuntimeRoundMessage(
  state: RoundtableState,
  plan: RoundtableRuntimePlan,
  output: NormalizedRuntimeOutput,
  meta: RuntimeMessageMeta = {},
): RoundtableState {
  const agent = state.agents.find((item) => item.id === plan.agentId);
  if (!agent) return state;
  const phase = phaseById(plan.phaseId);
  const runtimeSuffix = meta.runtime && meta.runtime !== 'demo'
    ? `\n\n[Runtime: ${runtimeLabels[meta.runtime]}${meta.durationMs ? `, ${Math.round(meta.durationMs / 1000)}s` : ''}]`
    : '';
  const message: RoundtableMessage = {
    id: `runtime-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    senderId: agent.id,
    senderName: agent.name,
    senderAvatar: agent.avatar,
    senderRoleLabel: agent.roleLabel,
    content: `${output.content}${runtimeSuffix}`,
    phaseId: plan.phaseId,
    phaseTitle: phase.title,
    interactionType: output.interactionType,
    targetAgentIds: output.targetAgentIds,
    relatedIdea: output.relatedIdea,
    evidenceRequest: output.evidenceRequest,
    createdAt: new Date().toISOString(),
  };
  const nextState = { ...state, status: 'running' as const, messages: [...state.messages, message] };
  if (output.interactionType !== 'evidence_request' || !output.evidenceRequest) {
    return addEvidenceTaskForMessage(nextState, message);
  }
  const withFact = addFactEntry(nextState, {
    type: 'evidence_request',
    content: output.evidenceRequest,
    source: '',
    status: 'needs_evidence',
    addedBy: agent.name,
    phaseId: plan.phaseId,
  });
  return addEvidenceTaskForMessage(withFact, message);
}

export function advanceRuntimeStateAfterPhase(state: RoundtableState): RoundtableState {
  const phaseId = state.currentPhaseId;
  const finalPhaseId = ROUNDTABLE_PHASES.at(-1)?.id || 'round7';
  if (phaseId === finalPhaseId) {
    const completeState = {
      ...state,
      status: 'complete' as const,
      currentPhaseId: finalPhaseId,
      pendingExtraRoundSuggestion: '如果事实包改变了领先想法，Agent 建议可追加一轮跟进讨论，需要用户确认。',
    };
    return { ...completeState, finalOutput: buildFinalOutput(completeState) };
  }
  return {
    ...state,
    status: 'running' as const,
    currentPhaseId: nextPhaseId(phaseId),
  };
}
