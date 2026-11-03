import React, { useEffect, useState, useMemo } from 'react';
import Layout from '../components/Layout';
import Cookies from 'js-cookie';
import AccountDashboard from '../components/account/AccountDashboard';
import BetaInviteDialog from '../components/account/BetaInviteDialog';
import LoginScreen from '../components/account/LoginScreen';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

const saveInstallationPair = (installationId, accessToken) => {
  let count = 1;
  while (Cookies.get(`githubInstallationId${count}`)) count++;

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  Cookies.set(`githubInstallationId${count}`, installationId, {
    secure: true,
    sameSite: 'Strict',
    expires: expiresAt,
  });

  Cookies.set(`githubAccessToken${count}`, accessToken, {
    secure: true,
    sameSite: 'Strict',
    expires: expiresAt,
  });
};

export const getAllInstallationPairs = () => {
  const pairs = [];
  let count = 1;

  while (true) {
    const installationId = Cookies.get(`githubInstallationId${count}`);
    const accessToken = Cookies.get(`githubAccessToken${count}`);

    if (!installationId || !accessToken) break;

    pairs.push({ installationId, accessToken });
    count++;
  }

  return pairs;
};

const reportInviteResult = (current, next) => {
  if ((current?.status === 'accepted' || current?.status === 'already') && next.status === 'ready') {
    return { ...current, inviter: current.inviter || next.inviter };
  }
  return { ...current, ...next, inviter: next.inviter || current?.inviter };
};

const loadInvitePreview = async (code, onResult) => {
  try {
    const res = await fetch('/preview-beta-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      onResult({ status: 'invalid', error: data.error || 'This invite link is not valid.' });
      return;
    }
    onResult({ inviter: data.inviter_username, status: data.redeemed ? 'used' : 'ready' });
  } catch (error) {
    onResult({ status: 'invalid', error: 'Could not load this invite.' });
  }
};

const redeemPendingInvite = async (sessionID, onResult) => {
  const code = sessionStorage.getItem('betaInvite');
  if (!code || !sessionID) return;
  sessionStorage.removeItem('betaInvite');
  try {
    const res = await fetch('/redeem-beta-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', sessionID },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok && res.status >= 500) sessionStorage.setItem('betaInvite', code);
    const status = !res.ok ? (res.status === 409 ? 'used' : 'invalid') : data.already ? 'already' : 'accepted';
    onResult({ inviter: data.inviter_username, status, error: data.error });
    if (status === 'accepted') window.dispatchEvent(new Event('beta-access-granted'));
  } catch (error) {
    sessionStorage.setItem('betaInvite', code);
  }
};

