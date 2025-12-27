const axios = require('axios');

exports.handler = async event => {
  console.log('=== Netlify Function Triggered: Update Game ===');
  console.log('Received Headers:', JSON.stringify(event.headers, null, 2));

  const headers = Object.keys(event.headers).reduce((acc, key) => {
    acc[key.toLowerCase()] = event.headers[key];
    return acc;
  }, {});

  const sessionID = headers['sessionid'];
  console.log('Extracted sessionID:', sessionID);

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      body: '',
    };
  }

  if (event.httpMethod !== 'PUT') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  let gameData;
  try {
    gameData = JSON.parse(event.body);
  } catch (error) {
    console.error('❌ Invalid JSON body:', error);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  const { game_id, game_name, version, description, background_image_url, screenshots } = gameData;

  if (!game_id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Game ID is required' }),
    };
  }

  const updatedFields = {};
  if (game_name) updatedFields.game_name = game_name;
  if (version) updatedFields.version = version;
  if (description) updatedFields.description = description;
  if (background_image_url) updatedFields.background_image_url = background_image_url;
  if (screenshots !== undefined) updatedFields.screenshots = screenshots;

  if (Object.keys(updatedFields).length === 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'No fields to update' }),
    };
  }

  try {
    console.log('✅ Sending request to update game...');
    const response = await axios.put(
      `${process.env.API_BASE_URL}/rest-api/games/${game_id}`,
      updatedFields,
      {
        headers: { 'x-api-key': process.env.API_KEY },
      }
    );

    console.log('✅ Game updated successfully:', response.data);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(response.data),
    };
  } catch (error) {
    console.error('❌ API Error:', error.response?.data || error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.response?.data || error.message }),
    };
  }
};
