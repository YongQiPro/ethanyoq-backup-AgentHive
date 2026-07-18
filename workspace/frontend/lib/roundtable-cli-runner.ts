import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import type { RoundtableAgentRuntime } from './roundtable-engine';

export interface RoundtableRoleAgentRunConfig {
  mode: 'role_agent';
  skillId?: string;
  skillPath?: string;
  skillLoadStatus?: string;
  sourceManifestPath?: string;
  profileDir?: string;
}

export interface RoundtableRoleAgentEvidence {
  mode: 'role_agent';
  skillId?: string;
  skillPath?: string;
  resolvedSkillPath?: string;
  skillExists: boolean;
  skillHash?: string;
  manifestPath?: string;
  resolvedManifestPath?: string;
  manifestExists: boolean;
  manifestHash?: string;
  skillLoadStatus?: string;
  profileDir?: string;
  profileSkillPath?: string;
  profileSkillExists: boolean;
  profileSkillHash?: string;
  skillInstalledToProfile: boolean;
  skillProfileHashMatchesSource: boolean;
  skillLoadVerified: boolean;
  skillLoadVerificationStatus: 'not_checked' | 'probe_passed' | 'probe_failed';
  codexHomeForRun?: string;
  fullSkillBodyEmbedded: false;
}

export interface RoundtableCliRunInput {
  runtime: Exclude<RoundtableAgentRuntime, 'demo'>;
  prompt: string;
  agentName: string;
  phaseId: string;
  timeoutMs?: number;
  roleAgent?: RoundtableRoleAgentRunConfig;
}

export interface RoundtableCliRunResult {
  ok: boolean;
  output: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  command: string;
  durationMs: number;
  promptPath: string;
  outputPath?: string;
  roleAgentEvidence?: RoundtableRoleAgentEvidence;
  error?: string;
  actualRuntime?: Exclude<RoundtableAgentRuntime, 'demo'>;
  fallbackFrom?: Exclude<RoundtableAgentRuntime, 'demo'>;
  fallbackReason?: string;
}

interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
}

const projectRoot = join(process.cwd(), '..', '..');
const runtimeCwd = process.env.ROUNDTABLE_RUNTIME_CWD || projectRoot;
const artifactDir = process.env.ROUNDTABLE_RUNTIME_ARTIFACT_DIR ||
  join(projectRoot, 'output', 'roundtable-runtime');

type RoundtableRuntimeEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

function runtimeEffort(): RoundtableRuntimeEffort {
  const configured = (process.env.ROUNDTABLE_MODEL_EFFORT || process.env.ROUNDTABLE_REASONING_EFFORT || 'low').trim();
  return ['low', 'medium', 'high', 'xhigh', 'max'].includes(configured)
    ? configured as RoundtableRuntimeEffort
    : 'low';
}

function safeSlug(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'agent';
}

function ensureArtifactDir() {
  mkdirSync(artifactDir, { recursive: true });
}

function writeArtifact(name: string, value: string): string {
  ensureArtifactDir();
  const path = join(artifactDir, name);
  writeFileSync(path, value, 'utf8');
  return path;
}

