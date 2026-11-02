import React, { useEffect, useState } from 'react';
import { Button, LinearProgress, Stack, TextField, Typography } from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';
import Cookies from 'js-cookie';
import { colors } from '../../theme/colors';
import { notify } from '../../utils/notify';

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    color: colors.text,
    '& fieldset': { borderColor: colors.border },
    '&:hover fieldset': { borderColor: colors.primary },
  },
  '& .MuiInputLabel-root': { color: colors.border },
  '& .MuiFormHelperText-root': { color: colors.border },
};

const emptySettings = { appId: '', depotId: '', username: '', branch: '' };

const SteamUploadTab = ({ game }) => {
  const desktop = Boolean(window.electronAPI?.steamUploadBuild);
  const [settings, setSettings] = useState(emptySettings);
  const [loadedFor, setLoadedFor] = useState(null);
  const [password, setPassword] = useState('');
  const [guardCode, setGuardCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [percentage, setPercentage] = useState(null);
  const [log, setLog] = useState('');

  useEffect(() => {
    let ignore = false;
    window.electronAPI?.getSteamSettings?.(game.game_id).then(saved => {
      if (ignore) return;
      setSettings({ ...emptySettings, ...(saved || {}) });
      setLoadedFor(game.game_id);
    });
    return () => {
      ignore = true;
    };
  }, [game.game_id]);

  useEffect(() => {
    if (!desktop || loadedFor !== game.game_id) return undefined;
    const timer = setTimeout(() => {
      window.electronAPI.saveSteamSettings(game.game_id, settings);
    }, 400);
    return () => clearTimeout(timer);
  }, [desktop, game.game_id, loadedFor, settings]);

  const setField = key => event => setSettings(current => ({ ...current, [key]: event.target.value }));

  const setAppId = event => {
    const appId = event.target.value;
    setSettings(current => ({
      ...current,
      appId,
      depotId: /^\d+$/.test(appId) ? String(Number(appId) + 1) : current.depotId,
    }));
  };

  const upload = async () => {
    setBusy(true);
    setLog('');
    setPercentage(0);
    setStatus(`Fetching v${game.version}…`);
    const unsubscribe = window.electronAPI.onSteamUploadProgress?.(progress => {
      if (progress.gameId !== game.game_id) return;
      if (progress.message) {
        setStatus(progress.phase === 'uploading' ? 'Uploading to Steam…' : progress.message);
        if (progress.phase === 'log' || progress.phase === 'uploading') {
          setLog(current => `${current}${progress.message}\n`.split('\n').slice(-80).join('\n'));
        }
      }
      if (progress.phase === 'uploading' && progress.percentage == null) setPercentage(null);
      else if (progress.percentage != null) setPercentage(progress.percentage);
    });
    try {
      const result = await window.electronAPI.steamUploadBuild({
        gameId: game.game_id,
        version: game.version,
        ...settings,
        password,
        guardCode,
        sessionId: Cookies.get('sessionID'),
      });
      setPassword('');
      setGuardCode('');
      setStatus(result?.message || 'Upload finished.');
      notify('Steam upload finished', result?.message || `v${game.version} was uploaded.`);
    } catch (error) {
      const message = error.message || 'SteamCMD could not upload this build.';
      setStatus('Steam upload failed');
      setLog(current => `${current}${message}\n`.split('\n').slice(-80).join('\n'));
      notify('Steam upload failed', message.split('\n')[0]);
    } finally {
      unsubscribe?.();
      setBusy(false);
    }
  };

  if (!desktop) {
    return (
      <Typography sx={{ color: colors.text, padding: 2 }}>
        Open this page in the Buildsmith app to upload the current build to Steam.
      </Typography>
    );
  }

  return (
    <Stack spacing={2} sx={{ padding: 2 }}>
      <Typography variant="body2" sx={{ color: colors.text }}>
        Uploads v{game.version || '—'} through SteamPipe. Steam sends the patch to players.
      </Typography>
      <Stack direction="row" spacing={1}>
        <TextField label="Steam App ID" value={settings.appId} onChange={setAppId} disabled={busy} fullWidth sx={fieldSx} />
        <TextField label="Depot ID" value={settings.depotId} onChange={setField('depotId')} disabled={busy} fullWidth sx={fieldSx} />
      </Stack>
      <TextField
        label="Beta branch"
        value={settings.branch}
        onChange={setField('branch')}
        disabled={busy}
        helperText="A named beta branch is set live after upload. Leave this empty to upload only."
        fullWidth
        sx={fieldSx}
      />
      <TextField label="Build account" value={settings.username} onChange={setField('username')} disabled={busy} fullWidth sx={fieldSx} />
      <Stack direction="row" spacing={1}>
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={event => setPassword(event.target.value)}
          disabled={busy}
          helperText="Leave empty after this machine has logged in once."
          fullWidth
          sx={fieldSx}
        />
        <TextField
          label="Steam Guard code"
          value={guardCode}
          onChange={event => setGuardCode(event.target.value)}
          disabled={busy}
          helperText="Only the first login on this machine."
          fullWidth
          sx={fieldSx}
        />
      </Stack>
      <Button
        variant="contained"
        startIcon={<UploadIcon />}
        onClick={upload}
        disabled={busy || !game.version || !settings.appId || !settings.depotId || !settings.username}
        sx={{ backgroundColor: colors.primary, color: colors.background, alignSelf: 'flex-start' }}
      >
        {busy ? 'Uploading…' : 'Upload current build'}
      </Button>
      {busy || status ? (
        <Stack spacing={1}>
          <Typography variant="body2" sx={{ color: colors.text }}>{status}</Typography>
          {busy && (
            <LinearProgress
              variant={percentage == null ? 'indeterminate' : 'determinate'}
              value={percentage ?? 0}
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                '& .MuiLinearProgress-bar': { backgroundColor: colors.button },
              }}
            />
          )}
        </Stack>
      ) : null}
      {log && (
        <pre
          style={{
            margin: 0,
            maxHeight: 180,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            color: colors.text,
            fontSize: 12,
          }}
        >
          {log}
        </pre>
      )}
    </Stack>
  );
};

export default SteamUploadTab;
