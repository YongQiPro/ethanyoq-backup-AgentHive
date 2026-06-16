import {
  addFactEntry,
  type FactPackEntry,
  type RoundtableState,
} from './roundtable-engine';

export const CONTEXT_MATERIAL_MAX_CHARS = 20_000;
export const SUPPORTED_CONTEXT_MATERIAL_EXTENSIONS = [
  '.md',
  '.markdown',
  '.txt',
  '.json',
  '.jsonl',
  '.csv',
] as const;

export interface RoundtableContextMaterial {
  title: string;
  source: string;
  content: string;
  importedBy?: string;
  maxChars?: number;
}

export interface NormalizedContextMaterial {
  title: string;
  source: string;
  content: string;
  excerpt: string;
  truncated: boolean;
}

export interface ImportedContextMaterialSummary {
  id: string;
  title: string;
  source: string;
  excerpt: string;
  status: FactPackEntry['status'];
  createdAt: string;
}

function extensionOf(name: string): string {
  const normalized = name.trim().toLowerCase();
  const dotIndex = normalized.lastIndexOf('.');
  return dotIndex >= 0 ? normalized.slice(dotIndex) : '';
}

export function isSupportedContextMaterialFilename(name: string): boolean {
  return SUPPORTED_CONTEXT_MATERIAL_EXTENSIONS.includes(
    extensionOf(name) as (typeof SUPPORTED_CONTEXT_MATERIAL_EXTENSIONS)[number],
  );
}

function compactWhitespace(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
}

function excerpt(value: string, limit = 1200): string {
  const compact = compactWhitespace(value).replace(/\s+/g, ' ');
  return compact.length > limit ? `${compact.slice(0, limit - 3)}...` : compact;
}

function shortExcerpt(value: string, limit = 220): string {
  return excerpt(value, limit);
}

function stripSupportedExtension(name: string): string {
  const ext = extensionOf(name);
  if (!ext) return name.trim();
  return name.trim().slice(0, -ext.length).trim();
}

function basename(value: string): string {
  const normalized = value.replace(/\\/g, '/').split('/').filter(Boolean);
  return normalized[normalized.length - 1] || value;
}

export function normalizeContextMaterial(
  material: RoundtableContextMaterial,
): NormalizedContextMaterial {
  const title = material.title.trim() || '未命名资料';
  const source = material.source.trim() || title;
  const maxChars = Math.max(1000, Math.floor(material.maxChars ?? CONTEXT_MATERIAL_MAX_CHARS));
  const normalizedContent = compactWhitespace(material.content);
  const truncated = normalizedContent.length > maxChars;
  const content = truncated ? `${normalizedContent.slice(0, maxChars)}\n\n[资料过长，已截断用于圆桌上下文]` : normalizedContent;

  return {
    title,
    source,
    content,
    excerpt: excerpt(content),
    truncated,
  };
}

function buildBackgroundBlock(material: NormalizedContextMaterial): string {
  return [
    `## 导入资料：${material.title}`,
    `来源：${material.source}`,
    '',
    material.content,
  ].join('\n');
}

function hasImportedSource(state: RoundtableState, material: NormalizedContextMaterial): boolean {
  return state.factPack.some((entry) =>
    entry.type === 'source' &&
    entry.source === material.source &&
    entry.content.includes(material.title)
  );
}

function titleFromImportedSource(entry: FactPackEntry): string {
  const match = entry.content.match(/导入资料：([^。\n]+)/);
  return match?.[1]?.trim() || basename(entry.source) || '未命名资料';
}

function isImportedMaterialEntry(entry: FactPackEntry): boolean {
  return entry.type === 'source' &&
    Boolean(entry.source.trim()) &&
    /导入资料：/.test(entry.content);
}

function topicTitleFromMaterial(material: NormalizedContextMaterial): string {
  const heading = material.content
    .split('\n')
    .map((line) => line.trim())
    .find((line) => /^#\s+/.test(line));
  if (heading) return heading.replace(/^#\s+/, '').trim();
  return stripSupportedExtension(material.title) || material.title;
}

export function applyContextMaterialToRoundtable(
  state: RoundtableState,
  materialInput: RoundtableContextMaterial,
): RoundtableState {
  const material = normalizeContextMaterial(materialInput);
  if (!material.content) return state;

  const backgroundBlock = buildBackgroundBlock(material);
  const backgroundAlreadyHasBlock = state.background.includes(`## 导入资料：${material.title}`) &&
    state.background.includes(`来源：${material.source}`);
  const withBackground = backgroundAlreadyHasBlock
    ? state
    : {
      ...state,
      background: [state.background.trim(), backgroundBlock].filter(Boolean).join('\n\n'),
    };

  if (hasImportedSource(withBackground, material)) return withBackground;

  return addFactEntry(withBackground, {
    type: 'source',
    content: [
      `导入资料：${material.title}。该资料已进入圆桌背景材料，内容真实性需按原始来源另行核验。`,
      `摘录：${material.excerpt}`,
      material.truncated ? '注：资料超过上下文上限，已截断注入。' : '',
    ].filter(Boolean).join('\n'),
    source: material.source,
    status: 'unverified',
    addedBy: materialInput.importedBy?.trim() || '用户导入',
    phaseId: state.currentPhaseId,
  });
}

export function getImportedContextMaterials(state: RoundtableState): ImportedContextMaterialSummary[] {
  return state.factPack
    .filter(isImportedMaterialEntry)
    .map((entry) => ({
      id: entry.id,
      title: titleFromImportedSource(entry),
      source: entry.source,
      excerpt: shortExcerpt(entry.content),
      status: entry.status,
      createdAt: entry.createdAt,
    }));
}

export function applyContextMaterialAsTopic(
  state: RoundtableState,
  materialInput: RoundtableContextMaterial,
): RoundtableState {
  const material = normalizeContextMaterial(materialInput);
  if (!material.content) return state;

  const withMaterial = applyContextMaterialToRoundtable(state, materialInput);
  return {
    ...withMaterial,
    topic: topicTitleFromMaterial(material),
    objective: '围绕导入文档进行圆桌讨论，提炼关键问题、争议、风险和下一步行动。',
  };
}