function quoteCmdArg(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function commandForDisplay(command: string, args: string[]): string {
  return [command, ...args].map((item) => item.includes(' ') ? quoteCmdArg(item) : item).join(' ');
}

function codexSandboxForRun(isRoleAgent: boolean): string {
  const configured = isRoleAgent
    ? process.env.ROUNDTABLE_CODEX_ROLE_AGENT_SANDBOX
    : process.env.ROUNDTABLE_CODEX_LEGACY_SANDBOX;
  if (configured?.trim()) return configured.trim();

  // Windows read-only sandbox can block the child Codex process from reading
  // installed SKILL.md files via shell (`CreateProcessAsUserW failed: 5`).
  return isRoleAgent && process.platform === 'win32' ? 'danger-full-access' : 'read-only';
}

function resolveEvidencePath(path?: string): string | undefined {
  if (!path) return undefined;
  const normalized = path.replace(/\\/g, '/');
  const candidates = [
    path,
    isAbsolute(path) ? path : join(runtimeCwd, path),
    isAbsolute(path) ? path : join(process.cwd(), path),
  ];
  if (/^openagents\//i.test(normalized)) {
    candidates.push(join(runtimeCwd, normalized.replace(/^openagents\//i, '')));
  }
  return candidates.find((candidate) => existsSync(candidate)) || (isAbsolute(path) ? path : join(runtimeCwd, path));
}

function profileRootForSkill(skillId?: string, runtime: Exclude<RoundtableAgentRuntime, 'demo'> = 'codex_cli'): string {
  void skillId;
  if (runtime === 'claude_code_cli') {
    return process.env.ROUNDTABLE_CLAUDE_HOME || process.env.CLAUDE_HOME || join(homedir(), '.claude');
  }
  return process.env.ROUNDTABLE_CODEX_HOME || process.env.CODEX_HOME || join(homedir(), '.codex');
}

function installSkillIntoProfile(
  skillId: string | undefined,
  resolvedSkillPath: string | undefined,
  runtime: Exclude<RoundtableAgentRuntime, 'demo'> = 'codex_cli',
): { profileDir: string; profileSkillPath?: string; profileSkillExists: boolean; profileSkillHash?: string } {
  const profileDir = profileRootForSkill(skillId, runtime);
  if (!skillId || !resolvedSkillPath || !existsSync(resolvedSkillPath)) {
    return { profileDir, profileSkillExists: false };
  }
  const profileSkillDir = join(profileDir, 'skills', safeSlug(skillId));
  mkdirSync(profileSkillDir, { recursive: true });
  const profileSkillPath = join(profileSkillDir, 'SKILL.md');
  copyFileSync(resolvedSkillPath, profileSkillPath);
  return {
    profileDir,
    profileSkillPath,
    profileSkillExists: existsSync(profileSkillPath),
    profileSkillHash: sha256File(profileSkillPath),
  };
}

function sha256File(path?: string): string | undefined {
  if (!path || !existsSync(path)) return undefined;
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function buildRoleAgentEvidence(
  roleAgent?: RoundtableRoleAgentRunConfig,
  runtime: Exclude<RoundtableAgentRuntime, 'demo'> = 'codex_cli',
): RoundtableRoleAgentEvidence | undefined {
  if (roleAgent?.mode !== 'role_agent') return undefined;
  const resolvedSkillPath = resolveEvidencePath(roleAgent.skillPath);
  const resolvedManifestPath = resolveEvidencePath(roleAgent.sourceManifestPath);
  const skillHash = sha256File(resolvedSkillPath);
  const manifestHash = sha256File(resolvedManifestPath);
  const profile = installSkillIntoProfile(roleAgent.skillId, resolvedSkillPath, runtime);
  const skillProfileHashMatchesSource = Boolean(
    skillHash &&
    profile.profileSkillHash &&
    profile.profileSkillHash === skillHash,
  );
  return {
    mode: 'role_agent',
    skillId: roleAgent.skillId,
    skillPath: roleAgent.skillPath,
    resolvedSkillPath,
    skillExists: Boolean(resolvedSkillPath && existsSync(resolvedSkillPath)),
    skillHash,
    manifestPath: roleAgent.sourceManifestPath,
    resolvedManifestPath,
    manifestExists: Boolean(resolvedManifestPath && existsSync(resolvedManifestPath)),
    manifestHash,
    skillLoadStatus: roleAgent.skillLoadStatus,
    ...profile,
    skillInstalledToProfile: Boolean(profile.profileSkillExists),
    skillProfileHashMatchesSource,
    skillLoadVerified: false,
    skillLoadVerificationStatus: 'not_checked',
    codexHomeForRun: runtime === 'codex_cli' ? profile.profileDir : undefined,
    fullSkillBodyEmbedded: false,
  };
}

export function prepareRoleAgentPrompt(
  prompt: string,
  evidence?: RoundtableRoleAgentEvidence,
): string {
  if (!evidence) return prompt;
  return [
    'ROLE_AGENT_EVIDENCE',
    `skill_id: ${evidence.skillId || 'none'}`,
    `skill_path: ${evidence.skillPath || 'none'}`,
    `resolved_skill_path: ${evidence.resolvedSkillPath || 'none'}`,
    `skill_exists: ${evidence.skillExists}`,
    `skill_hash: ${evidence.skillHash || 'none'}`,
    `manifest_path: ${evidence.manifestPath || 'none'}`,
    `resolved_manifest_path: ${evidence.resolvedManifestPath || 'none'}`,
    `manifest_exists: ${evidence.manifestExists}`,
    `manifest_hash: ${evidence.manifestHash || 'none'}`,
    `skill_load_status: ${evidence.skillLoadStatus || 'none'}`,
    `profile_dir: ${evidence.profileDir || 'none'}`,
    `profile_skill_path: ${evidence.profileSkillPath || 'none'}`,
    `profile_skill_exists: ${evidence.profileSkillExists}`,
    `profile_skill_hash: ${evidence.profileSkillHash || 'none'}`,
    `skill_installed_to_profile: ${evidence.skillInstalledToProfile}`,
    `skill_profile_hash_matches_source: ${evidence.skillProfileHashMatchesSource}`,
    `skill_load_verified: ${evidence.skillLoadVerified}`,
    `skill_load_verification_status: ${evidence.skillLoadVerificationStatus}`,
    `codex_home_for_run: ${evidence.codexHomeForRun || 'none'}`,
    'full_skill_body_embedded: false',
    'Instruction: use the installed role skill if your runtime has it available; copied-profile evidence is not proof that the runtime loaded the full skill body.',
    'END_ROLE_AGENT_EVIDENCE',
    '',
    prompt,
  ].join('\n');
}

function runProcess(
  command: string,
  args: string[],
  options: { cwd?: string; input?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv } = {},
): Promise<ProcessResult> {
  const started = Date.now();
  return new Promise((resolve) => {
    const isWindowsScript = process.platform === 'win32' && /\.(cmd|bat)$/i.test(command);
    let child;
    try {
      child = isWindowsScript
        ? spawn('cmd.exe', ['/d', '/c', ['call', quoteCmdArg(command), ...args.map(quoteCmdArg)].join(' ')], {
          cwd: options.cwd,
          env: options.env,
          windowsVerbatimArguments: true,
          windowsHide: true,
        })
        : spawn(command, args, {
          cwd: options.cwd,
          env: options.env,
          windowsHide: true,
        });
    } catch (error) {
      resolve({
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: null,
        durationMs: Date.now() - started,
      });
      return;
    }

    let stdout = '';
    let stderr = '';
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      resolve({
        stdout,
        stderr: `${stderr}\nProcess timed out after ${options.timeoutMs}ms`.trim(),
        exitCode: null,
        durationMs: Date.now() - started,
      });
    }, options.timeoutMs || 180_000);

    child.stdout?.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        stdout,
        stderr: `${stderr}\n${error.message}`.trim(),
        exitCode: null,
        durationMs: Date.now() - started,
      });
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ stdout, stderr, exitCode: code, durationMs: Date.now() - started });
    });

    if (options.input) {
      child.stdin?.write(options.input);
    }
    child.stdin?.end();
  });
}

