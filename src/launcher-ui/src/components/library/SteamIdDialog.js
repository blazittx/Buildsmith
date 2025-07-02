import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogActions, TextField, Button, Stack } from '@mui/material';
import { styled } from '@mui/material/styles';
import { colors } from '../../theme/colors';

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    border: '1px solid' + colors.border,
    borderRadius: '4px',
  },
}));

const SteamIdDialog = ({ open, onClose, onConfirm, gameName }) => {
  const [steamId, setSteamId] = useState('');

  const handleConfirm = () => {
    if (steamId.trim()) {
      onConfirm(steamId.trim());
      setSteamId('');
      onClose();
    }
  };

  const handleClose = () => {
    setSteamId('');
    onClose();
  };

  return (
    <StyledDialog open={open} onClose={handleClose} aria-labelledby="steam-id-dialog-title">
      <DialogTitle className="dialog" id="steam-id-dialog-title">
        Add Steam Integration
      </DialogTitle>
      <Stack className="dialog backdrop-invert">
        <Stack className={'gap-3'}>
          <TextField
            autoFocus
            fullWidth
            label="Steam App ID"
            value={steamId}
            onChange={e => setSteamId(e.target.value)}
            placeholder="e.g., 730 (for Counter-Strike 2)"
            variant="outlined"
            sx={{
              borderRadius: '8px',
              '& .MuiOutlinedInput-root': {
                backgroundColor: colors.background,
                color: colors.text,
                border: 'none',
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
        </Stack>
      </Stack>
      <DialogActions className="dialog" sx={{ padding: '12px' }}>
        <Button
          sx={{
            color: colors.text,
            backgroundColor: colors.background,
            outline: '1px solid' + colors.border,
            borderRadius: '4px',
            padding: '12px',
          }}
          onClick={handleConfirm}
          disabled={!steamId.trim()}
        >
          Add Steam ID
        </Button>
      </DialogActions>
    </StyledDialog>
  );
};

export default SteamIdDialog;
