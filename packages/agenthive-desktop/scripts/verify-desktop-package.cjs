const { existsSync, readdirSync, readFileSync, statSync } = require('node:fs');
const path = require('node:path');

const desktopRoot = path.resolve(__dirname, '..');
const resourcesRoot = path.join(desktopRoot, 'resources');
const roundtableRoot = path.join(resourcesRoot, 'roundtable');
const skillsRoot = path.join(resourcesRoot, 'defaults', 'roundtable-skills');
const runtimeModulesRoot = path.join(resourcesRoot, 'next-runtime-modules');
const forbiddenResourcePaths = new Set([
  path.join(roundtableRoot, 'context'),
  path.join(roundtableRoot, 'output'),
  path.join(resourcesRoot, 'defaults', 'context'),
]);
const defaultSensitivePatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:sk|tvly)-[A-Za-z0-9_-]{16,}\b/,
  /\bghp_[A-Za-z0-9]{20,}\b/,
  /\bAKIA[A-Z0-9]{16}\b/,
];

function releaseSensitivePatterns() {
  const configuredTerms = process.env.AGENTHIVE_RELEASE_PRIVATE_TERMS || '';
  return configuredTerms
    .split(',')
    .map((term) => term.trim())
    .filter(Boolean)
    .map((term) => new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
}

const privateTerms = [...defaultSensitivePatterns, ...releaseSensitivePatterns()];

function walk(directory, visitor) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      visitor(filePath, entry);
      walk(filePath, visitor);
    } else {
      visitor(filePath, entry);
    }
  }
}

function textContent(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (!['.js', '.cjs', '.json', '.md', '.txt', '.html', '.css'].includes(extension)) return undefined;
  if (statSync(filePath).size > 3_000_000) return undefined;
  return readFileSync(filePath, 'utf8');
}

function verifyDesktopPackageResources() {
  const required = [
    path.join(roundtableRoot, 'server.js'),
    path.join(roundtableRoot, '.next', 'static'),
    path.join(roundtableRoot, 'public', 'favicon.ico'),
    path.join(runtimeModulesRoot, 'next', 'package.json'),
    path.join(skillsRoot, 'musk-first-principles-perspective', 'SKILL.md'),
    path.join(skillsRoot, 'bezos-customer-flywheel-perspective', 'SKILL.md'),
  ];
  for (const item of required) {
    if (!existsSync(item)) throw new Error(`Required desktop resource is missing: ${item}`);
  }

  const violations = [];
  walk(resourcesRoot, (filePath, entry) => {
    if (forbiddenResourcePaths.has(filePath) || entry.name === '.env' || entry.name === '.env.local') {
      violations.push(`Forbidden bundled path: ${filePath}`);
    }
    if (!entry.isFile()) return;
    const content = textContent(filePath);
    if (!content) return;
    for (const pattern of privateTerms) {
      if (pattern.test(content)) violations.push(`Private term ${pattern} found in: ${filePath}`);
    }
  });
  if (violations.length) throw new Error(violations.join('\n'));

  console.log(JSON.stringify({
    status: 'verified',
    roundtableRoot,
    skillsRoot,
    runtimeModulesRoot,
    contextBundled: false,
  }, null, 2));
}

if (require.main === module) verifyDesktopPackageResources();

module.exports = { verifyDesktopPackageResources };
