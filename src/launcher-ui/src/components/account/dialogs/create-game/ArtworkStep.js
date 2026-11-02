import { Stack } from '@mui/material';
import ImageUploader from '../../../common/ImageUploader';
import ScreenshotUploader from '../../../common/ScreenshotUploader';
import { PreviewCard } from './formStyles';

export default function ArtworkStep({
  gameBackgroundUrl,
  setGameBackgroundUrl,
  uploading,
  setUploading,
  screenshots,
  setScreenshots,
  uploadingScreenshots,
  setUploadingScreenshots,
  uploadHeaders,
  previewGame,
}) {
  return (
    <Stack direction="row" gap={3} alignItems="flex-start">
      <Stack gap={2} sx={{ flex: 1 }}>
        <ImageUploader
          onUpload={url => setGameBackgroundUrl(url || '')}
          currentImageUrl={gameBackgroundUrl}
          uploading={uploading}
          setUploading={setUploading}
          headers={uploadHeaders}
        />
        <ScreenshotUploader
          screenshots={screenshots}
          onScreenshotsChange={setScreenshots}
          uploading={uploadingScreenshots}
          setUploading={setUploadingScreenshots}
          headers={uploadHeaders}
          maxScreenshots={10}
        />
      </Stack>
      <PreviewCard game={previewGame} />
    </Stack>
  );
}
