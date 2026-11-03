const { isAllowedHost } = require('../src/js/allowedHost');
const { gameIdFromKey } = require('../src/launcher-ui/netlify/functions/access');
const { signPayload, readPayload } = require('../src/launcher-ui/netlify/functions/githubState');

test('allowed hosts match the domain and its subdomains only', () => {
  const domains = ['buildsmith.app', 'github.com'];
  expect(isAllowedHost('buildsmith.app', domains)).toBe(true);
  expect(isAllowedHost('dev.buildsmith.app', domains)).toBe(true);
  expect(isAllowedHost('evilbuildsmith.app', domains)).toBe(false);
  expect(isAllowedHost('github.com.evil.test', domains)).toBe(false);
});

test('storage keys stay inside one game folder', () => {
  expect(gameIdFromKey('R2/abc/chunks/123')).toBe('abc');
  expect(gameIdFromKey('R2/abc/manifests/StandaloneWindows64/1.0.0.json')).toBe('abc');
  expect(gameIdFromKey('R2/../chunks/123')).toBe(null);
  expect(gameIdFromKey('user-uploads/file.png')).toBe(null);
});

test('signed github handoff expires and rejects tampering', () => {
  process.env.GITHUB_STATE_SECRET = 'test-secret';
  const code = signPayload({ kind: 'github-app', installationId: '1', token: 'ghs_x', exp: Date.now() + 1000 });
  expect(readPayload(code).token).toBe('ghs_x');
  expect(readPayload(code.slice(0, -1) + (code.endsWith('a') ? 'b' : 'a'))).toBe(null);
  const expired = signPayload({ kind: 'github-app', token: 'ghs_x', exp: Date.now() - 1000 });
  expect(readPayload(expired)).toBe(null);
});
