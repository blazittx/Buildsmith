import React, { useState } from 'react';
import {
  Box,
  Typography,
  Stack,
  Paper,
  LinearProgress,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DownloadIcon from '@mui/icons-material/Download';
import UpdateIcon from '@mui/icons-material/Update';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import StorageIcon from '@mui/icons-material/Storage';
import { colors } from '../../theme/colors';
import ImageButton from '../button/ImageButton';

// Steam button styling constants (matching AccountSettings)
const steamButtonStyle = {
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

const steamIconStyle = {
  width: 24,
  height: 24,
  filter: 'invert(100%)',
  transition: 'filter 0.2s',
};

const steamIconHoverStyle = {
  filter: 'invert(0%)',
};

export const GameDetails = ({
  game,
  isInstalled,
  isGameRunning,
  hasUpdate,
  currentVersion,
  latestVersion,
  playTime,
  achievements,
  diskUsage,
  activeDownloads,
  applyingUpdate,
  startingUpdate,
  onPlay,
  onDownload,
  onUpdate,
  onStop,
  onSteamClick,
  updateStep,
}) => {
  const [steamHovered, setSteamHovered] = useState(false);
  if (!game) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          color: colors.text,
        }}
      >
        <Typography variant="h6">Select a game to view details</Typography>
      </Box>
    );
  }

  const downloadProgress = activeDownloads[game.game_id];
  const isUpdating = applyingUpdate[game.game_id];
  const isStartingUpdate = startingUpdate && startingUpdate[game.game_id];

  // Determine button state and text
  let buttonText = 'Play';
  let buttonIcon = PlayArrowIcon;
  let buttonOnClick = onPlay;
  let buttonDisabled = false;
  if (isGameRunning) {
    buttonText = 'Stop';
    buttonIcon = require('@mui/icons-material/Stop').default;
    buttonOnClick = onStop;
  } else if (isStartingUpdate) {
    buttonText = 'Starting update...';
    buttonIcon = UpdateIcon;
    buttonOnClick = () => {};
    buttonDisabled = true;
  } else if (downloadProgress) {
    buttonText = updateStep
      ? `${updateStep} ${downloadProgress.percentageString || ''}`.trim()
      : `Downloading ${downloadProgress.percentageString}`;
    buttonIcon = DownloadIcon;
    buttonOnClick = onDownload;
    buttonDisabled = true;
  } else if (isUpdating) {
    buttonText = updateStep ? updateStep : 'Updating...';
    buttonIcon = UpdateIcon;
    buttonOnClick = onUpdate;
    buttonDisabled = true;
  } else if (hasUpdate && isInstalled) {
    buttonText = 'Update';
    buttonIcon = UpdateIcon;
    buttonOnClick = onUpdate;
  } else if (!isInstalled) {
    buttonText = 'Download';
    buttonIcon = DownloadIcon;
    buttonOnClick = onDownload;
  }

  return (
    <Box
      sx={{
        p: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Banner */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: 200,
          overflow: 'hidden',
          mb: 0,
        }}
      >
        <Box
          component="img"
          src={game.background_image_url}
          alt="Game Banner"
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 1,
            maskImage:
              'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 10%, rgba(0,0,0,0) 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 10%, rgba(0,0,0,0) 100%)',
          }}
        />

        {/* Title and version overlay */}
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            zIndex: 3,
            p: 3,
            width: '100%',
          }}
        >
          <Typography variant="h4" sx={{ color: colors.text, fontWeight: 700, mb: 0.5 }}>
            {game.game_name}
          </Typography>
          <Typography variant="subtitle1" sx={{ color: colors.text, opacity: 0.8 }}>
            {isInstalled
              ? `Version ${currentVersion}${hasUpdate ? ` (Update to ${latestVersion} available)` : ''}`
              : 'Not Installed'}
          </Typography>
        </Box>
      </Box>

      {/* Action Button (fixed below banner) */}
      <Box sx={{ px: 3, pt: 3, pb: 2, bgcolor: 'transparent', zIndex: 4 }}>
        <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="center">
          <ImageButton
            text={buttonText}
            icon={buttonIcon}
            onClick={buttonOnClick}
            style={{ minWidth: 200, height: 48, padding: '12px 24px' }}
            disabled={buttonDisabled}
          />
          {isInstalled && (
            <Tooltip title="Add Steam Integration" placement="left">
              <IconButton
                sx={steamButtonStyle}
                onMouseEnter={() => setSteamHovered(true)}
                onMouseLeave={() => setSteamHovered(false)}
                onClick={onSteamClick}
              >
                <img
                  src="/logos/steam.svg"
                  alt="Steam"
                  style={
                    steamHovered ? { ...steamIconStyle, ...steamIconHoverStyle } : steamIconStyle
                  }
                />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        {/* Download/Update Progress */}
        {downloadProgress && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress
              variant="determinate"
              value={downloadProgress.percent}
              sx={{
                height: 8,
                borderRadius: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: colors.button,
                },
              }}
            />
          </Box>
        )}
      </Box>

      {/* Scrollable Content: Description and Stats */}
      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', overflowY: 'auto', gap: 3 }}>
        {/* Game Description */}
        <Typography
          variant="body1"
          sx={{
            color: colors.text,
            lineHeight: 1.6,
          }}
        >
          {game.description}
        </Typography>

        {/* Game Stats */}
        <Paper
          sx={{
            p: 3,
            bgcolor: 'rgba(0, 0, 0, 0.2)',
            border: `1px solid ${colors.border}`,
          }}
        >
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <AccessTimeIcon sx={{ color: colors.text, opacity: 0.7 }} />
              <Typography sx={{ color: colors.text }}>Play Time: {playTime}</Typography>
            </Box>
            <Divider sx={{ borderColor: colors.border }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <EmojiEventsIcon sx={{ color: colors.text, opacity: 0.7 }} />
              <Typography sx={{ color: colors.text }}>
                Achievements: {achievements.completed}/{achievements.total}
              </Typography>
            </Box>
            <Divider sx={{ borderColor: colors.border }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <StorageIcon sx={{ color: colors.text, opacity: 0.7 }} />
              <Typography sx={{ color: colors.text }}>Disk Usage: {diskUsage}</Typography>
            </Box>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
};
