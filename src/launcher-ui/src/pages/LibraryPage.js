import React, { useCallback, useEffect, useState } from 'react';
import { Box, Grid, TextField } from '@mui/material';
import axios from 'axios';
import { colors } from '../theme/colors';
import { GameList } from '../components/library/GameList';
import { GameDetails } from '../components/library/GameDetails';
import { GameProperties } from '../components/library/GameProperties';
import { GameContextMenu } from '../components/library/GameContextMenu';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Cookies from 'js-cookie';
import SearchIcon from '@mui/icons-material/Search';
import { useLocation } from 'react-router-dom';
import { autoAddGameToLibrary } from '../utils/autoAddGame';

const LibraryPage = () => {
  const location = useLocation();
  const [installedGameIds, setInstalledGameIds] = useState([]);
  const [cachedGames, setCachedGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [activeDownloads, setActiveDownloads] = useState({});
  const [hasUpdate, setHasUpdate] = useState(false);
  const [applyingUpdate, setApplyingUpdate] = useState({});
  const [uninstallDialogOpen, setUninstallDialogOpen] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(null);
  const [latestVersion, setLatestVersion] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [playTime, setPlayTime] = useState('0 hours');
  const [achievements] = useState({ completed: 0, total: 0 });
  const [diskUsage, setDiskUsage] = useState('0 MB');
  const [propertiesDialogOpen, setPropertiesDialogOpen] = useState(false);
  const [gameProperties, setGameProperties] = useState({
    branch: 'latest',
    language: 'en',
    downloadLocation: '',
    launchOptions: '',
    notes: '',
  });
  const [gameUpdates, setGameUpdates] = useState({});
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [runningGames, setRunningGames] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [startingUpdate, setStartingUpdate] = useState({});

  const fetchLocalVersion = useCallback(
    async gameId => {
      try {
        const current = await window.electronAPI.getCurrentGameVersion(gameId);
        const gameInfo = cachedGames.find(g => g.game_id === gameId);
        const latest = gameInfo?.version;
        setCurrentVersion(current);
        setLatestVersion(latest);
        setHasUpdate(current !== latest);
      } catch (err) {
        console.error('Error fetching game versions:', err);
        setHasUpdate(false);
      }
    },
    [cachedGames]
  );

  const checkForUpdates = useCallback(async (games, installedIds) => {
    const updates = {};
    for (const game of games) {
      if (installedIds.includes(game.game_id) && window.electronAPI) {
        try {
          const current = await window.electronAPI.getCurrentGameVersion(game.game_id);
          if (current && game.version !== current) {
            updates[game.game_id] = {
              current,
              latest: game.version,
            };
          }
        } catch (err) {
          console.error(`Error checking update for ${game.game_id}:`, err);
        }
      }
    }
    return updates;
  }, []);

  useEffect(() => {
    const handleDownloadProgress = progressData => {
      if (!progressData?.gameId) return;

      // Clear startingUpdate when download progress starts
      setStartingUpdate(prev => {
        if (prev[progressData.gameId]) {
          const updated = { ...prev };
          delete updated[progressData.gameId];
          return updated;
        }
        return prev;
      });

      const percent = Math.round(progressData.percentage * 100);
      setActiveDownloads(prev => ({
        ...prev,
        [progressData.gameId]: {
          percent,
          percentageString: `${percent}%`,
          time: Date.now(),
        },
      }));
    };

    const handleDownloadComplete = async ({ gameId }) => {
      console.log(`Download complete for game ${gameId}`);

      setActiveDownloads(prev => {
        const updated = { ...prev };
        delete updated[gameId];
        return updated;
      });

      setApplyingUpdate(prev => ({ ...prev, [gameId]: true }));

      try {
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Refresh installed games list
        const ids = await window.electronAPI.getInstalledGames();
        setInstalledGameIds(ids);

        // Update selectedGame to the latest object from cachedGames
        setSelectedGame(prev => {
          const updated = cachedGames.find(g => g.game_id === gameId);
          return updated || prev;
        });

        // Update version and update status
        const currentVersion = await window.electronAPI.getCurrentGameVersion(gameId);
        const gameInfo = cachedGames.find(g => g.game_id === gameId);

        if (gameId === selectedGame?.game_id) {
          setCurrentVersion(currentVersion);
          setHasUpdate(gameInfo && currentVersion !== gameInfo.version);
        }

        if (gameInfo && currentVersion === gameInfo.version) {
          setGameUpdates(prev => {
            const updated = { ...prev };
            delete updated[gameId];
            return updated;
          });
        }
      } catch (error) {
        console.error(`Error in update process for ${gameId}:`, error);
      } finally {
        setApplyingUpdate(prev => {
          const updated = { ...prev };
          delete updated[gameId];
          return updated;
        });
      }
    };

    window.electronAPI?.onDownloadProgress(handleDownloadProgress);
    window.electronAPI?.onDownloadComplete(handleDownloadComplete);

    return () => {
      window.electronAPI?.removeDownloadProgressListener(handleDownloadProgress);
    };
  }, [selectedGame, fetchLocalVersion, cachedGames]);

  useEffect(() => {
    const loadGames = async () => {
      // 1. Always display all library games from cache immediately
      let cachedLibraryGames = [];
      if (window.electronAPI?.getCachedLibraryGames) {
        try {
          cachedLibraryGames = await window.electronAPI.getCachedLibraryGames();
          setCachedGames(cachedLibraryGames);
        } catch (cacheErr) {
          console.error('Error loading cached library games:', cacheErr);
        }
      }

      // Fallback: If still empty, try localStorage
      if (!cachedLibraryGames.length) {
        let localLibrary = [];
        try {
          localLibrary = JSON.parse(localStorage.getItem('localLibrary')) || [];
        } catch (e) {
          localLibrary = [];
        }
        if (localLibrary.length) {
          // Get game details from localStorage
          const localGames = localLibrary.map(gameId => {
            const gameDetailsKey = `game_${gameId}`;
            const gameDetails = JSON.parse(localStorage.getItem(gameDetailsKey)) || {
              game_id: gameId,
              game_name: gameId,
              version: 'unknown',
              description: '',
              background_image_url: '',
              banner_image_url: '',
              playtime: 0,
              achievements: { completed: 0, total: 0 },
              disk_usage: '0 MB',
              last_played: null,
              properties: {
                branch: 'latest',
                language: 'en',
                downloadLocation: '',
                launchOptions: '',
                notes: '',
              },
            };
            return gameDetails;
          });
          setCachedGames(localGames);
          cachedLibraryGames = localGames;
        }
      }

      // 2. Get installed games and update installed status
      let ids = [];
      if (window.electronAPI && window.electronAPI.getInstalledGames) {
        try {
          ids = await window.electronAPI.getInstalledGames();
        } catch (err) {
          console.error('Error getting installed games:', err);
        }
      }
      setInstalledGameIds(ids);

      // 3. Check for updates for all installed games
      const updates = await checkForUpdates(cachedLibraryGames, ids);
      setGameUpdates(updates);

      // 4. Try to fetch latest library games from API
      try {
        const sessionID = Cookies.get('sessionID');
        const response = await axios.get('/get-library-games', {
          headers: {
            sessionID: sessionID,
          },
        });
        const libraryGames = response.data;
        setCachedGames(libraryGames);

        // Update localStorage with latest data
        localStorage.setItem('localLibrary', JSON.stringify(libraryGames.map(g => g.game_id)));
        libraryGames.forEach(game => {
          const gameDetailsKey = `game_${game.game_id}`;
          localStorage.setItem(gameDetailsKey, JSON.stringify(game));
        });

        // Check for updates with the new library data
        const newUpdates = await checkForUpdates(libraryGames, ids);
        setGameUpdates(newUpdates);
      } catch (err) {
        console.error('Error loading library:', err);
      }
    };

    loadGames();
    const updateInterval = setInterval(loadGames, 300000);

    return () => clearInterval(updateInterval);
  }, [checkForUpdates]);

  // Add effect to check for updates when selected game changes
  useEffect(() => {
    if (selectedGame && window.electronAPI) {
      const checkSelectedGameUpdate = async () => {
        try {
          const current = await window.electronAPI.getCurrentGameVersion(selectedGame.game_id);
          if (current && selectedGame.version !== current) {
            setGameUpdates(prev => ({
              ...prev,
              [selectedGame.game_id]: {
                current,
                latest: selectedGame.version,
              },
            }));
          }
        } catch (err) {
          console.error(`Error checking update for selected game:`, err);
        }
      };
      checkSelectedGameUpdate();
    }
  }, [selectedGame]);

  useEffect(() => {
    if (selectedGame) {
      const gameInfo = cachedGames.find(g => g.game_id === selectedGame.game_id);
      if (gameInfo) {
        setLatestVersion(gameInfo.version);
      }

      const fetchGameInfo = async () => {
        if (window.electronAPI) {
          try {
            const [current, sizeInBytes, playtime] = await Promise.all([
              window.electronAPI.getCurrentGameVersion(selectedGame.game_id),
              window.electronAPI.getGameSize(selectedGame.game_id),
              window.electronAPI.getGamePlaytime(selectedGame.game_id),
            ]);

            setCurrentVersion(current);
            setHasUpdate(gameInfo && current !== gameInfo.version);

            let size;
            if (sizeInBytes < 1024 * 1024) {
              size = `${Math.round(sizeInBytes / 1024)} KB`;
            } else if (sizeInBytes < 1024 * 1024 * 1024) {
              size = `${Math.round(sizeInBytes / (1024 * 1024))} MB`;
            } else {
              size = `${Math.round(sizeInBytes / (1024 * 1024 * 1024))} GB`;
            }
            setDiskUsage(size);

            const hours = Math.floor(playtime / 3600);
            const minutes = Math.floor((playtime % 3600) / 60);
            setPlayTime(`${hours} hours ${minutes} minutes`);
          } catch (err) {
            console.error('Error fetching game info:', err);
          }
        }
      };

      fetchGameInfo();
    }
  }, [selectedGame, cachedGames]);

  // Add effect to handle game selection from URL query parameter and ensure a game is selected
  useEffect(() => {
    if (!cachedGames.length) return;

    const params = new URLSearchParams(location.search);
    const gameId = params.get('game');

    // Only handle URL parameter on initial load (when selectedGame is null)
    if (gameId && !selectedGame) {
      const game = cachedGames.find(g => g.game_id === gameId);
      if (game) {
        setSelectedGame(game);
        return;
      }
    }

    // If no game is selected or the selected game is not in the list, select the first available
    if (!selectedGame || !cachedGames.some(g => g.game_id === selectedGame.game_id)) {
      setSelectedGame(cachedGames[0]);
    }
  }, [cachedGames, selectedGame, location.search]);

  // Add effect to handle automatic game addition from URL parameter
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const gameId = params.get('game');

    if (gameId) {
      // Check if the game is already in the library
      const isInLibrary = cachedGames.some(g => g.game_id === gameId);

      if (!isInLibrary) {
        // Auto-add the game to library if it's public
        autoAddGameToLibrary(
          gameId,
          cachedGames.map(g => g.game_id),
          updatedLibrary => {
            // The autoAddGameToLibrary function will handle updating localStorage
            // We need to reload the games to reflect the changes
            const loadGames = async () => {
              try {
                const sessionID = Cookies.get('sessionID');
                const response = await axios.get('/get-library-games', {
                  headers: {
                    sessionID: sessionID,
                  },
                });
                const libraryGames = response.data;
                setCachedGames(libraryGames);
              } catch (err) {
                console.error('Error reloading library after auto-add:', err);
              }
            };
            loadGames();
          }
        );
      }
    }
  }, [location.search, cachedGames]);

  const handleContextMenu = (event, game) => {
    event.preventDefault();
    setContextMenu(null);
    setTimeout(() => {
      setContextMenu({
        mouseX: event.clientX - 2,
        mouseY: event.clientY - 4,
      });
      setSelectedGame(game);
    }, 0);
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleUninstallGame = async () => {
    if (!selectedGame) return;

    try {
      await window.electronAPI.uninstallGame(selectedGame.game_id);
      setInstalledGameIds(prev => prev.filter(id => id !== selectedGame.game_id));
      // After uninstall, select the next available game
      setTimeout(() => {
        setSelectedGame(prev => {
          const remainingGames = cachedGames.filter(g => g.game_id !== selectedGame.game_id);
          return remainingGames[0] || null;
        });
      }, 0);
      setUninstallDialogOpen(false);
    } catch (err) {
      console.error('Error uninstalling game:', err);
    }
  };

  const handleSaveProperties = () => {
    if (!selectedGame) return;

    try {
      window.electronAPI.saveGameProperties(selectedGame.game_id, gameProperties);
      setPropertiesDialogOpen(false);
    } catch (err) {
      console.error('Error saving game properties:', err);
    }
  };

  const handlePlayGame = async () => {
    if (!selectedGame) return;

    try {
      await window.electronAPI.openGame(selectedGame.game_id);
      setIsGameRunning(true);
    } catch (err) {
      console.error('Error opening game:', err);
    }
  };

  const handleStopGame = async () => {
    if (!selectedGame) return;

    try {
      await window.electronAPI.stopGame(selectedGame.game_id);
      setIsGameRunning(false);
    } catch (err) {
      console.error('Error stopping game:', err);
    }
  };

  const handleDownloadGame = async () => {
    if (!selectedGame) return;
    if (activeDownloads[selectedGame.game_id] || applyingUpdate[selectedGame.game_id]) return;

    if (window.electronAPI) {
      // Desktop environment - use electron download
      window.electronAPI.downloadGame(selectedGame.game_id);
    } else {
      // Web environment - download as zip
      try {
        const sessionId = document.cookie
          .split('; ')
          .find(row => row.startsWith('sessionID='))
          ?.split('=')[1];

        // Get presigned URL
        const presignResp = await fetch('https://cdn.diabolical.services/generateDownloadUrl', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionId && { sessionID: sessionId }),
          },
          body: JSON.stringify({
            key: `R2/${selectedGame.game_id}/Versions/Build-StandaloneWindows64-${selectedGame.version}.zip`,
          }),
        });

        if (!presignResp.ok) {
          throw new Error('Failed to generate download URL');
        }

        const { url: downloadUrl } = await presignResp.json();

        // Create a temporary link and trigger download
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `${selectedGame.game_name}-${selectedGame.version}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) {
        console.error('Download error:', error);
        // You might want to show an error notification here
      }
    }
  };

  const handleUpdateGame = () => {
    if (!selectedGame) return;
    if (
      activeDownloads[selectedGame.game_id] ||
      applyingUpdate[selectedGame.game_id] ||
      startingUpdate[selectedGame.game_id]
    )
      return;
    setStartingUpdate(prev => ({ ...prev, [selectedGame.game_id]: true }));
    setTimeout(() => {
      window.electronAPI.downloadGame(selectedGame.game_id);
    }, 0);
  };

  const handleOpenInstallLocation = async () => {
    if (!selectedGame) return;
    try {
      await window.electronAPI.openInstallLocation(selectedGame.game_id);
    } catch (err) {
      console.error('Error opening install location:', err);
    }
  };

  // Remove from library handler
  const handleRemoveFromLibrary = async () => {
    if (!selectedGame) return;
    try {
      const sessionID = Cookies.get('sessionID');

      if (!sessionID) {
        // Offline mode: Remove from localStorage
        let localLibrary = [];
        try {
          localLibrary = JSON.parse(localStorage.getItem('localLibrary')) || [];
        } catch (e) {
          localLibrary = [];
        }

        // Remove game from localLibrary array
        localLibrary = localLibrary.filter(id => id !== selectedGame.game_id);
        localStorage.setItem('localLibrary', JSON.stringify(localLibrary));

        // Remove game details from localStorage
        const gameDetailsKey = `game_${selectedGame.game_id}`;
        localStorage.removeItem(gameDetailsKey);

        // Update cached games
        if (window.electronAPI?.cacheGamesLocally) {
          let cachedGames = [];
          try {
            cachedGames = await window.electronAPI.getCachedGames();
            cachedGames = cachedGames.filter(g => g.game_id !== selectedGame.game_id);
            window.electronAPI.cacheGamesLocally(cachedGames);
          } catch (e) {
            console.error('Error updating cached games:', e);
          }
        }

        if (window.electronAPI) {
          window.electronAPI.showCustomNotification(
            'Game Removed',
            'Game has been removed from your local library.'
          );
        }

        // Update state
        setCachedGames(prev => prev.filter(g => g.game_id !== selectedGame.game_id));
        setInstalledGameIds(prev => prev.filter(id => id !== selectedGame.game_id));
        setTimeout(() => {
          setSelectedGame(prev => {
            const remainingGames = cachedGames.filter(g => g.game_id !== selectedGame.game_id);
            return remainingGames[0] || null;
          });
        }, 0);
        return;
      }

      // Online mode: Remove from server
      await axios.post(
        '/remove-from-library',
        { game_id: selectedGame.game_id },
        {
          headers: {
            sessionID: sessionID,
          },
        }
      );

      // Also update localStorage
      let localLibrary = [];
      try {
        localLibrary = JSON.parse(localStorage.getItem('localLibrary')) || [];
        localLibrary = localLibrary.filter(id => id !== selectedGame.game_id);
        localStorage.setItem('localLibrary', JSON.stringify(localLibrary));
      } catch (e) {
        console.error('Error updating localStorage:', e);
      }

      // Remove from cachedGames and update selection
      setCachedGames(prev => prev.filter(g => g.game_id !== selectedGame.game_id));
      setInstalledGameIds(prev => prev.filter(id => id !== selectedGame.game_id));
      setTimeout(() => {
        setSelectedGame(prev => {
          const remainingGames = cachedGames.filter(g => g.game_id !== selectedGame.game_id);
          return remainingGames[0] || null;
        });
      }, 0);
    } catch (err) {
      console.error('Error removing game from library:', err);
      if (window.electronAPI) {
        window.electronAPI.showCustomNotification(
          'Remove Failed',
          err.message || 'Could not remove game from library'
        );
      }
    }
  };

  // Filter games based on search query
  const filteredGames = cachedGames.filter(
    game =>
      game.game_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.game_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Add effect to handle game state changes
  useEffect(() => {
    const handleGameStarted = gameId => {
      setRunningGames(prev => new Set([...prev, gameId]));
      if (selectedGame?.game_id === gameId) {
        setIsGameRunning(true);
      }
    };

    const handleGameStopped = gameId => {
      setRunningGames(prev => {
        const newSet = new Set(prev);
        newSet.delete(gameId);
        return newSet;
      });
      if (selectedGame?.game_id === gameId) {
        setIsGameRunning(false);
      }
    };

    if (window.electronAPI) {
      window.electronAPI.onGameStarted(handleGameStarted);
      window.electronAPI.onGameStopped(handleGameStopped);
    }

    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeGameStartedListener(handleGameStarted);
        window.electronAPI.removeGameStoppedListener(handleGameStopped);
      }
    };
  }, [selectedGame]);

  // Add effect to check for running games on mount and when selected game changes
  useEffect(() => {
    const checkRunningGames = async () => {
      if (window.electronAPI) {
        // Check all installed games
        for (const gameId of installedGameIds) {
          const isRunning = await window.electronAPI.isGameRunning(gameId);
          if (isRunning) {
            setRunningGames(prev => new Set([...prev, gameId]));
          }
        }
        // Update isGameRunning for selected game
        if (selectedGame) {
          const isRunning = await window.electronAPI.isGameRunning(selectedGame.game_id);
          setIsGameRunning(isRunning);
        }
      }
    };

    checkRunningGames();
  }, [selectedGame, installedGameIds]);

  // Update isGameRunning when selected game changes
  useEffect(() => {
    if (selectedGame) {
      setIsGameRunning(runningGames.has(selectedGame.game_id));
    }
  }, [selectedGame, runningGames]);

  return (
    <Box
      sx={{
        height: '100vh',
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Grid container sx={{ flex: 1, minHeight: 0, height: '100%' }}>
        <Grid
          item
          xs={12}
          md={3}
          sx={{
            height: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRight: `1px solid ${colors.border}`,
            pr: '1px',
            boxSizing: 'border-box',
          }}
        >
          <TextField
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search games..."
            variant="standard"
            size="small"
            fullWidth
            slotProps={{
              input: {
                disableUnderline: true,
                endAdornment: <SearchIcon sx={{ color: '#888', fontSize: 20, ml: 1 }} />,
                sx: {
                  fontSize: '15px',
                  color: '#fff',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                },
              },
            }}
            sx={{
              width: '100%',
              border: 'none',
              background: 'none',
              borderRadius: 0,
              borderBottom: `1px solid ${colors.border}`,
              m: 0,
              p: 2,
            }}
          />
          <GameList
            games={filteredGames}
            selectedGame={selectedGame}
            onGameSelect={setSelectedGame}
            installedGameIds={installedGameIds}
            gameUpdates={gameUpdates}
            onContextMenu={handleContextMenu}
            runningGames={Array.from(runningGames)}
          />
        </Grid>
        <Grid
          item
          xs={12}
          md={9}
          sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}
        >
          <GameDetails
            game={selectedGame}
            isInstalled={installedGameIds.includes(selectedGame?.game_id)}
            isGameRunning={isGameRunning}
            hasUpdate={hasUpdate}
            currentVersion={currentVersion}
            latestVersion={latestVersion}
            playTime={playTime}
            achievements={achievements}
            diskUsage={diskUsage}
            activeDownloads={activeDownloads}
            applyingUpdate={applyingUpdate}
            startingUpdate={startingUpdate}
            onPlay={handlePlayGame}
            onDownload={handleDownloadGame}
            onUpdate={handleUpdateGame}
            onStop={handleStopGame}
          />
        </Grid>
      </Grid>

      <GameContextMenu
        anchorEl={contextMenu}
        onClose={handleCloseContextMenu}
        game={selectedGame}
        isInstalled={installedGameIds.includes(selectedGame?.game_id)}
        isGameRunning={isGameRunning}
        hasUpdate={hasUpdate}
        onPlay={handlePlayGame}
        onDownload={handleDownloadGame}
        onUpdate={handleUpdateGame}
        onStop={handleStopGame}
        onUninstall={() => setUninstallDialogOpen(true)}
        onOpenFolder={handleOpenInstallLocation}
        onOpenProperties={() => setPropertiesDialogOpen(true)}
        onRemoveFromLibrary={handleRemoveFromLibrary}
      />

      <GameProperties
        open={propertiesDialogOpen}
        onClose={() => setPropertiesDialogOpen(false)}
        game={selectedGame}
        properties={gameProperties}
        onPropertiesChange={(key, value) => setGameProperties(prev => ({ ...prev, [key]: value }))}
        onSave={handleSaveProperties}
      />

      <ConfirmDialog
        open={uninstallDialogOpen}
        onClose={() => setUninstallDialogOpen(false)}
        onConfirm={handleUninstallGame}
        title="Uninstall Game"
        message={`Are you sure you want to uninstall ${selectedGame?.game_name}?`}
      />
    </Box>
  );
};

export default LibraryPage;
