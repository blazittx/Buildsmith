const crypto = require('crypto');

function stateSecret() {
  return process.env.GITHUB_STATE_SECRET || process.env.API_KEY || '';
}

function signPayload(data) {
  const secret = stateSecret();
  if (!secret) throw new Error('GitHub state signing is not configured');
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function readPayload(code) {
  const secret = stateSecret();
  const value = String(code || '');
  const dot = value.lastIndexOf('.');
  if (!secret || dot <= 0) return null;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const actualBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(actualBuf, expectedBuf)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch (error) {
    return null;
  }
}

module.exports = { signPayload, readPayload };
