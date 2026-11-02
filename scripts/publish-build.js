const { publishDirectory, publishZip } = require('../src/js/publishBuild');

function arg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? '' : process.argv[index + 1] || '';
}

async function main() {
  const gameId = arg('--game');
  const version = arg('--version');
  const dir = arg('--dir');
  const zip = arg('--zip');
  const sessionId = arg('--session');
  const api = (arg('--api') || process.env.API_URL || '').replace(/\/$/, '');
  if (!gameId || !version || (!dir && !zip) || !api || !process.env.API_KEY) {
    console.error('Usage: node scripts/publish-build.js --game id --version 1.2.3 (--dir folder | --zip file) --api API_URL');
    process.exit(1);
  }

  const published = zip
    ? await publishZip({ zipPath: zip, gameId, version, sessionId })
    : await publishDirectory({ dir, gameId, version, sessionId });

  const response = await fetch(`${api}/games/${encodeURIComponent(gameId)}/builds`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.API_KEY,
    },
    body: JSON.stringify({
      version,
      platform: published.platform,
      manifest_key: published.manifestKey,
      total_bytes: published.totalBytes,
      chunk_count: published.chunkCount,
      session_id: sessionId || undefined,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Failed to register build');
  console.log(`Published ${published.chunkCount} chunks for ${gameId} ${version}`);
}

main().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
