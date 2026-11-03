const CDN = 'https://cdn.diabolical.services';
const ZIP = '/R2/patch/Versions/Build-StandaloneWindows64-0.0.7.zip';
const KEY = ZIP.slice(1);

async function finish(res) {
  await res.arrayBuffer().catch(() => {});
  return res;
}

test('the cdn does not serve a game zip as a public file', async () => {
  const res = await finish(await fetch(`${CDN}${ZIP}`));
  expect(res.status).toBe(404);
});

test('the apex host does not serve that zip either', async () => {
  const res = await finish(await fetch(`https://diabolical.services${ZIP}`));
  expect(res.status).toBe(401);
});

test('an upload url is refused when no session is sent', async () => {
  const res = await fetch(`${CDN}/generateUploadUrl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      size_bytes: 1000,
      isGameUpload: true,
      gameId: 'patch',
      version: '0.0.7',
      fileExt: 'zip',
    }),
  });
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.error).toMatch(/session/i);
});

test('a private build is not signed for a request with no session', async () => {
  const res = await fetch(`${CDN}/generateDownloadUrl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: KEY }),
  });
  expect(res.status).toBe(403);
  const body = await res.json();
  expect(body.url).toBeUndefined();
});
