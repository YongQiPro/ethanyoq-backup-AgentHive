import {
  addFactEntry,
  type EvidenceTask,
  type EvidenceTaskStatus,
  type RoundtableMessage,
  type RoundtablePhaseId,
  type RoundtableState,
} from './roundtable-engine';

export interface EvidenceTaskRequestInput {
  request: string;
  requestedByAgentId: string;
  requestedByAgentName: string;
  targetAgentIds?: string[];
  phaseId?: RoundtablePhaseId;
  sourceMessageId?: string;
}

export interface ClassifyEvidenceOptions {
  limit?: number;
}

interface EvidenceClassification {
  status: EvidenceTaskStatus;
  summary: string;
}

const brokerName = 'Evidence Broker';
const brokerSource = 'Evidence Broker（本地模拟，未联网）';
const brokerDemoAgentId = 'evidence-broker-demo';
const externalResearchSourceRef = 'Evidence Broker demo: external research required; no source fetched';

const userDataPattern =
  /内部数据|用户上传|销售|台账|订单|客户级|账户级|门店级|医院级|覆盖|库存|采购订单|采购台账|毛利|成本|收入|预算|负责人|组织架构|区域|渠道|CRM|SKU|剂型/i;
const externalResearchPattern = /带量采购|医保|政策|准入|合规|省份|监管|集采/;
const marketResearchPattern = /市场|竞品|客户|支付意愿|复购|获客|增长|TAM|SAM|SOM|渠道|价格/i;
const medicalResearchPattern = /医学|临床|适应症|指南|RCT|真实世界|疗效|安全性|药品|药物|患者|血液|移植|ICU|抗感染|真菌/i;
const explicitEvidenceNeedPattern =
  /(?:需要|请|必须|先|要|得|不能).*?(?:证据|补证|补齐|来源|数据|核验|验证)|(?:缺少|缺乏|没有|无).*?(?:证据|来源|数据|样本|口径|边界)|不能.*?(?:拍脑袋|下结论|承诺|证明)/;
const sentenceSplitPattern = /(?<=[。！？!?；;])\s*/;

function existingEvidenceTasks(state: RoundtableState): EvidenceTask[] {
  return Array.isArray(state.evidenceTasks) ? state.evidenceTasks : [];
}

function nowIso(): string {
  return new Date().toISOString();
}

function compactHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function taskIdForInput(input: EvidenceTaskRequestInput, request: string, requestedByAgentId: string): string {
  const sourceMessageId = input.sourceMessageId?.trim();
  if (sourceMessageId) return `evidence:${sourceMessageId}`;
  return `evidence:${compactHash([request, requestedByAgentId, input.phaseId || ''].join('\n'))}`;
}

function classifyEvidenceRequest(request: string): EvidenceClassification {
  if (userDataPattern.test(request)) {
    return {
      status: 'needs_user_data',
      summary:
        '该请求需要内部数据或用户上传，如销售台账、客户级订单、医院级记录或毛利明细；本地模拟未联网，不能编造为已证实结论。',
    };
  }

  if (externalResearchPattern.test(request)) {
    return {
      status: 'needs_external_research',
      summary:
        '该请求需要公开政策资料和外部检索核验；Evidence Broker 本地模拟未联网，不能给出正式来源结论。',
    };
  }

  return {
    status: 'not_found',
    summary:
      '本地模拟未识别到可分类的内部数据或公开政策证据需求；本地模拟未联网，不能编造，也不能给正式来源结论。',
  };
}

function agentExists(state: RoundtableState, id: string): boolean {
  return state.agents.some((agent) => agent.id === id);
}

function assignEvidenceAgentIds(state: RoundtableState, request: string): string[] {
  const ids: string[] = [];
  const pushIfExists = (id: string) => {
    if (agentExists(state, id) && !ids.includes(id)) ids.push(id);
  };

  if (externalResearchPattern.test(request)) pushIfExists('policy-research-agent');
  if (medicalResearchPattern.test(request)) pushIfExists('medical-evidence-research-agent');
  if (marketResearchPattern.test(request)) pushIfExists('market-research-agent');
  if (userDataPattern.test(request)) pushIfExists('company-context-agent');
  pushIfExists('fact-pack-keeper');

  return ids.length > 0 ? ids : [brokerDemoAgentId];
}

function extractEvidenceRequestFromContent(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized || !explicitEvidenceNeedPattern.test(normalized)) return '';
  const relevantSentences = normalized
    .split(sentenceSplitPattern)
    .map((sentence) => sentence.trim())
    .filter((sentence) => explicitEvidenceNeedPattern.test(sentence));
  const request = (relevantSentences.length ? relevantSentences.join(' ') : normalized).trim();
  return request.length > 420 ? `${request.slice(0, 417)}...` : request;
}

function buildUncertaintyFactContent(task: EvidenceTask, summary: string): string {
  return `证据任务 ${task.id} 未证实：${task.request}\n分类说明：${summary}`;
}

