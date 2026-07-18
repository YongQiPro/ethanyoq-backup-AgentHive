const { execFileSync } = require('node:child_process');
const { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync } = require('node:fs');
const path = require('node:path');

const desktopRoot = path.resolve(__dirname, '..');
const agentHiveRoot = path.resolve(desktopRoot, '..', '..', '..');
const openagentsRoot = path.join(agentHiveRoot, 'openagents');
const frontendRoot = path.join(openagentsRoot, 'workspace', 'frontend');
const skillsSource = path.join(openagentsRoot, 'roundtable-skills');
const resourcesRoot = path.join(desktopRoot, 'resources');
const roundtableTarget = path.join(resourcesRoot, 'roundtable');
const skillsTarget = path.join(resourcesRoot, 'defaults', 'roundtable-skills');
const runtimeModulesTarget = path.join(resourcesRoot, 'next-runtime-modules');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function requireDirectory(directory, label) {
  if (!existsSync(directory)) throw new Error(`${label} is missing: ${directory}`);
}

function cleanTarget(directory) {
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(path.dirname(directory), { recursive: true });
}

function buildFrontend() {
  if (process.platform === 'win32') {
    execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `${npmCommand} run build`], {
      cwd: frontendRoot,
      stdio: 'inherit',
    });
    return;
  }
  execFileSync(npmCommand, ['run', 'build'], {
    cwd: frontendRoot,
    stdio: 'inherit',
  });
}

function copyRuntimeSkills(sourceRoot, targetRoot) {
  mkdirSync(targetRoot, { recursive: true });
  for (const entry of readdirSync(sourceRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sourceSkillRoot = path.join(sourceRoot, entry.name);
    const targetSkillRoot = path.join(targetRoot, entry.name);
    const sourceSkill = path.join(sourceSkillRoot, 'SKILL.md');
    if (!existsSync(sourceSkill)) continue;
    mkdirSync(targetSkillRoot, { recursive: true });
    copyFileSync(sourceSkill, path.join(targetSkillRoot, 'SKILL.md'));

    const sourceManifest = path.join(sourceSkillRoot, 'references', 'sources', 'source-manifest.json');
    if (existsSync(sourceManifest)) {
      const targetManifest = path.join(targetSkillRoot, 'references', 'sources', 'source-manifest.json');
      mkdirSync(path.dirname(targetManifest), { recursive: true });
      copyFileSync(sourceManifest, targetManifest);
    }
  }
}

function prepareRoundtable() {
  requireDirectory(frontendRoot, 'Roundtable frontend');
  requireDirectory(skillsSource, 'Roundtable skill source');

  buildFrontend();

  const standaloneRoot = path.join(frontendRoot, '.next', 'standalone');
  const staticRoot = path.join(frontendRoot, '.next', 'static');
  const publicRoot = path.join(frontendRoot, 'public');
  const standaloneModules = path.join(standaloneRoot, 'node_modules');
  requireDirectory(standaloneRoot, 'Next standalone output');
  requireDirectory(staticRoot, 'Next static output');
  requireDirectory(publicRoot, 'Frontend public assets');
  requireDirectory(standaloneModules, 'Next standalone runtime modules');

  cleanTarget(roundtableTarget);
  cleanTarget(skillsTarget);
  cleanTarget(runtimeModulesTarget);
  cpSync(standaloneRoot, roundtableTarget, { recursive: true });
  cpSync(staticRoot, path.join(roundtableTarget, '.next', 'static'), { recursive: true });
  cpSync(publicRoot, path.join(roundtableTarget, 'public'), { recursive: true });
  cpSync(standaloneModules, runtimeModulesTarget, { recursive: true });
  copyRuntimeSkills(skillsSource, skillsTarget);

  console.log(JSON.stringify({
    status: 'prepared',
    roundtableTarget,
    skillsTarget,
    runtimeModulesTarget,
    copiedContext: false,
  }, null, 2));
}

if (require.main === module) prepareRoundtable();

module.exports = { prepareRoundtable };
