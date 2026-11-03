import React, { useEffect, useState } from 'react';
import {
  Divider as MuiDivider,
  Grid,
  IconButton,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Box,
} from '@mui/material';
import { colors } from '../../theme/colors';
import LogoutButton from './LogoutButton';
import BetaInvites from './BetaInvites';
import LogoutIcon from '@mui/icons-material/Logout';
import LinearProgress from '@mui/material/LinearProgress';
import CloseIcon from '@mui/icons-material/Close';

// Use local SVGs for each service, with a description for the tooltip
export const services = [
  {
    name: 'Discord',
    icon: '/logos/discord.svg',
    description: 'Get Discord role integration and team chat features.',
  },
  {
    name: 'Steam',
    icon: '/logos/steam.svg',
    description: 'Deploy straight to Steam from GitHub.',
  },
  {
    name: 'Unity',
    icon: '/logos/unity.svg',
    description: 'Share your Unity asset packs with your team members.',
  },
  {
    name: 'Patreon',
    icon: '/logos/patreon.svg',
    description: 'Get perks such as more hosting space, higher limits on games/teams, etc.',
  },
];

const PATREON_CLIENT_ID = '1xNwOOd3hVInyijzxYT0qrqTf1mkuhYPqcZusknZ4I6MQhk-97vzlp2ABpqgMHFH';
const REDIRECT_URI = 'https://buildsmith.app/.netlify/functions/patreonAuth';

const formatStorageValue = bytes => {
  if (!bytes) return '0.00 MB';
  const gb = bytes / 1e9;
  const mb = bytes / 1e6;
  if (gb >= 1) {
    return `${gb.toFixed(2)} GB`;
  }
  return `${mb.toFixed(2)} MB`;
};

const getPatreonOAuthUrl = () => {
  // Detect if running in Electron (customize this check as needed)
  const isElectron = window?.navigator?.userAgent?.toLowerCase().includes('electron');
  const source = isElectron ? 'electron' : 'web';
  // Get the sessionID from your cookie or app state
  const sessionID = document.cookie
    .split('; ')
    .find(row => row.startsWith('sessionID='))
    ?.split('=')[1];

  // Compose state as a JSON string and encode it
  const stateObj = { source, sessionID };
  const state = encodeURIComponent(JSON.stringify(stateObj));

  return (
    `https://www.patreon.com/oauth2/authorize?` +
    `response_type=code` +
    `&client_id=${PATREON_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=identity%20identity%5Bemail%5D%20identity.memberships` +
    `&state=${state}`
  );
};

const iconButtonStyle = {
  background: '#000',
  borderRadius: '4px',
  width: 48,
  height: 48,
  border: `1px solid ${colors.border}`,
  transition: 'background 0.2s, border-color 0.2s',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  p: 0,
  boxShadow: '0 1px 4px 0 rgba(0,0,0,0.03)',
  '&:hover': {
    background: '#fff',
    borderColor: '#fff',
  },
};

const imgStyle = {
  width: 24,
  height: 24,
  filter: 'invert(100%)',
  transition: 'filter 0.2s',
};

const imgHoverStyle = {
  filter: 'invert(0%)',
};

const Divider = () => <MuiDivider sx={{ borderColor: colors.border, opacity: 1 }} />;

