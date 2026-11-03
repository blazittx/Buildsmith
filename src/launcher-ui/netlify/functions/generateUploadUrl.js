const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const { requireUser, gameIdFromKey, canAccessGame } = require('./access');
const { listSizes, objectSize } = require('./r2');
const { assertRoom } = require('./patchUsage');

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

    const user = await requireUser(event);
    if (!user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    const access = new Map();
    const allowedKey = key => {
      const ownerId = gameIdFromKey(key);
      if (!ownerId) return false;
      if (!access.has(ownerId)) access.set(ownerId, canAccessGame(user, ownerId, { write: true }));
      return access.get(ownerId);
    };

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
      const folders = new Map();
      for (const file of files) {
        const key = file.overwriteKey;
        if (!(await allowedKey(key))) throw new Error('Invalid upload key');
        const folder = key.slice(0, key.lastIndexOf('/') + 1);
        if (!folders.has(folder)) folders.set(folder, listSizes(s3, folder));
      }
      const stored = new Map();
      for (const [folder, pending] of folders) {
        stored.set(folder, await pending);
      }
      let added = 0;
      const states = files.map(file => {
        const key = file.overwriteKey;
        const folder = key.slice(0, key.lastIndexOf('/') + 1);
        const existing = stored.get(folder).get(key);
        const next = Number(file.size_bytes) || 0;
        added += existing == null ? next : Math.max(0, next - existing);
        return { key, existing, contentType: file.contentType };
      });
      await assertRoom(s3, user.sessionId, added);
      const urls = [];
      for (const state of states) {
        if (state.existing != null) {
          urls.push({ key: state.key, exists: true });
          continue;
        }
        urls.push({
          url: await sign(state.key, state.contentType || 'application/octet-stream'),
          key: state.key,
        });
      }
      return {
        statusCode: 200,
        body: JSON.stringify({ urls }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // Generate key based on whether it's a game upload or not
    const safeExt = String(fileExt || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
    let key;
    if (isGameUpload && gameId) {
      key = `R2/${gameId}/Versions/Build-StandaloneWindows64-${version || '0.0.1'}.zip`;
      if (!(await allowedKey(key))) throw new Error('Invalid upload key');
    } else if (overwriteKey) {
      key = overwriteKey;
      if (!(await allowedKey(key))) throw new Error('Invalid upload key');
    } else {
      key = `user-uploads/${uuidv4()}.${safeExt}`;
    }

    const existing = await objectSize(s3, key);
    const next = Number(body.size_bytes) || 0;
    await assertRoom(s3, user.sessionId, existing == null ? next : Math.max(0, next - existing));

    const url = await sign(key, contentType);

    return {
      statusCode: 200,
      body: JSON.stringify({ url, key }),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error) {
    console.error('Error generating upload URL:', error);
    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({ error: error.message }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
};
