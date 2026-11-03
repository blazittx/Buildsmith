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

  const body = await request.json().catch(() => ({}));
  const sessionID = request.headers.get('sessionid') || body.session_id;
  if (!sessionID || !body.code) {
    return new Response(JSON.stringify({ error: 'Missing session_id or code' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const apiBaseUrl = Netlify.env.get('API_BASE_URL');
    const apiKey = Netlify.env.get('API_KEY');
    if (!apiBaseUrl || !apiKey) {
      return new Response(JSON.stringify({ error: 'API configuration missing.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiRes = await fetch(`${apiBaseUrl}/rest-api/users/beta-invites/redeem`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionID, code: body.code }),
    });
    const text = await apiRes.text();
    return new Response(text, {
      status: apiRes.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
