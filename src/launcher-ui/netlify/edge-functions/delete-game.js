/* eslint-disable import/no-anonymous-default-export */
/* eslint-disable no-undef */

export default async request => {
  if (request.method === 'OPTIONS') return new Response('', { status: 200 });
  if (request.method !== 'DELETE') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const response = await fetch(new URL('/.netlify/functions/delete-game', request.url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: await request.text(),
  });

  return new Response(await response.text(), {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
