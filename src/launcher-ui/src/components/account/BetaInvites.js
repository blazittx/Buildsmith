import React, { useCallback, useEffect, useState } from 'react';
import { Divider as MuiDivider, Skeleton, Stack, Typography } from '@mui/material';
import Check from '@mui/icons-material/Check';
import ContentCopy from '@mui/icons-material/ContentCopy';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import Cookies from 'js-cookie';
import { colors } from '../../theme/colors';

const INVITE_ORIGIN = 'https://buildsmith.app';
const CODES_HIDDEN_KEY = 'betaInviteCodesHidden';

const sessionID = () => Cookies.get('sessionID');

const actionButton = {
  color: colors.text,
  width: 'fit-content',
};

const copyIconStyle = {
  fontSize: 16,
  color: colors.text,
  cursor: 'pointer',
  opacity: 0.7,
  transition: 'transform 0.1s ease, opacity 0.15s ease',
  '&:hover': { opacity: 1 },
  '&:active': { transform: 'scale(0.8)' },
};

export default function BetaInvites() {
  const [data, setData] = useState(null);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [codesHidden, setCodesHidden] = useState(() => localStorage.getItem(CODES_HIDDEN_KEY) === '1');
  const [copiedCode, setCopiedCode] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async (quiet = false) => {
    const id = sessionID();
    if (!id) {
      setHidden(true);
      setLoading(false);
      return;
    }
    if (!quiet) setLoading(true);
    try {
      const res = await fetch('/get-beta-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', sessionID: id },
        body: JSON.stringify({ session_id: id }),
      });
      if (res.status === 403) {
        setHidden(true);
        return;
      }
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to load invites');
      setData(body);
      setHidden(false);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener('beta-access-granted', load);
    return () => window.removeEventListener('beta-access-granted', load);
  }, [load]);

  const createInvite = async () => {
    const id = sessionID();
    if (!id) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/create-beta-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', sessionID: id },
        body: JSON.stringify({ session_id: id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to create invite');
      await load(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async code => {
    const link = `${INVITE_ORIGIN}/account/dashboard?betaInvite=${code}`;
    await navigator.clipboard.writeText(link);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(current => (current === code ? '' : current)), 1200);
    window.electronAPI?.showCustomNotification('Invite copied', link);
  };

  if (hidden) return null;
  if (loading) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="rectangular" width="100%" height={72} />
        <MuiDivider sx={{ borderColor: colors.border, opacity: 1 }} />
      </Stack>
    );
  }

  const unlimited = !!data?.unlimited;
  const remaining = data?.invites_remaining ?? 0;
  const createDisabled = busy || (!unlimited && !remaining);

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1" sx={{ color: colors.text, fontWeight: 600, letterSpacing: 0.2 }}>
        Beta invites
      </Typography>
      <Typography variant="body2" sx={{ color: colors.text, opacity: 0.7, fontSize: 14 }}>
        {unlimited
          ? 'You can create as many invites as you want.'
          : `You have ${remaining} invite${remaining === 1 ? '' : 's'} left.`}{' '}
        Each link can be used once. The person who uses it becomes a beta tester and can invite others.
      </Typography>
      {error ? (
        <Typography color="error" variant="body2">
          {error}
        </Typography>
      ) : null}
      <Stack direction="row" spacing={2} alignItems="center">
        <button
          className="game-button"
          style={{ ...actionButton, opacity: createDisabled ? 0.5 : 1, pointerEvents: createDisabled ? 'none' : 'auto' }}
          disabled={createDisabled}
          onClick={createInvite}
        >
          Create invite link
        </button>
        {(data?.invites || []).length ? (
          <button
            type="button"
            title={codesHidden ? 'Show codes' : 'Hide codes'}
            onClick={() =>
              setCodesHidden(value => {
                const next = !value;
                localStorage.setItem(CODES_HIDDEN_KEY, next ? '1' : '0');
                return next;
              })
            }
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.text,
              cursor: 'pointer',
            }}
          >
            {codesHidden ? <VisibilityOff sx={{ fontSize: 28 }} /> : <Visibility sx={{ fontSize: 28 }} />}
          </button>
        ) : null}
      </Stack>
      {(data?.invites || []).map(invite => (
        <Stack key={invite.code} direction="row" spacing={2} alignItems="center">
          <Typography variant="body2" sx={{ color: colors.text, opacity: 0.7, fontFamily: 'monospace' }}>
            {invite.redeemed ? 'Used' : codesHidden ? '••••••••••••••••' : invite.code}
          </Typography>
          {invite.redeemed ? null : (
            copiedCode === invite.code ? (
              <Check className="cursor-hover" onClick={() => copyLink(invite.code)} sx={copyIconStyle} />
            ) : (
              <ContentCopy
                className="cursor-hover"
                titleAccess="Copy link"
                onClick={() => copyLink(invite.code)}
                sx={copyIconStyle}
              />
            )
          )}
        </Stack>
      ))}
      <MuiDivider sx={{ borderColor: colors.border, opacity: 1 }} />
    </Stack>
  );
}
