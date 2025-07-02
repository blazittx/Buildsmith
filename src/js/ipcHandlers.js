const path = require('path');
const { app, ipcMain, BrowserWindow, shell } = require('electron');
const { exec, spawn } = require('child_process');
const AdmZip = require('adm-zip');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const { download } = require('electron-dl');
const { dialog } = require('electron');

const updater = require('./updater');
const { downloadGame } = require('./downloadManager');
const {
  getInstalledGames,
  showContextMenu,
  uninstallGame,
  getGameSize,
  startPlaytimeTracking,
  stopPlaytimeTracking,
  getGamePlaytime,
} = require('./gameManager');
const { getCurrentGameVersion, getLatestGameVersion } = require('./updater');
const { loadSettings, saveSettings, buildsmithPath } = require('./settings');
const { cacheGamesLocally, readCachedGames } = require('./cacheManager');
const { getPreferredExecutable, getAllUnityPackages } = require('./launcherUtils');
const windowStore = require('./windowStore');

// Track running game processes
const runningGames = new Map();

// Add function to check for running games on startup
function checkRunningGames() {
  const runningGamesList = [];
  runningGames.forEach((gameInfo, gameId) => {
    try {
      process.kill(gameInfo.pid, 0); // throws if process is not running
      runningGamesList.push(gameId);
    } catch (e) {
      runningGames.delete(gameId);
    }
  });
  return runningGamesList;
}

