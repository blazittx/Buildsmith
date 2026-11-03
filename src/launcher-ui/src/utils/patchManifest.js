const CHUNK_SIZE = 5 * 1024 * 1024;
export const PLATFORM = 'StandaloneWindows64';

export async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const view = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < view.length; i++) hex += view[i].toString(16).padStart(2, '0');
  return hex;
}

function includedPath(rel) {
  const filePath = String(rel).replace(/\\/g, '/');
  if (!filePath || filePath.endsWith('/')) return null;
  const parts = filePath.split('/');
  if (parts.some(part => part === '.patch-chunks' || part === '.patch-staging')) return null;
  const name = parts[parts.length - 1];
  if (name === '.buildsmith-manifest.json' || name.endsWith('-version.json')) return null;
  return filePath;
}

function ownedBytes(bytes) {
  if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) return bytes;
  return new Uint8Array(bytes);
}

async function recordFile(data) {
  const chunks = [];
  if (data.length === 0) {
    const empty = new Uint8Array(0);
    chunks.push({ sha256: await sha256Hex(empty), offset: 0, length: 0, bytes: empty });
  }
  for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
    const bytes = new Uint8Array(data.subarray(offset, offset + CHUNK_SIZE));
    chunks.push({ sha256: await sha256Hex(bytes), offset, length: bytes.length, bytes });
  }
  return { size: data.length, sha256: await sha256Hex(ownedBytes(data)), chunks };
}

export async function manifestFromFiles(entries, version, platform = PLATFORM) {
  const byPath = new Map();
  for (const entry of entries) {
    const filePath = includedPath(entry.path);
    if (filePath) byPath.set(filePath, entry.bytes);
  }

  const files = [];
  const blobs = new Map();
  for (const filePath of [...byPath.keys()].sort()) {
    const record = await recordFile(byPath.get(filePath));
    for (const chunk of record.chunks) {
      if (!blobs.has(chunk.sha256)) blobs.set(chunk.sha256, chunk.bytes);
    }
    files.push({
      path: filePath,
      size: record.size,
      sha256: record.sha256,
      chunks: record.chunks.map(({ sha256, offset, length }) => ({ sha256, offset, length })),
    });
  }
  return { manifest: { version, platform, files }, blobs };
}
