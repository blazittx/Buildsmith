import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Skeleton, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Cookies from 'js-cookie';
import { colors } from '../../theme/colors';
import { formatBytes } from '../../utils/publishPatch';

export default function StorageBreakdown() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const sessionID = Cookies.get('sessionID');
    if (!sessionID) {
      setError('No session ID');
      return;
    }
    fetch('/.netlify/functions/storage-breakdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionID }),
    })
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to load storage');
        setReport(data);
      })
      .catch(err => setError(err.message || 'Failed to load storage'));
  }, []);

  return (
    <Stack className="overflow-hidden" sx={{ width: '100%', height: '100%' }}>
      <Stack className="flex overflow-auto flex-col" sx={{ gap: 2, p: 3, height: '100%' }}>
        <Link to="/account/dashboard/settings" style={{ color: colors.text, width: 'fit-content' }}>
          <Stack direction="row" alignItems="center" gap={0.5}>
            <ArrowBackIcon sx={{ fontSize: 18 }} />
            <Typography sx={{ color: colors.text, fontSize: 14 }}>Storage</Typography>
          </Stack>
        </Link>
        {error ? (
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        ) : !report ? (
          <Skeleton variant="rectangular" height={120} />
        ) : (
          <Stack gap={3}>
            <Typography sx={{ color: colors.text, fontWeight: 600 }}>
              {formatBytes(report.total_bytes)} stored
            </Typography>
            {report.games.length === 0 ? (
              <Typography sx={{ color: colors.text, opacity: 0.7, fontSize: 14 }}>
                No builds stored yet.
              </Typography>
            ) : (
              report.games.map(game => (
                <Stack key={game.game_id} gap={1.5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                    <Typography sx={{ color: colors.text, fontWeight: 600 }}>{game.game_name}</Typography>
                    <Typography sx={{ color: colors.text, opacity: 0.7, fontSize: 13 }}>
                      {formatBytes(game.stored_bytes)}
                    </Typography>
                  </Stack>
                  {game.versions.map(version => (
                    <Stack key={version.version} gap={0.5}>
                      <Typography sx={{ color: colors.text, fontSize: 13, opacity: 0.8 }}>
                        v{version.version} · index {formatBytes(version.manifest_bytes)}
                      </Typography>
                      {version.files.length === 0 ? (
                        <Typography sx={{ color: colors.text, opacity: 0.55, fontSize: 13 }}>
                          Same files as a newer version.
                        </Typography>
                      ) : (
                        version.files.map(file => (
                          <Stack
                            key={`${version.version}-${file.path}`}
                            direction="row"
                            justifyContent="space-between"
                            gap={2}
                          >
                            <Typography
                              sx={{ color: colors.text, fontSize: 13, wordBreak: 'break-all' }}
                            >
                              {file.path}
                            </Typography>
                            <Typography sx={{ color: colors.text, fontSize: 13, whiteSpace: 'nowrap' }}>
                              {formatBytes(file.bytes)}
                            </Typography>
                          </Stack>
                        ))
                      )}
                    </Stack>
                  ))}
                  {game.unreferenced_bytes > 0 && (
                    <Typography sx={{ color: colors.text, opacity: 0.7, fontSize: 13 }}>
                      Other stored data · {formatBytes(game.unreferenced_bytes)}
                    </Typography>
                  )}
                </Stack>
              ))
            )}
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}
