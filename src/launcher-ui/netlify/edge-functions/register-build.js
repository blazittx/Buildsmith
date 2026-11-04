/* eslint-disable import/no-anonymous-default-export */
/* eslint-disable no-undef */

// Deno's HTTP/2 fetch in the edge runtime fails with TypeError: fetch failed
// once its connection pool is stuck. Registration is a small JSON post, so
// hand it to the Node function, which already reaches the API during upload.
export default async (request, context) => {
  if (request.method === 'OPTIONS') return new Response('', { status: 200 });
  return context.rewrite('/.netlify/functions/registerBuild');
};
