const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const packageJson = require("../package.json");
const packageRoot = path.resolve(__dirname, "..");
const distRoot = path.join(packageRoot, "dist");
const unpackedDirectory = path.join(distRoot, "win-unpacked");
const archiveName = `AgentHive-Portable-${packageJson.version}-x64.zip`;
const archivePath = path.join(distRoot, archiveName);
const stagingDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "agenthive-portable-"));
const portableDirectory = path.join(stagingDirectory, "AgentHive");

if (!fs.existsSync(path.join(unpackedDirectory, "AgentHive.exe"))) {
  throw new Error(`Expected portable executable is missing: ${unpackedDirectory}`);
}

try {
  fs.cpSync(unpackedDirectory, portableDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(portableDirectory, "README-Portable.txt"),
    [
      "AgentHive portable edition",
      "",
      "No installation is required. Keep the AgentHive folder intact and run AgentHive.exe.",
      "Codex CLI, Claude Code CLI, and Tavily CLI remain optional local runtime dependencies.",
      "Your discussion data is stored in the current Windows user profile, not inside this folder.",
      "",
    ].join("\r\n"),
    "utf8",
  );

  if (fs.existsSync(archivePath)) fs.rmSync(archivePath, { force: true });
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `Compress-Archive -LiteralPath '${portableDirectory.replace(/'/g, "''")}' -DestinationPath '${archivePath.replace(/'/g, "''")}' -CompressionLevel Optimal -Force`,
    ],
    { stdio: "inherit" },
  );

  if (!fs.existsSync(archivePath)) {
    throw new Error(`Portable archive was not created: ${archivePath}`);
  }
  console.log(`Created ${archivePath}`);
} finally {
  fs.rmSync(stagingDirectory, { recursive: true, force: true });
}
