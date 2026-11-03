import React, { useEffect, useRef, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Slide, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { colors } from '../theme/colors';

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

const ToastItem = ({ toast, timeout = 300, autoDismiss = 3000, onDownload, onDismiss }) => {
  const [show, setShow] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const messageOpenRef = useRef(false);

  useEffect(() => {
    // Trigger slide in after mount
    const timer = setTimeout(() => {
      setShow(true);
    }, 50);

    // Auto-dismiss after a specified duration by sliding out
    const autoTimer = setTimeout(() => {
      if (!messageOpenRef.current) setShow(false);
    }, autoDismiss);

    return () => {
      clearTimeout(timer);
      clearTimeout(autoTimer);
    };
  }, [autoDismiss]);

  // When the slide exit animation completes, notify the parent to remove this toast
  const handleExited = () => {
    onDismiss(toast.id);
  };

  // For the UPDATE button: trigger download and then slide out
  const handleDownload = () => {
    if (onDownload) {
      onDownload(toast.gameId);
    }
    setShow(false);
  };

  // For the CLOSE button: simply slide out
  const handleClose = () => {
    setShow(false);
  };

  const openMessage = () => {
    messageOpenRef.current = true;
    setMessageOpen(true);
  };

  const closeMessage = () => {
    messageOpenRef.current = false;
    setMessageOpen(false);
    setShow(false);
  };

  return (
    <>
    <Slide direction="left" in={show} timeout={timeout} onExited={handleExited}>
      <div
        className="toast-hover background relative rounded-sm shadow-lg transition-all duration-500 dialog outline"
        style={{
          justifyContent: 'space-between',
          padding: 0,
          height: '70px',
          outlineColor: colors.border,
          backgroundColor: colors.background,
          color: colors.text,
          width: 'fit-content',
        }}
      >
        <div className="flex items-center justify-between h-full gap-3">
          <div
            className="p-3"
            onClick={openMessage}
            style={{ maxWidth: 320, minWidth: 0, cursor: 'pointer' }}
          >
            <strong
              title={toast.title}
              style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {toast.title}
            </strong>
            <p
              className="m-0"
              title={toast.body}
              style={{
                color: colors.border,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {toast.body}
            </p>
          </div>
          {toast.gameId ? (
            <button
              className="relative h-full p-3 rounded-r-sm border-none transition-all duration-200 cursor-pointer whitespace-nowrap overflow-hidden bg-[var(--background)] text-[var(--text)] toaster-button hover:backdrop-invert hover:bg-[var(--text)] hover:text-[var(--background)]"
              onClick={handleDownload}
            >
              UPDATE
            </button>
          ) : (
            <button
              className="relative h-full p-3 rounded-r-sm border-none transition-all duration-200 cursor-pointer whitespace-nowrap overflow-hidden bg-[var(--background)] text-[var(--text)] toaster-button hover:backdrop-invert hover:bg-[var(--text)] hover:text-[var(--background)]"
              onClick={handleClose}
            >
              DISMISS
            </button>
          )}
        </div>
      </div>
    </Slide>
    <StyledDialog open={messageOpen} onClose={closeMessage}>
      <DialogTitle
        className="dialog"
        sx={{
          color: colors.text,
          borderBottom: '1px solid' + colors.border,
          padding: '16px 24px',
          height: 'fit-content',
        }}
      >
        {toast.title}
      </DialogTitle>
      <DialogContent sx={{ padding: '24px !important', backgroundColor: colors.background }}>
        <Typography sx={{ color: colors.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {toast.body}
        </Typography>
      </DialogContent>
      <DialogActions
        className="dialog"
        sx={{
          padding: '16px 24px',
          borderTop: '1px solid' + colors.border,
          gap: '12px',
        }}
      >
        <Button
          onClick={closeMessage}
          sx={{
            color: colors.text,
            backgroundColor: colors.background,
            outline: '1px solid' + colors.border,
            borderRadius: '4px',
            padding: '8px 16px',
            '&:hover': { backgroundColor: colors.button },
          }}
        >
          Close
        </Button>
      </DialogActions>
    </StyledDialog>
    </>
  );
};

export default ToastItem;
