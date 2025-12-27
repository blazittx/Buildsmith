/* eslint-disable import/no-anonymous-default-export */
/* eslint-disable no-undef */

export default async (request, context) => {
  console.log('=== Netlify Edge Function Triggered ===');

  // Access environment variables via globalThis.ENV
  const API_BASE_URL = Netlify.env.get('API_BASE_URL');
  const API_KEY = Netlify.env.get('API_KEY');

  // Example: parse the "sessionid" header (case-insensitive in your original code)
  const sessionID = request.headers.get('sessionid');

  console.log('Extracted sessionID:', sessionID);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response('', { status: 200 });
  }

  // Only allow POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Parse the request body
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const {
    game_name,
    game_id,
    team_name,
    description,
    background_image_url,
    version,
    team_icon_url,
    github_repo,
    status,
    screenshots,
  } = body;

  if (!game_name || !game_id || !team_name) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  if (!sessionID) {
    return new Response(JSON.stringify({ error: 'Unauthorized: No session ID' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    // Create the game record with session ID
    const gameUploadRes = await fetch(`${API_BASE_URL}/rest-api/games`, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        game_name,
        game_id,
        team_name,
        description,
        background_image_url,
        version,
        team_icon_url,
        github_repo,
        status,
        screenshots,
        session_id: sessionID,
      }),
    });

    if (!gameUploadRes.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to create game: ${gameUploadRes.status}` }),
        {
          status: gameUploadRes.status,
          headers: { 'content-type': 'application/json' },
        }
      );
    }

    const gameData = await gameUploadRes.json();

    // Validate status if provided
    if (typeof gameData.status !== 'undefined') {
      const validStatuses = ['public', 'private', 'archived'];
      if (!validStatuses.includes(gameData.status)) {
        return new Response(
          JSON.stringify({
            error: 'Invalid status value. Must be one of: public, private, archived.',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Return success
    return new Response(JSON.stringify({ message: 'Game created successfully', game: gameData }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    console.error('Edge Function Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};
