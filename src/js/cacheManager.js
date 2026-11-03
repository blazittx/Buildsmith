const { ipcMain } = require('electron');
const windowStore = require('./windowStore');

function cacheGamesLocally(games) {
  try {
    const mainWindow = windowStore.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(
        `localStorage.setItem('localGames', ${JSON.stringify(JSON.stringify(games))})`
      );
      console.log('✅ Cached games written to localStorage.');
    }
  } catch (err) {
    console.error('❌ Failed to cache games:', err);
  }
}

async function readCachedGames() {
  try {
    const mainWindow = windowStore.getMainWindow();
    if (mainWindow) {
      const games = await mainWindow.webContents.executeJavaScript(
        'localStorage.getItem("localGames")'
      );
      if (!games) {
        console.log('No games found in localStorage');
        return [];
      }
      const parsedGames = JSON.parse(games);
      if (!Array.isArray(parsedGames)) {
        console.error('Invalid games data in localStorage');
        return [];
      }
      return parsedGames;
    }
    return [];
  } catch (err) {
    console.error('❌ Failed to read cached games from localStorage:', err);
    return [];
  }
}

module.exports = { cacheGamesLocally, readCachedGames };
