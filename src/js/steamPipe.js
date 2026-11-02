const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const extract = require('extract-zip');
const { buildsmithPath } = require('./settings');
const { materializeBuild } = require('./downloadManager');

const STEAMCMD = {
  win32: { url: 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip', exe: 'steamcmd.exe', kind: 'zip' },
  darwin: { url: 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd_osx.tar.gz', exe: 'steamcmd.sh', kind: 'tar' },
  linux: { url: 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz', exe: 'steamcmd.sh', kind: 'tar' },
};

let activeUpload = null;

function steamRoot() {
  return path.join(buildsmithPath, 'steam');
}

function settingsFile(gameId) {
  return path.join(steamRoot(), 'games', `${gameId}.json`);
}

function loadSteamSettings(gameId) {
  try {
    const saved = JSON.parse(fs.readFileSync(settingsFile(gameId), 'utf8'));
    return {
      appId: saved.appId || '',
      depotId: saved.depotId || '',
      username: saved.username || '',
      branch: saved.branch || '',
    };
  } catch (error) {
    return { appId: '', depotId: '', username: '', branch: '' };
  }
}

function saveSteamSettings(gameId, settings) {
  const next = {
    appId: String(settings.appId || '').trim(),
    depotId: String(settings.depotId || '').trim(),
    username: String(settings.username || '').trim(),
    branch: String(settings.branch || '').trim(),
  };
  const file = settingsFile(gameId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(next, null, 2));
  return next;
}

function appBuildScript({ appId, depotId, description, contentRoot, buildOutput, branch }) {
  const root = contentRoot.replace(/\\/g, '/');
  const output = buildOutput.replace(/\\/g, '/');
  const live = String(branch || '').replace(/"/g, '');
  const desc = String(description || '').replace(/"/g, '');
  return `"AppBuild"
{
\t"AppID" "${appId}"
\t"Desc" "${desc}"
\t"ContentRoot" "${root}"
\t"BuildOutput" "${output}"
\t"SetLive" "${live}"
\t"Depots"
\t{
\t\t"${depotId}"
\t\t{
\t\t\t"FileMapping"
\t\t\t{
\t\t\t\t"LocalPath" "*"
\t\t\t\t"DepotPath" "."
\t\t\t\t"recursive" "1"
\t\t\t}
\t\t}
\t}
}
`;
}

function steamcmdArgs({ username, password, guardCode, scriptPath }) {
  const args = ['+@ShutdownOnFailedCommand', '1', '+@NoPromptForPassword', '1', '+login', username];
  if (password) args.push(password);
  if (guardCode) args.push(guardCode);
  args.push('+run_app_build', scriptPath, '+quit');
  return args;
}

function redact(text, secrets) {
  return secrets.reduce((out, secret) => (secret ? out.split(secret).join('••••') : out), text);
}

function downloadFile(url, dest) {
  return fetch(url).then(async res => {
    if (!res.ok) throw new Error(`Failed to download SteamCMD (${res.status})`);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.writeFile(dest, Buffer.from(await res.arrayBuffer()));
  });
}

function extractTar(archive, dest) {
  return new Promise((resolve, reject) => {
    const child = spawn('tar', ['-xzf', archive, '-C', dest], { windowsHide: true });
    child.on('error', reject);
    child.on('close', code => (code === 0 ? resolve() : reject(new Error(`tar exited with code ${code}`))));
  });
}

async function ensureSteamCmd(onLog) {
  const spec = STEAMCMD[process.platform];
  if (!spec) throw new Error('SteamCMD is not available on this operating system.');
  const dir = path.join(steamRoot(), 'cmd');
  const exe = path.join(dir, spec.exe);
  if (fs.existsSync(exe)) return exe;
  onLog?.('Downloading SteamCMD…');
  fs.mkdirSync(dir, { recursive: true });
  const archive = path.join(steamRoot(), path.basename(spec.url));
  await downloadFile(spec.url, archive);
  if (spec.kind === 'zip') await extract(archive, { dir });
  else await extractTar(archive, dir);
  fs.rmSync(archive, { force: true });
  if (spec.exe.endsWith('.sh')) fs.chmodSync(exe, 0o755);
  if (!fs.existsSync(exe)) throw new Error('SteamCMD did not extract correctly.');
  return exe;
}

function runSteamCmd(exe, args, { secrets, onLog }) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { cwd: path.dirname(exe), windowsHide: true });
    const lines = [];
    const take = chunk => {
      for (const line of redact(chunk.toString(), secrets).split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        lines.push(trimmed);
        if (lines.length > 400) lines.shift();
        onLog?.(trimmed);
      }
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('error', reject);
    child.on('close', code => resolve({ code, lines }));
  });
}

async function uploadCurrentBuild({
  gameId,
  version,
  appId,
  depotId,
  username,
  password,
  guardCode,
  branch,
  sessionId,
  origin,
  onProgress,
}) {
  if (activeUpload) throw new Error('A Steam upload is already running.');
  const id = String(appId || '').trim();
  const depot = String(depotId || '').trim();
  const user = String(username || '').trim();
  const liveBranch = String(branch || '').trim();
  if (!/^\d+$/.test(id) || !/^\d+$/.test(depot)) throw new Error('App ID and Depot ID must be numbers.');
  if (!user) throw new Error('Enter the Steam build account username.');
  if (guardCode && !password) throw new Error('Enter the Steam password together with the Steam Guard code.');
  if (/^(default|public)$/i.test(liveBranch)) {
    throw new Error('Enter a beta branch, or leave the branch empty. The public branch is published from the Steamworks builds page.');
  }

  activeUpload = gameId;
  const secrets = [password, guardCode].filter(Boolean);
  const report = progress => onProgress?.({ gameId, ...progress });
  const log = message => report({ phase: 'log', message });
  let contentRoot;
  try {
    contentRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'buildsmith-steam-'));
    saveSteamSettings(gameId, { appId: id, depotId: depot, username: user, branch: liveBranch });
    report({ phase: 'downloading', message: `Fetching v${version}…`, percentage: 0 });
    await materializeBuild({
      gameId,
      version,
      dest: contentRoot,
      sessionId,
      origin,
      onProgress: ({ percentage }) =>
        report({
          phase: 'downloading',
          message: `Fetching v${version}…`,
          percentage: Math.round((percentage || 0) * 100),
        }),
    });

    const exe = await ensureSteamCmd(log);
    const scripts = path.join(steamRoot(), 'scripts');
    const output = path.join(steamRoot(), 'output', id);
    fs.mkdirSync(scripts, { recursive: true });
    fs.mkdirSync(output, { recursive: true });
    const scriptPath = path.join(scripts, `app_build_${id}.vdf`);
    fs.writeFileSync(
      scriptPath,
      appBuildScript({
        appId: id,
        depotId: depot,
        description: version,
        contentRoot,
        buildOutput: output,
        branch: liveBranch,
      })
    );

    report({ phase: 'uploading', message: 'Uploading to Steam…', percentage: null });
    let result;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      result = await runSteamCmd(exe, steamcmdArgs({ username: user, password, guardCode, scriptPath }), {
        secrets,
        onLog: line => {
          const match = line.match(/(\d{1,3}(?:\.\d+)?)%/);
          report({
            phase: 'uploading',
            message: line,
            percentage: match ? Math.min(100, Math.round(Number(match[1]))) : undefined,
          });
        },
      });
      if (result.code !== 7) break;
      log('SteamCMD updated itself. Retrying…');
    }
    if (result.code !== 0) {
      throw new Error(result.lines.slice(-12).join('\n') || `SteamCMD exited with code ${result.code}`);
    }
    const buildLine = [...result.lines].reverse().find(line => /BuildID/i.test(line)) || 'Upload finished.';
    report({ phase: 'done', message: buildLine, percentage: 100 });
    return { ok: true, message: buildLine };
  } finally {
    activeUpload = null;
    if (contentRoot) fs.rmSync(contentRoot, { recursive: true, force: true });
  }
}

module.exports = {
  appBuildScript,
  steamcmdArgs,
  loadSteamSettings,
  saveSteamSettings,
  uploadCurrentBuild,
};
