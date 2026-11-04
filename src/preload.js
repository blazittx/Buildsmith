const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  onDbStatusChange: callback => {
    ipcRenderer.on('db-status', (event, status) => {
      callback(status);
    });
  },
  onUpdateMessage: callback => {
    ipcRenderer.on('updateMessage', (event, message) => {
      callback(message);
    });
  },
});

contextBridge.exposeInMainWorld('versions', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
});

contextBridge.exposeInMainWorld('electronAPI', {
  // Game Actions
  downloadGame: gameId => ipcRenderer.send('download-game', gameId),
  getPathForFile: file => webUtils.getPathForFile(file),
  publishGameBuild: payload => ipcRenderer.invoke('publish-game-build', payload),
  getSteamSettings: gameId => ipcRenderer.invoke('get-steam-settings', gameId),
  saveSteamSettings: (gameId, settings) =>
    ipcRenderer.invoke('save-steam-settings', gameId, settings),
  steamUploadBuild: payload => ipcRenderer.invoke('steam-upload-build', payload),
  onSteamUploadProgress: callback => {
    const listener = (event, progress) => callback(progress);
    ipcRenderer.on('steam-upload-progress', listener);
    return () => ipcRenderer.removeListener('steam-upload-progress', listener);
  },
  openGame: gameId => ipcRenderer.send('open-game', gameId),
  stopGame: gameId => ipcRenderer.send('stop-game', gameId),
  isGameRunning: gameId => ipcRenderer.invoke('is-game-running', gameId),
  getGameSize: gameId => ipcRenderer.invoke('get-game-size', gameId),
  getGamePlaytime: gameId => ipcRenderer.invoke('get-game-playtime', gameId),
  onGameStarted: callback => {
    ipcRenderer.on('game-started', (event, gameId) => callback(gameId));
  },
  removeGameStartedListener: callback => {
    ipcRenderer.removeListener('game-started', callback);
  },
  onGameStopped: callback => {
    ipcRenderer.on('game-stopped', (event, gameId) => callback(gameId));
  },
  removeGameStoppedListener: callback => {
    ipcRenderer.removeListener('game-stopped', callback);
  },
  uninstallGame: gameId => ipcRenderer.send('uninstall-game', gameId),
  openInstallLocation: gameId => ipcRenderer.send('open-install-location', gameId),
  getInstalledGames: () => ipcRenderer.invoke('get-installed-games'),
  getCurrentGameVersion: gameId => ipcRenderer.invoke('get-current-game-version', gameId),
  getLatestGameVersion: gameId => ipcRenderer.invoke('get-latest-game-version', gameId),
  onPatchUploadProgress: callback => {
    const listener = (event, progress) => callback(progress);
    ipcRenderer.on('patch-upload-progress', listener);
    return () => ipcRenderer.removeListener('patch-upload-progress', listener);
  },
  onDownloadProgress: callback => {
    const listener = (event, progress) => callback(progress);
    ipcRenderer.on('download-progress', listener);
    return () => ipcRenderer.removeListener('download-progress', listener);
  },
  onDownloadComplete: callback => {
    const listener = (event, gameId, installPath) => {
      callback({ gameId, installPath });
    };
    ipcRenderer.on('download-complete', listener);
    return () => ipcRenderer.removeListener('download-complete', listener);
  },
  onGameUninstalled: callback => {
    const listener = (event, gameId) => callback(gameId);
    ipcRenderer.on('game-uninstalled', listener);
    return () => ipcRenderer.removeListener('game-uninstalled', listener);
  },
  showContextMenu: (gameId, position) => {
    ipcRenderer.send('show-context-menu', gameId, position);
  },
  getCachedGames: () => ipcRenderer.invoke('get-cached-games'),
  cacheGamesLocally: games => {
    localStorage.setItem('localGames', JSON.stringify(games));
  },

  // Library Games Cache
  cacheLibraryGamesLocally: games => {
    localStorage.setItem('libraryGames', JSON.stringify(games));
  },
  getCachedLibraryGames: () => {
    const data = localStorage.getItem('libraryGames');
    return data ? JSON.parse(data) : [];
  },

  // Local Games Cache
  getLocalGames: () => {
    const data = localStorage.getItem('localGames');
    return data ? JSON.parse(data) : [];
  },

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: settings => ipcRenderer.invoke('update-settings', settings),
  onSettingsUpdated: callback => {
    ipcRenderer.on('settings-updated', (event, settings) => callback(settings));
    return () => {
      ipcRenderer.removeListener('settings-updated', callback);
    };
  },
  onThemeChanged: callback => {
    ipcRenderer.on('theme-changed', (event, theme) => callback(theme));
    return () => {
      ipcRenderer.removeAllListeners('theme-changed');
    };
  },

  // Window
  closeWindow: () => ipcRenderer.send('close-window'),
  reloadWindow: () => ipcRenderer.send('reload-window'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  getWindowSize: () => ipcRenderer.invoke('get-window-size'),
  setWindowSize: (width, height) => {
    ipcRenderer.send('set-window-size-and-center', width, height);
  },

  // API
  openExternal: url => ipcRenderer.invoke('open-external-url', url),
  showCustomNotification: (title, body, gameId) =>
    ipcRenderer.send('show-notification', { title, body, gameId }),
  onNotification: callback => {
    ipcRenderer.on('show-notification', (event, data) => callback(data));
  },
  onProtocolData: callback => {
    ipcRenderer.on('protocol-data', (event, { action, data }) => {
      callback(action, data);
    });
  },
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  downloadUpdate: () => ipcRenderer.send('download-update'),
  onUpdateAvailable: callback => ipcRenderer.on('update-available', callback),
  onUpdateNotAvailable: callback => ipcRenderer.on('update-not-available', callback),
  getUnityPackages: () => ipcRenderer.invoke('get-unity-packages'),
  readFile: filePath => ipcRenderer.invoke('read-file', filePath),
  downloadUnityPackage: (url, defaultFilename) =>
    ipcRenderer.invoke('download-unity-package', url, defaultFilename),
  isUnityEditorRunning: () => ipcRenderer.invoke('is-unity-editor-running'),
  installUnityPackage: packagePath => ipcRenderer.invoke('install-unity-package', packagePath),
  getLastDownloadedPath: () => ipcRenderer.invoke('get-last-downloaded-path'),
  deleteFile: filePath => ipcRenderer.invoke('delete-file', filePath),
  createSteamAppIdFile: (gameId, steamId) =>
    ipcRenderer.invoke('create-steam-appid-file', gameId, steamId),
});

contextBridge.exposeInMainWorld('githubAPI', {
  fetchWorkflows: (repoFullName, accessToken) =>
    ipcRenderer.invoke('fetch-github-workflows', repoFullName, accessToken),
  fetchLogs: (repoFullName, runId, accessToken) =>
    ipcRenderer.invoke('fetch-github-logs', repoFullName, runId, accessToken),
});

const bridge = {
  updateMessage: callback => ipcRenderer.on('updateMessage', callback),
};

contextBridge.exposeInMainWorld('bridge', bridge);
