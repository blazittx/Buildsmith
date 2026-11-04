exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  const body = JSON.parse(event.body || '{}');
  const apiBase = process.env.API_BASE_URL;
  const apiKey = process.env.API_KEY;
  if (!body.game_id || !apiBase || !apiKey) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Game ID is required' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  const response = await fetch(
    `${apiBase}/rest-api/games/${encodeURIComponent(body.game_id)}/builds`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        version: body.version,
        platform: body.platform,
        manifest_key: body.manifest_key,
        total_bytes: body.total_bytes,
        chunk_count: body.chunk_count,
        session_id: body.session_id,
      }),
    }
  );
  return {
    statusCode: response.status,
    body: await response.text(),
    headers: { 'Content-Type': 'application/json' },
  };
};