function isBrokerFactForTask(
  entry: RoundtableState['factPack'][number],
  task: EvidenceTask,
): boolean {
  return (
    entry.type === 'uncertainty' &&
    entry.status === 'needs_evidence' &&
    entry.addedBy === brokerName &&
    entry.source.includes('Evidence Broker') &&
    entry.source.includes('本地模拟') &&
    entry.source.includes('未联网') &&
    entry.content.includes(`证据任务 ${task.id} `)
  );
}

function uniqueIds(ids: string[]): string[] {
  const unique: string[] = [];
  for (const id of ids) {
    if (!unique.includes(id)) unique.push(id);
  }
  return unique;
}

function ensureUncertaintyFact(
  state: RoundtableState,
  task: EvidenceTask,
  summary: string,
): { state: RoundtableState; factEntryIds: string[] } {
  const existingFactIds = state.factPack
    .filter((entry) => isBrokerFactForTask(entry, task))
    .map((entry) => entry.id);

  if (existingFactIds.length > 0) {
    return {
      state,
      factEntryIds: uniqueIds([...task.factEntryIds, ...existingFactIds]),
    };
  }

  const beforeFactCount = state.factPack.length;
  const nextState = addFactEntry(state, {
    type: 'uncertainty',
    content: buildUncertaintyFactContent(task, summary),
    source: brokerSource,
    status: 'needs_evidence',
    addedBy: brokerName,
    phaseId: task.phaseId,
  });
  const addedFact =
    nextState.factPack.length > beforeFactCount
      ? nextState.factPack[nextState.factPack.length - 1]
      : undefined;

  return {
    state: nextState,
    factEntryIds: addedFact ? uniqueIds([...task.factEntryIds, addedFact.id]) : task.factEntryIds,
  };
}

export function addEvidenceTaskForRequest(
  state: RoundtableState,
  input: EvidenceTaskRequestInput,
): RoundtableState {
  const request = input.request.trim();
  if (!request) return state;

  const requestedByAgentId = input.requestedByAgentId.trim() || 'unknown';
  const requestedByAgentName = input.requestedByAgentName.trim() || requestedByAgentId;
  const sourceMessageId = input.sourceMessageId?.trim();
  const id = taskIdForInput(input, request, requestedByAgentId);
  const evidenceTasks = existingEvidenceTasks(state);
  if (evidenceTasks.some((task) => task.id === id)) return state;

  const timestamp = nowIso();
  const assignedAgentIds = assignEvidenceAgentIds(state, request);
  const task: EvidenceTask = {
    id,
    request,
    requestedByAgentId,
    requestedByAgentName,
    targetAgentIds: [...(input.targetAgentIds || [])],
    phaseId: input.phaseId,
    status: 'queued',
    assignedAgentIds,
    resultSummary: '',
    factEntryIds: [],
    sourceRefs: [],
    sourceMessageId: sourceMessageId || undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return {
    ...state,
    evidenceTasks: [...evidenceTasks, task],
  };
}

export function addEvidenceTaskForMessage(
  state: RoundtableState,
  message: RoundtableMessage,
): RoundtableState {
  const request =
    message.evidenceRequest?.trim() ||
    (message.interactionType === 'evidence_request' ? message.content : '') ||
    extractEvidenceRequestFromContent(message.content);

  return addEvidenceTaskForRequest(state, {
    request,
    requestedByAgentId: message.senderId,
    requestedByAgentName: message.senderName,
    targetAgentIds: message.targetAgentIds,
    phaseId: message.phaseId,
    sourceMessageId: message.id,
  });
}

export function classifyPendingEvidenceTasksDemo(
  state: RoundtableState,
  options: ClassifyEvidenceOptions = {},
): RoundtableState {
  const initialEvidenceTasks = existingEvidenceTasks(state);
  const limit = Math.max(0, Math.floor(options.limit ?? 3));
  if (limit === 0) {
    return {
      ...state,
      evidenceTasks: initialEvidenceTasks,
    };
  }

  let classifiedCount = 0;
  let nextState: RoundtableState = {
    ...state,
    evidenceTasks: initialEvidenceTasks,
  };
  const timestamp = nowIso();
  const evidenceTasks = initialEvidenceTasks.map((task) => {
    if (task.status !== 'queued' || classifiedCount >= limit) return task;

    classifiedCount += 1;
    const classification = classifyEvidenceRequest(task.request);
    const factResult = ensureUncertaintyFact(nextState, task, classification.summary);
    nextState = factResult.state;

    return {
      ...task,
      status: classification.status,
      assignedAgentIds: task.assignedAgentIds.length > 0 ? task.assignedAgentIds : assignEvidenceAgentIds(nextState, task.request),
      resultSummary: classification.summary,
      factEntryIds: factResult.factEntryIds,
      sourceRefs:
        classification.status === 'needs_external_research'
          ? uniqueIds([...task.sourceRefs, externalResearchSourceRef])
          : task.sourceRefs,
      updatedAt: timestamp,
    };
  });

  if (classifiedCount === 0) {
    return {
      ...nextState,
      evidenceTasks,
    };
  }

  return {
    ...nextState,
    evidenceTasks,
  };
}
