import type { InteractionType } from './roundtable-engine';

export type QualityFailure =
  | 'mask_language'
  | 'too_generic'
  | 'weak_challenge'
  | 'weak_persona_fidelity'
  | 'generic_consulting_voice'
  | 'missing_evidence_boundary'
  | 'missing_action'
  | 'unnatural_jargon';

export interface JudgeInput {
  agentId?: string;
  agentName?: string;
  skillId?: string;
  content: string;
  interactionType: InteractionType;
  targetAgentIds: string[];
  evidenceRequest?: string;
}

export interface JudgeResult {
  pass: boolean;
  failures: QualityFailure[];
  scores: {
    personaFidelity: number;
    commercialSharpness: number;
    evidenceDiscipline: number;
    disagreementIntensity: number;
    actionability: number;
    antiMaskLanguage: number;
  };
}

function hasAny(value: string, words: string[]): boolean {
  return words.some((word) => value.includes(word));
}

function score(condition: boolean): number {
  return condition ? 0.8 : 0.2;
}

const roleMarkers: Record<string, string[]> = {
  'bezos-customer-flywheel-perspective': [
    '客户',
    '飞轮',
    '长期',
    'Day 1',
    '复购',
    '组合采购',
    '主动联系',
    '行为信号',
    '体验',
    '代理指标',
    'one-way',
    'two-way',
    '现金流',
    '客户行为',
    '客户级',
  ],
  'musk-first-principles-perspective': [
    '第一性',
    '物理约束',
    '成本曲线',
    '速度',
    '销售小时',
    '管理精力小时',
    '每小时新增管线',
    '单位产出',
    '边际产出',
    '反事实',
    '硬问题',
    '资源发动机',
    '客户级',
    '加码',
    '理论下限',
    '一倍',
    '十倍',
    '停止加码',
  ],
  'jobs-product-narrative-perspective': [
    '客户不会',
    '体验',
    '简单',
    '去掉',
    '客户无感',
    '端到端',
    '责任人',
    '管理装饰',
    '标签',
  ],
  'grove-strategic-inflection-perspective': [
    '10x',
    '十倍',
    '战略转折',
    '外部压力',
    '旧模式',
    '旧覆盖',
    '准入窗口',
    '组合转化窗口',
    '资源到账',
    '口袋',
    '闸门',
    '高确定性',
    '80%',
    '暂缓90天',
    '组织逃避',
    '不行动',
    '生存',
    '单位管理小时',
    '管理小时回报',
    '准入周期',
    '准入推进',
    '增量毛利',
    '资源回报',
    '资源迁移',
    '旧平均覆盖',
    '组织交出资源',
    '拜访日历否决权',
    '产品线单品优先',
    '准入天数拉长',
    '组合渗透率停滞',
    '销售小时毛利',
    '毛利/销售小时下滑',
  ],
  'drucker-management-critic-perspective': [
    '贡献',
    '谁负责',
    '责任',
    '权限',
    '停止做',
    '低贡献',
    '有效',
    '负责人',
  ],
  'thiel-contrarian-monopoly-perspective': [
    '反共识',
    '秘密',
    '垄断',
    '从零到一',
    '0 到 1',
    '0到1',
    '10倍',
    '十倍',
    '竞品',
    '细分',
    '窄市场',
    '价值捕获',
    '定价权',
    '溢价',
    '红海',
    '避开竞争',
    '不对称回报',
    '控制决策链',
    '下一单默认交给',
    '下一单归属',
    '合法优先协作',
    '组合绑定',
    '独占性关系',
    '护城河',
    '高级客服',
    '默认归属',
  ],
  'walton-channel-execution-perspective': [
    '一线',
    '店长',
    '代表',
    '现场',
    '客户抱怨',
    '客诉',
    'SKU',
    '周转',
    '低价',
    '费用',
    '每平米',
    '一页表',
    '填表',
    '区域周会',
    '供应链',
    '复制',
    'customer-level台账',
    '区域周会',
    '产品线单品插队',
    '组合库存',
    '先天保送',
    '马上降级维持',
    '负责人时间',
  ],
};

