import { spawn } from 'node:child_process';

export interface TavilyEvidenceSearchResult {
  ok: boolean;
  query: string;
  command: string;
  rawJson: string;
  stderr?: string;
  error?: string;
  durationMs?: number;
}

interface TavilySearchOptions {
  depth?: 'ultra-fast' | 'fast' | 'basic' | 'advanced';
  maxResults?: number;
  timeoutMs?: number;
}

function compactQuery(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 320);
}

function quoteDisplay(value: string): string {
  return value.includes(' ') ? `"${value.replace(/"/g, '\\"')}"` : value;
}

function displayCommand(command: string, args: string[]): string {
  return [command, ...args.map(quoteDisplay)].join(' ');
}

export function getTavilySpawnOptions(): {
  windowsHide: boolean;
  shell: false;
  env: NodeJS.ProcessEnv;
} {
  return {
    windowsHide: true,
    shell: false,
    env: { ...process.env, NO_COLOR: '1' },
  };
}

export function buildTavilyEvidenceSearchArgs(
  query: string,
  options: TavilySearchOptions = {},
): string[] {
  const depth = options.depth || 'fast';
  const maxResults = Math.max(1, Math.min(10, Math.floor(options.maxResults ?? 5)));
  return [
    'search',
    compactQuery(query),
    '--depth',
    depth,
    '--max-results',
    String(maxResults),
    '--json',
  ];
}

export function buildTavilyEvidenceQuery(input: {
  evidenceRequest: string;
  topic?: string;
  objective?: string;
  searchScope?: string;
}): string {
  return compactQuery([
    input.evidenceRequest,
    input.topic ? `议题 ${input.topic}` : '',
    input.objective ? `目标 ${input.objective}` : '',
    input.searchScope ? `范围 ${input.searchScope}` : '',
  ].filter(Boolean).join(' '));
}

export function formatTavilyEvidenceSearchContext(result: TavilyEvidenceSearchResult): string {
  if (!result.ok) {
    return [
      'Tavily 预检索结果：失败',
      `query: ${result.query}`,
      `command: ${result.command}`,
      `error: ${result.error || result.stderr || 'unknown error'}`,
      '证据 Agent 仍需明确标注未完成联网补证，不能把无来源判断写成 verified。',
    ].join('\n');
  }

  const clipped = summarizeTavilyRawJson(result.rawJson);
  return [
    'Tavily 预检索结果：',
    `query: ${result.query}`,
    `command: ${result.command}`,
    'raw_json:',
    clipped,
    '使用要求：只把 raw_json 中带 URL、标题或可核验来源的信息写入 facts/sourceRefs；无法核验的内容只能作为不确定项。',
  ].join('\n');
}

function truncate(value: unknown, limit: number): string {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function summarizeTavilyRawJson(rawJson: string): string {
  try {
    const parsed = JSON.parse(rawJson) as {
      answer?: unknown;
      results?: Array<{ title?: unknown; url?: unknown; content?: unknown; raw_content?: unknown }>;
    };
    const results = Array.isArray(parsed.results)
      ? parsed.results.slice(0, 4).map((item) => ({
        title: truncate(item.title, 160),
        url: truncate(item.url, 260),
        content: truncate(item.content || item.raw_content, 280),
      }))
      : [];
    return JSON.stringify({
      answer: truncate(parsed.answer, 500) || null,
      results,
      truncated: Array.isArray(parsed.results) && parsed.results.length > results.length,
    }, null, 2);
  } catch {
    return rawJson.length > 2_500 ? `${rawJson.slice(0, 2_500)}\n...[truncated]` : rawJson;
  }
}

export function runTavilyEvidenceSearch(
  query: string,
  options: TavilySearchOptions = {},
): Promise<TavilyEvidenceSearchResult> {
  const args = buildTavilyEvidenceSearchArgs(query, options);
  const command = 'tvly';
  const commandText = displayCommand(command, args);
  const timeoutMs = Math.max(3_000, Math.floor(options.timeoutMs ?? 12_000));
  const started = Date.now();

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let child;
    try {
      child = spawn(command, args, {
        ...getTavilySpawnOptions(),
      });
    } catch (error) {
      resolve({
        ok: false,
        query,
        command: commandText,
        rawJson: '',
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - started,
      });
      return;
    }

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      resolve({
        ok: false,
        query,
        command: commandText,
        rawJson: stdout.trim(),
        stderr,
        error: `Tavily search timed out after ${timeoutMs}ms`,
        durationMs: Date.now() - started,
      });
    }, timeoutMs);

    child.stdout?.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: false,
        query,
        command: commandText,
        rawJson: stdout.trim(),
        stderr,
        error: error.message,
        durationMs: Date.now() - started,
      });
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: code === 0 && stdout.trim().length > 0,
        query,
        command: commandText,
        rawJson: stdout.trim(),
        stderr,
        error: code === 0 ? undefined : stderr || stdout || `tvly exited with code ${code}`,
        durationMs: Date.now() - started,
      });
    });
  });
}
