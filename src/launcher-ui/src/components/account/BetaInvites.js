import React, { useCallback, useEffect, useState } from 'react';
import { Button, Divider as MuiDivider, Skeleton, Stack, Typography } from '@mui/material';
import Cookies from 'js-cookie';
import { colors } from '../../theme/colors';

const INVITE_ORIGIN = 'https://buildsmith.app';

const sessionID = () => Cookies.get('sessionID');

const buttonStyle = {
  alignSelf: 'flex-start',
  color: colors.text,
  border: `1px solid ${colors.border}`,
  borderRadius: '4px',
  textTransform: 'none',
  '&:hover': { background: colors.button },
};

export default function BetaInvites() {
  const [data, setData] = useState(null);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
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
    window.electronAPI?.showCustomNotification('Invite copied', link);
  };

  if (hidden) return null;
  if (loading) return <Skeleton variant="rectangular" width="100%" height={72} />;

  const unlimited = !!data?.unlimited;
  const remaining = data?.invites_remaining ?? 0;

  return (
    <Stack spacing={2}>
      <MuiDivider sx={{ borderColor: colors.border, opacity: 1 }} />
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
      <Button sx={buttonStyle} disabled={busy || (!unlimited && !remaining)} onClick={createInvite}>
        Create invite link
      </Button>
      {(data?.invites || []).map(invite => (
        <Stack key={invite.code} direction="row" spacing={2} alignItems="center">
          <Typography variant="body2" sx={{ color: colors.text, opacity: 0.7, fontFamily: 'monospace' }}>
            {invite.redeemed ? 'Used' : invite.code}
          </Typography>
          {invite.redeemed ? null : (
            <Button sx={buttonStyle} onClick={() => copyLink(invite.code)}>
              Copy link
            </Button>
          )}
        </Stack>
      ))}
    </Stack>
  );
}
