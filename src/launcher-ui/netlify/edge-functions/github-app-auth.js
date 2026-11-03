/* eslint-disable import/no-anonymous-default-export */
/* eslint-disable no-undef */

import { importPKCS8, SignJWT } from 'https://deno.land/x/jose@v4.14.4/index.ts';

function secret() {
  return Netlify.env.get('GITHUB_STATE_SECRET') || Netlify.env.get('API_KEY') || '';
}

function bytesToBase64Url(bytes) {
  let bin = '';
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const bin = atob(padded);
  return Uint8Array.from(bin, char => char.charCodeAt(0));
}

async function hmac(payload) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
  return bytesToBase64Url(sig);
}

async function readPayload(code) {
  const value = String(code || '');
  const dot = value.lastIndexOf('.');
  if (!secret() || dot <= 0) return null;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = await hmac(payload);
  if (sig.length !== expected.length) return null;
  let mismatch = 0;
  for (let i = 0; i < sig.length; i += 1) mismatch |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (mismatch) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch (error) {
    return null;
  }
}

async function signPayload(data) {
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(data)));
  return `${payload}.${await hmac(payload)}`;
}

export default async request => {
  const { searchParams } = new URL(request.url);
  const installationId = searchParams.get('installation_id');
  const installState = await readPayload(searchParams.get('state'));
  if (!installationId || !/^\d+$/.test(installationId) || !installState || installState.kind !== 'github-install') {
    return new Response(JSON.stringify({ error: 'Missing GitHub installation state' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const apiBase = Netlify.env.get('API_BASE_URL');
    const apiKey = Netlify.env.get('API_KEY');
    const userRes = await fetch(`${apiBase}/rest-api/users/session/${encodeURIComponent(installState.sessionId)}`, {
      headers: { 'x-api-key': apiKey },
    });
    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    const user = await userRes.json();

    const privateKey = await importPKCS8(
      new TextEncoder().encode(atob(Netlify.env.get('GITHUB_PRIVATE_KEY'))),
      'RS256'
    );
    const now = Math.floor(Date.now() / 1000);
    const jwtToken = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt(now)
      .setExpirationTime(now + 600)
      .setIssuer(Netlify.env.get('GITHUB_APP_ID'))
      .sign(privateKey);
    const ghHeaders = { Authorization: `Bearer ${jwtToken}`, Accept: 'application/vnd.github+json' };

    const infoRes = await fetch(`https://api.github.com/app/installations/${installationId}`, { headers: ghHeaders });
    if (!infoRes.ok) throw new Error('Installation lookup failed');
    const account = (await infoRes.json()).account || {};
    const githubId = String(user.github_id || user.githubId || '');
    let owned = account.type === 'User' && String(account.id) === githubId;
    if (!owned && account.type === 'Organization' && user.username) {
      const memberRes = await fetch(
        `https://api.github.com/orgs/${account.login}/memberships/${encodeURIComponent(user.username)}`,
        { headers: ghHeaders }
      );
      owned = memberRes.ok && (await memberRes.json()).state === 'active';
    }
    if (!owned) {
      return new Response(JSON.stringify({ error: 'This GitHub installation is not yours' }), { status: 403 });
    }

    const tokenRes = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      headers: ghHeaders,
    });
    if (!tokenRes.ok) throw new Error('Token request failed');
    const { token } = await tokenRes.json();
    const code = await signPayload({
      kind: 'github-app',
      installationId,
      token,
      exp: Date.now() + 2 * 60 * 1000,
    });

    return new Response('', {
      status: 302,
      headers: { Location: `buildsmith://github-app?code=${encodeURIComponent(code)}` },
    });
  } catch (error) {
    console.error('GitHub installation token request failed');
    return new Response(JSON.stringify({ error: 'Failed to finish GitHub authorization' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
