const { S3Client, ListObjectsV2Command, DeleteObjectsCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const BUCKET = 'diabolicallauncher';

function r2Client() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) throw new Error('Storage is not configured');

  return new S3Client({
    region: 'auto',
    endpoint: 'https://c82515457400147e7f08ee6234e25742.r2.cloudflarestorage.com',
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function deletePrefix(s3, prefix) {
  if (!prefix.endsWith('/') || prefix.includes('..') || prefix.split('/').length < 3) {
    throw new Error('Refusing to delete that location');
  }

  let token;
  do {
    const listed = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        ContinuationToken: token,
      })
    );
    const objects = (listed.Contents || [])
      .map(item => item.Key)
      .filter(key => key && key.startsWith(prefix))
      .map(Key => ({ Key }));

    if (objects.length) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: BUCKET,
          Delete: { Objects: objects, Quiet: true },
        })
      );
    }

    token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (token);
}

async function deleteKeys(s3, keys) {
  for (const key of [...new Set(keys)].filter(Boolean)) {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  }
}

function cdnKey(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'cdn.diabolical.services') return null;
    const key = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    if (!key || key.includes('..') || key.endsWith('/')) return null;
    return key;
  } catch {
    return null;
  }
}

module.exports = { r2Client, deletePrefix, deleteKeys, cdnKey };
