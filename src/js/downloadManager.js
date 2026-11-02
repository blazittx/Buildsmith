const fs = require('fs');
const https = require('https');
const path = require('path');
const { BrowserWindow } = require('electron');
const { download } = require('electron-dl');
const extract = require('extract-zip');
const { buildsmithPath, versionFilePath } = require('./settings');
const { getMainWindow } = require('./windowStore');
const { getLatestGameVersion } = require('./versionChecker');
const { applyManifest, missingChunks } = require('./patcher');

const downloadAgent = new https.Agent({ keepAlive: true, maxSockets: 16 });

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`;
}

async function extractZip(zipPath, gameId, event) {
  const extractPath = path.join(buildsmithPath, gameId);
  try {
    await extract(zipPath, { dir: extractPath });
    fs.unlinkSync(zipPath);
    event.sender.send('download-complete', gameId);
    return extractPath;
  } catch (err) {
    console.error('Extraction error:', err);
    event.sender.send('download-error', gameId, err.message);
    throw err;
  }
}

async function readSession() {
  return BrowserWindow.getFocusedWindow()?.webContents.executeJavaScript(`(() => {
    const m = document.cookie.match(/sessionID=([^;]+)/);
    return m ? m[1] : null;
  })()`);
}

function launcherOrigin() {
  try {
    const raw = getMainWindow()?.webContents?.getURL?.() || '';
    if (raw.startsWith('http')) return new URL(raw).origin;
  } catch (error) {
    console.warn('Could not read launcher origin', error);
  }
  return 'https://buildsmith.app';
}

async function presignMany(keys, sessionId) {
  if (!keys.length) return new Map();
  const res = await fetch(`${launcherOrigin()}/.netlify/functions/generateDownloadUrl`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionId ? { sessionID: sessionId } : {}),
    },
    body: JSON.stringify({ keys }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to sign download URLs');
  return new Map((data.urls || []).map(item => [item.key, item.url]));
}

function downloadUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { agent: downloadAgent }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        resolve(downloadUrl(res.headers.location));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Download failed (${res.statusCode})`));
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
  });
}

async function tryPatch(event, gameId) {
  const sessionId = await readSession();
  const { latestVersion } = await getLatestGameVersion(gameId);
  if (!latestVersion) throw new Error('Game version information not found.');

  const manifestKey = `R2/${gameId}/manifests/StandaloneWindows64/${latestVersion}.json`;
  const manifestUrl = (await presignMany([manifestKey], sessionId)).get(manifestKey);
  if (!manifestUrl) throw new Error(`No patch manifest for ${latestVersion}`);
  const targetManifest = JSON.parse((await downloadUrl(manifestUrl)).toString('utf8'));
  const build = { version: latestVersion };

  const installDir = path.join(buildsmithPath, gameId);
  fs.mkdirSync(installDir, { recursive: true });
  const manifestPath = path.join(installDir, '.buildsmith-manifest.json');
  const localManifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;
  const chunkUrls = await presignMany(
    missingChunks(localManifest, targetManifest).map(sha => `R2/${gameId}/chunks/${sha}`),
    sessionId
  );

  await applyManifest({
    installDir,
    localManifest,
    targetManifest,
    onProgress: ({ percentage, downloadedBytes, totalBytes }) => {
      if (!downloadedBytes) console.log(`Patch for ${gameId}: downloading ${formatBytes(totalBytes)}`);
      event.sender.send('download-progress', {
        gameId,
        percentage,
        downloadedBytes,
        totalBytes,
        sizeLabel: `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)}`,
      });
    },
    fetchChunk: async sha => {
      const url = chunkUrls.get(`R2/${gameId}/chunks/${sha}`);
      if (!url) throw new Error(`Missing chunk ${sha}`);
      return downloadUrl(url);
    },
  });

  fs.writeFileSync(versionFilePath(gameId), JSON.stringify({ version: build.version }));
  event.sender.send('download-complete', gameId);
  getMainWindow()?.webContents.send('update-available', { gameId, updateAvailable: false });
  return true;
}

async function downloadFullBuild(event, gameId) {
  const { latestVersion, latestVersionUrl } = await getLatestGameVersion(gameId);
  if (!latestVersion || !latestVersionUrl) {
    const errorMsg = 'Game version information not found. Please try again later.';
    getMainWindow()?.webContents.send('show-notification', {
      title: 'Game Unavailable',
      body: errorMsg,
      duration: 5000,
    });
    event.sender.send('download-error', gameId, errorMsg);
    throw new Error(errorMsg);
  }

  const sessionId = await readSession();
  const presignResp = await fetch('https://cdn.diabolical.services/generateDownloadUrl', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionId && { sessionID: sessionId }),
    },
    body: JSON.stringify({
      key: `R2/${gameId}/Versions/Build-StandaloneWindows64-${latestVersion}.zip`,
    }),
  });
  if (!presignResp.ok) {
    const err = await presignResp.text();
    const errorMsg = `Failed to generate download URL: ${err}`;
    getMainWindow()?.webContents.send('show-notification', {
      title: 'Download Failed',
      body: errorMsg,
      duration: 5000,
    });
    event.sender.send('download-error', gameId, errorMsg);
    throw new Error(errorMsg);
  }
  const { url: zipUrl } = await presignResp.json();
  const window = BrowserWindow.getFocusedWindow() || getMainWindow();
  const dl = await download(window, zipUrl, {
    directory: buildsmithPath,
    onProgress: progress => {
      event.sender.send('download-progress', { gameId, percentage: progress.percent });
    },
  });
  await extractZip(dl.getSavePath(), gameId, event);
  fs.mkdirSync(path.join(buildsmithPath, gameId), { recursive: true });
  fs.writeFileSync(versionFilePath(gameId), JSON.stringify({ version: latestVersion }));
  getMainWindow()?.webContents.send('update-available', { gameId, updateAvailable: false });
}

async function downloadGame(event, gameId) {
  try {
    console.log(`Starting download for: ${gameId}`);
    try {
      await tryPatch(event, gameId);
      return;
    } catch (error) {
      console.error(`Patch failed for ${gameId}, downloading the full build`, error);
    }
    await downloadFullBuild(event, gameId);
  } catch (err) {
    console.error('Download error:', err);
    // Only show notification if it hasn't been shown already
    if (
      !err.message.includes('Game version information not found') &&
      !err.message.includes('Failed to generate download URL')
    ) {
      getMainWindow()?.webContents.send('show-notification', {
        title: 'Download Failed',
        body: err.message || 'An unexpected error occurred during download',
        duration: 5000,
      });
    }
    event.sender.send('download-error', gameId, err.message);
    throw err;
  }
}

module.exports = { downloadGame, extractZip };
