const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');

exports.handler = async function (event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  try {
    // Parse the request body
    const body = JSON.parse(event.body);
    const {
      contentType = 'image/png',
      fileExt = 'png',
      overwriteKey,
      gameId,
      isGameUpload,
      version,
      files,
    } = body;

    // Get R2 credentials from environment variables
    const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
    const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;

    if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'R2 credentials not configured' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // Initialize S3 client for R2
    const s3 = new S3Client({
      region: 'auto',
      endpoint: 'https://c82515457400147e7f08ee6234e25742.r2.cloudflarestorage.com',
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    const sign = (key, type) =>
      getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: 'diabolicallauncher',
          Key: key,
          ContentType: type,
          CacheControl: 'no-cache',
        }),
        { expiresIn: Array.isArray(files) ? 3600 : 60 }
      );

    if (Array.isArray(files)) {
      const urls = [];
      for (const file of files) {
        const key = file.overwriteKey;
        if (!key || key.includes('..')) throw new Error('Invalid upload key');
        urls.push({ url: await sign(key, file.contentType || 'application/octet-stream'), key });
      }
      return {
        statusCode: 200,
        body: JSON.stringify({ urls }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // Generate key based on whether it's a game upload or not
    let key;
    if (isGameUpload && gameId) {
      key = `R2/${gameId}/Versions/Build-StandaloneWindows64-${version || '0.0.1'}.zip`;
    } else {
      key = overwriteKey || `user-uploads/${uuidv4()}.${fileExt}`;
    }

    const url = await sign(key, contentType);

    return {
      statusCode: 200,
      body: JSON.stringify({ url, key }),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error) {
    console.error('Error generating upload URL:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
};
