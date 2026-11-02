const { r2Client, deletePrefix, deleteKeys, cdnKey } = require('./r2');

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

function gamePrefix(gameId) {
  if (!gameId || typeof gameId !== 'string' || gameId.length > 64 || /[\\/]/.test(gameId) || gameId.includes('..')) {
    throw new Error('Unexpected game location');
  }
  return `R2/${gameId}/`;
}

exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid request body' });
  }

  const { gameId, sessionId } = body;
  if (!gameId || !sessionId) return json(400, { error: 'Game ID and session ID are required' });

  const apiBase = process.env.API_BASE_URL;
  const apiKey = process.env.API_KEY;
  if (!apiBase || !apiKey) return json(500, { error: 'Storage is not configured' });

  try {
    const prefix = gamePrefix(gameId);
    const headers = { 'x-api-key': apiKey };

    const [gameRes, teamsRes] = await Promise.all([
      fetch(`${apiBase}/rest-api/games/${encodeURIComponent(gameId)}`, { headers }),
      fetch(`${apiBase}/rest-api/teams/session/${encodeURIComponent(sessionId)}`, { headers }),
    ]);
    const game = await gameRes.json().catch(() => ({}));
    const teams = await teamsRes.json().catch(() => ({}));
    if (!gameRes.ok) return json(gameRes.status, { error: game.error || 'Game not found' });
    if (!teamsRes.ok) return json(teamsRes.status, { error: teams.error || 'Failed to verify team membership' });
    if (!Array.isArray(teams) || !teams.some(team => team.team_name === game.team_name)) {
      return json(403, { error: 'You are not a member of this team' });
    }

    const s3 = r2Client();
    await deletePrefix(s3, prefix);
    const artwork = [game.background_image_url, ...(Array.isArray(game.screenshots) ? game.screenshots : [])]
      .map(cdnKey)
      .filter(key => key && (key.startsWith('user-uploads/') || key.startsWith(prefix)));
    await deleteKeys(s3, artwork);

    const delRes = await fetch(`${apiBase}/rest-api/games/${encodeURIComponent(gameId)}`, {
      method: 'DELETE',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    });
    const delData = await delRes.json().catch(() => ({}));
    if (!delRes.ok) {
      return json(delRes.status, { error: delData.error || 'Removed the files, but failed to delete the game' });
    }

    return json(200, { message: 'Game deleted successfully' });
  } catch (error) {
    console.error('delete-game failed:', error);
    return json(500, { error: error.message || 'Failed to delete game' });
  }
};
