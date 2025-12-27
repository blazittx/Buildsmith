import React, { useEffect, useState } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  Stack,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import SaveIcon from '@mui/icons-material/Save';
import GameCard from '../../GameCard';
import Cookies from 'js-cookie';
import { colors } from '../../../theme/colors';
import ImageUploader from '../../common/ImageUploader';
import ScreenshotUploader from '../../common/ScreenshotUploader';

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    maxHeight: 'none',
    minWidth: '800px',
    background: colors.background,
    boxShadow: 'none',
    margin: 0,
  },
}));

const EditGameDialog = ({ open, handleClose, game, onSave }) => {
  const [gameName, setGameName] = useState(game.game_name);
  const [gameId, setGameId] = useState(game.game_id);
  const [gameBackgroundUrl, setGameBackgroundUrl] = useState(game.background_image_url || '');
  const [gameDescription, setGameDescription] = useState(game.description || '');
  const [gameVersion, setGameVersion] = useState(game.version || '');
  const [gameStatus, setGameStatus] = useState(game.status || 'public');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [screenshots, setScreenshots] = useState(game.screenshots || []);
  const [uploadingScreenshots, setUploadingScreenshots] = useState(false);

  useEffect(() => {
    setGameName(game.game_name);
    setGameBackgroundUrl(game.background_image_url || '');
    setGameDescription(game.description || '');
    setGameVersion(game.version || '');
    setGameStatus(game.status || 'public');
    setScreenshots(game.screenshots || []);
  }, [game]);

  useEffect(() => {
    const hasNameChanged = gameName !== game.game_name;
    const hasDescriptionChanged = gameDescription !== (game.description || '');
    const hasBackgroundChanged = gameBackgroundUrl !== (game.background_image_url || '');
    const hasStatusChanged = gameStatus !== (game.status || 'public');
    const hasScreenshotsChanged = JSON.stringify(screenshots) !== JSON.stringify(game.screenshots || []);
    setHasChanges(
      hasNameChanged || hasDescriptionChanged || hasBackgroundChanged || hasStatusChanged || hasScreenshotsChanged
    );
  }, [gameName, gameDescription, gameBackgroundUrl, gameStatus, screenshots, game]);

  const handleSave = async () => {
    setIsSaving(true);
    const sessionID = Cookies.get('sessionID');
    if (!sessionID) {
      console.error('❌ No session ID found.');
      return;
    }

    const updatedGame = {
      session_id: sessionID,
      game_id: gameId,
      game_name: gameName.trim(),
      background_image_url: gameBackgroundUrl.trim(),
      description: gameDescription.trim(),
      version: gameVersion.trim(),
      status: gameStatus,
      team_name: game.team_name,
      is_manual_upload: false,
      screenshots: screenshots.length > 0 ? screenshots : undefined,
    };

    console.log('📤 Sending game update request:', updatedGame);

    try {
      const response = await fetch('/update-game', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedGame),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Update failed:', errorData);
        if (window.electronAPI) {
          window.electronAPI.showCustomNotification(
            'Edit Game Failed',
            errorData.error || 'Please try again later'
          );
        }
        throw new Error(errorData.error || 'Failed to update game.');
      }

      console.log('✅ Game updated successfully:', updatedGame);

      if (window.electronAPI) {
        window.electronAPI.showCustomNotification(
          'Game Updated',
          'Your game was successfully updated!'
        );
      }

      onSave({
        ...game,
        ...updatedGame,
      });
      handleClose();
    } catch (err) {
      console.error('❌ Error updating game:', err);
      if (window.electronAPI) {
        window.electronAPI.showCustomNotification('Edit Game Failed', 'Please try again later');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <StyledDialog open={open} onClose={handleClose} aria-labelledby="edit-game-dialog-title">
      <DialogContent
        style={{ padding: '24px', width: '100%', border: '1px solid' + colors.border }}
      >
        <Stack display={'flex'} flexDirection={'row'} gap={'24px'}>
          <Stack spacing={2} alignItems="center">
            {/* Render Editable Game Card */}
            <GameCard
              style={{ aspectRatio: '63/88', outline: '1px solid' + colors.border }}
              game={{
                game_name: gameName,
                game_id: gameId,
                background_image_url: gameBackgroundUrl,
                description: gameDescription,
                version: gameVersion,
                status: gameStatus,
                team_name: game.team_name,
              }}
              isEditing={true}
              setGameName={setGameName}
              setGameId={setGameId}
              setGameBackgroundUrl={setGameBackgroundUrl}
              setGameDescription={setGameDescription}
            />
          </Stack>
          <Stack
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: '-webkit-fill-available',
              gap: '24px',
            }}
          >
            {/* Status Dropdown */}
            <FormControl fullWidth>
              <InputLabel id="game-status-label">Game Status</InputLabel>
              <Select
                labelId="game-status-label"
                value={gameStatus}
                label="Game Status"
                onChange={e => setGameStatus(e.target.value)}
                sx={{
                  color: colors.text,
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: colors.border,
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: colors.border,
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: colors.border,
                  },
                }}
              >
                <MenuItem value="public">Public</MenuItem>
                <MenuItem value="private">Private</MenuItem>
                <MenuItem value="archived">Archived</MenuItem>
              </Select>
            </FormControl>

            {/* Image Uploader */}
            <ImageUploader
              onUpload={url => {
                setGameBackgroundUrl(url);
                setHasChanges(true);
              }}
              currentImageUrl={gameBackgroundUrl}
              uploading={uploading}
              setUploading={setUploading}
              headers={{
                sessionID: Cookies.get('sessionID'),
                uploadUrl: 'https://cdn.diabolical.services/generateUploadUrl',
              }}
            />
            
            {/* Screenshot Uploader */}
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

            {/* Save Button */}
            <Button
              sx={{
                color: '#fff !important',
                backgroundColor: colors.button,
                outline: '1px solid' + colors.border,
                borderRadius: '4px',
                padding: '12px 16px',
                opacity: hasChanges ? 1 : 0.5,
                '&:hover': {
                  opacity: hasChanges ? 0.8 : 0.5,
                },
              }}
              onClick={handleSave}
              aria-label="save"
              startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </StyledDialog>
  );
};

export default EditGameDialog;
