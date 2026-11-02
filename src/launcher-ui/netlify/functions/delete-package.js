const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

function packageKeys(packageUrl, packageId) {
  const url = new URL(packageUrl);
  if (url.hostname !== 'cdn.diabolical.services') {
    throw new Error('Unexpected package location');
  }

  const raw = url.pathname.replace(/^\//, '');
  const decoded = decodeURIComponent(raw);
  const suffix = `/packages/${packageId}.unitypackage`;
  const keys = [...new Set([decoded, raw])].filter(
    key => key.startsWith('team-uploads/') && key.endsWith(suffix) && !key.includes('..')
  );

  if (keys.length === 0) throw new Error('Unexpected package location');
  return keys;
}

exports.handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid request body' });
  }

  const { package_id, team_id, session_id } = body;
  if (!package_id || !team_id || !session_id) {
    return json(400, { error: 'Package ID, team ID, and session ID are required' });
  }

  const apiBase = process.env.API_BASE_URL;
  const apiKey = process.env.API_KEY;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!apiBase || !apiKey || !accessKeyId || !secretAccessKey) {
    return json(500, { error: 'Storage is not configured' });
  }

  try {
    const lookup = new URL(`${apiBase}/rest-api/unityPackages/${encodeURIComponent(package_id)}`);
    lookup.searchParams.set('team_id', String(team_id));
    lookup.searchParams.set('session_id', session_id);

    const pkgRes = await fetch(lookup, { headers: { 'x-api-key': apiKey } });
    const pkgData = await pkgRes.json().catch(() => ({}));
    if (!pkgRes.ok) {
      return json(pkgRes.status, { error: pkgData.error || 'Failed to find package' });
    }

    const packageUrl = pkgData.package?.package_url;
    if (!packageUrl) return json(500, { error: 'Package has no storage location' });

    const keys = packageKeys(packageUrl, package_id);
    const s3 = new S3Client({
      region: 'auto',
      endpoint: 'https://c82515457400147e7f08ee6234e25742.r2.cloudflarestorage.com',
      credentials: { accessKeyId, secretAccessKey },
    });

    for (const key of keys) {
      await s3.send(new DeleteObjectCommand({ Bucket: 'diabolicallauncher', Key: key }));
    }

    const delRes = await fetch(`${apiBase}/rest-api/unityPackages/${encodeURIComponent(package_id)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ team_id, session_id }),
    });
    const delData = await delRes.json().catch(() => ({}));
    if (!delRes.ok) {
      return json(delRes.status, { error: delData.error || 'Removed the file, but failed to delete the package record' });
    }

    return json(200, { message: 'Package deleted successfully' });
  } catch (error) {
    console.error('delete-package failed:', error);
    return json(500, { error: error.message || 'Failed to delete package' });
  }
};
