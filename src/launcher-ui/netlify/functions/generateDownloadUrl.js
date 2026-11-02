const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const keys = Array.isArray(body.keys) ? body.keys : body.key ? [body.key] : [];
    if (!keys.length || keys.some(key => !key || key.includes('..') || !key.startsWith('R2/'))) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'A list of R2 keys is required' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
    const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
    if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'R2 credentials not configured' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    const s3 = new S3Client({
      region: 'auto',
      endpoint: 'https://c82515457400147e7f08ee6234e25742.r2.cloudflarestorage.com',
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    const urls = [];
    for (const key of keys) {
      const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: 'diabolicallauncher', Key: key }), {
        expiresIn: 3600,
      });
      urls.push({ key, url });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ urls }),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error) {
    console.error('Error generating download URLs:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
};
