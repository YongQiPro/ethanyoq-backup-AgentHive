'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  AtSign,
  Bot,
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  Download,
  Edit3,
  FileText,
  HelpCircle,
  History,
  Home,
  Library,
  MessageCircle,
  PackageSearch,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  Send,
  Settings,
  Settings2,
  ShieldQuestion,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  ROUNDTABLE_PHASES,
  addAgent,
  addFactEntry,
  addUserInterjection,
  advanceRoundtable,
  buildAgentGenerationContext,
  clearRoundtableDiscussion,
  clearFactPack,
  confirmExtraRound,
  createDemoAgents,
  createEmptyRoundtableState,
  deleteAgent,
  deleteFactEntry,
  ensurePresetRoundtableAgents,
  exportRoundtableMarkdown,
  getInteractionEdges,
  getSelectedAgents,
  pauseRoundtable,
  renderAgentPrompt,
  requestAgentResponse,
  resumeRoundtable,
  removeLegacyDemoFactEntries,
  updateAgent,
  type FactEntryStatus,
  type FactEntryType,
  type InteractionType,
  type RoundtableAgent,
  type RoundtableAgentRuntime,
  type RoundtableMessage,
  type RoundtableState,
} from '@/lib/roundtable-engine';
import {
  advanceRuntimeStateAfterPhase,
  applyRuntimeEvidenceFailure,
  applyRuntimeEvidenceResult,
  applyRuntimeRoundMessage,
  compactRuntimeError,
  createDemoRuntimeOutput,
  getEvidenceResearchRuntimePlan,
  getRuntimeRoundPlan,
  isCliRuntime,
  markEvidenceTaskResearching,
  normalizeEvidenceRuntimeOutput,
  normalizeRuntimeOutput,
  runtimeLabels,
  type RoundtableEvidenceRuntimePlan,
  type RoundtableRuntimePlan,
} from '@/lib/roundtable-runtime';
import {
  addEvidenceTaskForRequest,
  classifyPendingEvidenceTasksDemo,
} from '@/lib/roundtable-evidence';
import { getAgentSkillMode, isBackgroundOnlyAgent } from '@/lib/roundtable-role-agent';
import {
  applyContextMaterialAsTopic,
  applyContextMaterialToRoundtable,
  getImportedContextMaterials,
  isSupportedContextMaterialFilename,
} from '@/lib/roundtable-context-material';
import {
  ROUNDTABLE_HISTORY_STORAGE_KEY,
  parseRoundtableHistory,
  restoreRoundtableHistoryItem,
  upsertHistoryItem,
  upsertRoundtableHistory,
  type RoundtableHistoryItem,
  type RoundtableHistorySource,
} from '@/lib/roundtable-history';

const storageKey = 'roundtable-p0:reference-shell:v1';

const interactionLabels: Record<InteractionType, string> = {
  statement: '观点',
  mention: '提及',
  reply: '回应',
  challenge: '挑战',
  evidence_request: '证据请求',
  synthesis: '收敛总结',
  user_interjection: '用户插话',
};

const interactionTone: Record<InteractionType, string> = {
  statement: 'border-violet-400/40 bg-violet-500/15 text-violet-200',
  mention: 'border-sky-400/40 bg-sky-500/15 text-sky-200',
  reply: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
  challenge: 'border-rose-400/40 bg-rose-500/15 text-rose-200',
  evidence_request: 'border-amber-400/40 bg-amber-500/15 text-amber-200',
  synthesis: 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200',
  user_interjection: 'border-slate-400/40 bg-slate-500/15 text-slate-200',
};

const factTypeLabels: Record<FactEntryType, string> = {
  background: '背景',
  known_fact: '事实',
  source: '来源',
  uncertainty: '不确定性',
  evidence_request: '证据请求',
};

const factStatusLabels: Record<FactEntryStatus, string> = {
  verified: '已验证',
  unverified: '未验证',
  assumption: '假设',
  needs_evidence: '待响应',
};

const factStatusTone: Record<FactEntryStatus, string> = {
  verified: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
  unverified: 'bg-rose-500/20 text-rose-200 border-rose-400/30',
  assumption: 'bg-orange-500/20 text-orange-200 border-orange-400/30',
  needs_evidence: 'bg-amber-500/20 text-amber-200 border-amber-400/30',
};

const evidenceTaskStatusLabels: Record<RoundtableState['evidenceTasks'][number]['status'], string> = {
  queued: '待补证',
  researching: '补证中',
  researched: '已补证',
  research_failed: '补证失败',
  needs_external_research: '需外部检索',
  needs_user_data: '需内部资料',
  not_found: '未找到',
  out_of_scope: '超出范围',
};

const evidenceTaskStatusTone: Record<RoundtableState['evidenceTasks'][number]['status'], string> = {
  queued: 'border-amber-400/40 bg-amber-500/15 text-amber-200',
  researching: 'border-sky-400/40 bg-sky-500/15 text-sky-200',
  researched: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
  research_failed: 'border-rose-400/40 bg-rose-500/15 text-rose-200',
  needs_external_research: 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200',
  needs_user_data: 'border-violet-400/40 bg-violet-500/15 text-violet-200',
  not_found: 'border-slate-400/40 bg-slate-500/15 text-slate-200',
  out_of_scope: 'border-rose-400/40 bg-rose-500/15 text-rose-200',
};

const skillModeLabels = {
  verified_role_agent: 'Verified Role Agent',
  installed_unverified: 'Installed / Unverified',
  draft_role_agent: 'Draft Skill',
  background_agent: '后台研究',
  legacy_prompt: 'Legacy Prompt',
} as const;

const skillModeTone = {
  verified_role_agent: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
  installed_unverified: 'border-sky-400/40 bg-sky-500/15 text-sky-200',
  draft_role_agent: 'border-amber-400/40 bg-amber-500/15 text-amber-200',
  background_agent: 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200',
  legacy_prompt: 'border-rose-400/40 bg-rose-500/15 text-rose-200',
} as const;

const statusLabels: Record<RoundtableState['status'], string> = {
  idle: '未开始',
  running: '进行中',
  paused: '已暂停',
  complete: '已完成',
};

type RoundtableSection = 'workspace' | 'roundtable' | 'agents' | 'knowledge' | 'factpack' | 'history' | 'settings';

type FactFilter = 'all' | 'known_fact' | 'uncertainty' | 'evidence_request';

type MessageFilter = 'all' | 'statement' | 'challenge' | 'reply' | 'evidence_request' | 'mine';

const navItems: Array<{ id: RoundtableSection; label: string; icon: typeof Home }> = [
  { id: 'workspace', label: '工作台', icon: Home },
  { id: 'roundtable', label: '圆桌会议', icon: Sparkles },
  { id: 'agents', label: '智能体', icon: Users },
  { id: 'knowledge', label: '知识库', icon: Library },
  { id: 'factpack', label: '实时包', icon: PackageSearch },
  { id: 'history', label: '历史记录', icon: History },
  { id: 'settings', label: '设置', icon: Settings },
];

function getInitialRoundtableSection(): RoundtableSection {
  if (typeof window === 'undefined') return 'roundtable';
  const section = new URLSearchParams(window.location.search).get('section');
  return navItems.some((item) => item.id === section) ? section as RoundtableSection : 'roundtable';
}

const darkFieldClass =
  'border-white/10 bg-[#0b131e] text-slate-100 placeholder:text-slate-500 focus-visible:border-violet-400 focus-visible:ring-violet-500/20';

const darkTextareaClass =
  'border-white/10 bg-[#0b131e] text-slate-100 placeholder:text-slate-500 focus-visible:border-violet-400 focus-visible:ring-violet-500/20';

const darkLabelClass = 'text-slate-200';

interface RuntimeApiResult {
  ok: boolean;
  output: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
  command?: string;
  durationMs?: number;
  promptPath?: string;
  outputPath?: string;
  actualRuntime?: 'codex_cli' | 'claude_code_cli';
  fallbackFrom?: string;
  fallbackReason?: string;
  error?: string;
}

interface RuntimeUiError {
  id: string;
  agentName: string;
  runtime: RoundtableAgentRuntime;
  message: string;
  command?: string;
}

interface RuntimeProgress {
  agentName: string;
  runtime: RoundtableAgentRuntime;
  index: number;
  total: number;
  phaseTitle: string;
}

function useRoundtableState() {
  const [state, setState] = useState<RoundtableState>(() => createEmptyRoundtableState());
  const [history, setHistory] = useState<RoundtableHistoryItem[]>([]);
  const [activeHistoryMeta, setActiveHistoryMeta] = useState<{ id?: string; source?: RoundtableHistorySource }>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      setHistory(parseRoundtableHistory(localStorage.getItem(ROUNDTABLE_HISTORY_STORAGE_KEY)));
      const params = new URLSearchParams(window.location.search);
      if (params.get('demo') === 'reference') {
        const reference = ensurePresetRoundtableAgents(createReferenceDemoState());
        setState(reference);
        localStorage.setItem(storageKey, JSON.stringify(reference));
        setLoaded(true);
        return;
      }
      if (params.get('demo') === 'complete') {
        const completed = ensurePresetRoundtableAgents(createCompletedDemoState());
        setState(completed);
        localStorage.setItem(storageKey, JSON.stringify(completed));
        setLoaded(true);
        return;
      }
      const raw = localStorage.getItem(storageKey);
      if (raw) setState(removeLegacyDemoFactEntries(ensurePresetRoundtableAgents(JSON.parse(raw) as RoundtableState)));
    } catch {
      setState(createEmptyRoundtableState());
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {}
  }, [loaded, state]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(ROUNDTABLE_HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {}
  }, [history, loaded]);

  useEffect(() => {
    if (!loaded || state.messages.length === 0) return;
    setHistory((prev) => upsertRoundtableHistory(prev, state, {
      id: activeHistoryMeta.id,
      source: activeHistoryMeta.source || 'local',
    }));
  }, [activeHistoryMeta.id, activeHistoryMeta.source, loaded, state]);

  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    fetch('/api/roundtable/history')
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { items?: RoundtableHistoryItem[] } | null) => {
        if (cancelled || !payload?.items?.length) return;
        setHistory((prev) => payload.items!.reduce((next, item) => upsertHistoryItem(next, item), prev));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loaded]);

  return { state, setState, history, setHistory, setActiveHistoryMeta };
}

function createCompletedDemoState() {
  let state = createEmptyRoundtableState();
  state = advanceRoundtable(state);
  state = advanceRoundtable(state);
  state = addFactEntry(state, {
    type: 'known_fact',
    content: '证据更新：已有头部产品 CAC 与 LTV 对比数据，需要进入下一轮评估。',
    source: '内部人工补充',
    status: 'verified',
    addedBy: 'demo',
    phaseId: 'round2',
  });
  for (let index = 0; index < ROUNDTABLE_PHASES.length && state.status !== 'complete'; index += 1) {
    state = advanceRoundtable(state);
  }
  return state;
}

function createReferenceDemoState() {
  let state = createEmptyRoundtableState();
  state = advanceRoundtable(state);
  state = advanceRoundtable(state);
  return {
    ...state,
    currentPhaseId: 'round2' as const,
    status: 'running' as const,
    finalOutput: null,
    pendingExtraRoundSuggestion: null,
  };
}

function compactTime(value: string) {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(value));
  } catch {
    return '';
  }
}

function phaseIndex(phaseId: RoundtableState['currentPhaseId']) {
  return Math.max(0, ROUNDTABLE_PHASES.findIndex((phase) => phase.id === phaseId));
}

function qualityScoreText(agent: RoundtableAgent): string {
  const scores = agent.qualityScores;
  if (!scores) return '未评分';
  const values = [scores.persona, scores.evidence, scores.intensity, scores.actionability]
    .filter((value): value is number => typeof value === 'number');
  if (!values.length) return '未评分';
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return `${Math.round(average * 100)} / 100`;
}

function Pill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex h-6 items-center rounded-md border px-2 text-[11px] font-medium', className)}>
      {children}
    </span>
  );
}

function DarkPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-xl border border-white/10 bg-[#101926]/88 shadow-[0_18px_50px_rgba(0,0,0,0.28)]', className)}>
      {children}
    </section>
  );
}

function SelectLike({
  value,
  onChange,
  children,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        'h-9 rounded-lg border border-white/10 bg-[#0b131e] px-3 text-xs text-slate-100 outline-none transition focus:border-violet-400/70',
        className,
      )}
    >
      {children}
    </select>
  );
}

function AvatarBadge({
  agent,
  active = false,
  size = 44,
}: {
  agent: RoundtableAgent;
  active?: boolean;
  size?: number;
}) {
  const avatar = agent.avatar.trim();
  const isImage =
    /^https?:\/\//i.test(avatar) ||
    avatar.startsWith('data:image/') ||
    avatar.startsWith('/') ||
    /\.(png|jpg|jpeg|webp|gif)$/i.test(avatar);

  return (
    <div
      className={cn(
        'relative shrink-0 rounded-full bg-[#182434] shadow-[0_0_0_1px_rgba(255,255,255,0.12)]',
        active && 'ring-2 ring-violet-400 ring-offset-2 ring-offset-[#101926]',
      )}
      style={{ width: size, height: size }}
    >
      {isImage ? (
        <img src={avatar} alt={agent.name} className="h-full w-full rounded-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-sky-500 text-sm font-semibold text-white">
          {avatar.slice(0, 2) || agent.name.slice(0, 1)}
        </div>
      )}
      {active && <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />}
    </div>
  );
}

