import { zipSync } from 'fflate';

const DOWNLOAD_URL = '/.netlify/functions/generateDownloadUrl';
const PLATFORM = 'StandaloneWindows64';

function sessionId() {
  const row = document.cookie.split('; ').find(item => item.startsWith('sessionID='));
  return row ? row.split('=')[1] : '';
}

async function sign(keys) {
  const id = sessionId();
  const res = await fetch(DOWNLOAD_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(id ? { sessionID: id } : {}),
    },
    body: JSON.stringify({ keys }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to sign download URLs');
  return new Map((data.urls || []).map(item => [item.key, item.url]));
}

function saveBlob(bytes, name) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadLink(url, name) {
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function fetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

function joinChunks(parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function fileName(game) {
  return `${game.game_name || game.game_id}-${game.version}.zip`;
}

async function downloadLegacyZip(game) {
  const key = `R2/${game.game_id}/Versions/Build-StandaloneWindows64-${game.version}.zip`;
  const url = (await sign([key])).get(key);
  if (!url) throw new Error('No download for this version');
  downloadLink(url, fileName(game));
}

export async function downloadGameZip(game, { onProgress } = {}) {
  const manifestKey = `R2/${game.game_id}/manifests/${PLATFORM}/${game.version}.json`;
  const manifestUrl = (await sign([manifestKey])).get(manifestKey);
  if (!manifestUrl) throw new Error('No download for this version');

  let manifestResponse = null;
  try {
    manifestResponse = await fetch(manifestUrl);
  } catch (error) {
    manifestResponse = null;
  }
  if (!manifestResponse?.ok) {
    if (manifestResponse && manifestResponse.status !== 404) {
      throw new Error('Could not download this build');
    }
    await downloadLegacyZip(game);
    return;
  }

  const manifest = await manifestResponse.json();
  const needed = [];
  const seen = new Set();
  const lengthOf = new Map();
  for (const file of manifest.files || []) {
    for (const chunk of file.chunks) {
      if (!lengthOf.has(chunk.sha256)) lengthOf.set(chunk.sha256, chunk.length);
      if (!seen.has(chunk.sha256)) {
        seen.add(chunk.sha256);
        needed.push(chunk.sha256);
      }
    }
  }

  const totalBytes = needed.reduce((sum, hash) => sum + (lengthOf.get(hash) || 0), 0);
  let downloadedBytes = 0;
  const report = () => onProgress?.({ downloadedBytes, totalBytes });
  report();

  const signed = needed.length
    ? await sign(needed.map(hash => `R2/${game.game_id}/chunks/${hash}`))
    : new Map();
  const blobs = new Map();
  let cursor = 0;
  const workers = Math.min(16, needed.length);
  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (cursor < needed.length) {
        const hash = needed[cursor++];
        const key = `R2/${game.game_id}/chunks/${hash}`;
        const url = signed.get(key);
        if (!url) throw new Error(`Missing chunk ${hash}`);
        blobs.set(hash, await fetchBytes(url));
        downloadedBytes += lengthOf.get(hash) || 0;
        report();
      }
    })
  );

  const packed = {};
  for (const file of manifest.files || []) {
    packed[file.path] = joinChunks(file.chunks.map(chunk => blobs.get(chunk.sha256) || new Uint8Array(0)));
  }
  saveBlob(zipSync(packed, { level: 0 }), fileName(game));
}
