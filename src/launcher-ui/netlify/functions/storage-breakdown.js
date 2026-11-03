const { r2Client, listSizes, readObject } = require('./r2');
const { gamesForSession } = require('./patchUsage');

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

function versionValue(version) {
  return String(version)
    .split('.')
    .reduce((total, part) => total * 1000 + (Number(part) || 0), 0);
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const { session_id } = JSON.parse(event.body || '{}');
    if (!session_id) return json(400, { error: 'session_id required' });

    const s3 = r2Client();
    const games = [];
    let total = 0;
    for (const game of await gamesForSession(session_id)) {
      const chunkSizes = await listSizes(s3, `R2/${game.game_id}/chunks/`);
      const manifestSizes = await listSizes(s3, `R2/${game.game_id}/manifests/`);
      let stored = 0;
      for (const size of chunkSizes.values()) stored += size;
      for (const size of manifestSizes.values()) stored += size;
      total += stored;

      const manifests = [];
      for (const [key, size] of manifestSizes) {
        const body = JSON.parse((await readObject(s3, key)).toString('utf8'));
        manifests.push({
          version: body.version || key.split('/').pop().replace(/\.json$/, ''),
          manifest_bytes: size,
          files: body.files || [],
        });
      }
      manifests.sort((a, b) => versionValue(b.version) - versionValue(a.version));

      const seen = new Set();
      const versions = manifests.map(manifest => {
        const files = [];
        for (const file of manifest.files) {
          let bytes = 0;
          for (const chunk of file.chunks || []) {
            if (seen.has(chunk.sha256)) continue;
            seen.add(chunk.sha256);
            bytes += chunkSizes.get(chunk.sha256) ?? chunk.length ?? 0;
          }
          if (bytes) files.push({ path: file.path, bytes });
        }
        files.sort((a, b) => b.bytes - a.bytes);
        return { version: manifest.version, manifest_bytes: manifest.manifest_bytes, files };
      });

      let referenced = 0;
      for (const hash of seen) referenced += chunkSizes.get(hash) || 0;
      let listed = 0;
      for (const size of chunkSizes.values()) listed += size;
      games.push({
        game_id: game.game_id,
        game_name: game.game_name || game.game_id,
        stored_bytes: stored,
        unreferenced_bytes: Math.max(0, listed - referenced),
        versions,
      });
    }
    games.sort((a, b) => b.stored_bytes - a.stored_bytes);
    return json(200, { total_bytes: total, games });
  } catch (error) {
    console.error('storage breakdown failed:', error);
    return json(error.statusCode || 500, { error: error.message || 'Failed to load storage' });
  }
};