const AccountSettings = ({ username }) => {
  const [hovered, setHovered] = React.useState(null);
  const [connectedProviders, setConnectedProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectedUsernames, setConnectedUsernames] = useState({});

  // Quota state
  const [quota, setQuota] = useState(null);
  const [quotaLoading, setQuotaLoading] = useState(true);
  const [quotaError, setQuotaError] = useState(null);

  // Fetch connected providers (refactored so it can be called from anywhere)
  const fetchConnectedProviders = async () => {
    setLoading(true);
    try {
      const sessionID = document.cookie
        .split('; ')
        .find(row => row.startsWith('sessionID='))
        ?.split('=')[1];
      if (!sessionID) return;
      const res = await fetch('/connected-external-apps', {
        headers: { SessionID: sessionID },
      });
      if (!res.ok) throw new Error('Failed to fetch connected accounts');
      const data = await res.json();
      if (data.subscriptions) {
        // Get connected providers from subscriptions
        const connected = services
          .filter(service =>
            data.subscriptions.some(
              sub => sub.external_subscription_id === service.name.toLowerCase()
            )
          )
          .map(service => service.name);
        setConnectedProviders(connected);

        // Store usernames
        const usernames = {};
        data.subscriptions.forEach(sub => {
          const service = services.find(s => s.name.toLowerCase() === sub.external_subscription_id);
          if (service) {
            usernames[service.name] = sub.username;
          }
        });
        setConnectedUsernames(usernames);
      } else {
        setConnectedProviders([]);
        setConnectedUsernames({});
      }
    } catch (e) {
      setConnectedProviders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnectedProviders();
    // Listen for custom event to refresh connected accounts
    const handler = () => fetchConnectedProviders();
    window.addEventListener('external-auth-success', handler);
    return () => {
      window.removeEventListener('external-auth-success', handler);
    };
  }, []);

  // Fetch quota info
  useEffect(() => {
    const fetchQuota = async () => {
      setQuotaLoading(true);
      setQuotaError(null);
      try {
        const sessionID = document.cookie
          .split('; ')
          .find(row => row.startsWith('sessionID='))
          ?.split('=')[1];
        if (!sessionID) throw new Error('No session ID');
        const res = await fetch('/get-user-quota', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionID }),
        });
        if (!res.ok) throw new Error('Failed to fetch quota');
        const data = await res.json();
        setQuota(data);
      } catch (e) {
        setQuotaError(e.message || 'Failed to fetch quota');
        setQuota(null);
      } finally {
        setQuotaLoading(false);
      }
    };
    fetchQuota();
  }, []);

  // Split services into connected and not connected
  const connectedServices = services.filter(s => connectedProviders.includes(s.name));
  const unconnectedServices = services.filter(s => !connectedProviders.includes(s.name));

  const handlePatreonClick = () => {
    const url = getPatreonOAuthUrl();
    if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
      window.electronAPI.openExternal(url);
    } else {
      window.location.href = url;
    }
  };

  const handleDisconnect = async serviceName => {
    try {
      const sessionID = document.cookie
        .split('; ')
        .find(row => row.startsWith('sessionID='))
        ?.split('=')[1];
      if (!sessionID) return;

      const res = await fetch('/disconnect-external-app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          SessionID: sessionID,
        },
        body: JSON.stringify({ provider: serviceName.toLowerCase() }),
      });

      if (!res.ok) throw new Error('Failed to disconnect account');

      // Update the connected providers list
      setConnectedProviders(prev => prev.filter(p => p !== serviceName));
      // Remove the username from the state
      setConnectedUsernames(prev => {
        const newState = { ...prev };
        delete newState[serviceName.toLowerCase()];
        return newState;
      });
    } catch (error) {
      console.error('Error disconnecting account:', error);
    }
  };

  return (
    <Stack className="overflow-hidden" sx={{ width: '100%', maxWidth: '100%' }}>
      <Stack
        className="flex overflow-auto flex-col"
        sx={{
          background: 'rgba(255,255,255,0.01)',
          borderRadius: '4px',
          boxShadow: '0 4px 12px 0 rgba(0,0,0,0.04)',
          padding: '24px',
          gap: '32px',
        }}
      >
        {/* Profile Info */}
        <Stack spacing={2}>
          <Typography
            variant="subtitle1"
            sx={{ color: colors.text, fontWeight: 600, letterSpacing: 0.2 }}
          >
            Profile
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              label="Username"
              value={username}
              disabled
              fullWidth
              sx={{
                borderRadius: '4px',
                background: 'rgba(255,255,255,0.03)',
                '& .MuiOutlinedInput-root': {
                  color: colors.text,
                  fontSize: '16px',
                  borderRadius: '4px',
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  border: '1px solid' + colors.border + '!important',
                  borderRadius: '4px',
                },
                '& .MuiFormLabel-root': {
                  color: colors.text,
                },
              }}
            />
            <LogoutButton style={{ height: '100%', borderRadius: '4px' }}>
              <LogoutIcon sx={{ color: colors.error }} />
            </LogoutButton>
          </Stack>
        </Stack>

        <BetaInvites />

        {/* Quota/Usage Section */}
        <Stack spacing={2}>
          <Typography variant="subtitle2" sx={{ color: colors.text, fontWeight: 500 }}>
            Storage Usage
          </Typography>
          {quotaLoading ? (
            <Skeleton variant="rectangular" width={240} height={32} />
          ) : quotaError ? (
            <Typography color="error" variant="body2">
              {quotaError}
            </Typography>
          ) : quota ? (
            <Stack spacing={1}>
              <LinearProgress
                variant="determinate"
                value={
                  quota.usage_bytes && quota.quota_bytes
                    ? Math.min(100, (quota.usage_bytes / quota.quota_bytes) * 100)
                    : 0
                }
                sx={{
                  height: 6,
                  borderRadius: 2,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 2,
                    background: 'linear-gradient(90deg, #4CAF50 0%, #8BC34A 100%)',
                    transition: 'transform 0.4s ease-in-out',
                  },
                }}
              />
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" sx={{ color: colors.textSecondary, fontSize: 13 }}>
                  {formatStorageValue(quota.usage_bytes)} used
                </Typography>
                <Typography variant="body2" sx={{ color: colors.textSecondary, fontSize: 13 }}>
                  {formatStorageValue(quota.quota_bytes)} total
                </Typography>
              </Stack>
            </Stack>
          ) : null}
        </Stack>

        <Divider />

        {/* Add Accounts Section */}
        <Stack spacing={2}>
          <Typography
            variant="subtitle1"
            sx={{ color: colors.text, fontWeight: 600, letterSpacing: 0.2 }}
          >
            Add accounts to your profile
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: colors.text, opacity: 0.7, fontWeight: 400, fontSize: 14 }}
          >
            Connect your accounts to unlock features and personalize your experience. Only you can
            see your connected accounts unless you choose to display them.
          </Typography>
          <Grid container spacing={2}>
            {loading
              ? services.map((_, idx) => (
                  <Grid item key={idx}>
                    <Skeleton
                      variant="rounded"
                      width={48}
                      height={48}
                      sx={{ borderRadius: '4px' }}
                    />
                  </Grid>
                ))
              : unconnectedServices.map(service => (
                  <Grid item key={service.name}>
                    <Tooltip
                      title={
                        <span style={{ fontSize: 13, lineHeight: 1.4 }}>{service.description}</span>
                      }
                      placement="top"
                      arrow
                    >
                      <IconButton
                        sx={iconButtonStyle}
                        onMouseEnter={() => setHovered(service.name)}
                        onMouseLeave={() => setHovered(null)}
                        onClick={() => {
                          if (service.name === 'Patreon') {
                            handlePatreonClick();
                          }
                        }}
                      >
                        <img
                          src={service.icon}
                          alt={service.name}
                          style={
                            hovered === service.name ? { ...imgStyle, ...imgHoverStyle } : imgStyle
                          }
                        />
                      </IconButton>
                    </Tooltip>
                  </Grid>
                ))}
          </Grid>
        </Stack>

        <Divider />

        {/* Connected Accounts Section */}
        <Stack spacing={2}>
          <Typography
            variant="subtitle1"
            sx={{ color: colors.text, fontWeight: 600, letterSpacing: 0.2 }}
          >
            Connected Accounts
          </Typography>
          {loading ? (
            <Typography variant="body2" sx={{ color: colors.text, opacity: 0.7 }}>
              Loading...
            </Typography>
          ) : connectedServices.length === 0 ? (
            <Typography variant="body2" sx={{ color: colors.text, opacity: 0.7 }}>
              No accounts connected yet.
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {connectedServices.map(service => (
                <Grid item key={service.name}>
                  <Box
                    sx={{
                      position: 'relative',
                      display: 'inline-block',
                      cursor: 'pointer',
                    }}
                    className="hover-effect"
                  >
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      sx={{
                        background: '#000',
                        borderRadius: '4px',
                        border: `1px solid ${colors.border}`,
                        transition: 'all 0.2s ease',
                        overflow: 'hidden',
                        '&:hover': {
                          '& .service-icon': {
                            filter: 'invert(0%)',
                          },
                          '& .disconnect-button': {
                            width: '32px',
                            opacity: 1,
                          },
                        },
                      }}
                    >
                      <IconButton
                        sx={{
                          ...iconButtonStyle,
                          width: 48,
                          height: 48,
                          minWidth: 48,
                          borderRadius: 0,
                          border: 'none',
                          cursor: 'pointer',
                        }}
                        disabled
                      >
                        <img
                          src={service.icon}
                          alt={service.name}
                          style={imgStyle}
                          className="service-icon"
                        />
                      </IconButton>
                      <Stack
                        spacing={0.5}
                        sx={{
                          pr: 1,
                          minWidth: 'fit-content',
                          maxWidth: '200px',
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            color: colors.text,
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {connectedUsernames[service.name] || ''}
                        </Typography>
                      </Stack>
                      <IconButton
                        className="disconnect-button"
                        onClick={() => handleDisconnect(service.name)}
                        sx={{
                          width: 0,
                          opacity: 0,
                          transition: 'all 0.2s ease',
                          color: colors.error,
                          padding: '4px',
                          minWidth: 0,
                          cursor: 'pointer',
                          '&:hover': {
                            background: 'rgba(255,0,0,0.1)',
                          },
                        }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}
        </Stack>
      </Stack>
    </Stack>
  );
};

export function useConnectedProviders() {
  const [connectedProviders, setConnectedProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConnectedProviders = async () => {
      setLoading(true);
      try {
        const sessionID = document.cookie
          .split('; ')
          .find(row => row.startsWith('sessionID='))
          ?.split('=')[1];
        if (!sessionID) return;
        const res = await fetch('/connected-external-apps', {
          headers: { SessionID: sessionID },
        });
        if (!res.ok) throw new Error('Failed to fetch connected accounts');
        const data = await res.json();
        if (data.subscriptions) {
          // Get connected providers from subscriptions
          const connected = services
            .filter(service =>
              data.subscriptions.some(
                sub => sub.external_subscription_id === service.name.toLowerCase()
              )
            )
            .map(service => service.name);
          setConnectedProviders(connected);
        } else {
          setConnectedProviders([]);
        }
      } catch (e) {
        setConnectedProviders([]);
      } finally {
        setLoading(false);
      }
    };
    fetchConnectedProviders();
  }, []);

  return { connectedProviders, loading };
}

export default AccountSettings;
