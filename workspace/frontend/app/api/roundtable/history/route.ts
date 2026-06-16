import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import type { RoundtableState } from '@/lib/roundtable-engine';
import {
  createRoundtableHistoryItem,
  type RoundtableHistoryItem,
} from '@/lib/roundtable-history';

export const runtime = 'nodejs';

interface ArtifactCandidate {
  id: string;
  label: string;
  relativePath: string;
}

const artifactCandidates: ArtifactCandidate[] = [
  {
    id: 'artifact:ceo-realism-smoke-test',
    label: '最近 CEO 真实感测试',
    relativePath: 'output/ceo-realism-smoke-test/state.json',
  },
  {
    id: 'artifact:roundtable-pdf-test',
    label: 'PDF 片段圆桌测试',
    relativePath: 'output/roundtable-pdf-test/roundtable-state.json',
  },
];

function repositoryRoot(): string {
  return path.resolve(process.cwd(), '..', '..');
}

async function readArtifact(candidate: ArtifactCandidate): Promise<RoundtableHistoryItem | null> {
  const absolutePath = path.join(repositoryRoot(), candidate.relativePath);
  try {
    const [raw, fileStat] = await Promise.all([
      readFile(absolutePath, 'utf8'),
      stat(absolutePath),
    ]);
    const parsed = JSON.parse(raw) as RoundtableState;
    return createRoundtableHistoryItem(parsed, {
      id: candidate.id,
      source: 'artifact',
      updatedAt: fileStat.mtime.toISOString(),
    });
  } catch {
    return null;
  }
}

export async function GET() {
  const items = (await Promise.all(artifactCandidates.map(readArtifact)))
    .filter((item): item is RoundtableHistoryItem => Boolean(item));

  return NextResponse.json({
    items,
    artifactLabels: artifactCandidates.map((candidate) => candidate.label),
  });
}
