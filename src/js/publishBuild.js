const crypto = require('crypto');
const { promisify } = require('util');
const yauzl = require('yauzl');
const { PLATFORM, CHUNK_SIZE, sha256, manifestFromDir } = require('./patcher');

const openZip = promisify(yauzl.open);

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
  if (!res.ok) throw new Error(data.error || `Failed to reserve upload URLs (${res.status})`);
  if (!Array.isArray(data.urls) || data.urls.length !== files.length) {
    throw new Error('Upload URL response did not match the chunk list');
  }
  return data.urls;
}

function isDirectory(entry) {
  const mode = (entry.externalFileAttributes >> 16) & 0xffff;
  return (
    (mode & 61440) === 16384 ||
    entry.fileName.endsWith('/') ||
    (entry.versionMadeBy >> 8 === 0 && entry.externalFileAttributes === 16)
  );
}

function includedZipPath(name) {
  if (!name || name.startsWith('__MACOSX/')) return false;
  const parts = name.split('/');
  if (parts.slice(0, -1).some(part => part === '.patch-chunks' || part === '.patch-staging'))
    return false;
  const base = parts[parts.length - 1];
  return base !== '.buildsmith-manifest.json' && !base.endsWith('-version.json');
}

async function recordStream(stream) {
  const fileHash = crypto.createHash('sha256');
  const chunks = [];
  let pending = [];
  let pendingBytes = 0;
  let offset = 0;
  let size = 0;

  const emit = bytes => {
    chunks.push({ sha256: sha256(bytes), offset, length: bytes.length, bytes });
    offset += bytes.length;
  };

  for await (const piece of stream) {
    const data = Buffer.isBuffer(piece) ? piece : Buffer.from(piece);
    fileHash.update(data);
    size += data.length;
    pending.push(data);
    pendingBytes += data.length;
    if (pendingBytes < CHUNK_SIZE) continue;
    let buf = Buffer.concat(pending, pendingBytes);
    pending = [];
    pendingBytes = 0;
    let start = 0;
    while (buf.length - start >= CHUNK_SIZE) {
      emit(Buffer.from(buf.subarray(start, start + CHUNK_SIZE)));
      start += CHUNK_SIZE;
    }
    if (start < buf.length) {
      pending = [buf.subarray(start)];
      pendingBytes = buf.length - start;
    }
  }

  if (size === 0) emit(Buffer.alloc(0));
  else if (pendingBytes) emit(Buffer.concat(pending, pendingBytes));
  return { size, sha256: fileHash.digest('hex'), chunks };
}

function readZipEntry(zipfile, entry) {
  if (isDirectory(entry) || !includedZipPath(entry.fileName)) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err, stream) => (err ? reject(err) : resolve(stream)));
  }).then(recordStream);
}

async function manifestFromZip(zipPath, version, platform = PLATFORM) {
  const zipfile = await openZip(zipPath, { lazyEntries: true });
  const byPath = new Map();
  try {
    await new Promise((resolve, reject) => {
      let settled = false;
      const fail = error => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      zipfile.on('error', fail);
      zipfile.on('end', () => {
        if (settled) return;
        settled = true;
        resolve();
      });
      zipfile.on('entry', entry => {
        readZipEntry(zipfile, entry)
          .then(record => {
            if (record) byPath.set(entry.fileName, record);
            if (!settled) zipfile.readEntry();
          })
          .catch(fail);
      });
      zipfile.readEntry();
    });
  } finally {
    zipfile.close();
  }

  const files = [];
  const blobs = new Map();
  for (const filePath of [...byPath.keys()].sort()) {
    const record = byPath.get(filePath);
    for (const chunk of record.chunks) {
      if (!blobs.has(chunk.sha256)) blobs.set(chunk.sha256, chunk.bytes);
    }
    files.push({
      path: filePath,
      size: record.size,
      sha256: record.sha256,
      chunks: record.chunks.map(({ sha256: hash, offset, length }) => ({
        sha256: hash,
        offset,
        length,
      })),
    });
  }
  return { manifest: { version, platform, files }, blobs };
}

async function uploadManifest({
  manifest,
  blobs,
  gameId,
  version,
  sessionId,
  platform = PLATFORM,
  uploadUrl,
  onProgress,
}) {
  const entries = [...blobs.entries()];
  const manifestBody = Buffer.from(JSON.stringify(manifest));
  const totalBytes =
    entries.reduce((sum, [, bytes]) => sum + bytes.length, 0) + manifestBody.length;
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
  const abort = new AbortController();
  let failure = null;
  await Promise.all(
    Array.from({ length: workers }, async () => {
      try {
        while (cursor < entries.length && !abort.signal.aborted) {
          const index = cursor++;
          const [hash, bytes] = entries[index];
          const target = signed[index];
          if (target.key !== `R2/${gameId}/chunks/${hash}`) {
            throw new Error(`Storage kept a different key for R2/${gameId}/chunks/${hash}`);
          }
          if (target.exists) {
            uploadedBytes += bytes.length;
            report();
            continue;
          }
          const put = await fetch(target.url, {
            method: 'PUT',
            signal: abort.signal,
            headers: { 'Content-Type': 'application/octet-stream' },
            body: bytes,
          });
          if (!put.ok) throw new Error(`Failed to upload R2/${gameId}/chunks/${hash}`);
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

async function publishDirectory({ dir, version, platform = PLATFORM, ...options }) {
  const { manifest, blobs } = manifestFromDir(dir, version, platform);
  return uploadManifest({ manifest, blobs, version, platform, ...options });
}

async function publishZip({ zipPath, version, platform = PLATFORM, ...options }) {
  options.onProgress?.({ uploadedBytes: 0, totalBytes: 0, etaSeconds: null });
  const { manifest, blobs } = await manifestFromZip(zipPath, version, platform);
  return uploadManifest({ manifest, blobs, version, platform, ...options });
}

module.exports = { publishDirectory, publishZip };
