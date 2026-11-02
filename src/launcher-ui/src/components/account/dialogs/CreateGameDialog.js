import React, { useCallback, useEffect, useState } from 'react';
import { Button, CircularProgress, Stack, Typography } from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckIcon from '@mui/icons-material/Check';
import Cookies from 'js-cookie';
import { colors } from '../../../theme/colors';
import { getAllInstallationPairs } from '../../../pages/AccountPage';
import { uploadToCdn } from '../../../utils/cdnUpload';
import { notify, uploadErrorMessage } from '../../../utils/notify';
import {
  STEPS,
  StyledDialog,
  ghostButtonSx,
  isGameId,
  isVersion,
  primaryButtonSx,
} from './create-game/formStyles';
import DetailsStep from './create-game/DetailsStep';
import ArtworkStep from './create-game/ArtworkStep';
import BuildStep from './create-game/BuildStep';
import ReviewStep from './create-game/ReviewStep';

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

  const handleSave = async () => {
    if (!isGameId(gameId)) {
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

    if (activeTab === 1 && !isVersion(gameVersion)) {
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
          await uploadToCdn(gameFile, {
            sessionID,
            onProgress: setUploadProgress,
            fields: {
              isGameUpload: true,
              gameId: gameId.trim(),
              version: gameVersion,
            },
          });
        } catch (err) {
          console.error('Upload failed:', err);
          notify('Upload Failed', uploadErrorMessage(err, 'Could not upload your game file.'));
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

  const handleTabChange = newValue => {
    if (newValue === activeTab) return;
    setActiveTab(newValue);
    setSelectedRepo('');
    setGameFile(null);
    setGameFileName('');
  };

  const gameIdValid = isGameId(gameId);
  const detailsValid = Boolean(gameName.trim() && gameIdValid && selectedTeam);
  const artworkValid = Boolean(gameBackgroundUrl);
  const buildValid =
    activeTab === 0 ? Boolean(selectedRepo) : Boolean(gameFile && isVersion(gameVersion));
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
    if (step === 2 && activeTab === 1 && !isVersion(gameVersion))
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
              <DetailsStep
                gameName={gameName}
                setGameName={setGameName}
                gameDescription={gameDescription}
                setGameDescription={setGameDescription}
                gameId={gameId}
                setGameId={setGameId}
                gameIdError={gameIdError}
                setGameIdError={setGameIdError}
                gameIdValid={gameIdValid}
                teams={teams}
                selectedTeam={selectedTeam}
                onTeamChange={handleTeamChange}
                gameStatus={gameStatus}
                setGameStatus={setGameStatus}
                previewGame={previewGame}
              />
            )}
            {step === 1 && (
              <ArtworkStep
                gameBackgroundUrl={gameBackgroundUrl}
                setGameBackgroundUrl={setGameBackgroundUrl}
                uploading={uploading}
                setUploading={setUploading}
                screenshots={screenshots}
                setScreenshots={setScreenshots}
                uploadingScreenshots={uploadingScreenshots}
                setUploadingScreenshots={setUploadingScreenshots}
                uploadHeaders={uploadHeaders}
                previewGame={previewGame}
              />
            )}
            {step === 2 && (
              <BuildStep
                activeTab={activeTab}
                onTabChange={handleTabChange}
                connectedAccounts={connectedAccounts}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                loadRepositories={loadRepositories}
                loadingRepos={loadingRepos}
                filteredRepos={filteredRepos}
                selectedRepo={selectedRepo}
                setSelectedRepo={setSelectedRepo}
                ownerAvatars={ownerAvatars}
                onAuthorize={handleAuthorizeMoreRepos}
                gameVersion={gameVersion}
                setGameVersion={setGameVersion}
                gameFile={gameFile}
                gameFileName={gameFileName}
                onFile={handleGameFileSelect}
              />
            )}
            {step === 3 && (
              <ReviewStep
                previewGame={previewGame}
                gameName={gameName}
                gameId={gameId}
                selectedTeam={selectedTeam}
                gameStatus={gameStatus}
                gameDescription={gameDescription}
                screenshotCount={screenshots.length}
                buildLabel={activeTab === 0 ? selectedRepo : `${gameFileName || 'ZIP file'} · v${gameVersion}`}
                isSaving={isSaving}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
              />
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
