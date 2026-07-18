import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_CONTEXT_ROOT } from './roundtable-context-file';

interface LocalEvidenceInput {
  evidenceRequest?: string;
  contextRoot?: string;
}

interface LocalEvidenceFact {
  type?: 'known_fact' | 'source' | 'uncertainty';
  content?: string;
  source?: string;
  status?: 'verified' | 'unverified' | 'needs_evidence';
}

interface LocalEvidenceEntry {
  requestIncludes?: string[];
  resultSummary?: string;
  facts?: LocalEvidenceFact[];
  sourceRefs?: string[];
}

interface LocalEvidenceFile {
  entries?: LocalEvidenceEntry[];
}

const localEvidenceFilename = 'agenthive-evidence.json';

function matchesRequest(entry: LocalEvidenceEntry, request: string): boolean {
  const matchers = Array.isArray(entry.requestIncludes)
    ? entry.requestIncludes.map((item) => item.trim()).filter(Boolean)
    : [];
  return matchers.length === 0 || matchers.every((matcher) => request.includes(matcher));
}

function readLocalEvidenceFile(contextRoot: string): LocalEvidenceEntry[] {
  const filePath = path.join(contextRoot, localEvidenceFilename);
  if (!existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as LocalEvidenceFile;
    return Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch {
    return [];
  }
}

export function resolveLocalEvidenceRuntimeOutput(input: LocalEvidenceInput): string | null {
  const request = input.evidenceRequest?.trim() || '';
  if (!request) return null;
  const contextRoot = path.resolve(input.contextRoot || DEFAULT_CONTEXT_ROOT);
  const entry = readLocalEvidenceFile(contextRoot).find((candidate) => matchesRequest(candidate, request));
  if (!entry?.resultSummary || !Array.isArray(entry.facts) || entry.facts.length === 0) return null;

  const facts = entry.facts
    .filter((fact) => fact.content?.trim() && fact.source?.trim())
    .map((fact) => ({
      type: fact.type || 'known_fact',
      content: fact.content!.trim(),
      source: fact.source!.trim(),
      status: fact.status || 'unverified',
    }));
  if (facts.length === 0) return null;

  return JSON.stringify({
    status: facts.some((fact) => fact.status === 'verified') ? 'researched' : 'not_found',
    resultSummary: entry.resultSummary.trim(),
    facts,
    sourceRefs: Array.isArray(entry.sourceRefs)
      ? entry.sourceRefs.map((item) => item.trim()).filter(Boolean)
      : facts.map((fact) => fact.source),
  });
}
