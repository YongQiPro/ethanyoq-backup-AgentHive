import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import * as readline from 'node:readline';
import { isSupportedContextMaterialFilename } from './roundtable-context-material';

// Desktop builds keep user-imported material outside the immutable application bundle.
export const DEFAULT_CONTEXT_ROOT = process.env.ROUNDTABLE_CONTEXT_ROOT?.trim() ||
  path.resolve(process.cwd(), '..', '..', '..', 'context');
export const CONTEXT_FILE_RAW_MAX_BYTES = 1_000_000;

export interface ResolvedRoundtableContextFile {
  filePath: string;
  relativePath: string;
  title: string;
  source: string;
}

export interface ReadRoundtableContextFileResult extends ResolvedRoundtableContextFile {
  content: string;
  size: number;
  summarized: boolean;
}

interface ProductRollup {
  rows: number;
  total: number;
  accounts: Set<string>;
  months: Set<string>;
  accountTotals: Map<string, number>;
}

function createProductRollup(): ProductRollup {
  return {
    rows: 0,
    total: 0,
    accounts: new Set<string>(),
    months: new Set<string>(),
    accountTotals: new Map<string, number>(),
  };
}

function addProductAmount(
  rollups: Map<string, ProductRollup>,
  product: string,
  amount: number,
  accountName: string,
  accountCode: string,
  month: string,
) {
  if (!Number.isFinite(amount) || amount === 0) return;
  const key = product.trim();
  if (!key) return;
  const rollup = rollups.get(key) || createProductRollup();
  rollup.rows += 1;
  rollup.total += amount;
  if (accountCode) rollup.accounts.add(accountCode);
  if (month) rollup.months.add(month);
  const accountKey = accountName || accountCode || '未知医院';
  rollup.accountTotals.set(accountKey, (rollup.accountTotals.get(accountKey) || 0) + amount);
  rollups.set(key, rollup);
}

function topEntries<T>(map: Map<T, number>, limit: number): Array<[T, number]> {
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value);
}

async function summarizeJsonlFile(filePath: string, relativePath: string, size: number): Promise<string> {
  const lines = readline.createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  let rowCount = 0;
  let parseErrors = 0;
  const fields = new Set<string>();
  const months = new Set<string>();
  const accounts = new Set<string>();
  const provinces = new Map<string, number>();
  const classifications = new Map<string, number>();
  const samples: unknown[] = [];
  const productRollups = new Map<string, ProductRollup>();

  for await (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    rowCount += 1;
    try {
      const row = JSON.parse(trimmed) as Record<string, unknown>;
      Object.keys(row).forEach((field) => fields.add(field));
      const accountCode = typeof row.account_cd === 'string' ? row.account_cd : '';
      const accountName = typeof row.account_name === 'string' ? row.account_name : '';
      const month = typeof row.month_cd === 'string' ? row.month_cd : '';
      if (month) months.add(month);
      if (accountCode) accounts.add(accountCode);
      if (samples.length < 5) samples.push(row);

      const province = typeof row.province_name === 'string' ? row.province_name : '';
      if (province) provinces.set(province, (provinces.get(province) || 0) + 1);
      const classification = typeof row.account_classification_name === 'string' ? row.account_classification_name : '';
      if (classification) classifications.set(classification, (classifications.get(classification) || 0) + 1);

      if (typeof row.product === 'string') {
        addProductAmount(
          productRollups,
          row.product,
          Number(row.amount || 0),
          accountName,
          accountCode,
          month,
        );
      }

      const productAmounts = row.product_amounts;
      if (productAmounts && typeof productAmounts === 'object' && !Array.isArray(productAmounts)) {
        Object.entries(productAmounts as Record<string, unknown>).forEach(([product, value]) => {
          addProductAmount(productRollups, product, Number(value || 0), accountName, accountCode, month);
        });
      }
    } catch {
      parseErrors += 1;
    }
  }

  const productRanking = Array.from(productRollups.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 12)
    .map(([product, rollup], index) =>
      `${index + 1}. ${product}: ${formatAmount(rollup.total)}；非零记录 ${rollup.rows}；覆盖医院 ${rollup.accounts.size}`
    );
  const productHighlights = Array.from(productRollups.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 4)
    .map(([product, rollup]) => {
    const topAccounts = topEntries(rollup.accountTotals, 5)
      .map(([account, amount]) => `${String(account)} ${formatAmount(amount)}`)
      .join('；');
    const monthValues = Array.from(rollup.months).sort();
      return [
      `- ${product}: 总额 ${formatAmount(rollup.total)}；非零记录 ${rollup.rows}；覆盖医院 ${rollup.accounts.size}`,
      `  - 月份范围：${monthValues[0] || '无'} 至 ${monthValues.at(-1) || '无'}`,
      `  - Top 医院：${topAccounts || '无'}`,
    ].join('\n');
    });

  return [
    `# Context JSONL 摘要：${path.basename(filePath)}`,
    '',
    `来源：context/${relativePath}`,
    `文件大小：${formatAmount(size)} bytes；该文件较大，系统已生成摘要供圆桌使用，未把全量原文直接注入 prompt。`,
    `总行数：${formatAmount(rowCount)}；解析失败行：${formatAmount(parseErrors)}`,
    `字段：${Array.from(fields).join(', ') || '未识别'}`,
    accounts.size ? `唯一医院账号数：${formatAmount(accounts.size)}` : '',
    months.size ? `月份范围：${Array.from(months).sort()[0]} 至 ${Array.from(months).sort().at(-1)}` : '',
    provinces.size ? `省份 Top：${topEntries(provinces, 8).map(([name, count]) => `${String(name)} ${count}`).join('；')}` : '',
    classifications.size ? `医院等级 Top：${topEntries(classifications, 8).map(([name, count]) => `${String(name)} ${count}`).join('；')}` : '',
    '',
    productRanking.length ? '## 产品销售总额排行（金额单位沿用源表，未另行换算）' : '',
    ...productRanking,
    productRollups.size ? '' : '',
    productHighlights.length ? '## 产品销售重点摘录' : '',
    ...productHighlights,
    '',
    '## 样例行',
    '```json',
    JSON.stringify(samples, null, 2),
    '```',
  ].filter(Boolean).join('\n');
}

