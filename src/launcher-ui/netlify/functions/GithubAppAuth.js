const axios = require('axios');
const jwt = require('jsonwebtoken');
const { signPayload } = require('./githubState');
const { readInstallState } = require('./githubAppState');

async function installationOwned(jwtToken, installationId, user) {
  const infoRes = await axios.get(`https://api.github.com/app/installations/${installationId}`, {
    headers: { Authorization: `Bearer ${jwtToken}`, Accept: 'application/vnd.github+json' },
  });
  const account = infoRes.data.account || {};
  const githubId = String(user.github_id || user.githubId || '');
  if (account.type === 'User') return String(account.id) === githubId;
  if (account.type !== 'Organization' || !user.username) return false;
  const memberRes = await axios.get(
    `https://api.github.com/orgs/${account.login}/memberships/${encodeURIComponent(user.username)}`,
    { headers: { Authorization: `Bearer ${jwtToken}`, Accept: 'application/vnd.github+json' } }
  );
  return memberRes.data?.state === 'active';
}

exports.handler = async function (event) {
  const params = event.queryStringParameters || {};
  const installationId = params.installation_id;
  const installState = readInstallState(params.state);
  if (!installationId || !/^\d+$/.test(installationId) || !installState) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing GitHub installation state' }) };
  }

  try {
    const apiBase = process.env.API_BASE_URL;
    const apiKey = process.env.API_KEY;
    const userRes = await fetch(`${apiBase}/rest-api/users/session/${encodeURIComponent(installState.sessionId)}`, {
      headers: { 'x-api-key': apiKey },
    });
    if (!userRes.ok) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    const user = await userRes.json();

    const privateKey = Buffer.from(process.env.GITHUB_PRIVATE_KEY, 'base64').toString('utf-8');
    const now = Math.floor(Date.now() / 1000);
    const jwtToken = jwt.sign({ iat: now, exp: now + 600, iss: process.env.GITHUB_APP_ID }, privateKey, {
      algorithm: 'RS256',
    });

    const owned = await installationOwned(jwtToken, installationId, user);
    if (!owned) return { statusCode: 403, body: JSON.stringify({ error: 'This GitHub installation is not yours' }) };

    const tokenResponse = await axios.post(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {},
      { headers: { Authorization: `Bearer ${jwtToken}`, Accept: 'application/vnd.github+json' } }
    );
    const code = signPayload({
      kind: 'github-app',
      installationId,
      token: tokenResponse.data.token,
      exp: Date.now() + 2 * 60 * 1000,
    });

    return {
      statusCode: 302,
      headers: { Location: `buildsmith://github-app?code=${encodeURIComponent(code)}` },
    };
  } catch (error) {
    console.error('GitHub installation token request failed');
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to finish GitHub authorization' }) };
  }
};
