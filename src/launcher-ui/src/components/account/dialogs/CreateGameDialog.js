import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Chip,
  CircularProgress,
  Dialog,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import GameCard from '../../GameCard';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import UploadIcon from '@mui/icons-material/Upload';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Cookies from 'js-cookie';
import { colors } from '../../../theme/colors';
import ImageUploader from '../../common/ImageUploader';
import ScreenshotUploader from '../../common/ScreenshotUploader';
import { getAllInstallationPairs } from '../../../pages/AccountPage';
import ImageButton from '../../button/ImageButton';
import BackgroundAnimation from '../../BackgroundAnimation';

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    maxHeight: '800px',
    minWidth: '1000px',
    background: 'transparent',
    boxShadow: 'none',
    margin: 0,
  },
}));

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
  const [hasRequiredFields, setHasRequiredFields] = useState(false);
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

  useEffect(() => {
    if (teams && teams.length > 0) {
      setSelectedTeam(teams[0].team_id);
      setTeamIconUrl(teams[0].team_icon_url);
    }
  }, [teams]);

  useEffect(() => {
    const hasAllRequiredFields =
      gameName?.trim() &&
      gameId?.trim() &&
      selectedTeam &&
      gameBackgroundUrl &&
      ((activeTab === 0 && selectedRepo) ||
        (activeTab === 1 && gameFile && validateVersion(gameVersion)));
    setHasRequiredFields(!!hasAllRequiredFields);
  }, [
    gameName,
    gameId,
    selectedTeam,
    selectedRepo,
    gameBackgroundUrl,
    activeTab,
    gameFile,
    gameVersion,
    gameStatus,
  ]);

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

  useEffect(() => {
    const loadRepositories = async () => {
      const pairs = getAllInstallationPairs();

      if (pairs.length > 0) {
        console.log('✅ Found existing GitHub installations:', pairs);
        setLoadingRepos(true);
        setGithubRepos([]); // Clear existing repos

        // Process all installations sequentially
        for (const pair of pairs) {
          await fetchGithubRepos(pair.installationId, pair.accessToken);
        }

        setLoadingRepos(false);
      } else {
        console.log('❌ No GitHub installations found');
        setLoadingRepos(false);
      }
    };

    if (open) {
      loadRepositories();
    }
  }, [open, fetchGithubRepos]);

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
        screenshots: screenshots.length > 0 ? screenshots : undefined,
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
    setActiveTab(newValue);
  };

  return (
    <StyledDialog
      open={open}
      container={document.getElementById('root')}
      onClose={handleClose}
      aria-labelledby="create-game-dialog-title"
    >
      <Stack
        className={'p-6 overflow-hidden'}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          backgroundColor: colors.background,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 0,
          }}
        >
          <BackgroundAnimation style={{ opacity: 0.4 }} />
        </div>
        <Stack
          className={'gap-6 p-4'}
          flexDirection={'column'}
          style={{
            border: '1px solid' + colors.border,
            gap: '24px',
            padding: '24px',
            position: 'relative',
            zIndex: 2,
            borderRadius: '4px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'row', gap: '24px' }}>
            {/* Left side - Game Card */}
            <Stack
              width={'min-content'}
              alignItems="center"
              className={'gap-6 justify-between rounded-sm'}
              style={{
                gap: '24px',
                minWidth: '300px',
                maxWidth: '300px',
              }}
            >
              <GameCard
                style={{
                  aspectRatio: '63/88',
                  border: '1px solid' + colors.border,
                }}
                game={{
                  game_name: gameName,
                  game_id: gameId,
                  background_image_url: gameBackgroundUrl,
                  description: gameDescription,
                  version: gameVersion,
                }}
                isEditing={true}
                setGameName={setGameName}
                setGameId={setGameId}
                setGameBackgroundUrl={setGameBackgroundUrl}
                setGameDescription={setGameDescription}
              />
              <Stack
                className={'w-full'}
                style={{
                  margin: 0,
                  gap: '12px',
                  width: '100%',
                }}
              >
                <TextField
                  label="Game ID"
                  variant="outlined"
                  fullWidth
                  value={gameId}
                  onChange={e => setGameId(e.target.value)}
                  error={gameIdError}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: colors.text,
                      fontSize: '16px',
                      background: 'transparent',
                      backdropFilter: 'blur(10px)',
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                      border: '1px solid' + colors.border + '!important',
                      borderRadius: '4px',
                    },
                    '& .MuiFormLabel-root': {
                      color: '#444444 !important',
                    },
                  }}
                />
                <Stack style={{ gap: '12px' }} direction={'row'}>
                  <FormControl
                    fullWidth
                    sx={{
                      '& .MuiSelect-select': {
                        border: '1px solid' + colors.border + '!important',
                        borderRadius: '4px',
                        color: colors.text,
                        padding: '16.5px 14px !important',
                        height: '-webkit-fill-available',
                        background: 'transparent',
                        backdropFilter: 'blur(10px)',
                      },
                    }}
                  >
                    <InputLabel
                      id="team-select-label"
                      style={{
                        background: 'transparent',
                        backdropFilter: 'blur(10px)',
                        color: colors.border,
                        padding: '0 8px',
                      }}
                    >
                      Team
                    </InputLabel>
                    <Select
                      labelId="team-select-label"
                      value={selectedTeam}
                      label="Team"
                      onChange={handleTeamChange}
                      variant="outlined"
                      sx={{
                        '& .MuiOutlinedSelect-root': {
                          color: colors.text,
                          fontSize: '16px',
                        },
                        '& .MuiOutlinedInput-notchedOutline': {
                          border: '1px solid' + colors.border + '!important',
                          borderRadius: '4px',
                        },
                        '& .MuiFormLabel-root': {
                          color: '#444444 !important',
                        },
                      }}
                    >
                      {teams.map(team => (
                        <MenuItem
                          style={{
                            background: 'transparent',
                            backdropFilter: 'blur(10px)',
                            color: colors.border,
                            padding: '0 !important',
                          }}
                          key={team.team_name}
                          value={team.team_name}
                        >
                          {team.team_name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl
                    fullWidth
                    sx={{
                      '& .MuiSelect-select': {
                        border: '1px solid' + colors.border + '!important',
                        borderRadius: '4px',
                        color: colors.text,
                        padding: '16.5px 14px !important',
                        height: '-webkit-fill-available',
                        background: 'transparent',
                        backdropFilter: 'blur(10px)',
                      },
                    }}
                  >
                    <InputLabel
                      id="status-select-label"
                      style={{
                        background: 'transparent',
                        backdropFilter: 'blur(10px)',
                        color: colors.border,
                        padding: '0 8px',
                      }}
                    >
                      Game Status
                    </InputLabel>
                    <Select
                      labelId="status-select-label"
                      value={gameStatus}
                      label="Game Status"
                      onChange={e => setGameStatus(e.target.value)}
                      sx={{
                        '& .MuiOutlinedSelect-root': {
                          color: colors.text,
                          fontSize: '16px',
                        },
                        '& .MuiOutlinedInput-notchedOutline': {
                          border: '1px solid' + colors.border + '!important',
                          borderRadius: '4px',
                        },
                        '& .MuiFormLabel-root': {
                          color: '#444444 !important',
                        },
                      }}
                    >
                      <MenuItem value="public">Public</MenuItem>
                      <MenuItem value="private">Private</MenuItem>
                      <MenuItem value="archived">Archived</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
                <ImageUploader
                  onUpload={url => {
                    setGameBackgroundUrl(url);
                    setHasRequiredFields(true);
                  }}
                  style={{
                    background: 'transparent',
                    backdropFilter: 'blur(10px)',
                  }}
                  currentImageUrl={gameBackgroundUrl}
                  uploading={uploading}
                  setUploading={setUploading}
                  headers={{
                    sessionID: Cookies.get('sessionID'),
                    uploadUrl: 'https://cdn.diabolical.services/generateUploadUrl',
                  }}
                />
                <ScreenshotUploader
                  screenshots={screenshots}
                  onScreenshotsChange={setScreenshots}
                  uploading={uploadingScreenshots}
                  setUploading={setUploadingScreenshots}
                  headers={{
                    sessionID: Cookies.get('sessionID'),
                    uploadUrl: 'https://cdn.diabolical.services/generateUploadUrl',
                  }}
                  maxScreenshots={10}
                />
              </Stack>
            </Stack>

            {/* Right side - Upload Method */}
            <Stack className={'items-end w-full'} style={{ gap: '24px' }}>
              {/* Tabs at the top of the right side area */}
              <Stack
                width="100%"
                sx={{ borderBottom: 1, borderColor: colors.border, WebkitAppRegion: 'no-drag' }}
              >
                <Tabs
                  value={activeTab}
                  onChange={handleTabChange}
                  sx={{
                    '& .MuiTabs-indicator': {
                      backgroundColor: colors.primary,
                    },
                  }}
                >
                  <Tab
                    label="Deploy from GitHub"
                    sx={{
                      color: colors.text,
                      background: 'transparent',
                      backdropFilter: 'blur(10px)',
                      padding: '0 12px 12px 12px',
                      '&.Mui-selected': {
                        color: colors.primary,
                      },
                    }}
                  />
                  <Tab
                    label="Manual Upload"
                    sx={{
                      color: colors.text,
                      background: 'transparent',
                      backdropFilter: 'blur(10px)',
                      padding: '0 12px 12px 12px',
                      '&.Mui-selected': {
                        color: colors.primary,
                      },
                    }}
                  />
                </Tabs>
              </Stack>
              <Stack className={'gap-6 w-full flex-1'} style={{ gap: '12px' }}>
                {activeTab === 0 ? (
                  // GitHub Deployment Tab
                  <>
                    {connectedAccounts.length > 0 && (
                      <Stack
                        spacing={2}
                        sx={{
                          background: 'transparent',
                          backdropFilter: 'blur(10px)',
                          borderRadius: '4px',
                          boxShadow: '0 4px 12px 0 rgba(0,0,0,0.04)',
                          padding: '16px',
                          border: '1px solid' + colors.border + '!important',
                        }}
                      >
                        <Typography
                          variant="subtitle2"
                          sx={{ color: colors.text, fontWeight: 500 }}
                        >
                          Connected GitHub Accounts
                        </Typography>
                        <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: '8px' }}>
                          {connectedAccounts.map(account => (
                            <Stack
                              direction="row"
                              alignItems="center"
                              spacing={1}
                              sx={{
                                background: 'transparent',
                                backdropFilter: 'blur(10px)',
                                borderRadius: '4px',
                                padding: '8px 12px',
                                transition: 'all 0.2s ease',
                              }}
                            >
                              <img
                                src={account.avatarUrl}
                                alt={account.name}
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '50%',
                                  objectFit: 'contain',
                                }}
                              />
                              <Typography
                                variant="body2"
                                sx={{
                                  color: colors.text,
                                  fontWeight: 500,
                                }}
                              >
                                {account.name}
                              </Typography>
                              <Chip
                                label={account.type}
                                size="small"
                                sx={{
                                  backgroundColor: 'rgba(0, 188, 212, 0.1)',
                                  color: '#00bcd4',
                                  height: '20px',
                                  fontSize: '12px',
                                  fontWeight: 'bold',
                                  borderRadius: '4px',
                                }}
                              />
                            </Stack>
                          ))}
                        </Stack>
                      </Stack>
                    )}

                    <TextField
                      placeholder="Search repositories..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          color: colors.text,
                          fontSize: '14px',
                          background: 'transparent',
                          backdropFilter: 'blur(10px)',
                          borderRadius: '4px',
                          height: '48px',
                          '& fieldset': {
                            borderColor: colors.border,
                          },
                          '&:hover fieldset': {
                            borderColor: '#00bcd4',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#00bcd4',
                          },
                        },
                        '& .MuiInputBase-input': {
                          padding: '14px 16px',
                        },
                      }}
                    />

                    <Stack
                      className={'gap-2 flex-1'}
                      sx={{
                        background: 'transparent',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '4px',
                        boxShadow: '0 4px 12px 0 rgba(0,0,0,0.04)',
                        overflow: 'hidden',
                        minHeight: '200px',
                        border: '1px solid' + colors.border + '!important',
                      }}
                    >
                      <Stack
                        className={'gap-2'}
                        style={{
                          height: '250px',
                          padding: '16px',
                          overflowY: 'auto',
                          scrollbarWidth: 'thin',
                          scrollbarColor: `${colors.border} transparent`,
                          gap: '8px',
                        }}
                      >
                        {loadingRepos ? (
                          <Stack
                            alignItems="center"
                            justifyContent="center"
                            style={{ height: '100%' }}
                          >
                            <CircularProgress size={20} />
                            <Typography
                              variant="body2"
                              sx={{ color: colors.text, mt: 1, fontSize: '14px' }}
                            >
                              Loading Repositories...
                            </Typography>
                          </Stack>
                        ) : (
                          <>
                            {filteredRepos.length === 0 ? (
                              <Stack
                                alignItems="center"
                                justifyContent="center"
                                style={{ height: '100%' }}
                              >
                                <Typography
                                  variant="body2"
                                  sx={{ color: colors.text, opacity: 0.7 }}
                                >
                                  {searchQuery
                                    ? 'No repositories found'
                                    : 'No repositories available'}
                                </Typography>
                              </Stack>
                            ) : (
                              <>
                                {filteredRepos.map((repo, index) => (
                                  <Stack
                                    key={repo.id}
                                    direction="row"
                                    alignItems="center"
                                    spacing={1}
                                    className="hover-effect"
                                    sx={{
                                      padding: '12px 16px',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease',
                                      background:
                                        selectedRepo === repo.full_name
                                          ? colors.primary + '15'
                                          : 'transparent',
                                      border:
                                        selectedRepo === repo.full_name
                                          ? '1px solid ' + colors.primary
                                          : '1px solid transparent',
                                      '&:hover': {
                                        background: colors.primary + '08',
                                        border: '1px solid ' + colors.primary + '40',
                                      },
                                    }}
                                    onClick={() => setSelectedRepo(repo.full_name)}
                                  >
                                    <img
                                      src={ownerAvatars[repo.owner.login] || '/github.png'}
                                      alt={repo.owner.login}
                                      style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                      }}
                                    />
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        color: colors.text,
                                        flex: 1,
                                        fontWeight: 500,
                                      }}
                                    >
                                      {repo.full_name}
                                    </Typography>
                                    <Chip
                                      label={repo.private ? 'Private' : 'Public'}
                                      size="small"
                                      sx={{
                                        backgroundColor: repo.private
                                          ? 'rgba(255, 64, 129, 0.1)'
                                          : 'rgba(0, 230, 118, 0.1)',
                                        color: repo.private ? '#ff4081' : '#00e676',
                                        height: '20px',
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        borderRadius: '4px',
                                      }}
                                    />
                                  </Stack>
                                ))}
                              </>
                            )}
                          </>
                        )}
                      </Stack>
                    </Stack>

                    <Button
                      variant="outlined"
                      onClick={handleAuthorizeMoreRepos}
                      sx={{
                        color: colors.text,
                        borderColor: colors.border,
                        background: 'transparent',
                        backdropFilter: 'blur(10px)',
                        textTransform: 'none',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        fontSize: '14px',
                        gap: '8px',
                        '&:hover': {
                          background: colors.primary + '08',
                          borderColor: colors.primary,
                          color: colors.primary,
                        },
                      }}
                    >
                      <InfoOutlinedIcon sx={{ fontSize: '18px' }} />
                      Can't find your repo? Authorize more repositories
                    </Button>
                  </>
                ) : (
                  // Manual Upload Tab
                  <Stack spacing={2}>
                    <TextField
                      label="Version"
                      value={gameVersion}
                      onChange={handleVersionChange}
                      error={!validateVersion(gameVersion)}
                      helperText={
                        !validateVersion(gameVersion)
                          ? 'Version must be in format X.Y.Z (e.g., 1.0.0)'
                          : ''
                      }
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          color: colors.text,
                          fontSize: '14px',
                          background: 'transparent',
                          backdropFilter: 'blur(10px)',
                          '& fieldset': {
                            borderColor: colors.border,
                          },
                          '&:hover fieldset': {
                            borderColor: '#00bcd4',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#00bcd4',
                          },
                        },
                      }}
                    />
                    <Stack
                      onDragOver={e => {
                        e.preventDefault();
                        e.currentTarget.style.borderColor = colors.button;
                        e.currentTarget.style.backgroundColor = `${colors.button}20`;
                      }}
                      onDragLeave={e => {
                        e.preventDefault();
                        e.currentTarget.style.borderColor = colors.border;
                        e.currentTarget.style.backgroundColor = colors.background;
                      }}
                      onDrop={e => {
                        e.preventDefault();
                        e.currentTarget.style.borderColor = colors.border;
                        e.currentTarget.style.backgroundColor = colors.background;
                        const file = e.dataTransfer.files[0];
                        handleGameFileSelect(file);
                      }}
                      onClick={() => document.getElementById('game-file-upload')?.click()}
                      style={{
                        height: '120px',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                        border: `2px dashed ${colors.border}`,
                        background: 'transparent',
                        backdropFilter: 'blur(10px)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <input
                        id="game-file-upload"
                        hidden
                        type="file"
                        accept=".zip"
                        onChange={e => {
                          const file = e.target.files[0];
                          handleGameFileSelect(file);
                        }}
                      />
                      {isUploading ? (
                        <Stack alignItems="center" gap={1}>
                          <CircularProgress size={24} />
                          <span style={{ color: colors.text }}>
                            Uploading... {Math.round(uploadProgress)}%
                          </span>
                        </Stack>
                      ) : gameFile ? (
                        <Stack alignItems="center" gap={1}>
                          <UploadIcon style={{ color: colors.button }} />
                          <span style={{ color: colors.text }}>Game File Selected ✅</span>
                          <span style={{ color: colors.border, fontSize: '12px' }}>
                            {gameFileName}
                          </span>
                          <span style={{ color: colors.border, fontSize: '12px' }}>
                            Click or drag to change
                          </span>
                        </Stack>
                      ) : (
                        <Stack alignItems="center" gap={1}>
                          <UploadIcon style={{ color: colors.border }} />
                          <span style={{ color: colors.text }}>Upload Game File</span>
                          <span style={{ color: colors.border, fontSize: '12px' }}>
                            Supports ZIP files only
                          </span>
                        </Stack>
                      )}
                    </Stack>
                  </Stack>
                )}
              </Stack>

              {/* Save Button */}
              <Stack
                style={{
                  position: 'absolute',
                  bottom: '12px',
                  right: '12px',
                  zIndex: 1,
                }}
              >
                <ImageButton
                  text={isSaving ? 'Creating...' : 'Create and Deploy Game!'}
                  icon={RocketLaunchIcon}
                  onClick={handleSave}
                  style={{
                    color: '#fff',
                    borderRadius: '4px',
                    padding: '8px 12px',
                    width: 'fit-content',
                    opacity: !hasRequiredFields || isSaving ? 0.5 : 1,
                    transition: 'opacity 0.2s ease-in-out',
                  }}
                  disabled={isSaving || !hasRequiredFields}
                />
              </Stack>
            </Stack>
          </div>
        </Stack>
      </Stack>
    </StyledDialog>
  );
};

export default CreateGameDialog;
