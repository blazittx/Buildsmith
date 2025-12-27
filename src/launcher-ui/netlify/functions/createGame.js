const axios = require('axios');

exports.handler = async event => {
  console.log('=== Netlify Function Triggered ===');
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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
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
    screenshots,
  } = JSON.parse(event.body);
  const API_BASE_URL = process.env.API_BASE_URL;
  const API_KEY = process.env.API_KEY;

  if (!game_name || !game_id || !team_name) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields' }),
    };
  }

  if (!sessionID) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized: No session ID' }),
    };
  }

  try {
    const githubIdResponse = await axios.get(
      `${API_BASE_URL}/rest-api/users/session/${sessionID}`,
      {
        headers: { 'x-api-key': API_KEY },
      }
    );

    const sessionGithubId = githubIdResponse.data.github_id;

    if (!sessionGithubId) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'GitHub ID not found for session' }),
      };
    }

    const gameUploadResponse = await axios.post(
      `${API_BASE_URL}/rest-api/games`,
      {
        game_name,
        game_id,
        team_name,
        description,
        background_image_url,
        version,
        team_icon_url,
        github_repo,
        screenshots,
      },
      { headers: { 'x-api-key': API_KEY } }
    );

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: 'Game created successfully', game: gameUploadResponse.data }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.response?.data || error.message }),
    };
  }
};
