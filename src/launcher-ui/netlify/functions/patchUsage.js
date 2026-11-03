const { listSizes } = require('./r2');

const GAME_ID = /^[A-Za-z0-9]{1,64}$/;

async function apiPost(path, body) {
  const apiBase = process.env.API_BASE_URL;
  const apiKey = process.env.API_KEY;
  if (!apiBase || !apiKey) throw new Error('API configuration missing');
  const res = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to load account storage');
  return data;
}

async function gameIdsForSession(sessionId) {
  const games = await apiPost('/rest-api/users/games', { session_id: sessionId });
  return (Array.isArray(games) ? games : [])
    .map(game => game.game_id)
    .filter(id => GAME_ID.test(id));
}

async function patchUsageBytes(s3, sessionId) {
  const ids = await gameIdsForSession(sessionId);
  let total = 0;
  for (const id of ids) {
    for (const folder of ['chunks', 'manifests']) {
      const sizes = await listSizes(s3, `R2/${id}/${folder}/`);
      for (const size of sizes.values()) total += size;
    }
  }
  return total;
}

async function quotaLimit(sessionId) {
  const data = await apiPost('/rest-api/users/quota', { session_id: sessionId });
  return data;
}

async function assertRoom(s3, sessionId, addedBytes) {
  if (!addedBytes) return;
  const [usage, quota] = await Promise.all([patchUsageBytes(s3, sessionId), quotaLimit(sessionId)]);
  const limit = Number(quota.quota_bytes);
  if (!Number.isFinite(limit)) throw new Error('Plan quota not found');
  if (usage + addedBytes > limit) {
    const error = new Error('Quota exceeded');
    error.statusCode = 403;
    throw error;
  }
}

module.exports = { patchUsageBytes, quotaLimit, assertRoom };
