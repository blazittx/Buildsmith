const fs = require('fs');
const os = require('os');
const path = require('path');
const extract = require('extract-zip');
const { PLATFORM, manifestFromDir } = require('./patcher');

const CDN_UPLOAD = 'https://cdn.diabolical.services/generateUploadUrl';

async function uploadBytes(key, body, contentType, sessionId, uploadUrl = CDN_UPLOAD) {
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionId ? { sessionID: sessionId } : {}),
    },
    body: JSON.stringify({
      contentType,
      fileExt: key.includes('.') ? key.split('.').pop() : 'bin',
      size_bytes: body.length,
      overwriteKey: key,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Failed to reserve ${key}`);
  if (data.key && data.key !== key) {
    throw new Error(`Storage kept a different key for ${key}`);
  }
  const put = await fetch(data.url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
  });
  if (!put.ok) throw new Error(`Failed to upload ${key}`);
}

async function reserveUploads(files, sessionId, uploadUrl) {
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionId ? { sessionID: sessionId } : {}),
    },
    body: JSON.stringify({ files }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to reserve upload URLs');
  if (!Array.isArray(data.urls) || data.urls.length !== files.length) {
    throw new Error('Upload URL response did not match the chunk list');
  }
  return data.urls;
}

async function publishDirectory({ dir, gameId, version, sessionId, platform = PLATFORM, uploadUrl, onProgress }) {
  const { manifest, blobs } = manifestFromDir(dir, version, platform);
  const entries = [...blobs.entries()];
  const manifestBody = Buffer.from(JSON.stringify(manifest));
  const totalBytes = entries.reduce((sum, [, bytes]) => sum + bytes.length, 0) + manifestBody.length;
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

  const files = entries.map(([hash, bytes]) => ({
    overwriteKey: `R2/${gameId}/chunks/${hash}`,
    contentType: 'application/octet-stream',
    size_bytes: bytes.length,
  }));
  const signed = files.length ? await reserveUploads(files, sessionId, uploadUrl) : [];
  let cursor = 0;
  const workers = Math.min(16, entries.length);
  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (cursor < entries.length) {
        const index = cursor++;
        const [hash, bytes] = entries[index];
        const target = signed[index];
        if (target.key !== `R2/${gameId}/chunks/${hash}`) {
          throw new Error(`Storage kept a different key for R2/${gameId}/chunks/${hash}`);
        }
        const put = await fetch(target.url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: bytes,
        });
        if (!put.ok) throw new Error(`Failed to upload R2/${gameId}/chunks/${hash}`);
        uploadedBytes += bytes.length;
        report();
      }
    })
  );

  const manifestKey = `R2/${gameId}/manifests/${platform}/${version}.json`;
  await uploadBytes(manifestKey, manifestBody, 'application/json', sessionId, uploadUrl);
  uploadedBytes += manifestBody.length;
  report();

  return {
    manifestKey,
    totalBytes: manifest.files.reduce((sum, file) => sum + file.size, 0),
    chunkCount: blobs.size,
    platform,
  };
}

async function publishZip({ zipPath, ...options }) {
  options.onProgress?.({ uploadedBytes: 0, totalBytes: 0, etaSeconds: null });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'buildsmith-'));
  try {
    await extract(zipPath, { dir });
    return await publishDirectory({ dir, ...options });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = { publishDirectory, publishZip };
