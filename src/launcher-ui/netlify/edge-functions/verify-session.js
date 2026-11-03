/* eslint-disable import/no-anonymous-default-export */
/* eslint-disable no-undef */
export default async (request, context) => {
  if (request.method === 'OPTIONS') return new Response('', { status: 200 });
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sessionID = request.headers.get('sessionid');
  if (!sessionID) {
    return new Response(JSON.stringify({ error: 'Unauthorized: No valid session ID' }), {
      status: 401,
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

    const apiRes = await fetch(`${apiBaseUrl}/rest-api/users/session/${encodeURIComponent(sessionID)}`, {
      headers: { 'x-api-key': apiKey },
    });
    const body = await apiRes.text();
    return new Response(body, {
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
