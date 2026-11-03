import { Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import { colors } from '../../../../theme/colors';

export const STEPS = [
  { id: 'details', label: 'Details', hint: 'Name the game and choose who it belongs to.' },
  { id: 'artwork', label: 'Artwork', hint: 'Add a cover image and optional screenshots.' },
  { id: 'build', label: 'Build', hint: 'Connect a GitHub repo or upload a ZIP build.' },
  { id: 'review', label: 'Review', hint: 'Check everything, then create the game.' },
];

export const isGameId = id => /^[a-z0-9]{1,20}$/.test(id);
export const isVersion = version => /^\d+\.\d+\.\d+$/.test(version);

export const fieldSx = {
  '& .MuiOutlinedInput-root': {
    color: colors.text,
    fontSize: '15px',
    background: 'transparent',
  },
  '& .MuiOutlinedInput-notchedOutline': {
    border: '1px solid' + colors.border + ' !important',
    borderRadius: '4px',
  },
  '& .MuiFormLabel-root': { color: '#888 !important' },
  '& .MuiFormHelperText-root': { color: '#888' },
};

export const selectSx = {
  color: colors.text,
  background: 'transparent',
  '& .MuiOutlinedInput-notchedOutline': {
    border: '1px solid' + colors.border + ' !important',
    borderRadius: '4px',
  },
  '& .MuiSelect-icon': { color: colors.text },
};

export const menuProps = {
  PaperProps: {
    sx: {
      backgroundColor: '#111',
      color: colors.text,
      border: '1px solid ' + colors.border,
    },
  },
};

export const primaryButtonSx = {
  backgroundColor: colors.primary,
  color: '#041204',
  textTransform: 'none',
  borderRadius: '4px',
  padding: '8px 16px',
  fontWeight: 700,
  '&:hover': { backgroundColor: colors.primaryHover },
  '&.Mui-disabled': { backgroundColor: '#1c3d1a', color: '#6d6d6d' },
};

export const ghostButtonSx = {
  backgroundColor: 'transparent',
  color: colors.text,
  border: '1px solid ' + colors.border,
  textTransform: 'none',
  borderRadius: '4px',
  padding: '8px 16px',
  '&:hover': { backgroundColor: '#161616', borderColor: colors.text },
  '&.Mui-disabled': { color: '#555', borderColor: '#2a2a2a' },
};

export const StyledDialog = styled(Dialog)({
  '& .MuiBackdrop-root': { backgroundColor: 'rgba(0, 0, 0, 0.72)' },
  '& .MuiDialog-paper': {
    width: '840px',
    maxWidth: 'calc(100vw - 80px)',
    height: 'min(680px, calc(100vh - 96px))',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: colors.background,
    backgroundImage:
      'radial-gradient(rgba(87, 87, 87, 0.3) 1px, transparent 1px), radial-gradient(rgba(87, 87, 87, 0.3) 1px, transparent 1px)',
    backgroundSize: '20px 20px',
    animation: 'moveBackground 3s linear infinite',
    border: '1px solid ' + colors.border,
    borderRadius: '4px',
    boxShadow: 'none',
    margin: '48px 16px',
  },
});

export function PreviewCard({ game }) {
  return (
    <div
      style={{
        width: 200,
        flexShrink: 0,
        aspectRatio: '63/88',
        borderRadius: 4,
        border: '1px solid ' + colors.border,
        backgroundColor: '#121212',
        backgroundImage: game.background_image_url ? `url("${game.background_image_url}")` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        alignItems: 'flex-end',
        padding: 12,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.15) 55%)',
        }}
      />
      <div style={{ position: 'relative' }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, textTransform: 'uppercase', lineHeight: 1.2 }}>
          {game.game_name}
        </div>
        {game.description ? (
          <div
            style={{
              color: '#9a9a9a',
              fontSize: 12,
              marginTop: 6,
              lineHeight: 1.35,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {game.description}
          </div>
        ) : null}
        <div style={{ color: colors.primary, fontSize: 12, marginTop: 8 }}>v{game.version}</div>
      </div>
    </div>
  );
}

export function ReviewRow({ label, value }) {
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="baseline"
      sx={{ gap: 2, py: 1.25, borderBottom: '1px solid ' + colors.border }}
    >
      <Typography sx={{ color: '#888', fontSize: 13 }}>{label}</Typography>
      <Typography sx={{ color: colors.text, fontSize: 14, textAlign: 'right', wordBreak: 'break-word' }}>
        {value || '—'}
      </Typography>
    </Stack>
  );
}
