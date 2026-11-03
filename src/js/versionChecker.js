const cacheManager = require('./cacheManager');
const windowStore = require('./windowStore');

async function getLatestGameVersion(gameId) {
  try {
    // First try to get version from localStorage key 'game_<gameid>'
    const mainWindow = windowStore.getMainWindow();
    if (mainWindow) {
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(gameId || '')) {
        throw new Error('Unexpected game id');
      }
      const gameDetailsStr = await mainWindow.webContents.executeJavaScript(
        `localStorage.getItem(${JSON.stringify(`game_${gameId}`)})`
      );
      if (gameDetailsStr) {
        try {
          const gameDetails = JSON.parse(gameDetailsStr);
            if (gameDetails && /^\d+\.\d+\.\d+$/.test(gameDetails.version || '')) {
            console.log(`Using localStorage version for ${gameId}: ${gameDetails.version}`);
            const latestVersionUrl = `https://cdn.diabolical.services/R2/${gameId}/Versions/Build-StandaloneWindows64-${gameDetails.version}.zip`;
            return { latestVersion: gameDetails.version, latestVersionUrl };
          }
        } catch (e) {
          console.warn(`Could not parse localStorage game details for ${gameId}`);
        }
      }
    }

    // Fallback to regular cached games
    const cachedGames = await cacheManager.readCachedGames();
    if (!Array.isArray(cachedGames)) {
      throw new Error('Invalid cached games data');
    }

    const game = cachedGames.find(g => g.game_id === gameId);

    if (!game || !game.version) {
      throw new Error(`No version information found for game ${gameId}`);
    }

    const latestVersion = game.version;
    console.log(`Using cached version for ${gameId}: ${latestVersion}`);

    // Use the new CDN domain for download URL
    const latestVersionUrl = `https://cdn.diabolical.services/R2/${gameId}/Versions/Build-StandaloneWindows64-${latestVersion}.zip`;
    console.log(`Constructed download URL: ${latestVersionUrl}`);

    return { latestVersion, latestVersionUrl };
  } catch (error) {
    console.error(`Failed to get game version for ${gameId}:`, error);
    throw error;
  }
}

module.exports = {
  getLatestGameVersion,
};
