const { spawn, spawnSync } = require('node:child_process');
const { createWriteStream, cpSync, existsSync, mkdirSync, writeFileSync } = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { app, BrowserWindow, dialog, Menu, shell } = require('electron');
const { buildRoundtableServerEnv, getDesktopDataPaths } = require('./lib/desktop-paths.cjs');

app.setName('AgentHive');
app.setAppUserModelId('com.agenthive.desktop');

let mainWindow;
let roundtableServer;
let runtimePaths;
let serverUrl;
const isSmokeTest = process.env.AGENTHIVE_DESKTOP_SMOKE === '1';

function resourcePath(...parts) {
  const root = app.isPackaged
    ? process.resourcesPath
    : path.join(__dirname, 'resources');
  return path.join(root, ...parts);
}

function ensureDirectory(directory) {
  mkdirSync(directory, { recursive: true });
}

function seedUserData(paths) {
  ensureDirectory(paths.contextRoot);
  ensureDirectory(paths.artifactRoot);
  ensureDirectory(paths.logsRoot);

  const contextReadme = path.join(paths.contextRoot, 'README.md');
  if (!existsSync(contextReadme)) {
    writeFileSync(contextReadme, [
      '# AgentHive context',
      '',
      'Put roundtable background files here. This folder is local to this Windows user and is not part of the installed application.',
    ].join('\n'), 'utf8');
  }

  if (!existsSync(paths.skillRoot)) {
    const defaultSkills = resourcePath('defaults', 'roundtable-skills');
    if (!existsSync(defaultSkills)) {
      throw new Error(`Packaged role skills are missing: ${defaultSkills}`);
    }
    cpSync(defaultSkills, paths.skillRoot, { recursive: true, force: false, errorOnExist: false });
  }
}

function writeStatus(status) {
  if (!runtimePaths) return;
  writeFileSync(runtimePaths.statusPath, JSON.stringify({
    updatedAt: new Date().toISOString(),
    ...status,
  }, null, 2), 'utf8');
}

function findCommand(command) {
  if (process.platform !== 'win32') return undefined;
  const result = spawnSync('where.exe', [command], { windowsHide: true, encoding: 'utf8' });
  if (result.status !== 0) return undefined;
  return result.stdout.split(/\r?\n/).map((item) => item.trim()).find(Boolean);
}

function runtimeAvailability() {
  return {
    codex: findCommand('codex'),
    claude: findCommand('claude'),
    tavily: findCommand('tvly'),
  };
}

function reserveLoopbackPort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const address = socket.address();
      socket.close((error) => {
        if (error || !address || typeof address === 'string') {
          reject(error || new Error('Unable to reserve a loopback port.'));
          return;
        }
        resolve(address.port);
      });
    });
  });
}

function waitForServer(url, timeoutMs = 45_000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(url, { timeout: 2_500 }, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) {
          resolve();
          return;
        }
        retry();
      });
      request.on('error', retry);
      request.on('timeout', () => request.destroy());
    };
    const retry = () => {
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error(`AgentHive local service did not start within ${Math.ceil(timeoutMs / 1000)} seconds.`));
        return;
      }
      setTimeout(attempt, 300);
    };
    attempt();
  });
}

async function startRoundtableServer() {
  const serverRoot = resourcePath('roundtable');
  const serverScript = path.join(serverRoot, 'server.js');
  if (!existsSync(serverScript)) {
    throw new Error(`Packaged Next server is missing: ${serverScript}`);
  }

  const port = await reserveLoopbackPort();
  serverUrl = `http://127.0.0.1:${port}/roundtable`;
  const logPath = path.join(runtimePaths.logsRoot, 'roundtable-server.log');
  const logStream = createWriteStream(logPath, { flags: 'a' });
  const env = buildRoundtableServerEnv(process.env, runtimePaths, port);
  env.ELECTRON_RUN_AS_NODE = '1';
  env.NODE_PATH = [resourcePath('next-runtime-modules'), env.NODE_PATH].filter(Boolean).join(path.delimiter);

  roundtableServer = spawn(process.execPath, [serverScript], {
    cwd: serverRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  roundtableServer.stdout.pipe(logStream);
  roundtableServer.stderr.pipe(logStream);
  roundtableServer.once('exit', (code) => {
    if (code && code !== 0) {
      writeStatus({ status: 'server-exited', code, url: serverUrl, runtime: runtimeAvailability() });
    }
  });

  await waitForServer(serverUrl);
  writeStatus({ status: 'ready', url: serverUrl, runtime: runtimeAvailability() });
}

function showRuntimeStatus() {
  const runtime = runtimeAvailability();
  const lines = [
    `Codex CLI: ${runtime.codex || 'not detected'}`,
    `Claude Code CLI: ${runtime.claude || 'not detected'}`,
    `Tavily CLI: ${runtime.tavily || 'not detected'}`,
    '',
    'AgentHive uses locally installed and signed-in CLI runtimes. Role skills and discussion data are stored in this app\'s user-data directory.',
  ];
  dialog.showMessageBox(mainWindow, {
    type: runtime.codex || runtime.claude ? 'info' : 'warning',
    title: 'AgentHive runtime dependencies',
    message: lines.join('\n'),
  });
}

function installApplicationMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: 'AgentHive',
      submenu: [
        { label: 'Runtime Dependencies', click: showRuntimeStatus },
        { label: 'Open Local Data Folder', click: () => shell.openPath(runtimePaths.dataRoot) },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { role: 'minimize' }, { role: 'close' }],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    title: 'AgentHive',
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  await mainWindow.loadURL(serverUrl);
}

function stopRoundtableServer() {
  if (!roundtableServer || roundtableServer.killed) return;
  roundtableServer.kill();
}

const lock = app.requestSingleInstanceLock();
if (!lock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    runtimePaths = getDesktopDataPaths(app.getPath('userData'));
    try {
      seedUserData(runtimePaths);
      installApplicationMenu();
      await startRoundtableServer();
      if (isSmokeTest) {
        setTimeout(() => app.quit(), 250);
        return;
      }
      await createMainWindow();
    } catch (error) {
      writeStatus({ status: 'startup-failed', error: error instanceof Error ? error.message : String(error) });
      if (isSmokeTest) {
        console.error(error);
        app.exit(1);
        return;
      }
      dialog.showErrorBox('AgentHive failed to start', error instanceof Error ? error.message : String(error));
      app.quit();
    }
  });

  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', stopRoundtableServer);
}
