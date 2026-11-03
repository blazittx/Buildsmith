const { readPayload } = require('./githubState');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  let code = '';
  try {
    code = JSON.parse(event.body || '{}').code;
  } catch (error) {
    code = '';
  }
  const data = readPayload(code);
  if (!data || data.kind !== 'github-app' || !data.token || !data.installationId) {
    return { statusCode: 401, body: JSON.stringify({ error: 'This GitHub authorization has expired' }) };
  }
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ installationId: data.installationId, token: data.token }),
  };
};
