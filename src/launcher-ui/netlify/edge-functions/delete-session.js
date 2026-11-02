/* eslint-disable import/no-anonymous-default-export */
/* eslint-disable no-undef */
export default async request => {
  if (request.method === 'OPTIONS') return new Response('', { status: 200 });
  if (request.method !== 'DELETE') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sessionID = request.headers.get('sessionid');
  const apiBaseUrl = Netlify.env.get('API_BASE_URL');
  const apiKey = Netlify.env.get('API_KEY');
  if (!sessionID || !apiBaseUrl || !apiKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiRes = await fetch(`${apiBaseUrl}/rest-api/users/session/${encodeURIComponent(sessionID)}`, {
    method: 'DELETE',
    headers: { 'x-api-key': apiKey },
  });
  return new Response(await apiRes.text(), {
    status: apiRes.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
