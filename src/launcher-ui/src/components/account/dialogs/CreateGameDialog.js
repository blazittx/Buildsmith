import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Chip,
  CircularProgress,
  Dialog,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import UploadIcon from '@mui/icons-material/Upload';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckIcon from '@mui/icons-material/Check';
import Cookies from 'js-cookie';
import { colors } from '../../../theme/colors';
import ImageUploader from '../../common/ImageUploader';
import ScreenshotUploader from '../../common/ScreenshotUploader';
import { getAllInstallationPairs } from '../../../pages/AccountPage';

const STEPS = [
  { id: 'details', label: 'Details', hint: 'Name the game and choose who it belongs to.' },
  { id: 'artwork', label: 'Artwork', hint: 'Add a cover image and optional screenshots.' },
  { id: 'build', label: 'Build', hint: 'Connect a GitHub repo or upload a ZIP build.' },
  { id: 'review', label: 'Review', hint: 'Check everything, then create the game.' },
];

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    color: colors.text,
    fontSize: '15px',
    background: 'transparent',
  },
  '& .MuiOutlinedInput-notchedOutline': {
    border: '1px solid' + colors.border + ' !important',
    borderRadius: '4px',
  },
  '& .MuiFormLabel-root': {
    color: '#888 !important',
  },
  '& .MuiFormHelperText-root': {
    color: '#888',
  },
};

const selectSx = {
  color: colors.text,
  background: 'transparent',
  '& .MuiOutlinedInput-notchedOutline': {
    border: '1px solid' + colors.border + ' !important',
    borderRadius: '4px',
  },
  '& .MuiSelect-icon': { color: colors.text },
};

const menuProps = {
  PaperProps: {
    sx: {
      backgroundColor: '#111',
      color: colors.text,
      border: '1px solid ' + colors.border,
    },
  },
};

const primaryButtonSx = {
  backgroundColor: colors.primary,
  color: '#041204',
  textTransform: 'none',
  borderRadius: '4px',
  padding: '8px 16px',
  fontWeight: 700,
  '&:hover': { backgroundColor: colors.primaryHover },
  '&.Mui-disabled': { backgroundColor: '#1c3d1a', color: '#6d6d6d' },
};

const ghostButtonSx = {
  backgroundColor: 'transparent',
  color: colors.text,
  border: '1px solid ' + colors.border,
  textTransform: 'none',
  borderRadius: '4px',
  padding: '8px 16px',
  '&:hover': { backgroundColor: '#161616', borderColor: colors.text },
  '&.Mui-disabled': { color: '#555', borderColor: '#2a2a2a' },
};

const StyledDialog = styled(Dialog)({
  '& .MuiBackdrop-root': {
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  '& .MuiDialog-paper': {
    width: '840px',
    maxWidth: 'calc(100vw - 80px)',
    height: 'min(680px, calc(100vh - 96px))',
    display: 'flex',
    flexDirection: 'column',
    background: '#070707',
    border: '1px solid ' + colors.border,
    borderRadius: '4px',
    boxShadow: 'none',
    margin: '48px 16px',
  },
});

function PreviewCard({ game }) {
  return (
    <div
      style={{
        width: 200,
        flexShrink: 0,
        aspectRatio: '63/88',
        borderRadius: 4,
        border: '1px solid ' + colors.border,
        backgroundColor: '#121212',
        backgroundImage: game.background_image_url ? `url("${game.background_image_url}")` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        alignItems: 'flex-end',
        padding: 12,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.15) 55%)',
        }}
      />
      <div style={{ position: 'relative' }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, textTransform: 'uppercase', lineHeight: 1.2 }}>
          {game.game_name}
        </div>
        {game.description ? (
          <div
            style={{
              color: '#9a9a9a',
              fontSize: 12,
              marginTop: 6,
              lineHeight: 1.35,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {game.description}
          </div>
        ) : null}
        <div style={{ color: colors.primary, fontSize: 12, marginTop: 8 }}>v{game.version}</div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="baseline"
      sx={{ gap: 2, py: 1.25, borderBottom: '1px solid ' + colors.border }}
    >
      <Typography sx={{ color: '#888', fontSize: 13 }}>{label}</Typography>
      <Typography sx={{ color: colors.text, fontSize: 14, textAlign: 'right', wordBreak: 'break-word' }}>
        {value || '—'}
      </Typography>
    </Stack>
  );
}