function markerHits(input: JudgeInput): number {
  const key = input.skillId || input.agentId || '';
  const markers = roleMarkers[key] || [];
  return markers.filter((marker) => input.content.includes(marker)).length;
}

function isKnownPersona(input: JudgeInput): boolean {
  const key = input.skillId || input.agentId || '';
  return Boolean(roleMarkers[key]);
}

function hasGenericConsultingVoice(content: string): boolean {
  const compact = content.replace(/\s/g, '');
  return /支持(?:进入)?90天验证/.test(compact) &&
    hasAny(content, ['需要补充', '控制风险', '根据指标', '扩大投入']) &&
    !hasAny(content, ['停止', '反事实', '物理约束', '客户不会', '10x', '战略转折', '谁负责']);
}

export function judgeRoundtableOutput(input: JudgeInput): JudgeResult {
  const content = input.content.trim();
  const failures: QualityFailure[] = [];
  const hasMask = /我以|非本人观点|目标对象|作为(?:一个)?\s*AI|你的挑战成立|我接受你的挑战/.test(content);
  const hasUnnaturalJargon = /下注|止血|砍掉|失败判据|硬实验/.test(content);
  const hasEvidence = hasAny(content, ['证据', '未证实', '验证', '来源', '样本', '指标', '边界', '停止条件', '记录', '客户级', '基线', '队列', '信号', '台账']) ||
    Boolean(input.evidenceRequest);
  const hasAction = hasAny(content, [
    '下一步',
    '先拿',
    '拿前',
    '拿出',
    '提交',
    '交一张',
    '14天',
    '90天',
    '一周',
    '两周',
    '六周',
    '三个月',
    '试点',
    '试验',
    '停止',
    '暂缓',
    '去掉',
    '退出',
    '停掉',
    '收回',
    '降级',
    '别进',
    '不进入',
    '加码',
    '扩大投入',
    '负责人',
    '时间窗口',
    '闸门',
    '停止条件',
    '找出',
  ]);
  const hasChallenge = input.targetAgentIds.length > 0 || hasAny(content, ['不是', '别', '先别', '问题是', '断了', '挑战', '反对']);
  const hasCommercial = hasAny(content, ['客户', '成本', '商业', '采用', '客户', '渠道', '投入', '现金流', '资源', '规模']);
  const tooGeneric = content.length < 40 || !hasAny(content, ['证据', '客户', '成本', '采用', '资源', '指标', '风险', '验证']);
  const personaHits = markerHits(input);
  const weakPersona = isKnownPersona(input) && personaHits < 2;
  const genericVoice = hasGenericConsultingVoice(content);

  if (hasMask) failures.push('mask_language');
  if (tooGeneric) failures.push('too_generic');
  if ((input.interactionType === 'challenge' || input.interactionType === 'evidence_request') && !hasChallenge) failures.push('weak_challenge');
  if (weakPersona) failures.push('weak_persona_fidelity');
  if (genericVoice) failures.push('generic_consulting_voice');
  if (!hasEvidence) failures.push('missing_evidence_boundary');
  if (!hasAction) failures.push('missing_action');
  if (hasUnnaturalJargon) failures.push('unnatural_jargon');

  const scores = {
    personaFidelity: isKnownPersona(input) ? Math.min(1, personaHits / 3) : score(!hasMask && !tooGeneric),
    commercialSharpness: score(hasCommercial),
    evidenceDiscipline: score(hasEvidence || Boolean(input.evidenceRequest)),
    disagreementIntensity: score(hasChallenge),
    actionability: score(hasAction),
    antiMaskLanguage: hasMask ? 0 : 1,
  };

  return {
    pass: failures.length === 0,
    failures,
    scores,
  };
}
