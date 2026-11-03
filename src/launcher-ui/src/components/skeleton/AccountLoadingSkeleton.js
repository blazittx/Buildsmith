import React from 'react';
import { Box, Skeleton, Stack } from '@mui/material';
import { colors } from '../../theme/colors';
import Divider from '../Divider';
import TeamsSkeleton from './TeamsSkeleton';
import GameCardsSkeleton from './GameCardsSkeleton';

const bone = { bgcolor: '#161616', borderRadius: '4px' };

const shell = content => (
  <div className="flex flex-col h-full">
    <div
      className="flex justify-between align-center p-3"
      style={{ borderBottom: '1px solid' + colors.border }}
    >
      <Stack direction="row" spacing="12px" alignItems="center">
        <Skeleton variant="circular" width={32} height={32} sx={bone} />
        <Skeleton variant="text" width={120} height={28} sx={bone} />
      </Stack>
      <Stack direction="row" spacing={1}>
        <Skeleton variant="rounded" width={70} height={32} sx={bone} />
        <Skeleton variant="rounded" width={70} height={32} sx={bone} />
      </Stack>
    </div>
    <div className="w-full h-full flex overflow-hidden">
      <Stack className="h-full w-1/5 p-3" spacing="12px">
        <Skeleton variant="rounded" height={48} sx={bone} />
        <Skeleton variant="rounded" height={48} sx={bone} />
        <Skeleton variant="rounded" height={48} sx={bone} />
      </Stack>
      <Divider vertical />
      <div className="flex flex-col size-full overflow-hidden">{content}</div>
    </div>
  </div>
);

const settings = (
  <Stack spacing={4} sx={{ padding: '24px', width: '100%' }}>
    <Skeleton variant="text" width={80} height={28} sx={bone} />
    <Skeleton variant="rounded" height={56} sx={bone} />
    <Skeleton variant="rounded" height={96} sx={bone} />
    <Skeleton variant="rectangular" height={1} sx={{ bgcolor: colors.border }} />
    <Skeleton variant="text" width={120} height={24} sx={bone} />
    <Skeleton variant="rounded" height={8} sx={bone} />
  </Stack>
);

const team = (
  <Stack spacing={2} sx={{ padding: '12px', width: '100%' }}>
    <Skeleton variant="rounded" width={88} height={32} sx={bone} />
    <Stack direction="row" spacing={2} alignItems="center">
      <Skeleton variant="rounded" width={40} height={40} sx={bone} />
      <Skeleton variant="text" width={180} height={32} sx={bone} />
    </Stack>
    <Stack direction="row" spacing={2}>
      <Skeleton variant="rounded" width={90} height={36} sx={bone} />
      <Skeleton variant="rounded" width={110} height={36} sx={bone} />
    </Stack>
    <Skeleton variant="rounded" height={220} sx={bone} />
  </Stack>
);

const login = (
  <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Stack
      spacing={3}
      sx={{
        width: '100%',
        maxWidth: 360,
        padding: '32px',
        borderRadius: '4px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(255, 255, 255, 0.03)',
      }}
    >
      <Skeleton variant="text" width="60%" height={40} sx={{ ...bone, mx: 'auto' }} />
      <Skeleton variant="text" width="80%" height={20} sx={{ ...bone, mx: 'auto' }} />
      <Skeleton variant="rounded" height={48} sx={bone} />
      <Skeleton variant="text" width="70%" height={16} sx={{ ...bone, mx: 'auto' }} />
    </Stack>
  </Box>
);

export default function AccountLoadingSkeleton({ pathname, loggedIn }) {
  if (!loggedIn) return login;
  if (pathname.includes('/settings')) return shell(settings);
  if (pathname.includes('/games')) return shell(<GameCardsSkeleton />);
  if (/\/teams\/[^/]+/.test(pathname)) return shell(team);
  return shell(<TeamsSkeleton />);
}
