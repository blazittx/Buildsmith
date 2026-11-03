const { signPayload, readPayload } = require('./githubState');

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  const sessionId = event.headers.sessionid || event.headers.sessionID || event.headers.SessionID;
  const apiBase = process.env.API_BASE_URL;
  const apiKey = process.env.API_KEY;
  if (!sessionId || !apiBase || !apiKey) return json(401, { error: 'Unauthorized' });

  const userRes = await fetch(`${apiBase}/rest-api/users/session/${encodeURIComponent(sessionId)}`, {
    headers: { 'x-api-key': apiKey },
  });
  if (!userRes.ok) return json(401, { error: 'Unauthorized' });

  const state = signPayload({ kind: 'github-install', sessionId, exp: Date.now() + 10 * 60 * 1000 });
  return json(200, { state });
};

function readInstallState(state) {
  const data = readPayload(state);
  if (!data || data.kind !== 'github-install' || !data.sessionId) return null;
  return data;
}

module.exports.readInstallState = readInstallState;
