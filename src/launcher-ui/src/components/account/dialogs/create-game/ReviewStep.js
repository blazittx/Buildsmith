import { LinearProgress, Stack, Typography } from '@mui/material';
import { colors } from '../../../../theme/colors';
import { patchStatusLabel } from '../../../../utils/publishPatch';
import { PreviewCard, ReviewRow } from './formStyles';

export default function ReviewStep({
  previewGame,
  gameName,
  gameId,
  selectedTeam,
  gameStatus,
  gameDescription,
  screenshotCount,
  buildLabel,
  isSaving,
  isUploading,
  uploadProgress,
  patchProgress,
}) {
  return (
    <Stack direction="row" gap={3} alignItems="flex-start">
      <PreviewCard game={previewGame} />
      <Stack sx={{ flex: 1 }}>
        <ReviewRow label="Name" value={gameName} />
        <ReviewRow label="Game ID" value={gameId} />
        <ReviewRow label="Team" value={selectedTeam} />
        <ReviewRow label="Visibility" value={gameStatus ? gameStatus.charAt(0).toUpperCase() + gameStatus.slice(1) : ''} />
        <ReviewRow label="Description" value={gameDescription} />
        <ReviewRow label="Screenshots" value={String(screenshotCount)} />
        <ReviewRow label="Build" value={buildLabel} />
        {(isSaving || isUploading) && (
          <Stack gap={1} sx={{ mt: 2 }}>
            <Typography sx={{ color: colors.text, fontSize: 14 }}>
              {patchProgress
                ? patchStatusLabel(patchProgress)
                : isUploading
                  ? `Uploading build… ${Math.round(uploadProgress)}%`
                  : 'Creating the game…'}
            </Typography>
            {isUploading && (
              <LinearProgress
                variant="determinate"
                value={
                  patchProgress?.totalBytes
                    ? (patchProgress.uploadedBytes / patchProgress.totalBytes) * 100
                    : uploadProgress
                }
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: '#222',
                  '& .MuiLinearProgress-bar': { backgroundColor: colors.primary },
                }}
              />
            )}
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}
