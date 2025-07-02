import axios from 'axios';
import Cookies from 'js-cookie';

/**
 * Automatically adds a game to the user's library if it's public and not already in the library
 * @param {string} gameId - The game ID to add
 * @param {Array} currentLibraryGames - Current library games array
 * @param {Function} onLibraryUpdate - Callback to update library state
 * @returns {Promise<boolean>} - True if game was added, false otherwise
 */
export const autoAddGameToLibrary = async (gameId, currentLibraryGames, onLibraryUpdate) => {
  try {
    // Check if game is already in library
    if (currentLibraryGames.includes(gameId)) {
      console.log(`Game ${gameId} is already in library`);
      return false;
    }

    console.log(`Attempting to auto-add game ${gameId} to library`);

    // Get game details to check if it's public
    let gameDetails;
    try {
      const gameResponse = await axios.get(`/get-game-by-id/${gameId}`);
      gameDetails = gameResponse.data;

      // Check if game is public
      if (gameDetails.status !== 'public') {
        console.log(`Game ${gameId} is not public (status: ${gameDetails.status})`);
        return false;
      }
    } catch (error) {
      console.error(`Error fetching game details for ${gameId}:`, error);
      return false;
    }

    // Get session ID
    const sessionID = Cookies.get('sessionID');

    if (!sessionID) {
      // Offline mode: Add to localStorage library
      console.log(`Adding game ${gameId} to local library (offline mode)`);

      let localLibrary = [];
      try {
        localLibrary = JSON.parse(localStorage.getItem('localLibrary')) || [];
      } catch (e) {
        localLibrary = [];
      }

      if (!localLibrary.includes(gameId)) {
        // Store complete game details in localStorage
        const gameDetailsForStorage = {
          game_id: gameDetails.game_id,
          game_name: gameDetails.game_name,
          version: gameDetails.version || 'unknown',
          description: gameDetails.description || '',
          background_image_url: gameDetails.background_image_url || '',
          banner_image_url: gameDetails.banner_image_url || '',
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

        // Store in localLibrary array
        localLibrary.push(gameId);
        localStorage.setItem('localLibrary', JSON.stringify(localLibrary));

        // Store game details separately
        const gameDetailsKey = `game_${gameId}`;
        localStorage.setItem(gameDetailsKey, JSON.stringify(gameDetailsForStorage));

        // Update cached games
        if (window.electronAPI?.cacheGamesLocally) {
          let cachedGames = [];
          try {
            cachedGames = await window.electronAPI.getCachedGames();
          } catch (e) {
            cachedGames = [];
          }
          if (!cachedGames.find(g => g.game_id === gameId)) {
            cachedGames.push(gameDetailsForStorage);
            window.electronAPI.cacheGamesLocally(cachedGames);
          }
        }

        if (window.electronAPI) {
          window.electronAPI.showCustomNotification(
            'Game Added',
            'Game has been automatically added to your local library!'
          );
        }

        // Update the library state immediately
        onLibraryUpdate([...localLibrary]);
        return true;
      }
      return false;
    }

    // Online mode: Add to server library
    console.log(`Adding game ${gameId} to server library (online mode)`);

    const response = await axios.post(
      '/add-to-library',
      { game_id: gameId },
      { headers: { SessionID: sessionID } }
    );

    if (response.status === 200) {
      // Store complete game details in localStorage even for online mode
      const gameDetailsForStorage = {
        game_id: gameDetails.game_id,
        game_name: gameDetails.game_name,
        version: gameDetails.version || 'unknown',
        description: gameDetails.description || '',
        background_image_url: gameDetails.background_image_url || '',
        banner_image_url: gameDetails.banner_image_url || '',
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

      // Store game details
      const gameDetailsKey = `game_${gameId}`;
      localStorage.setItem(gameDetailsKey, JSON.stringify(gameDetailsForStorage));

      // Update cached games
      if (window.electronAPI?.cacheGamesLocally) {
        let cachedGames = [];
        try {
          cachedGames = await window.electronAPI.getCachedGames();
        } catch (e) {
          cachedGames = [];
        }
        if (!cachedGames.find(g => g.game_id === gameId)) {
          cachedGames.push(gameDetailsForStorage);
          window.electronAPI.cacheGamesLocally(cachedGames);
        }
      }

      if (window.electronAPI) {
        window.electronAPI.showCustomNotification(
          'Game Added',
          'Game has been automatically added to your library!'
        );
      }

      // Get current library games and add the new one
      const currentLibrary = JSON.parse(localStorage.getItem('localLibrary')) || [];
      const updatedLibrary = [...currentLibrary, gameId];
      onLibraryUpdate(updatedLibrary);

      return true;
    }

    return false;
  } catch (error) {
    console.error('Error auto-adding game to library:', error);

    // Don't show error notification for auto-add failures to avoid spam
    // The user can still manually add the game if needed

    return false;
  }
};
