const path = require('node:path');

function getDesktopDataPaths(userDataPath) {
  const dataRoot = path.join(userDataPath, 'roundtable-data');
  return {
    dataRoot,
    contextRoot: path.join(dataRoot, 'context'),
    artifactRoot: path.join(dataRoot, 'output', 'roundtable-runtime'),
    skillRoot: path.join(dataRoot, 'roundtable-skills'),
    logsRoot: path.join(dataRoot, 'logs'),
    statusPath: path.join(dataRoot, 'desktop-status.json'),
  };
}

function buildRoundtableServerEnv(baseEnv, paths, port) {
  return {
    ...baseEnv,
    HOSTNAME: '127.0.0.1',
    PORT: String(port),
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    ROUNDTABLE_CONTEXT_ROOT: paths.contextRoot,
    ROUNDTABLE_RUNTIME_CWD: paths.dataRoot,
    ROUNDTABLE_RUNTIME_ARTIFACT_DIR: paths.artifactRoot,
    ROUNDTABLE_DESKTOP: '1',
  };
}

module.exports = {
  buildRoundtableServerEnv,
  getDesktopDataPaths,
};
