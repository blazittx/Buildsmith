import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { colors } from '../../theme/colors';

const StyledDialog = styled(Dialog)({
  '& .MuiDialog-paper': {
    backgroundColor: colors.background,
    border: '1px solid' + colors.border,
    borderRadius: '4px',
    minWidth: '400px',
    maxWidth: '500px',
    margin: '16px',
  },
});

const meaning =
  'Beta access lets you publish games and builds. You also get 3 invites of your own. This link works once.';

export default function BetaInviteDialog({ notice, loggedIn, onClose }) {
  if (!notice) return null;
  const name = notice.inviter || 'A beta tester';
  const showMeaning = notice.status === 'ready' || notice.status === 'accepted';
  let lead = `${name} invited you to the Buildsmith beta.`;
  if (notice.status === 'accepted') lead = `${name} invited you. You now have beta access.`;
  if (notice.status === 'already') {
    lead = `${name} invited you. You already have beta access, so this link was not used.`;
  }
  if (notice.status === 'used') lead = 'This invite was already used.';
  if (notice.status === 'invalid') lead = notice.error || 'This invite link is not valid.';

  return (
    <StyledDialog open onClose={onClose}>
      <DialogTitle
        className="dialog"
        sx={{
          color: colors.text,
          borderBottom: '1px solid' + colors.border,
          padding: '16px 24px',
        }}
      >
        Beta invite
      </DialogTitle>
      <DialogContent sx={{ padding: '24px !important', backgroundColor: colors.background }}>
        <Typography sx={{ color: colors.text }}>{lead}</Typography>
        {showMeaning ? (
          <Typography sx={{ color: colors.text, opacity: 0.7, marginTop: '12px' }}>{meaning}</Typography>
        ) : null}
        {notice.status === 'ready' && !loggedIn ? (
          <Typography sx={{ color: colors.text, marginTop: '12px' }}>Sign in to accept it.</Typography>
        ) : null}
      </DialogContent>
      <DialogActions
        className="dialog"
        sx={{ padding: '16px 24px', borderTop: '1px solid' + colors.border }}
      >
        <Button
          onClick={onClose}
          sx={{
            color: colors.text,
            backgroundColor: colors.background,
            outline: '1px solid' + colors.border,
            borderRadius: '4px',
            padding: '8px 16px',
            '&:hover': { backgroundColor: colors.button },
          }}
        >
          {notice.status === 'ready' && !loggedIn ? 'Sign in' : 'Continue'}
        </Button>
      </DialogActions>
    </StyledDialog>
  );
}
