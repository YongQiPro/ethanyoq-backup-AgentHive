const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { buildRoundtableServerEnv, getDesktopDataPaths } = require('../lib/desktop-paths.cjs');

test('desktop runtime keeps mutable data in the Windows user-data directory', () => {
  const userData = path.join('C:', 'Users', 'Example', 'AppData', 'Roaming', 'AgentHive');
  const paths = getDesktopDataPaths(userData);

  assert.equal(paths.dataRoot, path.join(userData, 'roundtable-data'));
  assert.equal(paths.contextRoot, path.join(userData, 'roundtable-data', 'context'));
  assert.equal(paths.skillRoot, path.join(userData, 'roundtable-data', 'roundtable-skills'));
  assert.equal(paths.artifactRoot, path.join(userData, 'roundtable-data', 'output', 'roundtable-runtime'));
});

test('desktop runtime only binds the bundled server to loopback and supplies no source-tree context', () => {
  const paths = getDesktopDataPaths(path.join('C:', 'Users', 'Example', 'AppData', 'Roaming', 'AgentHive'));
  const env = buildRoundtableServerEnv({ PATH: 'example-path' }, paths, 43123);

  assert.equal(env.HOSTNAME, '127.0.0.1');
  assert.equal(env.PORT, '43123');
  assert.equal(env.ROUNDTABLE_CONTEXT_ROOT, paths.contextRoot);
  assert.equal(env.ROUNDTABLE_RUNTIME_CWD, paths.dataRoot);
  assert.equal(env.ROUNDTABLE_RUNTIME_ARTIFACT_DIR, paths.artifactRoot);
  assert.equal(env.NODE_PATH, undefined);
  assert.equal(env.ROUNDTABLE_CONTEXT_ROOT.includes('Vibe Coding Project'), false);
});