const CreateGameDialog = ({ open, handleClose, onSave, teams }) => {
  const [gameName, setGameName] = useState('');
  const [gameId, setGameId] = useState('');
  const [gameIdError, setGameIdError] = useState(false);
  const [gameBackgroundUrl, setGameBackgroundUrl] = useState('');
  const [gameDescription, setGameDescription] = useState('');
  const [gameVersion, setGameVersion] = useState('0.0.1');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [teamIconUrl, setTeamIconUrl] = useState('');
  const [githubRepos, setGithubRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [ownerAvatars, setOwnerAvatars] = useState({});
  const [activeTab, setActiveTab] = useState(0);
  const [gameFile, setGameFile] = useState(null);
  const [gameFileName, setGameFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [gameStatus, setGameStatus] = useState('public');
  const [screenshots, setScreenshots] = useState([]);
  const [uploadingScreenshots, setUploadingScreenshots] = useState(false);
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);

  useEffect(() => {
    if (!open) {
      setStep(0);
      setMaxReached(0);
    }
  }, [open]);

  useEffect(() => {
    if (teams && teams.length > 0 && !selectedTeam) {
      setSelectedTeam(teams[0].team_name);
      setTeamIconUrl(teams[0].team_icon_url);
    }
  }, [teams, selectedTeam]);

  const fetchGithubRepos = useCallback(async (installationId, accessToken, retryCount = 0) => {
    if (!installationId || !accessToken) {
      console.log('❌ Missing GitHub Installation ID or Access Token.');
      return;
    }

    try {
      console.log(
        `🔄 Fetching repositories for installation ${installationId} (attempt ${retryCount + 1})`
      );
      const reposResponse = await fetch(`https://api.github.com/installation/repositories`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      });

      if (!reposResponse.ok) {
        throw new Error(`Failed to fetch repositories. Status: ${reposResponse.status}`);
      }

      const data = await reposResponse.json();

      // Get account info and store avatar URLs
      if (data.repositories.length > 0) {
        const accountName = data.repositories[0].owner.login;
        const avatarUrl = data.repositories[0].owner.avatar_url;
        setConnectedAccounts(prev => [
          ...prev.filter(acc => acc.id !== installationId),
          {
            id: installationId,
            name: accountName,
            type: data.repositories[0].owner.type,
            avatarUrl: avatarUrl,
          },
        ]);

        // Store avatar URL for this owner
        setOwnerAvatars(prev => ({
          ...prev,
          [accountName]: avatarUrl,
        }));
      }

      // Add repos to the list
      setGithubRepos(prev => [...prev, ...data.repositories]);
      console.log(`✅ Successfully fetched ${data.repositories.length} repositories`);
    } catch (error) {
      console.error('❌ Error fetching repositories:', error);

      // Retry logic - attempt up to 3 times with exponential backoff
      if (retryCount < 2) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        console.log(`🔄 Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchGithubRepos(installationId, accessToken, retryCount + 1);
      } else {
        console.error('❌ Max retries reached for fetching repositories');
        if (window.electronAPI) {
          window.electronAPI.showCustomNotification(
            'Repository Loading Failed',
            'Failed to load repositories after multiple attempts. Please try again.'
          );
        }
      }
    }
  }, []);

  const loadRepositories = useCallback(async () => {
    const pairs = getAllInstallationPairs();
    setLoadingRepos(true);
    setGithubRepos([]);
    setConnectedAccounts([]);
    setOwnerAvatars({});

    for (const pair of pairs) {
      await fetchGithubRepos(pair.installationId, pair.accessToken);
    }

    setLoadingRepos(false);
  }, [fetchGithubRepos]);

  useEffect(() => {
    if (open) {
      loadRepositories();
    }
  }, [open, loadRepositories]);

  useEffect(() => {
    const handleProtocolData = (action, data) => {
      console.log('🔄 Handling Protocol Data:', action, data);

      if (action === 'github-app') {
        console.log('✅ GitHub App Authentication Successful');
        setLoadingRepos(true); // Set loading state before fetching

        // Fetch repos for the new installation
        fetchGithubRepos(data.githubInstallationId, data.githubAccessToken).finally(() => {
          setLoadingRepos(false);
        });
      }
    };

    if (window.electronAPI) {
      window.electronAPI.onProtocolData(handleProtocolData);
      return () => {
        window.electronAPI.onProtocolData(null);
      };
    }
  }, [fetchGithubRepos]);

  // Calculate filtered repos
  const filteredRepos = githubRepos.filter(repo =>
    repo.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleGameFileSelect = file => {
    if (file && file.name.endsWith('.zip')) {
      setGameFile(file);
      setGameFileName(file.name);
      if (window.electronAPI) {
        window.electronAPI.showCustomNotification(
          'File Selected',
          'Your game file is ready to be uploaded.'
        );
      }
    } else {
      if (window.electronAPI) {
        window.electronAPI.showCustomNotification('Invalid File', 'Please select a ZIP file.');
      }
    }
  };

  const validateVersion = version => {
    const versionRegex = /^\d+\.\d+\.\d+$/;
    return versionRegex.test(version);
  };

  const handleVersionChange = e => {
    const newVersion = e.target.value;
    setGameVersion(newVersion);
  };

  const handleSave = async () => {
    // Validate game ID before saving
    if (!/^[a-z0-9]{1,20}$/.test(gameId)) {
      setGameIdError(true);
      if (window.electronAPI) {
        window.electronAPI.showCustomNotification(
          'Invalid Game ID',
          'Game ID must contain only lowercase letters and numbers, with no spaces, and be 20 characters or less'
        );
      }
      return;
    }
    setGameIdError(false);

    setIsSaving(true);
    const sessionID = Cookies.get('sessionID');
    if (!sessionID) {
      console.error('❌ No session ID found.');
      if (window.electronAPI) {
        window.electronAPI.showCustomNotification('Game Creation Failed', 'Please try again later');
      }
      setIsSaving(false);
      return;
    }

    if (!selectedTeam) {
      console.error('❌ No team selected.');
      if (window.electronAPI) {
        window.electronAPI.showCustomNotification('Game Creation Failed', 'Please select a team');
      }
      setIsSaving(false);
      return;
    }

    if (activeTab === 1 && !validateVersion(gameVersion)) {
      if (window.electronAPI) {
        window.electronAPI.showCustomNotification(
          'Invalid Version',
          'Version must be in format X.Y.Z (e.g., 1.0.0)'
        );
      }
      setIsSaving(false);
      return;
    }

    try {
      // First create the game
      const newGame = {
        game_name: gameName.trim(),
        game_id: gameId.trim(),
        team_name: selectedTeam,
        description: gameDescription.trim(),
        background_image_url: gameBackgroundUrl.trim(),
        version: gameVersion.trim(),
        team_icon_url: teamIconUrl,
        github_repo: selectedRepo,
        status: gameStatus,
        is_manual_upload: activeTab === 1,
        screenshots: screenshots,
      };

      // Attempt to create the game via the Netlify function
      const response = await fetch('/create-game', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          sessionID: sessionID,
        },
        body: JSON.stringify(newGame),
      });

      if (!response.ok) {
        if (window.electronAPI) {
          window.electronAPI.showCustomNotification(
            'Game Creation Failed',
            'You are not a Beta Tester. Please contact support if you think this is an error.'
          );
        }
        throw new Error('Failed to create game via Netlify.');
      }

      console.log('✅ Game created successfully:', newGame);

      // Only upload file if game creation was successful and we're in manual upload mode
      if (activeTab === 1 && gameFile) {
        setIsUploading(true);
        setUploadProgress(0);
        try {
          const res = await fetch(`https://cdn.diabolical.services/generateUploadUrl`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(sessionID ? { sessionID } : {}),
            },
            body: JSON.stringify({
              fileExt: gameFile.name.split('.').pop(),
              contentType: gameFile.type,
              isGameUpload: true,
              gameId: gameId.trim(),
              version: gameVersion,
              size_bytes: gameFile.size,
            }),
          });

          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Failed to generate upload URL');
          }

          const { url } = await res.json();

          const xhr = new XMLHttpRequest();
          xhr.upload.addEventListener('progress', event => {
            if (event.lengthComputable) {
              const progress = (event.loaded / event.total) * 100;
              setUploadProgress(progress);
            }
          });

          await new Promise((resolve, reject) => {
            xhr.onload = resolve;
            xhr.onerror = reject;
            xhr.open('PUT', url);
            xhr.setRequestHeader('Content-Type', gameFile.type);
            xhr.send(gameFile);
          });
        } catch (err) {
          console.error('❌ Upload failed:', err);
          if (window.electronAPI) {
            window.electronAPI.showCustomNotification(
              'Upload Failed',
              err.message === 'Quota check failed'
                ? 'You have exceeded your storage quota. Please upgrade your plan or delete some files.'
                : err.message || 'Could not upload your game file.'
            );
          }
          // Reset the upload state
          setGameFile(null);
          setGameFileName('');
          setGameVersion('0.0.1');
          setUploadProgress(0);
          setIsSaving(false);
          setIsUploading(false);
          return;
        } finally {
          setIsUploading(false);
        }
      }

      // Only notify GitHub if the Netlify step succeeded and we're in GitHub mode
      if (activeTab === 0) {
        // Find the correct installation ID for this repository
        let installationId = null;
        let count = 1;
        while (true) {
          const currentInstallationId = Cookies.get(`githubInstallationId${count}`);
          const currentAccessToken = Cookies.get(`githubAccessToken${count}`);

          if (!currentInstallationId || !currentAccessToken) break;

          try {
            // Check if this installation has access to the selected repo
            const response = await fetch(`https://api.github.com/repos/${selectedRepo}`, {
              headers: {
                Authorization: `Bearer ${currentAccessToken}`,
                Accept: 'application/vnd.github+json',
              },
            });

            if (response.ok) {
              installationId = currentInstallationId;
              break;
            }
          } catch (err) {
            console.error(`Error checking repo access for installation ${count}:`, err);
          }

          count++;
        }

        if (!installationId) {
          if (window.electronAPI) {
            window.electronAPI.showCustomNotification(
              'Game Creation Failed',
              'No GitHub installation found with access to this repository'
            );
          }
          throw new Error('No GitHub installation found with access to this repository');
        }

        const githubWebhookResponse = await fetch(
          'https://api.diabolical.studio/github-app/webhook',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              event: 'game_created',
              repository: selectedRepo,
              game_id: gameId.trim(),
              installation_id: installationId,
            }),
          }
        );

        if (!githubWebhookResponse.ok) {
          if (window.electronAPI) {
            window.electronAPI.showCustomNotification(
              'Game Creation Failed',
              'Github App did not respond.'
            );
          }
          throw new Error('Failed to notify GitHub App.');
        }

        console.log('✅ GitHub App notified to create workflow.');
      }

      // Send the notification via main process.
      if (window.electronAPI) {
        window.electronAPI.showCustomNotification(
          'Game Created',
          'Your game was successfully created!'
        );
      }

      handleClose();
      if (onSave) {
        onSave();
      }
    } catch (error) {
      console.error('❌ Error creating game:', error);
      if (window.electronAPI) {
        window.electronAPI.showCustomNotification(
          'Game Creation Failed',
          error.message || 'An error occurred while creating your game.'
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleTeamChange = e => {
    const selectedTeamName = e.target.value;
    setSelectedTeam(selectedTeamName);
    const team = teams.find(team => team.team_name === selectedTeamName);
    setTeamIconUrl(team ? team.team_icon_url : '');
  };

  const handleAuthorizeMoreRepos = () => {
    const githubAppAuthUrl =
      'https://github.com/apps/diabolical-launcher-integration/installations/select_target';
    window.electronAPI.openExternal(githubAppAuthUrl);
  };

  const handleTabChange = (event, newValue) => {
    if (newValue === activeTab) return;
    setActiveTab(newValue);
    setSelectedRepo('');
    setGameFile(null);
    setGameFileName('');
  };

  const gameIdValid = /^[a-z0-9]{1,20}$/.test(gameId);
  const detailsValid = Boolean(gameName.trim() && gameIdValid && selectedTeam);
  const artworkValid = Boolean(gameBackgroundUrl);
  const buildValid =
    activeTab === 0 ? Boolean(selectedRepo) : Boolean(gameFile && validateVersion(gameVersion));
  const stepValid = [detailsValid, artworkValid, buildValid, detailsValid && artworkValid && buildValid];
  const locked = isSaving || isUploading;

  const continueHint = () => {
    if (step === 0) {
      if (!gameName.trim()) return 'Add a game name to continue.';
      if (!gameIdValid) return 'Game ID must be lowercase letters and numbers, up to 20 characters.';
      if (!selectedTeam) return 'Choose a team to continue.';
    }
    if (step === 1 && !artworkValid) return 'Add a cover image to continue.';
    if (step === 2 && activeTab === 0 && !selectedRepo) return 'Select a repository to continue.';
    if (step === 2 && activeTab === 1 && !gameFile) return 'Choose a ZIP file to continue.';
    if (step === 2 && activeTab === 1 && !validateVersion(gameVersion))
      return 'Version must look like 1.0.0.';
    if (step === 3 && !stepValid[3]) return 'Go back and finish the steps that are still incomplete.';
    return '';
  };

  const goNext = () => {
    if (step === 0) setGameIdError(!gameIdValid);
    if (!stepValid[step]) return;
    const next = Math.min(step + 1, STEPS.length - 1);
    setStep(next);
    setMaxReached(reached => Math.max(reached, next));
  };

  const goBack = () => {
    if (locked || step === 0) return;
    setStep(current => current - 1);
  };

  const goToStep = index => {
    if (locked) return;
    if (index <= step) {
      setStep(index);
      return;
    }
    if (index <= maxReached && stepValid.slice(0, index).every(Boolean)) {
      setStep(index);
    }
  };

  const previewGame = {
    game_name: gameName || 'Game name',
    game_id: gameId || 'preview',
    background_image_url: gameBackgroundUrl,
    description: gameDescription,
    version: gameVersion,
  };

  const uploadHeaders = {
    sessionID: Cookies.get('sessionID'),
    uploadUrl: 'https://cdn.diabolical.services/generateUploadUrl',
  };

  return (
    <StyledDialog
      open={open}
      container={document.getElementById('root')}
      onClose={locked ? undefined : handleClose}
      aria-labelledby="create-game-dialog-title"
    >
      <Stack sx={{ flex: 1, width: '100%', backgroundColor: '#070707', p: 3, minHeight: 0 }}>
        <Stack sx={{ flex: 1, minHeight: 0, gap: 2 }}>
          <Stack gap={1.5}>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline">
              <Typography id="create-game-dialog-title" sx={{ color: colors.text, fontSize: 22, fontWeight: 700 }}>
                Create a game
              </Typography>
              <Typography sx={{ color: '#888', fontSize: 13 }}>
                Step {step + 1} of {STEPS.length}
              </Typography>
            </Stack>
            <Stack direction="row" alignItems="center">
              {STEPS.map((item, index) => {
                const done = index < step;
                const active = index === step;
                const reachable =
                  index <= step || (index <= maxReached && stepValid.slice(0, index).every(Boolean));
                return (
                  <React.Fragment key={item.id}>
                    {index > 0 && (
                      <div
                        style={{
                          flex: 1,
                          height: 1,
                          minWidth: 16,
                          background: index <= step ? colors.primary : colors.border,
                        }}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => goToStep(index)}
                      disabled={!reachable || locked}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: 'transparent',
                        border: 'none',
                        color: active || done ? colors.text : '#777',
                        cursor: reachable && !locked ? 'pointer' : 'default',
                        padding: '4px 6px',
                        fontSize: 13,
                      }}
                    >
                      <span
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: 12,
                          fontWeight: 700,
                          background: done ? colors.primary : 'transparent',
                          color: done ? '#041204' : active ? colors.primary : '#777',
                          border: `1px solid ${done || active ? colors.primary : colors.border}`,
                        }}
                      >
                        {done ? <CheckIcon sx={{ fontSize: 15 }} /> : index + 1}
                      </span>
                      {item.label}
                    </button>
                  </React.Fragment>
                );
              })}
            </Stack>
            <Typography sx={{ color: '#9a9a9a', fontSize: 14 }}>{STEPS[step].hint}</Typography>
          </Stack>

          <Stack sx={{ flex: 1, minHeight: 0, overflow: 'auto', pr: 0.5 }}>
            {step === 0 && (
              <Stack direction="row" gap={3} alignItems="flex-start">
                <Stack gap={2} sx={{ flex: 1 }}>
                  <TextField
                    label="Game name"
                    value={gameName}
                    onChange={e => setGameName(e.target.value)}
                    fullWidth
                    sx={fieldSx}
                  />
                  <TextField
                    label="Description"
                    value={gameDescription}
                    onChange={e => setGameDescription(e.target.value)}
                    fullWidth
                    multiline
                    minRows={3}
                    sx={fieldSx}
                  />
                  <TextField
                    label="Game ID"
                    value={gameId}
                    onChange={e => {
                      setGameId(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
                      setGameIdError(false);
                    }}
                    error={gameIdError || (gameId.length > 0 && !gameIdValid)}
                    helperText="Lowercase letters and numbers, up to 20 characters."
                    fullWidth
                    sx={fieldSx}
                    inputProps={{ maxLength: 20 }}
                  />
                  <Stack direction="row" gap={2}>
                    <FormControl fullWidth>
                      <InputLabel id="team-select-label" sx={{ color: '#888' }}>
                        Team
                      </InputLabel>
                      <Select
                        labelId="team-select-label"
                        value={selectedTeam}
                        label="Team"
                        onChange={handleTeamChange}
                        sx={selectSx}
                        MenuProps={menuProps}
                      >
                        {(teams || []).map(team => (
                          <MenuItem key={team.team_id || team.team_name} value={team.team_name}>
                            {team.team_name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl fullWidth>
                      <InputLabel id="status-select-label" sx={{ color: '#888' }}>
                        Visibility
                      </InputLabel>
                      <Select
                        labelId="status-select-label"
                        value={gameStatus}
                        label="Visibility"
                        onChange={e => setGameStatus(e.target.value)}
                        sx={selectSx}
                        MenuProps={menuProps}
                      >
                        <MenuItem value="public">Public</MenuItem>
                        <MenuItem value="private">Private</MenuItem>
                        <MenuItem value="archived">Archived</MenuItem>
                      </Select>
                    </FormControl>
                  </Stack>
                </Stack>
                <PreviewCard game={previewGame} />
              </Stack>
            )}

            {step === 1 && (
              <Stack direction="row" gap={3} alignItems="flex-start">
                <Stack gap={2} sx={{ flex: 1 }}>
                  <ImageUploader
                    onUpload={url => setGameBackgroundUrl(url || '')}
                    currentImageUrl={gameBackgroundUrl}
                    uploading={uploading}
                    setUploading={setUploading}
                    headers={uploadHeaders}
                  />
                  <ScreenshotUploader
                    screenshots={screenshots}
                    onScreenshotsChange={setScreenshots}
                    uploading={uploadingScreenshots}
                    setUploading={setUploadingScreenshots}
                    headers={uploadHeaders}
                    maxScreenshots={10}
                  />
                </Stack>
                <PreviewCard game={previewGame} />
              </Stack>
            )}

            {step === 2 && (
              <Stack gap={2}>
                <Stack direction="row" gap={1.5}>
                  {[
                    { id: 0, title: 'Deploy from GitHub', body: 'Buildsmith builds from a repository you authorize.' },
                    { id: 1, title: 'Upload a ZIP', body: 'Ship a Windows build you already packaged.' },
                  ].map(option => {
                    const selected = activeTab === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleTabChange(null, option.id)}
                        style={{
                          flex: 1,
                          textAlign: 'left',
                          padding: '14px 16px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          background: selected ? colors.primary + '18' : 'transparent',
                          border: `1px solid ${selected ? colors.primary : colors.border}`,
                          color: colors.text,
                        }}
                      >
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>{option.title}</div>
                        <div style={{ color: '#9a9a9a', fontSize: 13 }}>{option.body}</div>
                      </button>
                    );
                  })}
                </Stack>

                {activeTab === 0 ? (
                  <>
                    {connectedAccounts.length > 0 && (
                      <Stack
                        spacing={1.5}
                        sx={{
                          borderRadius: '4px',
                          padding: '14px 16px',
                          border: '1px solid ' + colors.border,
                        }}
                      >
                        <Typography sx={{ color: colors.text, fontSize: 13, fontWeight: 600 }}>
                          Connected GitHub accounts
                        </Typography>
                        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                          {connectedAccounts.map(account => (
                            <Stack
                              key={account.id}
                              direction="row"
                              alignItems="center"
                              spacing={1}
                              sx={{ padding: '6px 10px' }}
                            >
                              <img
                                src={account.avatarUrl}
                                alt=""
                                style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }}
                              />
                              <Typography sx={{ color: colors.text, fontSize: 13 }}>{account.name}</Typography>
                              <Chip
                                label={account.type}
                                size="small"
                                sx={{
                                  backgroundColor: 'rgba(0, 188, 212, 0.1)',
                                  color: '#00bcd4',
                                  height: 20,
                                  fontSize: 11,
                                  borderRadius: '4px',
                                }}
                              />
                            </Stack>
                          ))}
                        </Stack>
                      </Stack>
                    )}

                    <Stack direction="row" gap={1} alignItems="center">
                      <TextField
                        placeholder="Search repositories..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        sx={{ ...fieldSx, flex: 1 }}
                      />
                      <Button
                        onClick={loadRepositories}
                        disabled={loadingRepos}
                        startIcon={loadingRepos ? <CircularProgress size={14} /> : <RefreshIcon />}
                        sx={ghostButtonSx}
                      >
                        Reload
                      </Button>
                    </Stack>

                    <Stack
                      sx={{
                        borderRadius: '4px',
                        border: '1px solid ' + colors.border,
                        height: 240,
                        overflowY: 'auto',
                        padding: '8px',
                        gap: 0.5,
                      }}
                    >
                      {loadingRepos ? (
                        <Stack alignItems="center" justifyContent="center" sx={{ height: '100%', gap: 1 }}>
                          <CircularProgress size={20} />
                          <Typography sx={{ color: colors.text, fontSize: 14 }}>Loading repositories...</Typography>
                        </Stack>
                      ) : filteredRepos.length === 0 ? (
                        <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
                          <Typography sx={{ color: '#888', fontSize: 14 }}>
                            {searchQuery ? 'No repositories found' : 'No repositories available'}
                          </Typography>
                        </Stack>
                      ) : (
                        filteredRepos.map(repo => {
                          const selected = selectedRepo === repo.full_name;
                          return (
                            <Stack
                              key={repo.id}
                              direction="row"
                              alignItems="center"
                              spacing={1}
                              onClick={() => setSelectedRepo(repo.full_name)}
                              sx={{
                                padding: '10px 12px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                background: selected ? colors.primary + '18' : 'transparent',
                                border: `1px solid ${selected ? colors.primary : 'transparent'}`,
                                '&:hover': { background: colors.primary + '10' },
                              }}
                            >
                              <img
                                src={ownerAvatars[repo.owner.login] || '/github.png'}
                                alt=""
                                style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }}
                              />
                              <Typography sx={{ color: colors.text, flex: 1, fontSize: 14 }}>{repo.full_name}</Typography>
                              <Chip
                                label={repo.private ? 'Private' : 'Public'}
                                size="small"
                                sx={{
                                  backgroundColor: repo.private ? 'rgba(255, 64, 129, 0.1)' : 'rgba(0, 230, 118, 0.1)',
                                  color: repo.private ? '#ff4081' : '#00e676',
                                  height: 20,
                                  fontSize: 11,
                                  borderRadius: '4px',
                                }}
                              />
                            </Stack>
                          );
                        })
                      )}
                    </Stack>

                    <Button
                      variant="outlined"
                      onClick={handleAuthorizeMoreRepos}
                      startIcon={<InfoOutlinedIcon />}
                      sx={{ ...ghostButtonSx, alignSelf: 'flex-start' }}
                    >
                      Can't find your repo? Authorize more repositories
                    </Button>
                  </>
                ) : (
                  <Stack gap={2}>
                    <TextField
                      label="Version"
                      value={gameVersion}
                      onChange={handleVersionChange}
                      error={!validateVersion(gameVersion)}
                      helperText={
                        validateVersion(gameVersion) ? 'Use major.minor.patch, for example 1.0.0' : 'Version must look like 1.0.0'
                      }
                      sx={fieldSx}
                    />
                    <Stack
                      onDragOver={e => {
                        e.preventDefault();
                        e.currentTarget.style.borderColor = colors.primary;
                      }}
                      onDragLeave={e => {
                        e.preventDefault();
                        e.currentTarget.style.borderColor = colors.border;
                      }}
                      onDrop={e => {
                        e.preventDefault();
                        e.currentTarget.style.borderColor = colors.border;
                        handleGameFileSelect(e.dataTransfer.files[0]);
                      }}
                      onClick={() => document.getElementById('game-file-upload')?.click()}
                      sx={{
                        height: 180,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                        border: `1px dashed ${gameFile ? colors.primary : colors.border}`,
                        cursor: 'pointer',
                        gap: 0.5,
                      }}
                    >
                      <input
                        id="game-file-upload"
                        hidden
                        type="file"
                        accept=".zip"
                        onChange={e => handleGameFileSelect(e.target.files[0])}
                      />
                      <UploadIcon style={{ color: gameFile ? colors.primary : '#888' }} />
                      <Typography sx={{ color: colors.text }}>
                        {gameFile ? gameFileName : 'Drop a ZIP here, or click to browse'}
                      </Typography>
                      <Typography sx={{ color: '#888', fontSize: 12 }}>
                        {gameFile ? 'Click or drop a file to replace it' : 'Windows standalone ZIP'}
                      </Typography>
                    </Stack>
                  </Stack>
                )}
              </Stack>
            )}

            {step === 3 && (
              <Stack direction="row" gap={3} alignItems="flex-start">
                <PreviewCard game={previewGame} />
                <Stack sx={{ flex: 1 }}>
                  <ReviewRow label="Name" value={gameName} />
                  <ReviewRow label="Game ID" value={gameId} />
                  <ReviewRow label="Team" value={selectedTeam} />
                  <ReviewRow
                    label="Visibility"
                    value={gameStatus ? gameStatus.charAt(0).toUpperCase() + gameStatus.slice(1) : ''}
                  />
                  <ReviewRow label="Description" value={gameDescription} />
                  <ReviewRow label="Screenshots" value={String(screenshots.length)} />
                  <ReviewRow
                    label="Build"
                    value={
                      activeTab === 0
                        ? selectedRepo
                        : `${gameFileName || 'ZIP file'} · v${gameVersion}`
                    }
                  />
                  {(isSaving || isUploading) && (
                    <Stack gap={1} sx={{ mt: 2 }}>
                      <Typography sx={{ color: colors.text, fontSize: 14 }}>
                        {isUploading
                          ? `Uploading build… ${Math.round(uploadProgress)}%`
                          : 'Creating the game…'}
                      </Typography>
                      {isUploading && (
                        <LinearProgress
                          variant="determinate"
                          value={uploadProgress}
                          sx={{
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: '#222',
                            '& .MuiLinearProgress-bar': { backgroundColor: colors.primary },
                          }}
                        />
                      )}
                    </Stack>
                  )}
                </Stack>
              </Stack>
            )}
          </Stack>

          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
            <Button startIcon={<ArrowBackIcon />} onClick={goBack} disabled={step === 0 || locked} sx={ghostButtonSx}>
              Back
            </Button>
            <Typography sx={{ color: '#888', fontSize: 13, flex: 1, textAlign: 'center' }}>
              {continueHint()}
            </Typography>
            {step < STEPS.length - 1 ? (
              <Button
                endIcon={<ArrowForwardIcon />}
                onClick={goNext}
                disabled={!stepValid[step] || locked}
                sx={primaryButtonSx}
              >
                Continue
              </Button>
            ) : (
              <Button
                startIcon={locked ? <CircularProgress size={16} sx={{ color: '#041204' }} /> : <RocketLaunchIcon />}
                onClick={handleSave}
                disabled={!stepValid[3] || locked}
                sx={primaryButtonSx}
              >
                {isUploading ? `Uploading ${Math.round(uploadProgress)}%` : isSaving ? 'Creating…' : 'Create and deploy'}
              </Button>
            )}
          </Stack>
        </Stack>
      </Stack>
    </StyledDialog>
  );
};

export default CreateGameDialog;
