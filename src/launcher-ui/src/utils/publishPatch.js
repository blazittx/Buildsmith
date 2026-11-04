import { unzip } from 'fflate';
import { PLATFORM, manifestFromFiles } from './patchManifest';

const UPLOAD_URL = '/.netlify/functions/generateUploadUrl';

export function formatBytes(bytes = 0) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export function formatEta(seconds) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '';
  if (seconds < 10) return 'a few seconds left';
  const mins = Math.round(seconds / 60);
  if (mins < 1) return `${Math.round(seconds)}s left`;
  if (mins < 60) return `${mins} min left`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m left`;
}

export function patchStatusLabel(progress) {
  if (!progress?.totalBytes) return 'Uploading patches…';
  const size = `${formatBytes(progress.uploadedBytes)} / ${formatBytes(progress.totalBytes)}`;
  const eta = formatEta(progress.etaSeconds);
  return eta ? `Uploading patches ${size} · ${eta}` : `Uploading patches ${size}`;
}

async function reserve(body, sessionId) {
  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionId ? { sessionID: sessionId } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Failed to reserve upload URLs (${res.status})`);
  return data;
}

async function putBytes(url, bytes, contentType, label, signal) {
  const put = await fetch(url, {
    method: 'PUT',
    signal,
    headers: { 'Content-Type': contentType },
    body: bytes,
  });
  if (!put.ok) throw new Error(`Failed to upload ${label}`);
}

async function publishZipInBrowser(file, { gameId, version, sessionId, onProgress }) {
  onProgress?.({ uploadedBytes: 0, totalBytes: 0, etaSeconds: null });
  const packed = new Uint8Array(await file.arrayBuffer());
  const unzipped = await new Promise((resolve, reject) => {
    unzip(packed, (err, files) => (err ? reject(err) : resolve(files)));
  });
  const { manifest, blobs } = await manifestFromFiles(
    Object.entries(unzipped).map(([path, bytes]) => ({ path, bytes })),
    version
  );

  const list = [...blobs.entries()];
  const manifestBody = new TextEncoder().encode(JSON.stringify(manifest));
  const totalBytes = list.reduce((sum, [, bytes]) => sum + bytes.length, 0) + manifestBody.length;
  let uploadedBytes = 0;
  const started = Date.now();
  const report = () => {
    const elapsed = (Date.now() - started) / 1000;
    const rate = elapsed > 0 ? uploadedBytes / elapsed : 0;
    onProgress?.({
      uploadedBytes,
      totalBytes,
      etaSeconds: rate > 0 ? (totalBytes - uploadedBytes) / rate : null,
    });
  };
  report();

  const files = list.map(([hash, bytes]) => ({
    overwriteKey: `R2/${gameId}/chunks/${hash}`,
    contentType: 'application/octet-stream',
    size_bytes: bytes.length,
  }));
  const signed = files.length ? (await reserve({ files }, sessionId)).urls : [];
  if (!Array.isArray(signed) || signed.length !== files.length) {
    throw new Error('Upload URL response did not match the chunk list');
  }

  let cursor = 0;
  const workers = Math.min(16, list.length);
  const abort = new AbortController();
  let failure = null;
  await Promise.all(
    Array.from({ length: workers }, async () => {
      try {
        while (cursor < list.length && !abort.signal.aborted) {
          const index = cursor++;
          const [hash, bytes] = list[index];
          const target = signed[index];
          const key = `R2/${gameId}/chunks/${hash}`;
          if (target.key !== key) throw new Error(`Storage kept a different key for ${key}`);
          if (target.exists) {
            uploadedBytes += bytes.length;
            report();
            continue;
          }
          await putBytes(target.url, bytes, 'application/octet-stream', key, abort.signal);
          uploadedBytes += bytes.length;
          report();
        }
      } catch (error) {
        if (!failure) failure = error;
        abort.abort();
      }
    })
  );
  if (failure) throw failure;

  const manifestKey = `R2/${gameId}/manifests/${PLATFORM}/${version}.json`;
  const reserved = await reserve(
    {
      contentType: 'application/json',
      fileExt: 'json',
      size_bytes: manifestBody.length,
      overwriteKey: manifestKey,
    },
    sessionId
  );
  if (reserved.key && reserved.key !== manifestKey) {
    throw new Error(`Storage kept a different key for ${manifestKey}`);
  }
  await putBytes(reserved.url, manifestBody, 'application/json', manifestKey);
  uploadedBytes += manifestBody.length;
  report();

  const response = await fetch('/register-build', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      game_id: gameId,
      version,
      platform: PLATFORM,
      manifest_key: manifestKey,
      total_bytes: manifest.files.reduce((sum, item) => sum + item.size, 0),
      chunk_count: blobs.size,
      session_id: sessionId,
    }),
  });
  if (!response.ok) {
    const raw = await response.text();
    let message = raw;
    try {
      message = JSON.parse(raw).error || raw;
    } catch (error) {
      message = raw;
    }
    if (response.status !== 404 && !String(message).includes('Cannot POST')) {
      throw new Error(message || 'Failed to register build');
    }
  }
}

export async function publishPatch(file, { gameId, version, sessionId, onProgress }) {
  const api = window.electronAPI;
  const zipPath = file && api?.publishGameBuild && api.getPathForFile ? api.getPathForFile(file) : '';
  if (zipPath) {
    onProgress?.({ uploadedBytes: 0, totalBytes: 0 });
    const onPatch = progress => {
      if (!progress.gameId || progress.gameId === gameId) onProgress?.(progress);
    };
    const unsubscribe = api.onPatchUploadProgress?.(onPatch);
    try {
      await api.publishGameBuild({ zipPath, gameId, version, sessionId });
    } finally {
      unsubscribe?.();
    }
    return;
  }
  if (!file) return;
  await publishZipInBrowser(file, { gameId, version, sessionId, onProgress });
}