async function where(command: string): Promise<string[]> {
  if (process.platform !== 'win32') return [command];
  const result = await runProcess('where.exe', [command], { timeoutMs: 5_000 });
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

async function resolveExecutable(
  command: string,
  envName: string,
  preferredExtensions: string[],
): Promise<string> {
  const configured = process.env[envName];
  if (configured) return configured;
  const candidates = await where(command);
  const existing = candidates.filter((item) => existsSync(item));
  const sorted = [...existing].sort((a, b) => {
    const aIndex = preferredExtensions.findIndex((ext) => a.toLowerCase().endsWith(ext));
    const bIndex = preferredExtensions.findIndex((ext) => b.toLowerCase().endsWith(ext));
    return (aIndex < 0 ? 99 : aIndex) - (bIndex < 0 ? 99 : bIndex);
  });
  return sorted[0] || command;
}

export function buildCodexArgs(input: {
  input: RoundtableCliRunInput;
  outputPath: string;
  runtimeCwd: string;
}): string[] {
  const isRoleAgent = input.input.roleAgent?.mode === 'role_agent';
  const sandbox = codexSandboxForRun(isRoleAgent);
  const effortConfig = `model_reasoning_effort="${runtimeEffort()}"`;
  const base = [
    'exec',
    '-c',
    effortConfig,
    '--sandbox',
    sandbox,
    '--color',
    'never',
    '--cd',
    input.runtimeCwd,
    '-o',
    input.outputPath,
    '-',
  ];
  return isRoleAgent ? base : [
    'exec',
    '-c',
    effortConfig,
    '--ephemeral',
    '--ignore-user-config',
    '--sandbox',
    'read-only',
    '--ignore-rules',
    '--color',
    'never',
    '--cd',
    input.runtimeCwd,
    '-o',
    input.outputPath,
    '-',
  ];
}

export function buildClaudeArgs(input: RoundtableCliRunInput): string[] {
  void input.prompt;
  const base = ['-p', '--effort', runtimeEffort(), '--output-format', 'text'];
  return input.roleAgent?.mode === 'role_agent'
    ? base
    : [...base, '--no-session-persistence', '--disable-slash-commands'];
}

async function runCodex(input: RoundtableCliRunInput): Promise<RoundtableCliRunResult> {
  const command = await resolveExecutable('codex', 'CODEX_EXE', ['.cmd', '.exe', '']);
  const slug = `${safeSlug(input.phaseId)}-${safeSlug(input.agentName)}-${Date.now().toString(36)}`;
  const roleAgentEvidence = buildRoleAgentEvidence(input.roleAgent, input.runtime);
  const prompt = prepareRoleAgentPrompt(input.prompt, roleAgentEvidence);
  const promptPath = writeArtifact(`${slug}.prompt.md`, prompt);
  const outputPath = join(artifactDir, `${slug}.codex-output.txt`);
  const args = buildCodexArgs({ input, outputPath, runtimeCwd });
  const result = await runProcess(command, args, {
    cwd: runtimeCwd,
    input: prompt,
    timeoutMs: input.timeoutMs,
    env: {
      ...process.env,
      NO_COLOR: '1',
      ...(roleAgentEvidence?.codexHomeForRun ? { CODEX_HOME: roleAgentEvidence.codexHomeForRun } : {}),
    },
  });
  const output = existsSync(outputPath) ? readFileSync(outputPath, 'utf8').trim() : result.stdout.trim();
  writeArtifact(`${slug}.codex-stdout.log`, result.stdout);
  writeArtifact(`${slug}.codex-stderr.log`, result.stderr);
  return {
    ok: result.exitCode === 0 && output.length > 0,
    output,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    command: commandForDisplay(command, args),
    durationMs: result.durationMs,
    promptPath,
    outputPath,
    roleAgentEvidence,
    actualRuntime: 'codex_cli',
    error: result.exitCode === 0 ? undefined : result.stderr || result.stdout || 'Codex CLI returned no output.',
  };
}

async function runClaude(input: RoundtableCliRunInput): Promise<RoundtableCliRunResult> {
  const command = await resolveExecutable('claude', 'CLAUDE_EXE', ['.exe', '.cmd', '']);
  const slug = `${safeSlug(input.phaseId)}-${safeSlug(input.agentName)}-${Date.now().toString(36)}`;
  const roleAgentEvidence = buildRoleAgentEvidence(input.roleAgent, input.runtime);
  const prompt = prepareRoleAgentPrompt(input.prompt, roleAgentEvidence);
  const promptPath = writeArtifact(`${slug}.prompt.md`, prompt);
  const args = buildClaudeArgs({ ...input, prompt });
  const result = await runProcess(command, args, {
    cwd: runtimeCwd,
    input: prompt,
    timeoutMs: input.timeoutMs,
    env: { ...process.env, NO_COLOR: '1' },
  });
  const outputPath = writeArtifact(`${slug}.claude-output.txt`, result.stdout.trim());
  writeArtifact(`${slug}.claude-stderr.log`, result.stderr);
  return {
    ok: result.exitCode === 0 && result.stdout.trim().length > 0,
    output: result.stdout.trim(),
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    command: commandForDisplay(command, buildClaudeArgs({ ...input, prompt: '<stdin-prompt>' })),
    durationMs: result.durationMs,
    promptPath,
    outputPath,
    roleAgentEvidence,
    actualRuntime: 'claude_code_cli',
    error: result.exitCode === 0 ? undefined : result.stderr || result.stdout || 'Claude Code CLI returned no output.',
  };
}

export async function runRoundtableCliAgent(input: RoundtableCliRunInput): Promise<RoundtableCliRunResult> {
  ensureArtifactDir();
  if (input.runtime === 'codex_cli') {
    const codexResult = await runCodex(input);
    if (!shouldFallbackFromCodexToClaude(codexResult)) return codexResult;
    const fallbackResult = await runClaude({ ...input, runtime: 'claude_code_cli' });
    const fallbackReason = codexResult.error || codexResult.stderr || codexResult.stdout || 'Codex CLI failed before fallback.';
    return {
      ...fallbackResult,
      stdout: [
        '--- Codex CLI fallback source stdout ---',
        codexResult.stdout,
        '--- Claude Code fallback stdout ---',
        fallbackResult.stdout,
      ].join('\n').trim(),
      stderr: [
        '--- Codex CLI fallback source stderr ---',
        codexResult.stderr,
        '--- Claude Code fallback stderr ---',
        fallbackResult.stderr,
      ].join('\n').trim(),
      command: `${codexResult.command} || ${fallbackResult.command}`,
      durationMs: codexResult.durationMs + fallbackResult.durationMs,
      actualRuntime: 'claude_code_cli',
      fallbackFrom: 'codex_cli',
      fallbackReason,
      error: fallbackResult.ok ? undefined : `Codex CLI fallback triggered: ${fallbackReason}\nClaude Code CLI failed: ${fallbackResult.error || fallbackResult.stderr || 'unknown error'}`,
    };
  }
  return runClaude(input);
}

export function shouldFallbackFromCodexToClaude(result: Partial<RoundtableCliRunResult> & Pick<RoundtableCliRunResult, 'ok'>): boolean {
  if (result.ok) return false;
  const text = [result.error, result.stderr, result.stdout].filter(Boolean).join('\n').toLowerCase();
  return text.includes('usage limit') ||
    text.includes("you've hit your usage limit") ||
    text.includes('codex/settings/usage') ||
    text.includes('try again at');
}

export function getRoundtableRuntimeArtifactDir(): string {
  ensureArtifactDir();
  return artifactDir || tmpdir();
}
