const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CHUNK_SIZE = 5 * 1024 * 1024;
const PLATFORM = 'StandaloneWindows64';
const SKIP = new Set(['.buildsmith-manifest.json']);

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.patch-chunks' || entry.name === '.patch-staging') continue;
      files.push(...walk(full).map(rel => path.join(entry.name, rel)));
    } else if (!SKIP.has(entry.name) && !entry.name.endsWith('-version.json')) {
      files.push(entry.name);
    }
  }
  return files;
}

function listFiles(dir) {
  return walk(dir).map(rel => rel.replace(/\\/g, '/')).sort();
}

function fileRecord(filePath) {
  const data = fs.readFileSync(filePath);
  const chunks = [];
  if (data.length === 0) {
    chunks.push({ sha256: sha256(Buffer.alloc(0)), offset: 0, length: 0, bytes: Buffer.alloc(0) });
  }
  for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
    const bytes = data.subarray(offset, offset + CHUNK_SIZE);
    chunks.push({ sha256: sha256(bytes), offset, length: bytes.length, bytes });
  }
  return { size: data.length, sha256: sha256(data), chunks };
}

function manifestFromDir(dir, version, platform = PLATFORM) {
  const files = [];
  const blobs = new Map();
  for (const rel of listFiles(dir)) {
    const record = fileRecord(path.join(dir, rel));
    for (const chunk of record.chunks) {
      if (!blobs.has(chunk.sha256)) blobs.set(chunk.sha256, chunk.bytes);
    }
    files.push({
      path: rel,
      size: record.size,
      sha256: record.sha256,
      chunks: record.chunks.map(({ sha256: hash, offset, length }) => ({ sha256: hash, offset, length })),
    });
  }
  return { manifest: { version, platform, files }, blobs };
}

function missingChunks(localManifest, targetManifest) {
  const have = new Set();
  for (const file of localManifest?.files || []) {
    for (const chunk of file.chunks) have.add(chunk.sha256);
  }
  const missing = [];
  const seen = new Set();
  for (const file of targetManifest.files || []) {
    for (const chunk of file.chunks) {
      if (!have.has(chunk.sha256) && !seen.has(chunk.sha256)) {
        seen.add(chunk.sha256);
        missing.push(chunk.sha256);
      }
    }
  }
  return missing;
}

function safePath(root, rel) {
  if (!rel || path.isAbsolute(rel) || rel.split('/').includes('..')) {
    throw new Error(`Unsafe manifest path: ${rel}`);
  }
  return path.join(root, rel);
}

function readChunk(installDir, source, cacheDir) {
  const cached = path.join(cacheDir, source.sha256);
  if (fs.existsSync(cached)) return fs.readFileSync(cached);
  const fd = fs.openSync(safePath(installDir, source.file), 'r');
  const buf = Buffer.alloc(source.length);
  fs.readSync(fd, buf, 0, source.length, source.offset);
  fs.closeSync(fd);
  return buf;
}

async function applyManifest({ installDir, localManifest, targetManifest, fetchChunk, onProgress }) {
  const localChunks = new Map();
  for (const file of localManifest?.files || []) {
    for (const chunk of file.chunks) {
      if (!localChunks.has(chunk.sha256)) {
        localChunks.set(chunk.sha256, { file: file.path, offset: chunk.offset, length: chunk.length, sha256: chunk.sha256 });
      }
    }
  }

  const needed = missingChunks(localManifest, targetManifest);
  const lengthOf = new Map();
  for (const file of targetManifest.files || []) {
    for (const chunk of file.chunks) {
      if (!lengthOf.has(chunk.sha256)) lengthOf.set(chunk.sha256, chunk.length);
    }
  }
  const totalBytes = needed.reduce((sum, hash) => sum + (lengthOf.get(hash) || 0), 0);
  let downloadedBytes = 0;
  const report = () =>
    onProgress?.({
      percentage: totalBytes ? downloadedBytes / totalBytes : 1,
      downloadedBytes,
      totalBytes,
    });
  const cacheDir = path.join(installDir, '.patch-chunks');
  fs.mkdirSync(cacheDir, { recursive: true });
  report();
  let cursor = 0;
  const workers = Math.min(16, needed.length);
  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (cursor < needed.length) {
        const hash = needed[cursor++];
        const bytes = Buffer.from(await fetchChunk(hash));
        await fs.promises.writeFile(path.join(cacheDir, hash), bytes);
        downloadedBytes += bytes.length;
        report();
      }
    })
  );

  const staging = path.join(installDir, '.patch-staging');
  fs.rmSync(staging, { recursive: true, force: true });
  const previous = new Map((localManifest?.files || []).map(file => [file.path, file.sha256]));

  for (const file of targetManifest.files) {
    if (previous.get(file.path) === file.sha256 && fs.existsSync(safePath(installDir, file.path))) continue;
    const dest = safePath(staging, file.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const fd = fs.openSync(dest, 'w');
    for (const chunk of file.chunks) {
      const bytes = readChunk(
        installDir,
        localChunks.get(chunk.sha256) || { sha256: chunk.sha256, length: chunk.length },
        cacheDir
      );
      if (bytes.length) fs.writeSync(fd, bytes);
    }
    fs.closeSync(fd);
  }

  for (const file of targetManifest.files) {
    if (previous.get(file.path) === file.sha256 && fs.existsSync(safePath(installDir, file.path))) continue;
    const dest = safePath(installDir, file.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(safePath(staging, file.path), dest);
  }

  const keep = new Set(targetManifest.files.map(file => file.path));
  for (const file of localManifest?.files || []) {
    if (!keep.has(file.path)) {
      const dest = safePath(installDir, file.path);
      if (fs.existsSync(dest)) fs.rmSync(dest);
    }
  }

  fs.writeFileSync(path.join(installDir, '.buildsmith-manifest.json'), JSON.stringify(targetManifest));
  fs.rmSync(cacheDir, { recursive: true, force: true });
  fs.rmSync(staging, { recursive: true, force: true });
}

module.exports = {
  CHUNK_SIZE,
  PLATFORM,
  sha256,
  manifestFromDir,
  missingChunks,
  applyManifest,
};
