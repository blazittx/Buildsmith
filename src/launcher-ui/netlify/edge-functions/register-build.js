/* eslint-disable import/no-anonymous-default-export */
/* eslint-disable no-undef */

export default async request => {
  if (request.method === 'OPTIONS') return new Response('', { status: 200 });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const apiBase = Netlify.env.get('API_BASE_URL');
  const apiKey = Netlify.env.get('API_KEY');
  if (!body.game_id || !apiBase || !apiKey) {
    return new Response(JSON.stringify({ error: 'Game ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const response = await fetch(`${apiBase}/rest-api/games/${encodeURIComponent(body.game_id)}/builds`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });
  return new Response(await response.text(), {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