export function resolveRoundtableContextFile(
  requestedPath: string,
  contextRoot = DEFAULT_CONTEXT_ROOT,
): ResolvedRoundtableContextFile {
  const raw = requestedPath.trim();
  if (!raw) throw new Error('请提供要导入的 context 文件名。');
  if (path.isAbsolute(raw)) throw new Error('只允许导入项目 context 目录下的相对路径。');

  const cleaned = raw
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/^context\//i, '');
  if (!isSupportedContextMaterialFilename(cleaned)) {
    throw new Error('只支持 .md、.markdown、.txt、.json、.jsonl、.csv 文件。');
  }

  const root = path.resolve(contextRoot);
  const filePath = path.resolve(root, cleaned);
  const relativePath = path.relative(root, filePath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('路径超出项目 context 目录，已拒绝导入。');
  }

  const normalizedRelativePath = relativePath.replace(/\\/g, '/');
  return {
    filePath,
    relativePath: normalizedRelativePath,
    title: path.basename(filePath),
    source: `context/${normalizedRelativePath}`,
  };
}

export async function readRoundtableContextFile(
  requestedPath: string,
  contextRoot = DEFAULT_CONTEXT_ROOT,
): Promise<ReadRoundtableContextFileResult> {
  const resolved = resolveRoundtableContextFile(requestedPath, contextRoot);
  const fileStat = await stat(resolved.filePath);
  if (!fileStat.isFile()) throw new Error('指定路径不是文件。');
  if (fileStat.size > CONTEXT_FILE_RAW_MAX_BYTES && path.extname(resolved.filePath).toLowerCase() === '.jsonl') {
    return {
      ...resolved,
      content: await summarizeJsonlFile(resolved.filePath, resolved.relativePath, fileStat.size),
      size: fileStat.size,
      summarized: true,
    };
  }
  const rawContent = await readFile(resolved.filePath, 'utf8');
  const summarized = fileStat.size > CONTEXT_FILE_RAW_MAX_BYTES;
  const content = summarized
    ? `${rawContent.slice(0, CONTEXT_FILE_RAW_MAX_BYTES)}\n\n[文件超过 ${CONTEXT_FILE_RAW_MAX_BYTES} bytes，已截断注入。]`
    : rawContent;
  return {
    ...resolved,
    content,
    size: fileStat.size,
    summarized,
  };
}
