const { r2Client, deletePrefix, deleteKeys, cdnKey } = require('./r2');

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

function teamPrefixes(teamName) {
  if (!teamName || typeof teamName !== 'string' || /[\\/]/.test(teamName) || teamName.includes('..')) {
    throw new Error('Unexpected team location');
  }
  return [...new Set([`team-uploads/${teamName}/`, `team-uploads/${encodeURIComponent(teamName)}/`])];
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

  const { teamId, sessionId } = body;
  if (!teamId || !sessionId) return json(400, { error: 'Team ID and session ID are required' });

  const apiBase = process.env.API_BASE_URL;
  const apiKey = process.env.API_KEY;
  if (!apiBase || !apiKey) return json(500, { error: 'Storage is not configured' });

  try {
    const headers = { 'x-api-key': apiKey };
    const teamsRes = await fetch(`${apiBase}/rest-api/teams/session/${encodeURIComponent(sessionId)}`, { headers });
    const teams = await teamsRes.json().catch(() => ({}));
    if (!teamsRes.ok) return json(teamsRes.status, { error: teams.error || 'Failed to verify team membership' });

    const team = Array.isArray(teams) ? teams.find(item => String(item.team_id) === String(teamId)) : null;
    if (!team) return json(403, { error: 'You are not a member of this team' });

    const packagesRes = await fetch(
      `${apiBase}/rest-api/unityPackages?team_id=${encodeURIComponent(team.team_id)}&session_id=${encodeURIComponent(sessionId)}`,
      { headers }
    );
    const packagesData = await packagesRes.json().catch(() => ({}));
    if (!packagesRes.ok && packagesRes.status !== 404) {
      return json(packagesRes.status, { error: packagesData.error || 'Failed to list team packages' });
    }

    for (const pkg of packagesData.packages || []) {
      const pkgRes = await fetch(`${apiBase}/rest-api/unityPackages/${encodeURIComponent(pkg.package_id)}`, {
        method: 'DELETE',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: team.team_id, session_id: sessionId }),
      });
      if (!pkgRes.ok) {
        const pkgErr = await pkgRes.json().catch(() => ({}));
        return json(pkgRes.status, { error: pkgErr.error || 'Failed to delete team packages' });
      }
    }

    const s3 = r2Client();
    for (const prefix of teamPrefixes(team.team_name)) {
      await deletePrefix(s3, prefix);
    }
    const iconKey = cdnKey(team.team_icon_url);
    if (iconKey && (iconKey.startsWith('user-uploads/') || iconKey.startsWith('team-uploads/'))) {
      await deleteKeys(s3, [iconKey]);
    }

    const delRes = await fetch(`${apiBase}/rest-api/teams/${encodeURIComponent(team.team_id)}`, {
      method: 'DELETE',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    });
    const delData = await delRes.json().catch(() => ({}));
    if (!delRes.ok) {
      return json(delRes.status, { error: delData.error || 'Removed the files, but failed to delete the team' });
    }

    return json(200, { message: 'Team deleted successfully' });
  } catch (error) {
    console.error('delete-team failed:', error);
    return json(500, { error: error.message || 'Failed to delete team' });
  }
};
