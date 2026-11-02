/* eslint-disable import/no-anonymous-default-export */
/* eslint-disable no-undef */

export default async request => {
  if (request.method === 'OPTIONS') return new Response('', { status: 200 });
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const gameId = new URL(request.url).pathname.split('/').pop();
  const platform = new URL(request.url).searchParams.get('platform') || 'StandaloneWindows64';
  const apiBase = Netlify.env.get('API_BASE_URL');
  const apiKey = Netlify.env.get('API_KEY');
  if (!gameId || !apiBase || !apiKey) {
    return new Response(JSON.stringify({ error: 'Build lookup is not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const response = await fetch(
    `${apiBase}/rest-api/games/${encodeURIComponent(gameId)}/builds/latest?platform=${encodeURIComponent(platform)}`,
    { headers: { 'x-api-key': apiKey } }
  );
  return new Response(await response.text(), {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
