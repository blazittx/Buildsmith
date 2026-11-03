/* eslint-disable import/no-anonymous-default-export */
/* eslint-disable no-undef */
export default async function (request, context) {
  console.log('=== Netlify Edge Function Triggered: Remove from Library ===');
  console.log('Received Headers:', JSON.stringify(Object.fromEntries(request.headers), null, 2));

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response('', { status: 200 });
  }

  // Only allow POST requests
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Normalize headers to lowercase for easier access
  const headersObj = {};
  for (const [key, value] of request.headers.entries()) {
    headersObj[key.toLowerCase()] = value;
  }

  const sessionID = headersObj['sessionid'];
  console.log('Extracted sessionID:', sessionID);

  if (!sessionID) {
    console.error('❌ No sessionID found in headers.');
    return new Response(JSON.stringify({ error: 'Unauthorized: No valid session ID' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Parse request body
    const { game_id } = await request.json();

    if (!game_id) {
      return new Response(JSON.stringify({ error: 'Game ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Access environment variables using Netlify.env.get() for Deno
    const apiBaseUrl = Netlify.env.get('API_BASE_URL');
    const apiKey = Netlify.env.get('API_KEY');

    if (!apiBaseUrl || !apiKey) {
      console.error('❌ API configuration missing.');
      return new Response(JSON.stringify({ error: 'API configuration missing.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const gameResponse = await fetch(`${apiBaseUrl}/rest-api/games/${encodeURIComponent(game_id)}`, {
      headers: { 'x-api-key': apiKey },
    });
    if (gameResponse.ok) {
      const game = await gameResponse.json();
      if (String(game.status || '').toLowerCase() === 'private') {
        return new Response(JSON.stringify({ error: 'Private games stay in your library.' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Forward the request to the Buildsmith API
    const response = await fetch(`${apiBaseUrl}/rest-api/library/remove`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        session_id: sessionID,
        game_id: game_id,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      return new Response(JSON.stringify({ error: errorText }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    console.log('✅ Game removed from library successfully:', data);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ API Error:', error.message);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
