import React, { useEffect, useState } from 'react';
import { SvgIcon } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { colors } from '../../theme/colors';

const GameButton = ({ gameInstalled, downloadProgress, gameVersion, onClick, gameId, isEditing }) => {
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    const checkGameStatus = async () => {
      if (window.electronAPI) {
        const running = await window.electronAPI.isGameRunning(gameId);
        setIsRunning(running);
      }
    };

    checkGameStatus();

    const handleGameStarted = startedGameId => {
      if (startedGameId === gameId) {
        setIsRunning(true);
      }
    };

    const handleGameStopped = stoppedGameId => {
      if (stoppedGameId === gameId) {
        setIsRunning(false);
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
  }, [gameId]);

  const handleClick = () => {
    if (isEditing) return;
    if (isRunning) {
      window.electronAPI.stopGame(gameId);
    } else {
      onClick();
    }
  };

  return (
    <button
      className="game-button shimmer-button w-full flex justify-between align-center"
      onClick={handleClick}
    >
      {isRunning ? (
        <img src="/stop.png" alt="Stop" />
      ) : gameInstalled ? (
        <img src="/play.png" alt="Play" />
      ) : isEditing ? (
        <SvgIcon
          component={DownloadIcon}
          style={{ width: '24px', height: '24px', color: colors.text }}
        />
      ) : (
        <img src="/download.png" alt="Download" />
      )}
      <p style={{ margin: '0', fontSize: '14px' }}>{downloadProgress || gameVersion}</p>
    </button>
  );
};

export default GameButton;
