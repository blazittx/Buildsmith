/* eslint-disable import/no-anonymous-default-export */
/* eslint-disable no-undef */
export default async (request, context) => {
  console.log('=== Netlify Edge Function Triggered: Update Game ===');
  console.log('Received Headers:', JSON.stringify(Object.fromEntries(request.headers), null, 2));

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response('', { status: 200 });
  }

  if (request.method !== 'PUT') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let gameData;
  try {
    gameData = await request.json();
  } catch (error) {
    console.error('❌ Invalid JSON body:', error);
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!gameData.session_id) {
    return new Response(JSON.stringify({ error: 'Session ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { game_id, game_name, version, description, background_image_url, status, screenshots } = gameData;

  if (!game_id) {
    return new Response(JSON.stringify({ error: 'Game ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate version format if provided
  if (version) {
    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(version)) {
      return new Response(
        JSON.stringify({ error: 'Version must be in format X.Y.Z (e.g., 1.0.0)' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Only check version increment if this is a manual upload
    if (gameData.is_manual_upload) {
      // Get current game version from API to validate version increment
      try {
        const apiBaseUrl = Netlify.env.get('API_BASE_URL');
        const apiKey = Netlify.env.get('API_KEY');

        if (!apiBaseUrl || !apiKey) {
          console.error('❌ API configuration missing.');
          return new Response(JSON.stringify({ error: 'API configuration missing.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const gameRes = await fetch(`${apiBaseUrl}/rest-api/games/${game_id}`, {
          headers: {
            'x-api-key': apiKey,
          },
        });

        if (!gameRes.ok) {
          console.error('❌ Failed to fetch current game version');
          return new Response(JSON.stringify({ error: 'Failed to validate version update' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const gameData = await gameRes.json();
        const currentVersion = gameData.version;

        // Compare versions
        const currentParts = currentVersion.split('.').map(Number);
        const newParts = version.split('.').map(Number);

        let isHigherVersion = false;
        for (let i = 0; i < 3; i++) {
          if (newParts[i] > currentParts[i]) {
            isHigherVersion = true;
            break;
          } else if (newParts[i] < currentParts[i]) {
            break;
          }
        }

        if (!isHigherVersion) {
          return new Response(
            JSON.stringify({
              error: `New version (${version}) must be higher than current version (${currentVersion})`,
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      } catch (error) {
        console.error('❌ Error validating version:', error);
        return new Response(JSON.stringify({ error: 'Failed to validate version update' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
  }

  // Validate status if provided
  if (typeof status !== 'undefined') {
    const validStatuses = ['public', 'private', 'archived'];
    if (!validStatuses.includes(status)) {
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

  const updatedFields = {};
  if (game_name) updatedFields.game_name = game_name;
  if (version) updatedFields.version = version;
  if (description) updatedFields.description = description;
  if (background_image_url) updatedFields.background_image_url = background_image_url;
  if (typeof status !== 'undefined') updatedFields.status = status;
  if (screenshots !== undefined) updatedFields.screenshots = screenshots;

  if (Object.keys(updatedFields).length === 0) {
    return new Response(JSON.stringify({ error: 'No fields to update' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log('✅ Sending request to update game...');

    // Access environment variables using Deno.env.get()
    const apiBaseUrl = Deno.env.get('API_BASE_URL');
    const apiKey = Deno.env.get('API_KEY');

    if (!apiBaseUrl || !apiKey) {
      console.error('❌ API configuration missing.');
      return new Response(JSON.stringify({ error: 'API configuration missing.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiRes = await fetch(`${apiBaseUrl}/rest-api/games/${game_id}`, {
      method: 'PUT',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...updatedFields,
        session_id: gameData.session_id,
      }),
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error('❌ API Error:', errText);
      return new Response(
        JSON.stringify({
          error: errText,
          details:
            'Failed to update game. Please check the version format and ensure you have the necessary permissions.',
        }),
        {
          status: apiRes.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const responseData = await apiRes.json();
    console.log('✅ Game updated successfully:', responseData);

    return new Response(JSON.stringify(responseData), {
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
};
