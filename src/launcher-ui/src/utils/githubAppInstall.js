import Cookies from 'js-cookie';

export async function openGitHubAppInstall() {
  const sessionID = Cookies.get('sessionID');
  const res = await fetch('/.netlify/functions/githubAppState', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(sessionID ? { sessionID } : {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.state) throw new Error(data.error || 'Could not start GitHub authorization');
  const url = `https://github.com/apps/diabolical-launcher-integration/installations/select_target?state=${encodeURIComponent(data.state)}`;
  await window.electronAPI.openExternal(url);
}
