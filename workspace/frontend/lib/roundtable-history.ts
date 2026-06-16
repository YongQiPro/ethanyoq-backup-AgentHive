import {
  ensurePresetRoundtableAgents,
  getSelectedAgents,
  type RoundtableState,
} from './roundtable-engine';

export const ROUNDTABLE_HISTORY_STORAGE_KEY = 'roundtable-p0:discussion-history:v1';
export const ROUNDTABLE_HISTORY_LIMIT = 30;

export type RoundtableHistorySource = 'local' | 'artifact' | 'imported';

export interface RoundtableHistoryItem {
  id: string;
  topic: string;
  objective: string;
  status: RoundtableState['status'];
  currentPhaseId: RoundtableState['currentPhaseId'];
  messageCount: number;
  factCount: number;
  agentNames: string[];
  createdAt: string;
  updatedAt: string;
  source: RoundtableHistorySource;
  state: RoundtableState;
}

export interface CreateRoundtableHistoryItemOptions {
  id?: string;
  source?: RoundtableHistorySource;
  updatedAt?: string;
}

function fallbackIso(): string {
  return new Date(0).toISOString();
}

function compactHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function stateCreatedAt(state: RoundtableState): string {
  return state.messages[0]?.createdAt || state.factPack[0]?.createdAt || fallbackIso();
}

function stateUpdatedAt(state: RoundtableState): string {
  const messageTime = state.messages.at(-1)?.createdAt;
  const factTime = state.factPack.at(-1)?.createdAt;
  return messageTime || factTime || stateCreatedAt(state);
}

export function getRoundtableHistoryId(state: RoundtableState, explicitId?: string): string {
  if (explicitId?.trim()) return explicitId.trim();
  const firstMessage = state.messages[0];
  if (firstMessage) return `discussion:${firstMessage.id}`;
  const basis = [
    state.topic,
    state.objective,
    state.currentPhaseId,
    state.factPack[0]?.id || '',
  ].join('|');
  return `draft:${compactHash(basis)}`;
}

export function createRoundtableHistoryItem(
  state: RoundtableState,
  options: CreateRoundtableHistoryItemOptions = {},
): RoundtableHistoryItem | null {
  if (state.messages.length === 0) return null;

  const restoredState = ensurePresetRoundtableAgents(state);
  const selectedAgents = getSelectedAgents(restoredState);
  const updatedAt = options.updatedAt || stateUpdatedAt(restoredState);
  return {
    id: getRoundtableHistoryId(restoredState, options.id),
    topic: restoredState.topic.trim() || '未命名圆桌讨论',
    objective: restoredState.objective.trim(),
    status: restoredState.status,
    currentPhaseId: restoredState.currentPhaseId,
    messageCount: restoredState.messages.length,
    factCount: restoredState.factPack.length,
    agentNames: selectedAgents.map((agent) => agent.name),
    createdAt: stateCreatedAt(restoredState),
    updatedAt,
    source: options.source || 'local',
    state: restoredState,
  };
}

export function upsertHistoryItem(
  history: RoundtableHistoryItem[],
  item: RoundtableHistoryItem | null,
): RoundtableHistoryItem[] {
  if (!item) return history;
  const rest = history.filter((entry) => entry.id !== item.id);
  return [item, ...rest]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, ROUNDTABLE_HISTORY_LIMIT);
}

export function upsertRoundtableHistory(
  history: RoundtableHistoryItem[],
  state: RoundtableState,
  options: CreateRoundtableHistoryItemOptions = {},
): RoundtableHistoryItem[] {
  return upsertHistoryItem(history, createRoundtableHistoryItem(state, options));
}

export function restoreRoundtableHistoryItem(item: RoundtableHistoryItem): RoundtableState {
  return ensurePresetRoundtableAgents(item.state);
}

function isHistoryItem(value: unknown): value is RoundtableHistoryItem {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RoundtableHistoryItem>;
  return Boolean(
    candidate.id &&
    candidate.topic &&
    candidate.updatedAt &&
    candidate.state &&
    Array.isArray(candidate.state.messages),
  );
}

export function parseRoundtableHistory(raw: string | null): RoundtableHistoryItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isHistoryItem)
      .map((item) => ({
        ...item,
        state: ensurePresetRoundtableAgents(item.state),
      }))
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, ROUNDTABLE_HISTORY_LIMIT);
  } catch {
    return [];
  }
}