export default function AccountPage() {
  const [username, setUsername] = useState(Cookies.get('username') || '');
  const [isLoggedIn, setIsLoggedIn] = useState(!!Cookies.get('sessionID'));
  const [checkingSession, setCheckingSession] = useState(true);
  const [inviteNotice, setInviteNotice] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const reportInvite = update => setInviteNotice(current => reportInviteResult(current, update));

  const cookieOptions = useMemo(() => ({ expires: 30, secure: true, sameSite: 'Strict' }), []);

  useEffect(() => {
    const handleSession = async () => {
      try {
        // First, check for auth callback parameters
        const params = new URLSearchParams(location.search);
        const sessionIDParam = params.get('sessionID');
        const usernameParam = params.get('username');
        const githubIdParam = params.get('githubID');
        const inviteFromUrl = params.get('betaInvite');
        if (inviteFromUrl) {
          sessionStorage.setItem('betaInvite', inviteFromUrl);
          loadInvitePreview(inviteFromUrl, reportInvite);
        }

        if (sessionIDParam && usernameParam && githubIdParam) {
          const verified = await fetch('/verify-session', {
            headers: { sessionID: sessionIDParam },
          });
          if (!verified.ok) {
            setCheckingSession(false);
            return;
          }
          Cookies.set('sessionID', sessionIDParam, cookieOptions);
          Cookies.set('username', usernameParam, cookieOptions);
          Cookies.set('githubID', githubIdParam, cookieOptions);

          setUsername(usernameParam);
          setIsLoggedIn(true);
          await redeemPendingInvite(sessionIDParam, reportInvite);
          params.delete('sessionID');
          params.delete('username');
          params.delete('githubID');
          params.delete('betaInvite');
          const search = params.toString();
          navigate(
            { pathname: location.pathname, search: search ? `?${search}` : '' },
            { replace: true }
          );
          return;
        }

        // Check existing session
        const sessionID = Cookies.get('sessionID');
        if (!sessionID) {
          setCheckingSession(false);
          return;
        }

        const res = await fetch('/verify-session', {
          headers: { sessionID },
        });

        if (res.status === 401 || res.status === 404) {
          Cookies.remove('sessionID');
          Cookies.remove('username');
          Cookies.remove('githubID');
          setUsername('');
          setIsLoggedIn(false);
        } else if (res.ok) {
          await res.json();
          Cookies.set('sessionID', sessionID, cookieOptions);
          const savedUsername = Cookies.get('username');
          const savedGithubId = Cookies.get('githubID');
          if (savedUsername) Cookies.set('username', savedUsername, cookieOptions);
          if (savedGithubId) Cookies.set('githubID', savedGithubId, cookieOptions);
          setIsLoggedIn(true);
          await redeemPendingInvite(sessionID, reportInvite);
        } else {
          setIsLoggedIn(true);
          await redeemPendingInvite(sessionID, reportInvite);
        }
        if (inviteFromUrl) {
          params.delete('betaInvite');
          const search = params.toString();
          navigate(
            { pathname: location.pathname, search: search ? `?${search}` : '' },
            { replace: true }
          );
        }
      } catch (error) {
        const existingSession = Cookies.get('sessionID');
        if (existingSession) {
          setIsLoggedIn(true);
          await redeemPendingInvite(existingSession, reportInvite);
        }
      } finally {
        setCheckingSession(false);
      }
    };

    handleSession();
  }, [location.search, location.pathname, navigate, cookieOptions]);

  useEffect(() => {
    if (
      window.api &&
      window.electronAPI &&
      typeof window.electronAPI.onProtocolData === 'function'
    ) {
      window.electronAPI.onProtocolData(async (action, data) => {
        if (action === 'auth') {
          // Use provider from data
          const provider = data && data.provider ? data.provider.toLowerCase() : 'unknown';

          let protocolName = 'OAuth';
          switch (provider) {
            case 'patreon':
              protocolName = 'Patreon OAuth';
              break;
            case 'github':
              protocolName = 'GitHub OAuth';
              break;
            case 'steam':
              protocolName = 'Steam OAuth';
              break;
            case 'discord':
              protocolName = 'Discord OAuth';
              break;
            default:
              protocolName = 'OAuth';
          }

          if (window.electronAPI) {
            window.electronAPI.showCustomNotification(protocolName, 'Successfully Authorized!');
          }

          // Handle each provider's data
          switch (provider) {
            case 'github': {
              const verified = await fetch('/verify-session', {
                headers: { sessionID: data.sessionID },
              });
              if (!verified.ok) break;
              Cookies.set('sessionID', data.sessionID, cookieOptions);
              Cookies.set('username', data.username, cookieOptions);
              Cookies.set('githubID', data.githubID, cookieOptions);
              setUsername(data.username);
              setIsLoggedIn(true);
              await redeemPendingInvite(data.sessionID, reportInvite);
              window.dispatchEvent(new Event('external-auth-success'));
              break;
            }
            case 'patreon':
              if (data.code) {
                Cookies.set('patreonAuthCode', data.code, cookieOptions);
              }
              window.dispatchEvent(new Event('external-auth-success'));
              break;
            case 'steam':
              // Handle Steam-specific logic here
              window.dispatchEvent(new Event('external-auth-success'));
              break;
            case 'discord':
              // Handle Discord-specific logic here
              window.dispatchEvent(new Event('external-auth-success'));
              break;
            default:
              // Handle unknown or generic OAuth
              window.dispatchEvent(new Event('external-auth-success'));
              break;
          }
        }
        if (action === 'github-app' && data.code) {
          if (window.electronAPI) {
            window.electronAPI.showCustomNotification('GitHub App', 'Successfully authorized!');
          }
          const exchanged = await fetch('/.netlify/functions/githubAppExchange', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: data.code }),
          });
          if (!exchanged.ok) return;
          const { installationId, token } = await exchanged.json();
          let found = false;
          let count = 1;
          while (Cookies.get(`githubInstallationId${count}`)) {
            if (Cookies.get(`githubInstallationId${count}`) === installationId) {
              Cookies.set(`githubAccessToken${count}`, token, cookieOptions);
              found = true;
              break;
            }
            count++;
          }
          if (!found) saveInstallationPair(installationId, token);
        }
      });
    }
  }, [cookieOptions]);

  const inviteDialog = (
    <BetaInviteDialog
      notice={inviteNotice}
      loggedIn={isLoggedIn}
      onClose={() => setInviteNotice(null)}
    />
  );

  if (checkingSession) {
    return (
      <Layout>
        <div>Loading...</div>
        {inviteDialog}
      </Layout>
    );
  }

  return (
    <>
    <Routes>
      <Route element={<Layout />}>
        <Route
          index
          element={
            isLoggedIn ? <Navigate to="/account/dashboard" /> : <Navigate to="/account/login" />
          }
        />
        <Route
          path="login"
          element={isLoggedIn ? <Navigate to="/account/dashboard" /> : <LoginScreen />}
        />
        <Route
          path="dashboard/*"
          element={
            isLoggedIn ? <AccountDashboard username={username} /> : <Navigate to="/account/login" />
          }
        />
      </Route>
    </Routes>
    {inviteDialog}
    </>
  );
}