function initIPCHandlers() {
  // Check for running games on startup
  const runningGamesList = checkRunningGames();
  if (runningGamesList.length > 0) {
    const mainWindow = windowStore.getMainWindow();
    if (mainWindow) {
      runningGamesList.forEach(gameId => {
        mainWindow.webContents.send('game-started', gameId);
      });
    }
  }

  // Game Actions
  ipcMain.on('download-game', downloadGame);
  ipcMain.handle('get-installed-games', async () => getInstalledGames());
  ipcMain.handle('get-current-game-version', async (event, gameId) =>
    getCurrentGameVersion(gameId)
  );
  ipcMain.handle('get-latest-game-version', async (event, gameId) => getLatestGameVersion(gameId));
  ipcMain.handle('get-game-size', async (event, gameId) => getGameSize(gameId));
  ipcMain.handle('get-game-playtime', async (event, gameId) => getGamePlaytime(gameId));

  ipcMain.on('open-game', (event, gameId) => {
    const gamePath = path.join(buildsmithPath, gameId);
    // Find the preferred .exe file in the game directory
    const executablePath = getPreferredExecutable(gamePath, gameId);
    if (!executablePath) {
      event.sender.send('game-stopped', gameId);
      throw new Error('No .exe file found in game directory');
    }

    // Start tracking playtime
    startPlaytimeTracking(gameId);

    // Use spawn instead of exec for better process control
    const gameProcess = spawn(executablePath, [], {
      cwd: gamePath,
      env: process.env,
      detached: false, // Change to false to keep process tied to launcher
      stdio: 'ignore', // Ignore stdio to prevent hanging
      windowsHide: false, // Ensure process is visible
    });

    // Store the process with its PID
    runningGames.set(gameId, {
      process: gameProcess,
      pid: gameProcess.pid,
    });

    // Handle process exit
    gameProcess.on('exit', code => {
      console.log(`Game process exited with code ${code}`);
      runningGames.delete(gameId);
      stopPlaytimeTracking(gameId);
      event.sender.send('game-stopped', gameId);
    });

    // Handle process error
    gameProcess.on('error', err => {
      console.error('Failed to start game process:', err);
      runningGames.delete(gameId);
      stopPlaytimeTracking(gameId);
      event.sender.send('game-stopped', gameId);
    });

    event.sender.send('game-started', gameId);
  });

  ipcMain.on('stop-game', (event, gameId) => {
    const gameInfo = runningGames.get(gameId);
    if (gameInfo) {
      // Listen for process exit (only once)
      const onExit = () => {
        runningGames.delete(gameId);
        stopPlaytimeTracking(gameId);
        event.sender.send('game-stopped', gameId);
      };
      gameInfo.process.once('exit', onExit);

      try {
        gameInfo.process.kill();

        setTimeout(() => {
          // Check if process is still running before calling taskkill
          try {
            process.kill(gameInfo.pid, 0); // throws if not running
          } catch (e) {
            // Process is already dead, do not call taskkill
            return;
          }
          // If we get here, process is still running, so force kill
          const taskkill = spawn('taskkill', ['/F', '/T', '/PID', gameInfo.pid.toString()]);
          taskkill.on('exit', code => {
            if (code === 0) {
              console.log(`Successfully killed process ${gameInfo.pid}`);
            } else {
              console.log(`Process ${gameInfo.pid} was already terminated or could not be found.`);
            }
            runningGames.delete(gameId);
            stopPlaytimeTracking(gameId);
            event.sender.send('game-stopped', gameId);
          });
          taskkill.on('error', err => {
            console.error('Error executing taskkill:', err);
            runningGames.delete(gameId);
            stopPlaytimeTracking(gameId);
            event.sender.send('game-stopped', gameId);
          });
        }, 1000);
      } catch (err) {
        console.error('Error in stop-game:', err);
        runningGames.delete(gameId);
        stopPlaytimeTracking(gameId);
        event.sender.send('game-stopped', gameId);
      }
    }
  });

  ipcMain.handle('is-game-running', (event, gameId) => runningGames.has(gameId));

  ipcMain.on('open-install-location', (event, gameId) => {
    const gamePath = path.join(buildsmithPath, gameId);
    exec(`explorer "${gamePath}"`);
  });

  ipcMain.on('show-context-menu', (event, gameId, position) => {
    showContextMenu(event, gameId, position);
  });
  ipcMain.on('uninstall-game', (event, gameId) => {
    uninstallGame(gameId);
  });

  ipcMain.handle('get-cached-games', async () => {
    const mainWindow = windowStore.getMainWindow();
    if (mainWindow) {
      const games = await mainWindow.webContents.executeJavaScript(
        'localStorage.getItem("localGames")'
      );
      return games ? JSON.parse(games) : [];
    }
    return [];
  });

  ipcMain.handle('cache-games-locally', (event, games) => {
    const mainWindow = windowStore.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(
        `localStorage.setItem('localGames', '${JSON.stringify(games)}')`
      );
    }
  });

  ipcMain.handle('get-local-games', async () => {
    const mainWindow = windowStore.getMainWindow();
    if (mainWindow) {
      return await mainWindow.webContents.executeJavaScript('localStorage.getItem("localGames")');
    }
    return null;
  });

  // Launcher Actions
  ipcMain.on('close-window', () => {
    const mainWindow = windowStore.getMainWindow();
    if (mainWindow && runningGames.size > 0) {
      mainWindow.webContents.send('show-notification', {
        title: 'Cannot Close Launcher',
        body: 'Please stop all running games before closing the launcher.',
      });
      return;
    }
    if (mainWindow) {
      mainWindow.close();
    }
  });

  // Add window close prevention
  app.on('window-all-closed', e => {
    if (runningGames.size > 0) {
      e.preventDefault();
      const mainWindow = windowStore.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send('show-notification', {
          title: 'Cannot Close Launcher',
          body: 'Please stop all running games before closing the launcher.',
        });
      }
    } else {
      app.quit();
    }
  });

  // Add cleanup handler for when the app is quitting
  app.on('before-quit', () => {
    // Force kill all running games
    runningGames.forEach((gameInfo, gameId) => {
      try {
        // Try normal kill first
        gameInfo.process.kill();

        // Force kill with taskkill after a short delay
        setTimeout(() => {
          try {
            process.kill(gameInfo.pid, 0); // Check if process is still running
            const taskkill = spawn('taskkill', ['/F', '/T', '/PID', gameInfo.pid.toString()]);
            taskkill.on('error', err => {
              console.error(`Error force killing game ${gameId}:`, err);
            });
          } catch (e) {
            // Process is already dead, no need to force kill
          }
        }, 1000);
      } catch (err) {
        console.error(`Error killing game ${gameId}:`, err);
      }
    });
  });

  ipcMain.on('reload-window', () => {
    const mainWindow = windowStore.getMainWindow();
    if (mainWindow) {
      mainWindow.reload();
    }
  });
  ipcMain.on('minimize-window', () => {
    const mainWindow = windowStore.getMainWindow();
    if (mainWindow) {
      mainWindow.minimize();
    }
  });
  ipcMain.handle('get-app-version', () => app.getVersion());
  ipcMain.on('check-for-updates', () => {
    updater.checkForUpdates();
  });
  ipcMain.on('download-update', () => {
    updater.downloadUpdate();
  });
  ipcMain.handle('get-settings', () => {
    const settings = loadSettings();
    return {
      windowSize: `${settings.windowSize.width}x${settings.windowSize.height}`,
      language: settings.language || 'en',
      autoUpdate: settings.autoUpdate !== false,
      notifications: settings.notifications !== false,
      minimizeToTray: settings.minimizeToTray !== false,
      launchOnStartup: settings.launchOnStartup || false,
      downloadPath: settings.downloadPath || '',
      maxConcurrentDownloads: settings.maxConcurrentDownloads || 3,
      cacheSize: settings.cacheSize || '5GB',
      customCursor: settings.customCursor || false,
    };
  });
  ipcMain.handle('update-settings', (event, newSettings) => {
    const currentSettings = loadSettings();
    const updatedSettings = { ...currentSettings };

    // Handle window size separately
    if (newSettings.windowSize) {
      const [width, height] = newSettings.windowSize.split('x').map(Number);
      updatedSettings.windowSize = { width, height };
      const mainWindow = windowStore.getMainWindow();
      if (mainWindow) {
        mainWindow.setContentSize(width, height);
        mainWindow.center();
      }
    }

    // Update other settings
    Object.keys(newSettings).forEach(key => {
      if (key !== 'windowSize') {
        updatedSettings[key] = newSettings[key];
      }
    });

    saveSettings(updatedSettings);

    // Handle launch on startup
    if (typeof updatedSettings.launchOnStartup !== 'undefined') {
      app.setLoginItemSettings({
        openAtLogin: !!updatedSettings.launchOnStartup,
        path: process.execPath,
      });
    }

    // Handle auto update
    if (typeof updatedSettings.autoUpdate !== 'undefined') {
      if (updatedSettings.autoUpdate) {
        autoUpdater.checkForUpdates();
      }
    }

    // Send settings update directly to renderer
    const mainWindow = windowStore.getMainWindow();
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('settings-updated', updatedSettings);
    }

    return updatedSettings;
  });
  ipcMain.handle('get-window-size', () => {
    const mainWindow = windowStore.getMainWindow();
    if (mainWindow) {
      const { width, height } = mainWindow.getContentBounds();
      return {
        width: Math.round(width / 10) * 10,
        height: Math.round(height / 10) * 10,
      };
    }
    return { width: 1280, height: 720 };
  });
  ipcMain.on('set-window-size-and-center', (event, width, height) => {
    const mainWindow = windowStore.getMainWindow();
    if (mainWindow) {
      mainWindow.setContentSize(Math.round(width / 10) * 10, Math.round(height / 10) * 10);
      mainWindow.center();
      const settings = loadSettings();
      settings.windowSize = {
        width: Math.round(width / 10) * 10,
        height: Math.round(height / 10) * 10,
      };
      saveSettings(settings);
    } else {
      console.log('Main window is not accessible.');
    }
  });
  ipcMain.on('show-notification', (event, data) => {
    const mainWindow = BrowserWindow.getFocusedWindow() || windowStore.getMainWindow();
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('show-notification', data);
    } else {
      console.log('No main window found to send notification');
    }
  });

  // Add settings-updated event handler
  ipcMain.on('settings-updated', (event, settings) => {
    const mainWindow = windowStore.getMainWindow();
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('settings-updated', settings);
    }
  });

  // Github API
  ipcMain.handle('fetch-github-workflows', async (event, repoFullName, accessToken) => {
    try {
      const response = await fetch(`https://api.github.com/repos/${repoFullName}/actions/runs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();
      return data.workflow_runs || [];
    } catch (error) {
      console.error('❌ Error fetching workflows:', error);
      return [];
    }
  });
  ipcMain.handle('fetch-github-logs', async (event, repoFullName, runId, accessToken) => {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${repoFullName}/actions/runs/${runId}/logs`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const zip = new AdmZip(Buffer.from(buffer));

      let extractedLogs = '';
      zip.getEntries().forEach(entry => {
        if (!entry.isDirectory && entry.entryName.endsWith('.txt')) {
          extractedLogs += `\n--- ${entry.entryName} ---\n${zip.readAsText(entry)}`;
        }
      });

      return extractedLogs || 'No logs found in archive.';
    } catch (error) {
      console.error('❌ Error extracting logs:', error);
      return 'Failed to retrieve logs.';
    }
  });

  // Handle opening external URLs
  ipcMain.handle('open-external-url', async (event, url) => {
    try {
      // Only allow http(s) URLs
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Blocked non-http(s) protocol');
      }
      if (
        !['github.com', 'patreon.com', 'buildsmith.app', 'diabolical.services'].some(domain =>
          parsed.hostname.endsWith(domain)
        )
      ) {
        throw new Error('Blocked domain');
      }
      await shell.openExternal(url);
      return true;
    } catch (error) {
      console.error('Error opening external URL:', error);
      return false;
    }
  });

  ipcMain.handle('get-unity-packages', async () => {
    const unityDir = path.join(process.env.APPDATA || '', 'Unity', 'Asset Store-5.x');
    return getAllUnityPackages(unityDir);
  });

  ipcMain.handle('read-file', async (event, filePath) => {
    try {
      return await fs.promises.readFile(filePath);
    } catch (error) {
      console.error('Error reading file:', error);
      throw error;
    }
  });

  let lastDownloadedPath = null;

  ipcMain.handle('download-unity-package', async (event, url, defaultFilename) => {
    const window = BrowserWindow.getFocusedWindow();
    // Create a temporary directory for downloads
    const tempDir = path.join(app.getPath('temp'), 'buildsmith-unity-packages');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Generate a unique filename
    const filename = `${defaultFilename || 'UnityPackage'}-${Date.now()}.unitypackage`;
    const filePath = path.join(tempDir, filename);

    try {
      await download(window, url, {
        directory: tempDir,
        filename: filename,
        onProgress: progress => {
          // Optionally, send progress to renderer
          event.sender.send('unity-package-download-progress', { percent: progress.percent });
        },
      });
      lastDownloadedPath = filePath;
      return true;
    } catch (error) {
      console.error('Error downloading Unity package:', error);
      return false;
    }
  });

  // Add handler to get last downloaded path
  ipcMain.handle('get-last-downloaded-path', () => {
    return lastDownloadedPath;
  });

  // Add handler to check if Unity Editor is running
  ipcMain.handle('is-unity-editor-running', async () => {
    return new Promise(resolve => {
      exec('tasklist /FI "IMAGENAME eq Unity.exe" /FO CSV', (error, stdout) => {
        if (error) {
          console.error('Error checking Unity Editor:', error);
          resolve({ isRunning: false, pid: null });
          return;
        }

        const lines = stdout.split('\n');
        if (lines.length > 1 && lines[1].toLowerCase().includes('unity.exe')) {
          // Header + at least one process
          const processInfo = lines[1].split(',');
          const pid = processInfo[1]?.replace(/"/g, '');
          resolve({ isRunning: true, pid: pid || null });
        } else {
          resolve({ isRunning: false, pid: null });
        }
      });
    });
  });

  // Add handler to install Unity package
  ipcMain.handle('install-unity-package', async (event, packagePath) => {
    return new Promise((resolve, reject) => {
      exec(`"${packagePath}"`, error => {
        if (error) {
          console.error('Error installing Unity package:', error);
          reject(error);
          return;
        }
        resolve(true);
      });
    });
  });

  // Add handler to delete file
  ipcMain.handle('delete-file', async (event, filePath) => {
    try {
      await fs.promises.unlink(filePath);
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  });

  // Steam App ID file creation
  ipcMain.handle('create-steam-appid-file', async (event, gameId, steamId) => {
    try {
      const gamePath = path.join(buildsmithPath, gameId);
      const steamAppIdPath = path.join(gamePath, 'steam_appid.txt');

      // Check if game directory exists
      if (!fs.existsSync(gamePath)) {
        throw new Error(`Game directory does not exist: ${gamePath}`);
      }

      // Write the Steam App ID to the file
      await fs.promises.writeFile(steamAppIdPath, steamId, 'utf8');

      console.log(`Created steam_appid.txt for game ${gameId} with App ID: ${steamId}`);
      return true;
    } catch (error) {
      console.error('Error creating Steam App ID file:', error);
      throw error;
    }
  });
}

module.exports = {
  initIPCHandlers,
};
