function sessionFrom(event) {
  const headers = event.headers || {};
  return headers.sessionid || headers.sessionID || headers.SessionID || '';
}

async function apiGet(apiBase, apiKey, path) {
  const res = await fetch(`${apiBase}${path}`, { headers: { 'x-api-key': apiKey } });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

async function requireUser(event) {
  const sessionId = sessionFrom(event);
  const apiBase = process.env.API_BASE_URL;
  const apiKey = process.env.API_KEY;
  if (!sessionId || !apiBase || !apiKey) return null;
  const user = await apiGet(apiBase, apiKey, `/rest-api/users/session/${encodeURIComponent(sessionId)}`);
  if (!user.ok) return null;
  return { sessionId, apiBase, apiKey, user: user.data };
}

function gameIdFromKey(key) {
  if (!key || key.includes('..') || key.includes('\\') || key.includes('?')) return null;
  const match = /^R2\/([A-Za-z0-9]{1,64})\/(chunks|manifests|Versions)\/[^/].*$/.exec(key);
  return match ? match[1] : null;
}

async function canAccessGame(ctx, gameId, { write }) {
  const game = await apiGet(ctx.apiBase, ctx.apiKey, `/rest-api/games/${encodeURIComponent(gameId)}`);
  if (!game.ok) return false;
  const status = String(game.data.status || 'public').toLowerCase();
  if (!write && status === 'public') return true;

  const teams = await apiGet(
    ctx.apiBase,
    ctx.apiKey,
    `/rest-api/teams/session/${encodeURIComponent(ctx.sessionId)}`
  );
  if (teams.ok && Array.isArray(teams.data) && teams.data.some(team => team.team_name === game.data.team_name)) {
    return true;
  }
  if (write) return false;

  const library = await apiGet(ctx.apiBase, ctx.apiKey, `/rest-api/library/${encodeURIComponent(ctx.sessionId)}`);
  return library.ok && Array.isArray(library.data) && library.data.some(item => item.game_id === gameId);
}

async function isPublicGame(gameId) {
  const apiBase = process.env.API_BASE_URL;
  const apiKey = process.env.API_KEY;
  if (!apiBase || !apiKey) return false;
  const game = await apiGet(apiBase, apiKey, `/rest-api/games/${encodeURIComponent(gameId)}`);
  return game.ok && String(game.data.status || 'public').toLowerCase() === 'public';
}

module.exports = { requireUser, gameIdFromKey, canAccessGame, isPublicGame };
