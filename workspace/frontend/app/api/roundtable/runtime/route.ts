import { NextResponse } from 'next/server';
import { runRoundtableCliAgent } from '@/lib/roundtable-cli-runner';
import type { RoundtableAgentRuntime } from '@/lib/roundtable-engine';
import { resolveLocalEvidenceRuntimeOutput } from '@/lib/roundtable-local-evidence';
import {
  buildTavilyEvidenceQuery,
  formatTavilyEvidenceSearchContext,
  runTavilyEvidenceSearch,
} from '@/lib/roundtable-tavily';

export const runtime = 'nodejs';

interface RuntimeRequestBody {
  runtime?: RoundtableAgentRuntime;
  prompt?: string;
  agentName?: string;
  phaseId?: string;
  evidenceRequest?: string;
  topic?: string;
  objective?: string;
  searchScope?: string;
  timeoutMs?: number;
  roleAgent?: {
    mode: 'role_agent';
    skillId?: string;
    skillPath?: string;
    skillLoadStatus?: string;
    sourceManifestPath?: string;
    profileDir?: string;
  };
}

export async function POST(request: Request) {
  let body: RuntimeRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: '请求体不是有效 JSON。' }, { status: 400 });
  }

  if (body.runtime !== 'codex_cli' && body.runtime !== 'claude_code_cli') {
    return NextResponse.json({ ok: false, error: '仅 Codex CLI / Claude Code CLI runtime 可由该接口执行。' }, { status: 400 });
  }
  if (!body.prompt?.trim()) {
    return NextResponse.json({ ok: false, error: '缺少 prompt。' }, { status: 400 });
  }

  let result;
  try {
    const startedAt = Date.now();
    const localEvidenceOutput = resolveLocalEvidenceRuntimeOutput({
      evidenceRequest: body.evidenceRequest,
      agentName: body.agentName,
      skillId: body.roleAgent?.skillId,
    });
    if (localEvidenceOutput) {
      return NextResponse.json({
        ok: true,
        output: localEvidenceOutput,
        stdout: '',
        stderr: '',
        command: 'local-context-evidence',
        durationMs: Date.now() - startedAt,
        actualRuntime: body.runtime,
      });
    }

    let prompt = body.prompt;
    let tavilyPrefetch;
    if (body.evidenceRequest?.trim()) {
      const query = buildTavilyEvidenceQuery({
        evidenceRequest: body.evidenceRequest,
        topic: body.topic,
        objective: body.objective,
        searchScope: body.searchScope,
      });
      tavilyPrefetch = await runTavilyEvidenceSearch(query, { timeoutMs: 12_000, maxResults: 5, depth: 'fast' });
      prompt = [
        body.prompt,
        '',
        'Runtime API 已执行后台公开来源预检索：',
        formatTavilyEvidenceSearchContext(tavilyPrefetch),
      ].join('\n');
    }
    result = await runRoundtableCliAgent({
      runtime: body.runtime,
      prompt,
      agentName: body.agentName || 'agent',
      phaseId: body.phaseId || 'roundtable',
      timeoutMs: body.timeoutMs || 180_000,
      roleAgent: body.roleAgent,
    });
    if (tavilyPrefetch) {
      result = { ...result, tavilyPrefetch };
    }
  } catch (error) {
    return NextResponse.json({
      ok: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