function Sidebar({
  state,
  activeSection,
  onSectionChange,
  onSessionOpen,
}: {
  state: RoundtableState;
  activeSection: RoundtableSection;
  onSectionChange: (section: RoundtableSection) => void;
  onSessionOpen: () => void;
}) {
  const currentPhase = ROUNDTABLE_PHASES[phaseIndex(state.currentPhaseId)];
  const currentIndex = phaseIndex(state.currentPhaseId);

  return (
    <aside className="flex w-[236px] shrink-0 flex-col border-r border-white/10 bg-[#0a121d]">
      <div className="flex h-[60px] items-center gap-3 border-b border-white/10 px-4">
        <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-[#5b6cff] to-[#8b5cf6] shadow-[0_0_24px_rgba(139,92,246,0.35)]">
          <Brain className="size-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-base font-semibold text-white">圆桌智策</p>
            <span className="rounded-md bg-violet-500/25 px-2 py-0.5 text-[11px] text-violet-200">P0 试用版</span>
          </div>
        </div>
      </div>

      <nav className="space-y-1 px-2 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                'flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-slate-400 transition',
                activeSection === item.id
                  ? 'bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow-[0_12px_30px_rgba(124,58,237,0.25)]'
                  : 'hover:bg-white/5 hover:text-slate-100',
              )}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-4 px-3 pb-4">
        <div className="rounded-xl border border-violet-400/15 bg-gradient-to-b from-violet-500/14 to-[#101826] p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-100">当前会议</p>
            <button onClick={onSessionOpen} className="text-violet-300 hover:text-violet-100">
              <Edit3 className="size-3.5" />
            </button>
          </div>
          <div className="rounded-lg bg-white/5 p-2">
            <p className="line-clamp-1 text-xs text-slate-100">{state.topic || '未设置讨论主题'}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300">
                {statusLabels[state.status]}
              </span>
              <span className="text-[10px] text-slate-500">{currentPhase.shortTitle}</span>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-3 text-xs font-medium text-slate-300">轮次进度</p>
            <div className="space-y-3">
              {ROUNDTABLE_PHASES.map((phase, index) => {
                const done = index < currentIndex || state.status === 'complete';
                const active = index === currentIndex && state.status !== 'complete';
                return (
                  <div key={phase.id} className="grid grid-cols-[18px_1fr_18px] items-center gap-2 text-xs">
                    <span
                      className={cn(
                        'size-3 rounded-full border',
                        done ? 'border-emerald-400 bg-emerald-400/25' : active ? 'border-violet-400 bg-violet-500/40' : 'border-slate-600',
                      )}
                    />
                    <span className={cn('truncate', active ? 'text-white' : done ? 'text-slate-300' : 'text-slate-500')}>
                      第 {index + 1} 轮：{phase.shortTitle}
                    </span>
                    {done && <Check className="size-3.5 text-sky-300" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0d1722] p-3">
          <p className="mb-3 text-sm font-semibold text-slate-100">会议信息</p>
          <div className="space-y-3 text-xs leading-relaxed text-slate-400">
            <div>
              <p className="mb-1 text-slate-300">会议目标</p>
              <p>{state.objective || '未设置会议目标'}</p>
            </div>
            <div>
              <p className="mb-1 text-slate-300">讨论范围</p>
              <p>{state.background || '暂无背景材料'}</p>
            </div>
            <div className="border-t border-white/10 pt-3">
              <p className="mb-1 text-slate-300">创建时间</p>
              <p>2025-06-08 14:30</p>
            </div>
            <div>
              <p className="mb-1 text-slate-300">创建者</p>
              <p>Allan</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function TopBar({
  state,
  canAdvance,
  onReset,
  onClearDiscussion,
  onPauseToggle,
  onAdvance,
  onExport,
  onSessionOpen,
  onHome,
  onSettings,
  isAdvancing,
}: {
  state: RoundtableState;
  canAdvance: boolean;
  onReset: () => void;
  onClearDiscussion: () => void;
  onPauseToggle: () => void;
  onAdvance: () => void;
  onExport: () => void;
  onSessionOpen: () => void;
  onHome: () => void;
  onSettings: () => void;
  isAdvancing: boolean;
}) {
  const currentPhase = ROUNDTABLE_PHASES[phaseIndex(state.currentPhaseId)];
  const hasDiscussionRecord = state.messages.length > 0 ||
    state.evidenceTasks.length > 0 ||
    Boolean(state.finalOutput);

  return (
    <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-white/10 bg-[#080d14] px-5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button onClick={onHome} className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white" title="返回工作台">
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-semibold text-white">
              新会话：{state.topic || 'AI 原生产品的商业化策略讨论'}
            </h1>
            <button onClick={onSessionOpen} className="text-slate-400 hover:text-white">
              <Edit3 className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="mx-4 flex shrink-0 items-center gap-3">
        <div className="flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-[#111a26] px-4 text-xs">
          <span className="size-2 rounded-full bg-emerald-400" />
          <span className="font-medium text-emerald-300">{statusLabels[state.status]}</span>
          <span className="text-slate-500">第 {phaseIndex(state.currentPhaseId) + 1} 轮：</span>
          <span className="text-slate-300">{currentPhase.shortTitle}</span>
        </div>
        {state.pendingExtraRoundSuggestion && (
          <button
            onClick={() => onAdvance()}
            className="h-8 whitespace-nowrap rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 text-xs text-sky-200 hover:bg-sky-500/20"
          >
            确认追加轮
          </button>
        )}
        <button
          onClick={onPauseToggle}
          disabled={state.status === 'complete'}
          className="flex h-8 items-center gap-2 whitespace-nowrap rounded-lg border border-white/10 bg-[#111a26] px-4 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-45"
        >
          {state.status === 'paused' ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
          {state.status === 'paused' ? '继续' : '暂停'}
        </button>
        <button
          onClick={onAdvance}
          disabled={!canAdvance}
          className="flex h-9 items-center gap-2 whitespace-nowrap rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 px-5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(124,58,237,0.3)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <ArrowRight className="size-4" />
          {isAdvancing ? '生成中' : '下一轮'}
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <button onClick={onExport} className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white">
          <Download className="size-4" />
          导出
        </button>
        <button
          onClick={onClearDiscussion}
          disabled={!hasDiscussionRecord}
          className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          title="清空讨论记录，保留已导入 context 背景资料"
        >
          <Trash2 className="size-4" />
          清空讨论
        </button>
        <button onClick={onReset} className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white">
          <RefreshCcw className="size-4" />
          示例
        </button>
        <button onClick={onSettings} className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white">
          <Settings2 className="size-4" />
          设置
        </button>
        <img src="/roundtable/avatars/host-user.png" alt="用户头像" className="size-8 rounded-full object-cover ring-1 ring-white/20" />
      </div>
    </header>
  );
}

function ParticipantStrip({
  state,
  selectedAgents,
  onAgentOpen,
}: {
  state: RoundtableState;
  selectedAgents: RoundtableAgent[];
  onAgentOpen: () => void;
}) {
  const lastSpeakerId = state.messages[state.messages.length - 1]?.senderId;
  const visible = selectedAgents.slice(0, 4);

  return (
    <DarkPanel className="m-2 mb-2 rounded-b-xl p-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">参与智能体（{selectedAgents.length}）</h2>
        <div className="flex items-center gap-2">
          <button onClick={onAgentOpen} className="flex h-8 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-slate-300 hover:bg-white/5">
            <Settings2 className="size-3.5" />
            管理智能体
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(4,minmax(0,1fr))_246px] gap-4">
        {visible.map((agent) => {
          const speaking = agent.id === lastSpeakerId;
          return (
            <button
              key={agent.id}
              onClick={onAgentOpen}
              className={cn(
                'group h-[136px] rounded-lg border border-white/10 bg-white/[0.035] p-4 text-left transition hover:border-violet-400/35 hover:bg-white/[0.055]',
                speaking && 'border-violet-400/45 bg-violet-500/10',
              )}
            >
              <div className="flex gap-4">
                <AvatarBadge agent={agent} active={speaking} size={66} />
                <div className="min-w-0 flex-1 pt-1">
                  <p className="truncate text-sm font-semibold text-white">{agent.name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="truncate text-xs text-slate-300">{agent.roleLabel}</p>
                    <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
                      {runtimeLabels[agent.runtime]}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">{agent.roleDescription}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-emerald-300">
                <span className="size-2 rounded-full bg-emerald-400" />
                在线
              </div>
            </button>
          );
        })}
        <button
          onClick={onAgentOpen}
          className="flex h-[136px] flex-col items-center justify-center rounded-lg border border-dashed border-white/14 bg-white/[0.02] text-slate-500 transition hover:border-violet-400/35 hover:text-violet-200"
        >
          <Plus className="mb-3 size-8" />
          <span className="text-sm">添加智能体</span>
        </button>
      </div>
    </DarkPanel>
  );
}

function MessageBubble({
  message,
  agents,
  active,
  onReply,
  onMention,
}: {
  message: RoundtableMessage;
  agents: RoundtableAgent[];
  active: boolean;
  onReply: (message: RoundtableMessage) => void;
  onMention: (message: RoundtableMessage) => void;
}) {
  const sender = agents.find((agent) => agent.id === message.senderId);
  const targets = message.targetAgentIds
    .map((id) => agents.find((agent) => agent.id === id))
    .filter((agent): agent is RoundtableAgent => Boolean(agent));

  return (
    <article className={cn('group border-b border-white/8 px-3 py-3 last:border-b-0', active && 'rounded-lg bg-violet-500/[0.035]')}>
      <div className="grid grid-cols-[40px_1fr] gap-3">
        {sender ? <AvatarBadge agent={sender} active={active} size={38} /> : <div className="size-[38px] rounded-full bg-slate-700" />}
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-white">{message.senderName}</span>
            <span className="text-xs text-slate-500">{compactTime(message.createdAt)}</span>
            <Pill className={interactionTone[message.interactionType]}>{interactionLabels[message.interactionType]}</Pill>
            {targets.length > 0 && (
              <span className="text-xs font-medium text-rose-300">
                → @{targets.map((agent) => agent.name).join('、')}
              </span>
            )}
          </div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">{message.content}</p>
          <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><CheckCircle2 className="size-3.5" /> 12</span>
            <button onClick={() => onReply(message)} className="flex items-center gap-1 hover:text-slate-300"><MessageCircle className="size-3.5" /> 回复</button>
            <button onClick={() => onMention(message)} className="flex items-center gap-1 hover:text-slate-300"><AtSign className="size-3.5" /> 提及</button>
          </div>
        </div>
      </div>
    </article>
  );
}

function DiscussionPanel({
  state,
  selectedAgents,
  interjection,
  setInterjection,
  onSendInterjection,
  onRequestEvidence,
  onAskAgent,
  onReplyMessage,
  onMentionMessage,
  isAdvancing,
  runtimeProgress,
}: {
  state: RoundtableState;
  selectedAgents: RoundtableAgent[];
  interjection: string;
  setInterjection: (value: string) => void;
  onSendInterjection: () => void;
  onRequestEvidence: () => void;
  onAskAgent: () => void;
  onReplyMessage: (message: RoundtableMessage) => void;
  onMentionMessage: (message: RoundtableMessage) => void;
  isAdvancing: boolean;
  runtimeProgress: RuntimeProgress | null;
}) {
  const lastMessageId = state.messages[state.messages.length - 1]?.id;
  const [messageFilter, setMessageFilter] = useState<MessageFilter>('all');
  const messageFilterItems: Array<{ id: MessageFilter; label: string }> = [
    { id: 'all', label: '全部' },
    { id: 'statement', label: '观点' },
    { id: 'challenge', label: '挑战' },
    { id: 'reply', label: '回应' },
    { id: 'evidence_request', label: '证据请求' },
    { id: 'mine', label: '只看我的' },
  ];
  const visibleMessages = state.messages.filter((message) => {
    if (messageFilter === 'all') return true;
    if (messageFilter === 'mine') return message.senderId === 'human';
    return message.interactionType === messageFilter;
  });

  return (
    <DarkPanel className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex h-[50px] shrink-0 items-center justify-between border-b border-white/10 px-5">
        <div className="flex items-center gap-4">
          <h2 className="text-base font-semibold text-white">讨论区</h2>
          <div className="flex items-center gap-2">
            {messageFilterItems.slice(0, 5).map((item) => (
              <button
                key={item.id}
                onClick={() => setMessageFilter(item.id)}
                className={cn(
                  'h-7 rounded-lg border px-3 text-xs transition',
                  messageFilter === item.id ? 'border-violet-400/40 bg-violet-500/15 text-violet-200' : 'border-white/10 text-slate-500 hover:text-slate-200',
                )}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => setMessageFilter('mine')}
              className={cn(
                'h-7 rounded-lg border px-3 text-xs transition',
                messageFilter === 'mine' ? 'border-violet-400/40 bg-violet-500/15 text-violet-200' : 'border-white/10 text-slate-400 hover:text-slate-200',
              )}
            >
              只看我的
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-slate-500">
          <SlidersHorizontal className="size-4" />
          <MessageCircle className="size-4" />
        </div>
      </div>

      {isAdvancing && (
        <div className="shrink-0 space-y-2 border-b border-white/10 px-5 py-3">
          <div className="flex items-center gap-2 rounded-lg border border-violet-400/25 bg-violet-500/10 px-3 py-2 text-xs text-violet-100">
            <Sparkles className="size-3.5 animate-pulse" />
            {runtimeProgress
              ? `正在生成 ${runtimeProgress.phaseTitle}：${runtimeProgress.agentName}（${runtimeLabels[runtimeProgress.runtime]}，${runtimeProgress.index}/${runtimeProgress.total}）。CEO 最长等待 90 秒，后台补证 45 秒。`
              : '正在调用本地 Codex / Claude CLI 生成本轮发言，请稍候...'}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {state.messages.length === 0 ? (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-white/10 text-center">
            <Sparkles className="mb-3 size-9 text-violet-300" />
            <p className="text-sm font-semibold text-white">点击“下一轮”开始圆桌讨论</p>
            <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-500">
              系统会按初始观点、相互挑战、观点修正、收敛总结四个阶段生成公开群聊记录。
            </p>
          </div>
        ) : visibleMessages.length === 0 ? (
          <div className="flex h-full min-h-[240px] items-center justify-center rounded-lg border border-dashed border-white/10 text-sm text-slate-500">
            当前筛选下没有发言。
          </div>
        ) : (
          visibleMessages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              agents={selectedAgents}
              active={message.id === lastMessageId}
              onReply={onReplyMessage}
              onMention={onMentionMessage}
            />
          ))
        )}
      </div>

      <div className="shrink-0 border-t border-white/10 p-4">
        <div className="grid h-12 grid-cols-[1fr_40px] items-center gap-2 rounded-lg border border-white/12 bg-[#0a121d] px-4">
          <input
            value={interjection}
            onChange={(event) => setInterjection(event.target.value)}
            placeholder="输入消息...（支持 @ 提及智能体）"
            className="h-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                onSendInterjection();
              }
            }}
          />
          <button
            onClick={onSendInterjection}
            disabled={!interjection.trim()}
            className="flex size-9 items-center justify-center rounded-lg bg-violet-600 text-white transition hover:bg-violet-500 disabled:opacity-45"
          >
            <Send className="size-4" />
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3 pl-1 text-xs text-slate-500">
          <button onClick={onSendInterjection} className="hover:text-slate-200">插话</button>
          <button onClick={onRequestEvidence} className="hover:text-slate-200">要求补证据</button>
          <button onClick={onAskAgent} className="hover:text-slate-200">指定回应</button>
        </div>
      </div>
    </DarkPanel>
  );
}

function FactPackPanel({
  state,
  onAddFactOpen,
  onViewAll,
  onDeleteFact,
  onClearFactPack,
}: {
  state: RoundtableState;
  onAddFactOpen: () => void;
  onViewAll: () => void;
  onDeleteFact: (id: string) => void;
  onClearFactPack: () => void;
}) {
  const [factFilter, setFactFilter] = useState<FactFilter>('all');
  const factFilterItems: Array<{ id: FactFilter; label: string }> = [
    { id: 'all', label: '全部' },
    { id: 'known_fact', label: '事实' },
    { id: 'uncertainty', label: '不确定性' },
    { id: 'evidence_request', label: '证据请求' },
  ];
  const filteredEntries = state.factPack.filter((entry) => factFilter === 'all' || entry.type === factFilter);
  const entries = filteredEntries.slice(-6).reverse();
  const evidenceTasks = (state.evidenceTasks || []).slice(-4).reverse();
  const pendingEvidenceCount = evidenceTasks.filter((task) => task.status === 'queued' || task.status === 'researching').length;

  return (
    <DarkPanel className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex h-[50px] shrink-0 items-center justify-between border-b border-white/10 px-5">
        <h2 className="text-base font-semibold text-white">
          事实包（{state.factPack.length}）
          {pendingEvidenceCount > 0 ? <span className="ml-2 text-xs font-medium text-amber-200">待补证 {pendingEvidenceCount}</span> : null}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onClearFactPack}
            disabled={state.factPack.length === 0}
            className="flex h-8 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-slate-400 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="size-3.5" />
            清空
          </button>
          <button onClick={onAddFactOpen} className="flex h-8 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-slate-300 hover:bg-white/5">
            <Plus className="size-3.5" />
            添加事实
          </button>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-5 border-b border-white/8 px-5 py-3 text-xs">
        {factFilterItems.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFactFilter(tab.id)}
            className={cn(factFilter === tab.id ? 'text-violet-300' : 'text-slate-500 hover:text-slate-300')}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-2">
          {evidenceTasks.length > 0 ? (
            <div className="mb-3 space-y-2">
              <p className="px-1 text-[11px] font-medium text-slate-400">证据任务</p>
              {evidenceTasks.map((task) => <EvidenceTaskCard key={task.id} task={task} agents={state.agents} />)}
            </div>
          ) : null}
          {entries.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
              暂无事实包条目
            </div>
          ) : entries.map((entry) => <FactEntryCard key={entry.id} entry={entry} onDelete={onDeleteFact} />)}
        </div>
      </div>
      <button onClick={onViewAll} className="h-9 shrink-0 border-t border-white/10 text-xs font-medium text-violet-300 hover:bg-white/[0.03]">
        查看全部
      </button>
    </DarkPanel>
  );
}

function RelationGraph({ state, selectedAgents }: { state: RoundtableState; selectedAgents: RoundtableAgent[] }) {
  const edges = getInteractionEdges(state.messages).slice(-8);
  const graphAgents = selectedAgents.slice(0, 4);
  const lastSpeakerId = state.messages[state.messages.length - 1]?.senderId;
  const positions = [
    { x: 50, y: 54 },
    { x: 160, y: 22 },
    { x: 274, y: 56 },
    { x: 162, y: 132 },
  ];

  const fallbackEdges = graphAgents.length >= 4 ? [
    { id: 'fallback-1', sourceAgentId: graphAgents[1].id, targetAgentId: graphAgents[0].id, type: 'challenge' as InteractionType },
    { id: 'fallback-2', sourceAgentId: graphAgents[0].id, targetAgentId: graphAgents[3].id, type: 'reply' as InteractionType },
    { id: 'fallback-3', sourceAgentId: graphAgents[3].id, targetAgentId: graphAgents[2].id, type: 'evidence_request' as InteractionType },
  ] : [];
  const visibleEdges = edges.length > 0 ? edges : fallbackEdges;

  const colorFor = (type: InteractionType) => {
    if (type === 'challenge') return '#fb7185';
    if (type === 'reply') return '#4ade80';
    if (type === 'evidence_request') return '#f59e0b';
    if (type === 'mention') return '#60a5fa';
    return '#60a5fa';
  };

  return (
    <DarkPanel className="h-full min-h-0 overflow-hidden p-5">
      <h2 className="mb-2 text-base font-semibold text-white">关系图谱</h2>
      <div className="relative mx-auto h-[168px] max-w-[344px]">
        <svg className="absolute inset-0 size-full" viewBox="0 0 324 168">
          {visibleEdges.map((edge) => {
            const sourceIndex = graphAgents.findIndex((agent) => agent.id === edge.sourceAgentId);
            const targetIndex = graphAgents.findIndex((agent) => agent.id === edge.targetAgentId);
            if (sourceIndex < 0 || targetIndex < 0) return null;
            const from = positions[sourceIndex];
            const to = positions[targetIndex];
            return (
              <g key={edge.id}>
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={colorFor(edge.type)}
                  strokeWidth="2"
                  strokeDasharray={edge.type === 'mention' ? '4 4' : undefined}
                  opacity="0.92"
                />
                <circle cx={to.x} cy={to.y} r="3" fill={colorFor(edge.type)} />
              </g>
            );
          })}
        </svg>
        {graphAgents.map((agent, index) => {
          const point = positions[index] || positions[0];
          return (
            <div
              key={agent.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: point.x, top: point.y }}
            >
              <AvatarBadge agent={agent} active={agent.id === lastSpeakerId || (!lastSpeakerId && index === 1)} size={52} />
            </div>
          );
        })}
        <span className="absolute left-[92px] top-1 text-xs font-medium text-rose-300">挑战</span>
        <span className="absolute right-[24px] top-[44px] text-xs font-medium text-sky-300">回应</span>
        <span className="absolute bottom-[22px] right-[22px] text-xs font-medium text-amber-300">证据请求</span>
        <span className="absolute bottom-[20px] left-[70px] text-xs font-medium text-emerald-300">回应</span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 rounded-lg border border-white/10 bg-[#0a121d] px-3 py-2 text-[11px] text-slate-400">
        <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-sky-400" /> 提及</span>
        <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-rose-400" /> 挑战</span>
        <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-emerald-400" /> 回应</span>
        <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-amber-400" /> 证据请求</span>
      </div>
    </DarkPanel>
  );
}

function MiniListCard({
  icon,
  title,
  items,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0d1622] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className={cn('flex size-5 items-center justify-center rounded-full', tone)}>{icon}</span>
        <p className="text-sm font-semibold text-slate-100">{title}</p>
      </div>
      <ul className="space-y-1.5 text-xs leading-relaxed text-slate-400">
        {items.slice(0, 3).map((item) => <li key={item}>• {item}</li>)}
      </ul>
    </div>
  );
}

function FinalOutputPanel({ state }: { state: RoundtableState }) {
  const output = state.finalOutput;
  const firstIdea = output?.ideas[0];

  const cards = [
    {
      title: '各观点支持理由',
      icon: <CheckCircle2 className="size-3.5" />,
      tone: 'bg-emerald-500/20 text-emerald-300',
      items: firstIdea?.supportingReasons || ['技术壁垒高，构建护城河', '网络效应带来规模化优势', '市场需求增长快速'],
    },
    {
      title: '反对意见',
      icon: <XCircle className="size-3.5" />,
      tone: 'bg-rose-500/20 text-rose-300',
      items: firstIdea?.objections || ['竞争激烈，获客成本高', '差异化价值主张不明确', '用户付费意愿不确定'],
    },
    {
      title: '关键风险',
      icon: <AlertTriangle className="size-3.5" />,
      tone: 'bg-amber-500/20 text-amber-300',
      items: firstIdea?.keyRisks || ['市场进入壁垒可能被快速复制', '商业模式可持续性风险', '政策与数据安全风险'],
    },
    {
      title: '共识',
      icon: <CheckCircle2 className="size-3.5" />,
      tone: 'bg-emerald-500/20 text-emerald-300',
      items: output?.consensus || ['聚焦高价值用户群体', '构建差异化的核心价值', '需要验证真实需求'],
    },
    {
      title: '分歧点',
      icon: <HelpCircle className="size-3.5" />,
      tone: 'bg-sky-500/20 text-sky-300',
      items: output?.disagreements || ['产品切入点选择', '商业模式优先级', '资源投入时机'],
    },
    {
      title: '待验证问题',
      icon: <ShieldQuestion className="size-3.5" />,
      tone: 'bg-slate-500/20 text-slate-300',
      items: output?.openQuestions || ['目标用户付费意愿', 'CAC 与 LTV 比例', '竞争对手应对策略'],
    },
  ];

  return (
    <DarkPanel className="h-full min-h-0 overflow-hidden p-5">
      <h2 className="mb-4 text-base font-semibold text-white">
        最终输出
        <span className="ml-2 text-xs font-normal text-slate-500">
          {output ? '已生成' : '将在第 4 轮生成'}
        </span>
      </h2>
      <div className="grid grid-cols-6 gap-3">
        {cards.map((card) => (
          <MiniListCard key={card.title} {...card} />
        ))}
      </div>
    </DarkPanel>
  );
}

function AgentManagerDialog({
  open,
  onOpenChange,
  state,
  setState,
  selectedAgentId,
  setSelectedAgentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: RoundtableState;
  setState: React.Dispatch<React.SetStateAction<RoundtableState>>;
  selectedAgentId: string;
  setSelectedAgentId: (id: string) => void;
}) {
  const agent = state.agents.find((item) => item.id === selectedAgentId) || state.agents[0];
  const selectedParticipantCount = state.agents.filter((item) => item.enabled && state.selectedAgentIds.includes(item.id)).length;
  const isCurrentParticipant = Boolean(agent && agent.enabled && state.selectedAgentIds.includes(agent.id));

  const updateSelected = (updates: Partial<RoundtableAgent>) => {
    if (!agent) return;
    setState((prev) => updateAgent(prev, agent.id, updates));
  };

  const setCurrentParticipation = (participating: boolean) => {
    if (!agent) return;
    setState((prev) => ({
      ...updateAgent(prev, agent.id, { enabled: participating }),
      selectedAgentIds: participating
        ? Array.from(new Set([...prev.selectedAgentIds, agent.id]))
        : prev.selectedAgentIds.filter((id) => id !== agent.id),
    }));
  };

  const importFileAsText = (file: File | undefined) => {
    if (!file || !agent) return;
    const reader = new FileReader();
    reader.onload = () => updateSelected({ skillContent: String(reader.result || '') });
    reader.readAsText(file);
  };

  const importAvatar = (file: File | undefined) => {
    if (!file || !agent) return;
    const reader = new FileReader();
    reader.onload = () => updateSelected({ avatar: String(reader.result || '') });
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="h-[min(840px,calc(100vh-48px))] max-w-[min(1180px,calc(100vw-48px))] overflow-hidden border-white/10 bg-[#101824] p-0 text-slate-100"
        variant="default"
      >
        <DialogHeader className="shrink-0 px-6 pt-6">
          <DialogTitle>Agent Registry · 管理智能体</DialogTitle>
          <DialogDescription>左侧选择 Agent，右侧用“加入当前讨论 / 移出当前讨论”决定是否进入当前圆桌；后台研究 Agent 仍按证据任务被调用。</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)] gap-5 px-6 pb-4">
          <div className="min-h-0 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-[#0b131e] p-3">
            {state.agents.map((item) => {
              const selected = item.id === agent?.id;
              const active = state.selectedAgentIds.includes(item.id) && item.enabled;
              const mode = getAgentSkillMode(item);
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedAgentId(item.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left',
                    selected ? 'border-violet-400/40 bg-violet-500/15' : 'border-white/8 bg-white/[0.02] hover:bg-white/[0.05]',
                  )}
                >
                  <AvatarBadge agent={item} active={selected} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{item.name}</p>
                    <p className="truncate text-xs text-slate-500">{item.roleLabel} · {runtimeLabels[item.runtime]}</p>
                    <Pill className={cn('mt-1', skillModeTone[mode])}>{skillModeLabels[mode]}</Pill>
                  </div>
                  <span className={cn('size-2 rounded-full', active ? 'bg-emerald-400' : 'bg-slate-600')} />
                </button>
              );
            })}
            <Button
              size="sm"
              className="mt-2 w-full"
              onClick={() => setState((prev) => {
                const next = addAgent(prev, { name: `新智能体 ${prev.agents.length + 1}` });
                setSelectedAgentId(next.agents[next.agents.length - 1].id);
                return next;
              })}
            >
              <UserPlus className="size-4" />
              新建智能体
            </Button>
          </div>

          {agent && (
            <div className="grid min-h-0 grid-cols-2 gap-4 overflow-y-auto pr-1">
              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_96px] gap-3">
                  <div className="space-y-1.5">
                    <Label className={darkLabelClass}>姓名</Label>
                    <Input className={darkFieldClass} value={agent.name} onChange={(event) => updateSelected({ name: event.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className={darkLabelClass}>头像</Label>
                    <Input className={darkFieldClass} value={agent.avatar} onChange={(event) => updateSelected({ avatar: event.target.value })} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 text-xs hover:bg-white/5">
                    <Upload className="size-3.5" />
                    上传头像
                    <input className="hidden" type="file" accept="image/*" onChange={(event) => importAvatar(event.target.files?.[0])} />
                  </label>
                  <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 text-xs hover:bg-white/5">
                    <Upload className="size-3.5" />
                    导入 SKILL.md
                    <input className="hidden" type="file" accept=".md,text/markdown,text/plain" onChange={(event) => importFileAsText(event.target.files?.[0])} />
                  </label>
                </div>
                <div className="space-y-1.5">
                  <Label className={darkLabelClass}>运行时</Label>
                  <SelectLike value={agent.runtime} onChange={(value) => updateSelected({ runtime: value as RoundtableAgentRuntime })} className="w-full">
                    <option value="demo">Demo 确定性</option>
                    <option value="codex_cli">Codex CLI</option>
                    <option value="claude_code_cli">Claude Code CLI</option>
                  </SelectLike>
                  <p className="text-xs text-slate-500">
                    选择 Codex / Claude 时，“下一轮”会调用本地 CLI；失败会显示错误，不会自动回退 demo。
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-white/10 bg-[#0b131e] p-3">
                  <div className="space-y-1.5">
                    <Label className={darkLabelClass}>Skill 状态</Label>
                    <Pill className={skillModeTone[getAgentSkillMode(agent)]}>{skillModeLabels[getAgentSkillMode(agent)]}</Pill>
                  </div>
                  <div className="space-y-1.5">
                    <Label className={darkLabelClass}>质量分</Label>
                    <p className="text-sm font-semibold text-white">{qualityScoreText(agent)}</p>
                  </div>
                  <div className="col-span-2 text-xs leading-relaxed text-slate-400">
                    {isBackgroundOnlyAgent(agent)
                      ? '后台研究 Agent 默认不参与台前讨论，只有被调用时补充事实。'
                      : getAgentSkillMode(agent) === 'legacy_prompt'
                        ? 'Legacy Prompt 模式会把 Skill 内容注入上下文，不能作为 verified role agent 验收。'
                        : 'Role Agent 模式只传任务、事实包和公开记录；Skill 由运行环境加载。'}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className={darkLabelClass}>角色标签</Label>
                  <Input className={darkFieldClass} value={agent.roleLabel} onChange={(event) => updateSelected({ roleLabel: event.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className={darkLabelClass}>角色描述</Label>
                  <Textarea value={agent.roleDescription} onChange={(event) => updateSelected({ roleDescription: event.target.value })} className={cn('min-h-24', darkTextareaClass)} />
                </div>
                <div className="space-y-1.5">
                  <Label className={darkLabelClass}>会议职责</Label>
                  <Textarea value={agent.responsibility} onChange={(event) => updateSelected({ responsibility: event.target.value })} className={cn('min-h-24', darkTextareaClass)} />
                </div>
              </div>
              <div className="space-y-3">
                <div className="rounded-lg border border-white/10 bg-[#0b131e] p-3">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">当前参会状态</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        {isCurrentParticipant
                          ? '已加入当前圆桌，会在下一轮进入台前讨论。'
                          : isBackgroundOnlyAgent(agent)
                            ? '当前保留为后台研究 Agent，只有被证据任务调用时补充事实。'
                            : '当前未加入圆桌，不会在下一轮台前发言。'}
                      </p>
                    </div>
                    <Pill className={isCurrentParticipant ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200' : 'border-slate-500/35 bg-slate-500/10 text-slate-300'}>
                      {isCurrentParticipant ? '参会中' : '未参会'}
                    </Pill>
                  </div>
                  {isCurrentParticipant ? (
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setCurrentParticipation(false)}>
                      <XCircle className="size-4" />
                      移出当前讨论
                    </Button>
                  ) : (
                    <Button size="sm" className="w-full" onClick={() => setCurrentParticipation(true)}>
                      <UserPlus className="size-4" />
                      加入当前讨论
                    </Button>
                  )}
                </div>
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0b131e] px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Agent 记录状态</p>
                    <p className="text-xs text-slate-500">删除会从 Agent Registry 中移除该智能体。</p>
                  </div>
                  <span className={cn('size-2 rounded-full', agent.enabled ? 'bg-emerald-400' : 'bg-slate-600')} />
                </div>
                <div className="space-y-1.5">
                  <Label className={darkLabelClass}>Skill 内容</Label>
                  <Textarea value={agent.skillContent} onChange={(event) => updateSelected({ skillContent: event.target.value })} className={cn('min-h-[360px] font-mono text-xs', darkTextareaClass)} />
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" size="sm" onClick={() => {
                    const prompt = renderAgentPrompt(buildAgentGenerationContext(state, agent.id));
                    void navigator.clipboard?.writeText(prompt);
                  }}>
                    复制上下文预览
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={state.agents.length <= 1}
                    onClick={() => setState((prev) => {
                      const next = deleteAgent(prev, agent.id);
                      setSelectedAgentId(next.agents[0]?.id || '');
                      return next;
                    })}
                  >
                    <Trash2 className="size-4" />
                    删除
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="sticky bottom-0 z-10 flex shrink-0 items-center justify-between border-t border-white/10 bg-[#101824]/95 px-6 py-4 backdrop-blur">
          <p className="text-xs leading-relaxed text-slate-500">
            当前参会智能体 {selectedParticipantCount} 个。更改会立即保存到本次圆桌。
          </p>
          <Button onClick={() => onOpenChange(false)}>
            <Check className="size-4" />
            完成
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SessionDialog({
  open,
  onOpenChange,
  state,
  setState,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: RoundtableState;
  setState: React.Dispatch<React.SetStateAction<RoundtableState>>;
}) {
  const importBackground = (file: File | undefined) => {
    if (!file) return;
    if (!isSupportedContextMaterialFilename(file.name)) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '').trim();
      if (!text) return;
      setState((prev) => applyContextMaterialToRoundtable(prev, {
        title: file.name,
        source: `local-file/${file.name}`,
        content: text,
      }));
    };
    reader.readAsText(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border-white/10 bg-[#101824] text-slate-100">
        <DialogHeader>
          <DialogTitle>会话设置</DialogTitle>
          <DialogDescription>设置讨论主题、会议目标、背景材料和搜索范围。</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className={darkLabelClass}>讨论主题</Label>
            <Input className={darkFieldClass} value={state.topic} onChange={(event) => setState((prev) => ({ ...prev, topic: event.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className={darkLabelClass}>会议目标</Label>
            <Textarea value={state.objective} onChange={(event) => setState((prev) => ({ ...prev, objective: event.target.value }))} className={cn('min-h-20', darkTextareaClass)} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className={darkLabelClass}>背景材料 / pasted context</Label>
              <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 text-xs hover:bg-white/5">
                <Upload className="size-3.5" />
                导入资料
                <input className="hidden" type="file" accept=".md,.markdown,.txt,.json,.jsonl,.csv,text/markdown,text/plain,application/json,text/csv" onChange={(event) => importBackground(event.target.files?.[0])} />
              </label>
            </div>
            <Textarea value={state.background} onChange={(event) => setState((prev) => ({ ...prev, background: event.target.value }))} className={cn('min-h-28', darkTextareaClass)} />
          </div>
          <div className="space-y-1.5">
            <Label className={darkLabelClass}>搜索范围</Label>
            <Input className={darkFieldClass} value={state.searchScope} onChange={(event) => setState((prev) => ({ ...prev, searchScope: event.target.value }))} />
          </div>
          <div className="rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
            联网搜索暂未接入；P0 不会伪造搜索结果。请将已验证来源手动加入事实包。
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FactEntryDialog({
  open,
  onOpenChange,
  state,
  setState,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: RoundtableState;
  setState: React.Dispatch<React.SetStateAction<RoundtableState>>;
}) {
  const [type, setType] = useState<FactEntryType>('known_fact');
  const [status, setStatus] = useState<FactEntryStatus>('verified');
  const [content, setContent] = useState('');
  const [source, setSource] = useState('');

  const addEntry = () => {
    if (!content.trim()) return;
    setState((prev) => addFactEntry(prev, {
      type,
      status,
      content,
      source,
      addedBy: 'human',
      phaseId: prev.currentPhaseId,
    }));
    setContent('');
    setSource('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-white/10 bg-[#101824] text-slate-100">
        <DialogHeader>
          <DialogTitle>添加事实包条目</DialogTitle>
          <DialogDescription>无来源内容会被视为未验证、假设或需要证据。</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={darkLabelClass}>类型</Label>
              <SelectLike value={type} onChange={(value) => setType(value as FactEntryType)}>
                {Object.entries(factTypeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </SelectLike>
            </div>
            <div className="space-y-1.5">
              <Label className={darkLabelClass}>状态</Label>
              <SelectLike value={status} onChange={(value) => setStatus(value as FactEntryStatus)}>
                {Object.entries(factStatusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </SelectLike>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className={darkLabelClass}>内容</Label>
            <Textarea value={content} onChange={(event) => setContent(event.target.value)} className={cn('min-h-28', darkTextareaClass)} />
          </div>
          <div className="space-y-1.5">
            <Label className={darkLabelClass}>来源</Label>
            <Input className={darkFieldClass} value={source} onChange={(event) => setSource(event.target.value)} placeholder="可为空；为空时不要标记为已验证" />
          </div>
          <Button onClick={addEntry} disabled={!content.trim()}>
            <Plus className="size-4" />
            添加
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResponseDialog({
  open,
  onOpenChange,
  state,
  responseAgentId,
  setResponseAgentId,
  targetAgentId,
  setTargetAgentId,
  responseInstruction,
  setResponseInstruction,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: RoundtableState;
  responseAgentId: string;
  setResponseAgentId: (id: string) => void;
  targetAgentId: string;
  setTargetAgentId: (id: string) => void;
  responseInstruction: string;
  setResponseInstruction: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-white/10 bg-[#101824] text-slate-100">
        <DialogHeader>
          <DialogTitle>指定智能体回应</DialogTitle>
          <DialogDescription>选择发言者、回应对象和本轮追问指令。</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={darkLabelClass}>发言智能体</Label>
              <SelectLike value={responseAgentId} onChange={setResponseAgentId} className="w-full">
                {state.agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
              </SelectLike>
            </div>
            <div className="space-y-1.5">
              <Label className={darkLabelClass}>回应对象</Label>
              <SelectLike value={targetAgentId} onChange={setTargetAgentId} className="w-full">
                <option value="">无目标</option>
                {state.agents.filter((agent) => agent.id !== responseAgentId).map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
              </SelectLike>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className={darkLabelClass}>回应指令</Label>
            <Textarea
              value={responseInstruction}
              onChange={(event) => setResponseInstruction(event.target.value)}
              placeholder="例如：请回应上一条挑战，必须指出一个可验证指标。"
              className={cn('min-h-28', darkTextareaClass)}
            />
          </div>
          <Button onClick={() => {
            onSubmit();
            onOpenChange(false);
          }}>
            <Send className="size-4" />
            生成回应
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FactEntryCard({
  entry,
  onDelete,
}: {
  entry: RoundtableState['factPack'][number];
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-white/8 bg-[#0d1622] px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Pill className={factStatusTone[entry.status]}>{factStatusLabels[entry.status]}</Pill>
          <span className="text-xs text-slate-300">{factTypeLabels[entry.type]}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-600">{compactTime(entry.createdAt)}</span>
          {onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(entry.id)}
              className="rounded-md p-1 text-slate-500 hover:bg-white/5 hover:text-rose-200"
              aria-label="删除事实包条目"
              title="删除事实包条目"
            >
              <Trash2 className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>
      <p className="text-xs leading-relaxed text-slate-300">{entry.content}</p>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">来源：{entry.source || '未提供来源'}</p>
    </div>
  );
}

function EvidenceTaskCard({
  task,
  agents,
}: {
  task: RoundtableState['evidenceTasks'][number];
  agents: RoundtableAgent[];
}) {
  const assignedNames = task.assignedAgentIds
    .map((id) => agents.find((agent) => agent.id === id)?.name || id)
    .join('、');
  return (
    <div className="rounded-lg border border-white/8 bg-[#0d1622] px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Pill className={evidenceTaskStatusTone[task.status]}>{evidenceTaskStatusLabels[task.status]}</Pill>
          <span className="min-w-0 truncate text-xs text-slate-300">{task.requestedByAgentName}</span>
        </div>
        <span className="shrink-0 text-[11px] text-slate-400">{compactTime(task.updatedAt)}</span>
      </div>
      <p className="text-xs leading-relaxed text-slate-300">{task.request}</p>
      {task.resultSummary ? (
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{task.resultSummary}</p>
      ) : (
        <p className="mt-2 text-[11px] leading-relaxed text-amber-200/75">等待后台证据任务处理。</p>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        分配后台：{assignedNames || '未分配'}；P0 当前为任务登记/分类，不代表已完成联网研究。
      </p>
    </div>
  );
}

function WorkspaceSection({
  state,
  selectedAgents,
  onSectionChange,
  onAdvance,
  onAgentOpen,
  onFactOpen,
  onSessionOpen,
  canAdvance,
}: {
  state: RoundtableState;
  selectedAgents: RoundtableAgent[];
  onSectionChange: (section: RoundtableSection) => void;
  onAdvance: () => void;
  onAgentOpen: () => void;
  onFactOpen: () => void;
  onSessionOpen: () => void;
  canAdvance: boolean;
}) {
  const latestMessage = state.messages.at(-1);
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px] gap-3 p-4">
      <DarkPanel className="p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-violet-200">当前工作台</p>
            <h2 className="mt-1 text-xl font-semibold text-white">{state.topic || '未设置讨论主题'}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">{state.objective || '先设置会议目标，再开始讨论。'}</p>
          </div>
          <Button onClick={onAdvance} disabled={!canAdvance}>
            <ArrowRight className="size-4" />
            下一轮
          </Button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[
            ['参会智能体', selectedAgents.length, 'agents'],
            ['事实包条目', state.factPack.length, 'factpack'],
            ['讨论发言', state.messages.length, 'history'],
            ['当前轮次', phaseIndex(state.currentPhaseId) + 1, 'roundtable'],
          ].map(([label, value, section]) => (
            <button
              key={String(label)}
              onClick={() => onSectionChange(section as RoundtableSection)}
              className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-left hover:border-violet-400/35 hover:bg-white/[0.055]"
            >
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
            </button>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <button onClick={onSessionOpen} className="rounded-lg border border-white/10 bg-[#0b131e] p-4 text-left hover:bg-white/[0.04]">
            <Edit3 className="mb-3 size-4 text-violet-300" />
            <p className="text-sm font-semibold text-white">编辑会话</p>
            <p className="mt-1 text-xs text-slate-500">主题、目标、背景材料和搜索范围。</p>
          </button>
          <button onClick={onAgentOpen} className="rounded-lg border border-white/10 bg-[#0b131e] p-4 text-left hover:bg-white/[0.04]">
            <Users className="mb-3 size-4 text-sky-300" />
            <p className="text-sm font-semibold text-white">管理智能体</p>
            <p className="mt-1 text-xs text-slate-500">启停角色、查看 Skill、切换运行时。</p>
          </button>
          <button onClick={onFactOpen} className="rounded-lg border border-white/10 bg-[#0b131e] p-4 text-left hover:bg-white/[0.04]">
            <PackageSearch className="mb-3 size-4 text-emerald-300" />
            <p className="text-sm font-semibold text-white">添加事实</p>
            <p className="mt-1 text-xs text-slate-500">把来源、假设和证据请求放进事实包。</p>
          </button>
        </div>
      </DarkPanel>
      <DarkPanel className="p-5">
        <h2 className="text-base font-semibold text-white">最新状态</h2>
        <div className="mt-4 space-y-3 text-sm">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs text-slate-500">会议状态</p>
            <p className="mt-1 text-slate-200">{statusLabels[state.status]} · {ROUNDTABLE_PHASES[phaseIndex(state.currentPhaseId)].title}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs text-slate-500">最新发言</p>
            <p className="mt-1 line-clamp-5 text-xs leading-relaxed text-slate-300">
              {latestMessage ? `${latestMessage.senderName}：${latestMessage.content}` : '尚未开始讨论。'}
            </p>
          </div>
          <button onClick={() => onSectionChange('roundtable')} className="w-full rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-100 hover:bg-violet-500/20">
            进入圆桌会议
          </button>
        </div>
      </DarkPanel>
    </div>
  );
}

function AgentsSection({ state, selectedAgents, onAgentOpen }: { state: RoundtableState; selectedAgents: RoundtableAgent[]; onAgentOpen: () => void }) {
  const selected = new Set(selectedAgents.map((agent) => agent.id));
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <DarkPanel className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Agent Registry · 智能体</h2>
            <p className="mt-1 text-sm text-slate-500">当前参会 {selectedAgents.length} 个；政策/研究类角色默认作为后台能力保留，可手动启用。</p>
          </div>
          <Button onClick={onAgentOpen}><Settings2 className="size-4" />管理智能体</Button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {state.agents.map((agent) => {
            const mode = getAgentSkillMode(agent);
            return (
              <button key={agent.id} onClick={onAgentOpen} className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-left hover:border-violet-400/35">
                <div className="flex items-center gap-3">
                  <AvatarBadge agent={agent} active={selected.has(agent.id)} size={46} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{agent.name}</p>
                    <p className="truncate text-xs text-slate-500">{agent.roleLabel} · {runtimeLabels[agent.runtime]}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill className={skillModeTone[mode]}>{skillModeLabels[mode]}</Pill>
                  <Pill className="border-white/10 bg-white/[0.03] text-slate-300">质量分 {qualityScoreText(agent)}</Pill>
                </div>
                <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-400">{agent.roleDescription}</p>
              </button>
            );
          })}
        </div>
      </DarkPanel>
    </div>
  );
}

function KnowledgeSection({
  state,
  setState,
  onSessionOpen,
  onFactOpen,
}: {
  state: RoundtableState;
  setState: React.Dispatch<React.SetStateAction<RoundtableState>>;
  onSessionOpen: () => void;
  onFactOpen: () => void;
}) {
  const [contextPath, setContextPath] = useState('data_dictionary.md');
  const [isImportingContext, setIsImportingContext] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [backgroundDraft, setBackgroundDraft] = useState(state.background);
  const [searchScopeDraft, setSearchScopeDraft] = useState(state.searchScope);
  const sourceEntries = state.factPack.filter((entry) => entry.type === 'source' || entry.source.trim());
  const importedMaterials = useMemo(() => getImportedContextMaterials(state), [state.factPack]);
  const hasKnowledgeDraftChanges = backgroundDraft !== state.background || searchScopeDraft !== state.searchScope;

  useEffect(() => {
    setBackgroundDraft(state.background);
  }, [state.background]);

  useEffect(() => {
    setSearchScopeDraft(state.searchScope);
  }, [state.searchScope]);

  const isMarkdownMaterialFilename = (name: string) => /\.m(arkdown|d)$/i.test(name.trim());

  const applyImportedMaterial = (title: string, source: string, content: string, summarized = false) => {
    setState((prev) => applyContextMaterialToRoundtable(prev, {
      title,
      source,
      content,
    }));
    setImportMessage(`已导入${summarized ? '摘要' : ''}：${title}`);
  };

  const applyTopicMaterial = (title: string, source: string, content: string, summarized = false) => {
    setState((prev) => applyContextMaterialAsTopic(prev, {
      title,
      source,
      content,
    }));
    setImportMessage(`已作为讨论 Topic 导入${summarized ? '摘要' : ''}：${title}`);
  };

  const saveKnowledgeSettings = () => {
    setState((prev) => ({
      ...prev,
      background: backgroundDraft.trim(),
      searchScope: searchScopeDraft.trim() || prev.searchScope,
    }));
    setImportMessage('已保存背景设定。');
  };

  const resetKnowledgeDrafts = () => {
    setBackgroundDraft(state.background);
    setSearchScopeDraft(state.searchScope);
    setImportMessage('已恢复为当前会话设定。');
  };

  const importLocalMaterial = (file: File | undefined, asTopic = false) => {
    if (!file) return;
    if (!isSupportedContextMaterialFilename(file.name)) {
      setImportMessage('仅支持 .md / .txt / .json / .jsonl / .csv 资料。');
      return;
    }
    if (asTopic && !isMarkdownMaterialFilename(file.name)) {
      setImportMessage('导入为 Topic 仅支持 .md / .markdown 文档。');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '').trim();
      if (!text) {
        setImportMessage('文件内容为空，未导入。');
        return;
      }
      if (asTopic) {
        applyTopicMaterial(file.name, `local-file/${file.name}`, text);
        return;
      }
      applyImportedMaterial(file.name, `local-file/${file.name}`, text);
    };
    reader.onerror = () => setImportMessage('读取本机文件失败。');
    reader.readAsText(file);
  };

  const importProjectContext = async (asTopic = false) => {
    const requestedPath = contextPath.trim();
    if (!requestedPath) {
      setImportMessage('请填写 context 目录下的文件名。');
      return;
    }
    if (asTopic && !isMarkdownMaterialFilename(requestedPath)) {
      setImportMessage('作为讨论 Topic 导入仅支持 .md / .markdown 文档。');
      return;
    }
    setIsImportingContext(true);
    setImportMessage('');
    try {
      const response = await fetch('/api/roundtable/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: requestedPath }),
      });
      const payload = await response.json().catch(() => null) as {
        ok?: boolean;
        title?: string;
        source?: string;
        content?: string;
        summarized?: boolean;
        error?: string;
      } | null;
      if (!response.ok || !payload?.ok || !payload.content) {
        setImportMessage(payload?.error || `导入失败，HTTP ${response.status}`);
        return;
      }
      if (asTopic) {
        applyTopicMaterial(payload.title || requestedPath, payload.source || `context/${requestedPath}`, payload.content, Boolean(payload.summarized));
        return;
      }
      applyImportedMaterial(payload.title || requestedPath, payload.source || `context/${requestedPath}`, payload.content, Boolean(payload.summarized));
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsImportingContext(false);
    }
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px] gap-3 p-4">
      <DarkPanel className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">知识库</h2>
          <div className="flex items-center gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-slate-200 hover:bg-white/5">
              <Upload className="size-3.5" />
              导入本机文件
              <input
                className="hidden"
                type="file"
                accept=".md,.markdown,.txt,.json,.jsonl,.csv,text/markdown,text/plain,application/json,text/csv"
                onChange={(event) => {
                  importLocalMaterial(event.target.files?.[0], false);
                  event.currentTarget.value = '';
                }}
              />
            </label>
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 text-xs text-violet-100 hover:bg-violet-500/20">
              <FileText className="size-3.5" />
              导入 MD 为 Topic
              <input
                className="hidden"
                type="file"
                accept=".md,.markdown,text/markdown,text/plain"
                onChange={(event) => {
                  importLocalMaterial(event.target.files?.[0], true);
                  event.currentTarget.value = '';
                }}
              />
            </label>
            <Button onClick={onSessionOpen} variant="outline"><Edit3 className="size-4" />编辑背景</Button>
          </div>
        </div>
        <div className="mb-3 rounded-lg border border-cyan-400/20 bg-cyan-500/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-cyan-100">从项目 context/ 导入资料</p>
              <p className="mt-1 text-xs leading-relaxed text-cyan-100/70">支持 md、txt、json、jsonl、csv；导入后会进入背景材料和来源索引。</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              className={darkFieldClass}
              value={contextPath}
              onChange={(event) => setContextPath(event.target.value)}
              placeholder="例如：data_dictionary.md"
            />
            <Button onClick={() => importProjectContext(false)} disabled={isImportingContext} variant="outline">
              <Library className="size-4" />
              {isImportingContext ? '导入中' : '导入'}
            </Button>
            <Button onClick={() => importProjectContext(true)} disabled={isImportingContext} variant="outline">
              <FileText className="size-4" />
              作为讨论 Topic 导入
            </Button>
          </div>
          {importMessage ? (
            <p className="mt-2 text-xs leading-relaxed text-cyan-100/80">{importMessage}</p>
          ) : null}
        </div>
        <div className="rounded-lg border border-white/10 bg-[#0b131e] p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-slate-500">背景材料</p>
            <span className="text-[11px] text-slate-600">{backgroundDraft.length} 字符</span>
          </div>
          <Textarea
            value={backgroundDraft}
            onChange={(event) => setBackgroundDraft(event.target.value)}
            placeholder="为本次圆桌补充业务背景、已知边界、会议资料摘要。"
            className={cn('min-h-36', darkTextareaClass)}
          />
        </div>
        <div className="mt-3 rounded-lg border border-white/10 bg-[#0b131e] p-4">
          <p className="mb-2 text-xs text-slate-500">搜索范围</p>
          <Textarea
            value={searchScopeDraft}
            onChange={(event) => setSearchScopeDraft(event.target.value)}
            placeholder="限定本次讨论可使用的资料边界、证据要求和不可臆造的内容。"
            className={cn('min-h-20', darkTextareaClass)}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={saveKnowledgeSettings} disabled={!hasKnowledgeDraftChanges}>
            <Check className="size-4" />
            保存背景设定
          </Button>
          <Button onClick={resetKnowledgeDrafts} disabled={!hasKnowledgeDraftChanges} variant="outline">
            <RefreshCcw className="size-4" />
            恢复当前
          </Button>
          <Button onClick={onSessionOpen} variant="outline"><Edit3 className="size-4" />会话高级设置</Button>
        </div>
        <div className="mt-3 rounded-lg border border-white/10 bg-[#0b131e] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium text-slate-300">已导入资料（{importedMaterials.length}）</p>
            <p className="text-[11px] text-slate-600">来自 context/ 或本机文件</p>
          </div>
          {importedMaterials.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-sm text-slate-500">
              暂无已导入资料。导入后会同时进入背景材料和来源索引。
            </div>
          ) : (
            <div className="grid gap-2">
              {importedMaterials.slice().reverse().map((item) => (
                <div key={item.id} className="rounded-lg border border-white/8 bg-white/[0.025] px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-white">{item.title}</p>
                    <Pill className="border-cyan-400/20 bg-cyan-500/10 text-cyan-100">{item.status === 'verified' ? '已验证' : '未验证'}</Pill>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">{item.source}</p>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-400">{item.excerpt}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </DarkPanel>
      <DarkPanel className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">来源索引</h2>
          <button onClick={onFactOpen} className="text-xs text-violet-300 hover:text-violet-100">添加来源</button>
        </div>
        <div className="space-y-2">
          {sourceEntries.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">暂无来源条目</div>
          ) : sourceEntries.slice(-8).reverse().map((entry) => <FactEntryCard key={entry.id} entry={entry} />)}
        </div>
      </DarkPanel>
    </div>
  );
}

function FactPackSection({
  state,
  onAddFactOpen,
  onDeleteFact,
  onClearFactPack,
}: {
  state: RoundtableState;
  onAddFactOpen: () => void;
  onDeleteFact: (id: string) => void;
  onClearFactPack: () => void;
}) {
  const [factFilter, setFactFilter] = useState<FactFilter>('all');
  const filters: Array<{ id: FactFilter; label: string }> = [
    { id: 'all', label: '全部' },
    { id: 'known_fact', label: '事实' },
    { id: 'uncertainty', label: '不确定性' },
    { id: 'evidence_request', label: '证据请求' },
  ];
  const entries = state.factPack.filter((entry) => factFilter === 'all' || entry.type === factFilter).slice().reverse();
  const evidenceTasks = (state.evidenceTasks || []).slice().reverse();
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <DarkPanel className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">实时包</h2>
            <p className="mt-1 text-sm text-slate-500">事实、假设、不确定性和证据请求都会在这里沉淀。</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={onClearFactPack} disabled={state.factPack.length === 0} variant="outline">
              <Trash2 className="size-4" />
              清空事实包
            </Button>
            <Button onClick={onAddFactOpen}><Plus className="size-4" />添加事实</Button>
          </div>
        </div>
        <div className="mb-4 flex gap-2">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setFactFilter(filter.id)}
              className={cn(
                'h-8 rounded-lg border px-3 text-xs transition',
                factFilter === filter.id ? 'border-violet-400/40 bg-violet-500/15 text-violet-200' : 'border-white/10 text-slate-500 hover:text-slate-200',
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
        {evidenceTasks.length > 0 ? (
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium text-slate-400">证据任务</p>
            <div className="mb-3 rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100/85">
              当前 P0 证据后台只会登记任务、分配后台角色并标注“需要外部研究/用户数据”。除非事实条目明确标为已验证，否则不能把任务分类当作证据结论。
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {evidenceTasks.map((task) => <EvidenceTaskCard key={task.id} task={task} agents={state.agents} />)}
            </div>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          {entries.length === 0 ? (
            <div className="col-span-2 rounded-lg border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-500">当前筛选下没有事实包条目</div>
          ) : entries.map((entry) => <FactEntryCard key={entry.id} entry={entry} onDelete={onDeleteFact} />)}
        </div>
      </DarkPanel>
    </div>
  );
}

const historySourceLabels: Record<RoundtableHistoryItem['source'], string> = {
  local: '本机讨论',
  artifact: '测试记录',
  imported: '导入记录',
};

function HistorySection({
  state,
  history,
  onLoad,
  onDelete,
  onExport,
  onExportItem,
}: {
  state: RoundtableState;
  history: RoundtableHistoryItem[];
  onLoad: (item: RoundtableHistoryItem) => void;
  onDelete: (id: string) => void;
  onExport: () => void;
  onExportItem: (item: RoundtableHistoryItem) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <DarkPanel className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">历史记录</h2>
            <p className="mt-1 text-sm text-slate-500">保存过的圆桌任务会在这里恢复、导出和核对。</p>
          </div>
          <Button onClick={onExport} variant="outline"><Download className="size-4" />导出</Button>
        </div>
        <div className="grid grid-cols-[380px_minmax(0,1fr)] gap-4">
          <div className="min-h-[420px] space-y-3">
            {history.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-500">尚无历史任务</div>
            ) : history.map((item) => (
              <div key={item.id} className="rounded-lg border border-white/10 bg-[#0b131e] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-white">{item.topic}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{item.objective || '未填写会议目标'}</p>
                  </div>
                  <Pill className={item.source === 'artifact' ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200' : 'border-white/10 bg-white/[0.03] text-slate-300'}>
                    {historySourceLabels[item.source]}
                  </Pill>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5">
                    <p className="text-slate-500">发言</p>
                    <p className="mt-1 font-semibold text-slate-200">{item.messageCount}</p>
                  </div>
                  <div className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5">
                    <p className="text-slate-500">事实</p>
                    <p className="mt-1 font-semibold text-slate-200">{item.factCount}</p>
                  </div>
                  <div className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5">
                    <p className="text-slate-500">更新</p>
                    <p className="mt-1 font-semibold text-slate-200">{compactTime(item.updatedAt)}</p>
                  </div>
                </div>
                <p className="mt-3 line-clamp-1 text-xs text-slate-500">角色：{item.agentNames.join('、') || '未记录'}</p>
                <div className="mt-3 flex gap-2">
                  <Button onClick={() => onLoad(item)} size="sm"><History className="size-3.5" />载入</Button>
                  <Button onClick={() => onExportItem(item)} size="sm" variant="outline"><Download className="size-3.5" />导出</Button>
                  <button
                    onClick={() => onDelete(item.id)}
                    className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-500 hover:border-rose-400/40 hover:text-rose-200"
                    aria-label="删除历史任务"
                    title="删除历史任务"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="min-w-0 space-y-3">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs text-slate-500">当前载入任务</p>
              <p className="mt-1 text-sm font-semibold text-white">{state.topic || '未设置讨论主题'}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{state.messages.length} 条发言 · {state.factPack.length} 条事实包</p>
            </div>
            {state.messages.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-500">当前会话尚无讨论发言。可以从左侧载入最近测试记录。</div>
            ) : state.messages.slice().reverse().map((message) => (
              <div key={message.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-white">{message.senderName}</span>
                  <span className="text-xs text-slate-500">{message.phaseTitle}</span>
                  <span className="text-xs text-slate-600">{compactTime(message.createdAt)}</span>
                  <Pill className={interactionTone[message.interactionType]}>{interactionLabels[message.interactionType]}</Pill>
                </div>
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">{message.content}</p>
              </div>
            ))}
          </div>
        </div>
      </DarkPanel>
    </div>
  );
}

function SettingsSection({ onSessionOpen, onAgentOpen, onReset }: { onSessionOpen: () => void; onAgentOpen: () => void; onReset: () => void }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <DarkPanel className="p-5">
        <h2 className="text-lg font-semibold text-white">设置</h2>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <button onClick={onSessionOpen} className="rounded-lg border border-white/10 bg-[#0b131e] p-4 text-left hover:bg-white/[0.04]">
            <Edit3 className="mb-3 size-4 text-violet-300" />
            <p className="text-sm font-semibold text-white">会话设置</p>
            <p className="mt-1 text-xs text-slate-500">调整主题、目标、背景和搜索范围。</p>
          </button>
          <button onClick={onAgentOpen} className="rounded-lg border border-white/10 bg-[#0b131e] p-4 text-left hover:bg-white/[0.04]">
            <Users className="mb-3 size-4 text-sky-300" />
            <p className="text-sm font-semibold text-white">智能体设置</p>
            <p className="mt-1 text-xs text-slate-500">管理角色、Skill 和运行时。</p>
          </button>
          <button onClick={onReset} className="rounded-lg border border-white/10 bg-[#0b131e] p-4 text-left hover:bg-white/[0.04]">
            <RefreshCcw className="mb-3 size-4 text-amber-300" />
            <p className="text-sm font-semibold text-white">重置示例</p>
            <p className="mt-1 text-xs text-slate-500">恢复默认主题、事实包和参会角色。</p>
          </button>
        </div>
      </DarkPanel>
    </div>
  );
}

export function RoundtableView() {
  const { state, setState, history, setHistory, setActiveHistoryMeta } = useRoundtableState();
  const [activeSection, setActiveSection] = useState<RoundtableSection>(() => getInitialRoundtableSection());
  const [agentOpen, setAgentOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [factOpen, setFactOpen] = useState(false);
  const [responseOpen, setResponseOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState(state.agents[0]?.id || '');
  const [interjection, setInterjection] = useState('');
  const [responseAgentId, setResponseAgentId] = useState(state.agents[0]?.id || '');
  const [targetAgentId, setTargetAgentId] = useState('');
  const [responseInstruction, setResponseInstruction] = useState('');
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [runtimeErrors, setRuntimeErrors] = useState<RuntimeUiError[]>([]);
  const [runtimeProgress, setRuntimeProgress] = useState<RuntimeProgress | null>(null);
  const advanceRunIdRef = useRef(0);

  const selectedAgents = getSelectedAgents(state);
  const canAdvance = Boolean(
    state.topic.trim() &&
    state.objective.trim() &&
    selectedAgents.length > 0 &&
    state.status !== 'paused' &&
    state.status !== 'complete' &&
    !isAdvancing
  );

  useEffect(() => {
    if (!state.agents.some((agent) => agent.id === selectedAgentId)) {
      setSelectedAgentId(state.agents[0]?.id || '');
    }
    if (!state.agents.some((agent) => agent.id === responseAgentId)) {
      setResponseAgentId(state.agents[0]?.id || '');
    }
  }, [responseAgentId, selectedAgentId, state.agents]);

  const resetDemo = () => {
    const next = createEmptyRoundtableState();
    setActiveHistoryMeta({});
    setRuntimeProgress(null);
    setRuntimeErrors([]);
    setState(next);
    setSelectedAgentId(next.agents[0]?.id || '');
    setResponseAgentId(next.agents[0]?.id || '');
  };

  const clearDiscussion = () => {
    setActiveHistoryMeta({});
    setRuntimeProgress(null);
    setRuntimeErrors([]);
    setState((prev) => clearRoundtableDiscussion(prev));
  };

  const addRuntimeError = (plan: RoundtableRuntimePlan, message: string, command?: string) => {
    setRuntimeErrors((prev) => [
      ...prev,
      {
        id: `${plan.id}-${Date.now().toString(36)}`,
        agentName: plan.agentName,
        runtime: plan.runtime,
        message: compactRuntimeError(message),
        command,
      },
    ]);
  };

  const callRuntime = async (
    plan: RoundtableRuntimePlan,
    runtimeState: RoundtableState = state,
  ): Promise<RuntimeApiResult> => {
    const agent = runtimeState.agents.find((item) => item.id === plan.agentId);
    const roleAgent = agent && agent.skillSourcePath && getAgentSkillMode(agent) !== 'legacy_prompt' ? {
      mode: 'role_agent' as const,
      skillId: agent.skillId || agent.id,
      skillPath: agent.skillSourcePath,
      sourceManifestPath: agent.sourceManifestPath,
      skillLoadStatus: agent.skillLoadStatus,
    } : undefined;
    const evidenceRequest = 'evidenceRequest' in plan && typeof plan.evidenceRequest === 'string'
      ? plan.evidenceRequest
      : undefined;
    const response = await fetch('/api/roundtable/runtime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        runtime: plan.runtime,
        prompt: plan.prompt,
        agentName: plan.agentName,
        phaseId: plan.phaseId,
        evidenceRequest,
        topic: runtimeState.topic,
        objective: runtimeState.objective,
        searchScope: runtimeState.searchScope,
        timeoutMs: evidenceRequest ? 45_000 : 90_000,
        roleAgent,
      }),
    });
    const payload = await response.json().catch(() => null) as RuntimeApiResult | null;
    if (!payload) {
      return {
        ok: false,
        output: '',
        error: `Runtime API 返回了非 JSON 响应，HTTP ${response.status}。`,
      };
    }
    return payload;
  };

  const runRuntimePlanBatch = async (
    plans: RoundtableRuntimePlan[],
    baseState: RoundtableState,
    runId: number,
  ): Promise<{ state: RoundtableState; hasRuntimeFailure: boolean }> => {
    let workingState = baseState;
    let hasRuntimeFailure = false;
    let completed = 0;

    const tasks = plans.map((plan, index) => (async () => {
      if (advanceRunIdRef.current === runId) {
        setRuntimeProgress({
          agentName: plan.agentName,
          runtime: plan.runtime,
          index: index + 1,
          total: plans.length,
          phaseTitle: plan.phaseTitle,
        });
      }

      if (!isCliRuntime(plan.runtime)) {
        return { plan, result: null as RuntimeApiResult | null, error: null as string | null };
      }

      try {
        const result = await callRuntime(plan, baseState);
        if (!result.ok || !result.output?.trim()) {
          return {
            plan,
            result,
            error: result.error || result.stderr || result.stdout || 'Runtime 没有返回可展示内容。',
          };
        }
        return { plan, result, error: null as string | null };
      } catch (error) {
        return {
          plan,
          result: null as RuntimeApiResult | null,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    })().then((outcome) => {
      if (advanceRunIdRef.current !== runId) return outcome;
      completed += 1;
      setRuntimeProgress({
        agentName: outcome.plan.agentName,
        runtime: outcome.plan.runtime,
        index: completed,
        total: plans.length,
        phaseTitle: outcome.plan.phaseTitle,
      });

      if (outcome.error) {
        hasRuntimeFailure = true;
        addRuntimeError(outcome.plan, outcome.error, outcome.result?.command);
        return outcome;
      }

      if (!outcome.result) {
        workingState = applyRuntimeRoundMessage(
          workingState,
          outcome.plan,
          createDemoRuntimeOutput(outcome.plan),
          { runtime: 'demo' },
        );
      } else {
        const normalized = normalizeRuntimeOutput(outcome.result.output, outcome.plan, workingState);
        workingState = applyRuntimeRoundMessage(workingState, outcome.plan, normalized, {
          runtime: outcome.result.actualRuntime || (outcome.result.fallbackFrom ? 'claude_code_cli' : outcome.plan.runtime),
          durationMs: outcome.result.durationMs,
        });
      }
      setState(workingState);
      return outcome;
    }));

    await Promise.allSettled(tasks);
    return { state: workingState, hasRuntimeFailure };
  };

  const runEvidencePlanBatch = async (
    plans: RoundtableEvidenceRuntimePlan[],
    baseState: RoundtableState,
    runId: number,
  ): Promise<RoundtableState> => {
    let workingState = baseState;
    let completed = 0;

    const tasks = plans.map((plan, index) => (async () => {
      if (advanceRunIdRef.current === runId) {
        setRuntimeProgress({
          agentName: plan.agentName,
          runtime: plan.runtime,
          index: index + 1,
          total: plans.length,
          phaseTitle: plan.phaseTitle,
        });
      }

      try {
        const result = await callRuntime(plan, baseState);
        if (!result.ok || !result.output?.trim()) {
          return {
            plan,
            result,
            error: result.error || result.stderr || result.stdout || '后台补证 Runtime 没有返回可展示内容。',
          };
        }
        return { plan, result, error: null as string | null };
      } catch (error) {
        return {
          plan,
          result: null as RuntimeApiResult | null,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    })().then((outcome) => {
      if (advanceRunIdRef.current !== runId) return outcome;
      completed += 1;
      setRuntimeProgress({
        agentName: outcome.plan.agentName,
        runtime: outcome.plan.runtime,
        index: completed,
        total: plans.length,
        phaseTitle: outcome.plan.phaseTitle,
      });

      if (outcome.error) {
        addRuntimeError(outcome.plan, outcome.error, outcome.result?.command);
        workingState = applyRuntimeEvidenceFailure(workingState, outcome.plan, outcome.error);
      } else if (outcome.result) {
        const normalized = normalizeEvidenceRuntimeOutput(outcome.result.output, outcome.plan);
        workingState = applyRuntimeEvidenceResult(workingState, outcome.plan, normalized);
      }
      setState(workingState);
      return outcome;
    }));

    await Promise.allSettled(tasks);
    return workingState;
  };

  const deleteFact = (id: string) => {
    setState((prev) => deleteFactEntry(prev, id));
  };

  const clearFacts = () => {
    setState((prev) => clearFactPack(prev));
  };

  const advance = async () => {
    if (isAdvancing) return;
    if (state.pendingExtraRoundSuggestion) {
      setState((prev) => confirmExtraRound(prev));
      return;
    }

    const runId = advanceRunIdRef.current + 1;
    advanceRunIdRef.current = runId;
    let workingState = resumeRoundtable(state);
    const phaseStartState = workingState;
    const initialPlan = getRuntimeRoundPlan(
      phaseStartState,
      {
        promptState: phaseStartState,
        excludeTranscriptPhaseIds: [phaseStartState.currentPhaseId],
      },
    );
    const hasCliAgents = initialPlan.some((plan) => isCliRuntime(plan.runtime));

    if (!hasCliAgents) {
      setRuntimeErrors([]);
      setState(classifyPendingEvidenceTasksDemo(advanceRoundtable(workingState)));
      return;
    }

    setIsAdvancing(true);
    setRuntimeErrors([]);
    setRuntimeProgress(null);
    setState(workingState);

    try {
      const roundResult = await runRuntimePlanBatch(initialPlan, workingState, runId);
      if (advanceRunIdRef.current !== runId) return;
      workingState = roundResult.state;

      if (!roundResult.hasRuntimeFailure) {
        const evidencePlans = getEvidenceResearchRuntimePlan(workingState, {
          limitTasks: 2,
          limitAgentsPerTask: 1,
        });
        for (const plan of evidencePlans) {
          workingState = markEvidenceTaskResearching(workingState, plan);
        }
        setState(workingState);

        workingState = await runEvidencePlanBatch(evidencePlans, workingState, runId);
        if (advanceRunIdRef.current !== runId) return;

        workingState = advanceRuntimeStateAfterPhase(workingState);
        setState(workingState);
      }
    } catch (error) {
      setRuntimeErrors((prev) => [
        ...prev,
        {
          id: `advance-${Date.now().toString(36)}`,
          agentName: '圆桌运行器',
          runtime: 'codex_cli',
          message: error instanceof Error ? error.message : String(error),
        },
      ]);
    } finally {
      if (advanceRunIdRef.current === runId) {
        setRuntimeProgress(null);
        setIsAdvancing(false);
      }
    }
  };

  const togglePause = () => {
    if (isAdvancing) {
      advanceRunIdRef.current += 1;
      setIsAdvancing(false);
      setRuntimeProgress(null);
      setRuntimeErrors((prev) => [
        ...prev,
        {
          id: `pause-${Date.now().toString(36)}`,
          agentName: '圆桌运行器',
          runtime: 'codex_cli',
          message: '已暂停当前生成；后台旧请求若稍后返回，将不会再写回本轮圆桌。',
        },
      ]);
    }
    setState((prev) => prev.status === 'paused' ? resumeRoundtable(prev) : pauseRoundtable(prev));
  };

  const exportStateMarkdown = (exportState: RoundtableState, filename: string) => {
    const markdown = exportRoundtableMarkdown(exportState);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportMarkdown = () => {
    exportStateMarkdown(state, 'roundtable-current-discussion.md');
  };

  const exportHistoryItem = (item: RoundtableHistoryItem) => {
    exportStateMarkdown(item.state, `roundtable-history-${item.updatedAt.slice(0, 10)}.md`);
  };

  const loadHistoryItem = (item: RoundtableHistoryItem) => {
    setActiveHistoryMeta({ id: item.id, source: item.source });
    setState(restoreRoundtableHistoryItem(item));
  };

  const deleteHistoryItem = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const sendInterjection = () => {
    if (!interjection.trim()) return;
    setState((prev) => addUserInterjection(prev, interjection));
    setInterjection('');
  };

  const requestEvidence = () => {
    const content = interjection.trim() || '请补充与当前争议相关的来源、样本数和验证边界。';
    setState((prev) => {
      const withFact = addFactEntry(prev, {
        type: 'evidence_request',
        content,
        source: '',
        status: 'needs_evidence',
        addedBy: 'human',
        phaseId: prev.currentPhaseId,
      });
      return addEvidenceTaskForRequest(withFact, {
        request: content,
        requestedByAgentId: 'human',
        requestedByAgentName: '用户',
        phaseId: prev.currentPhaseId,
      });
    });
    setInterjection('');
    setFactOpen(true);
  };

  const askAgent = () => {
    const instruction = responseInstruction.trim() || interjection.trim() || '请回应当前讨论中的关键挑战。';
    setState((prev) => requestAgentResponse(prev, responseAgentId || prev.agents[0]?.id, instruction, targetAgentId || undefined));
    setInterjection('');
    setResponseInstruction('');
  };

  const openResponseDialog = () => {
    if (!responseInstruction.trim() && interjection.trim()) setResponseInstruction(interjection.trim());
    setResponseOpen(true);
  };

  const replyToMessage = (message: RoundtableMessage) => {
    const nextSpeaker = selectedAgents.find((agent) => agent.id !== message.senderId) || selectedAgents[0] || state.agents[0];
    setResponseAgentId(nextSpeaker?.id || '');
    setTargetAgentId(message.senderId);
    setResponseInstruction(`请回应 ${message.senderName} 的上一条发言，指出一个最关键的分歧、证据缺口或验证动作。`);
    setResponseOpen(true);
  };

  const mentionMessage = (message: RoundtableMessage) => {
    setInterjection((prev) => `${prev.trim() ? `${prev.trim()} ` : ''}@${message.senderName} `);
  };

  const currentPhase = ROUNDTABLE_PHASES[phaseIndex(state.currentPhaseId)];

  const discussionWarning = !canAdvance && state.status !== 'complete';

  const renderActiveSection = () => {
    if (activeSection === 'workspace') {
      return (
        <WorkspaceSection
          state={state}
          selectedAgents={selectedAgents}
          onSectionChange={setActiveSection}
          onAdvance={advance}
          onAgentOpen={() => setAgentOpen(true)}
          onFactOpen={() => setFactOpen(true)}
          onSessionOpen={() => setSessionOpen(true)}
          canAdvance={canAdvance}
        />
      );
    }
    if (activeSection === 'agents') {
      return <AgentsSection state={state} selectedAgents={selectedAgents} onAgentOpen={() => setAgentOpen(true)} />;
    }
    if (activeSection === 'knowledge') {
      return <KnowledgeSection state={state} setState={setState} onSessionOpen={() => setSessionOpen(true)} onFactOpen={() => setFactOpen(true)} />;
    }
    if (activeSection === 'factpack') {
      return (
        <FactPackSection
          state={state}
          onAddFactOpen={() => setFactOpen(true)}
          onDeleteFact={deleteFact}
          onClearFactPack={clearFacts}
        />
      );
    }
    if (activeSection === 'history') {
      return (
        <HistorySection
          state={state}
          history={history}
          onLoad={loadHistoryItem}
          onDelete={deleteHistoryItem}
          onExport={exportMarkdown}
          onExportItem={exportHistoryItem}
        />
      );
    }
    if (activeSection === 'settings') {
      return <SettingsSection onSessionOpen={() => setSessionOpen(true)} onAgentOpen={() => setAgentOpen(true)} onReset={resetDemo} />;
    }
    return (
      <main className="grid min-h-0 flex-1 grid-rows-[206px_minmax(0,1fr)] bg-[radial-gradient(circle_at_45%_0%,rgba(59,130,246,0.08),transparent_35%),#070c13]">
        <ParticipantStrip state={state} selectedAgents={selectedAgents} onAgentOpen={() => setAgentOpen(true)} />

        <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_416px] gap-2 px-2 pb-2">
          <div className="grid min-h-0 grid-rows-[minmax(0,540px)_minmax(188px,1fr)] gap-2">
            <div className="relative min-h-0">
              {discussionWarning && (
                <div className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  <AlertTriangle className="size-3.5" />
                  需要讨论主题、会议目标和至少一个启用智能体。
                </div>
              )}
              <DiscussionPanel
                state={state}
                selectedAgents={selectedAgents}
                interjection={interjection}
                setInterjection={setInterjection}
                onSendInterjection={sendInterjection}
                onRequestEvidence={requestEvidence}
                onAskAgent={openResponseDialog}
                onReplyMessage={replyToMessage}
                onMentionMessage={mentionMessage}
                isAdvancing={isAdvancing}
                runtimeProgress={runtimeProgress}
              />
            </div>
            <FinalOutputPanel state={state} />
          </div>

          <div className="grid min-h-0 grid-rows-[500px_minmax(0,1fr)] gap-2">
            <FactPackPanel
              state={state}
              onAddFactOpen={() => setFactOpen(true)}
              onViewAll={() => setActiveSection('factpack')}
              onDeleteFact={deleteFact}
              onClearFactPack={clearFacts}
            />
            <RelationGraph state={state} selectedAgents={selectedAgents} />
          </div>
        </div>
      </main>
    );
  };

  return (
    <div
      className="roundtable-reference-shell flex h-full min-h-[900px] bg-[#070c13] text-slate-100"
      data-reference-title="新会话：AI 原生产品的商业化策略讨论"
    >
      <Sidebar
        state={state}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onSessionOpen={() => setSessionOpen(true)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          state={state}
          canAdvance={canAdvance}
          onReset={resetDemo}
          onClearDiscussion={clearDiscussion}
          onPauseToggle={togglePause}
          onAdvance={advance}
          onExport={exportMarkdown}
          onSessionOpen={() => setSessionOpen(true)}
          onHome={() => setActiveSection('workspace')}
          onSettings={() => setActiveSection('settings')}
          isAdvancing={isAdvancing}
        />

        {renderActiveSection()}
      </div>

      <AgentManagerDialog
        open={agentOpen}
        onOpenChange={setAgentOpen}
        state={state}
        setState={setState}
        selectedAgentId={selectedAgentId}
        setSelectedAgentId={setSelectedAgentId}
      />
      <SessionDialog open={sessionOpen} onOpenChange={setSessionOpen} state={state} setState={setState} />
      <FactEntryDialog open={factOpen} onOpenChange={setFactOpen} state={state} setState={setState} />
      <ResponseDialog
        open={responseOpen}
        onOpenChange={setResponseOpen}
        state={state}
        responseAgentId={responseAgentId}
        setResponseAgentId={setResponseAgentId}
        targetAgentId={targetAgentId}
        setTargetAgentId={setTargetAgentId}
        responseInstruction={responseInstruction}
        setResponseInstruction={setResponseInstruction}
        onSubmit={askAgent}
      />

      <div className="hidden" aria-hidden="true">
        当前阶段：{currentPhase.title}
        <Database />
        <Clock3 />
        <Bot />
        <FileText />
        <ChevronRight />
      </div>
    </div>
  );
}
