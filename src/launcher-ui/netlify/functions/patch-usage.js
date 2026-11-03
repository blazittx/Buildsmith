const { r2Client } = require('./r2');
const { patchUsageBytes, quotaLimit } = require('./patchUsage');

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const { session_id } = JSON.parse(event.body || '{}');
    if (!session_id) return json(400, { error: 'session_id required' });
    const [usage, quota] = await Promise.all([
      patchUsageBytes(r2Client(), session_id),
      quotaLimit(session_id),
    ]);
    return json(200, {
      usage_bytes: usage,
      quota_bytes: Number(quota.quota_bytes),
      plan_id: quota.plan_id,
      user_id: quota.user_id,
    });
  } catch (error) {
    console.error('patch usage failed:', error);
    return json(error.statusCode || 500, { error: error.message || 'Failed to load storage usage' });
  }
};
