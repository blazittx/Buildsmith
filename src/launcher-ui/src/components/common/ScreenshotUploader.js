import React, { useRef, useState } from 'react';
import { CircularProgress, Stack, Box, IconButton, Typography } from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { colors } from '../../theme/colors';
import { uploadToCdn } from '../../utils/cdnUpload';
import { notify, uploadErrorMessage } from '../../utils/notify';

const ScreenshotUploader = ({
  screenshots = [],
  onScreenshotsChange,
  uploading,
  setUploading,
  headers,
  style = {},
  maxScreenshots = 10,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState(null);
  const fileInputRef = useRef();

  const handleFileUpload = async (file, index = null) => {
    if (index === null && screenshots.length >= maxScreenshots) {
      notify('Upload Limit Reached', `You can only upload up to ${maxScreenshots} screenshots.`);
      return;
    }

    setUploading(true);
    if (index !== null) {
      setUploadingIndex(index);
    }

    try {
      const { publicUrl: imageUrl } = await uploadToCdn(file, { sessionID: headers.sessionID });

      if (index !== null) {
        // Replace screenshot at index
        const newScreenshots = [...screenshots];
        newScreenshots[index] = imageUrl;
        onScreenshotsChange(newScreenshots);
      } else {
        // Add new screenshot
        onScreenshotsChange([...screenshots, imageUrl]);
      }

      notify('Upload Complete', 'Screenshot uploaded successfully.');
    } catch (err) {
      console.error('Upload failed:', err);
      notify('Upload Failed', uploadErrorMessage(err, 'Could not upload your screenshot.'));
    } finally {
      setUploading(false);
      setUploadingIndex(null);
    }
  };

  const handleDragOver = e => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = e => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = e => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    
    if (files.length === 0) return;
    
    if (screenshots.length + files.length > maxScreenshots) {
      notify('Upload Limit', `You can only upload up to ${maxScreenshots} screenshots total.`);
      return;
    }

    // Upload files sequentially
    files.forEach((file, idx) => {
      setTimeout(() => {
        handleFileUpload(file);
      }, idx * 100); // Small delay between uploads
    });
  };

  const handleFileSelect = e => {
    const files = Array.from(e.target.files).filter(file => file.type.startsWith('image/'));
    
    if (files.length === 0) return;
    
    if (screenshots.length + files.length > maxScreenshots) {
      notify('Upload Limit', `You can only upload up to ${maxScreenshots} screenshots total.`);
      return;
    }

    // Upload files sequentially
    files.forEach((file, idx) => {
      setTimeout(() => {
        handleFileUpload(file);
      }, idx * 100);
    });
    
    // Reset input
    e.target.value = '';
  };

  const handleDelete = index => {
    onScreenshotsChange(screenshots.filter((_, i) => i !== index));
  };

  const moveScreenshot = (index, direction) => {
    const next = index + direction;
    if (next < 0 || next >= screenshots.length) return;
    const updated = [...screenshots];
    [updated[index], updated[next]] = [updated[next], updated[index]];
    onScreenshotsChange(updated);
  };

  const handleReplace = (index, file) => {
    handleFileUpload(file, index);
  };

  return (
    <Stack spacing={2} style={style}>
      <Typography variant="body2" sx={{ color: colors.text, opacity: 0.8 }}>
        Screenshots ({screenshots.length}/{maxScreenshots})
      </Typography>
      
      {/* Existing Screenshots Grid */}
      {screenshots.length > 0 && (
        <Box sx={{ containerType: 'inline-size' }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 2,
            maxHeight: 'calc((100cqw - 16px) * 9 / 16 + 16px)',
            overflowY: 'auto',
          }}
        >
          {screenshots.map((screenshot, index) => (
            <Box
              key={index}
              sx={{
                position: 'relative',
                aspectRatio: '16/9',
                borderRadius: '4px',
                overflow: 'hidden',
                border: `1px solid ${colors.border}`,
              }}
            >
              <Box
                component="img"
                src={screenshot}
                alt={`Screenshot ${index + 1}`}
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  display: 'flex',
                  gap: 0.5,
                  p: 0.5,
                  background: 'rgba(0, 0, 0, 0.6)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <IconButton
                  size="small"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.png,.jpg,.jpeg,.gif,.webp';
                    input.onchange = (e) => {
                      if (e.target.files[0]) {
                        handleReplace(index, e.target.files[0]);
                      }
                    };
                    input.click();
                  }}
                  disabled={uploading && uploadingIndex === index}
                  sx={{
                    color: colors.text,
                    '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
                    padding: '4px',
                  }}
                >
                  {uploading && uploadingIndex === index ? (
                    <CircularProgress size={16} />
                  ) : (
                    <UploadIcon sx={{ fontSize: 16 }} />
                  )}
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => handleDelete(index)}
                  disabled={uploading}
                  sx={{
                    color: '#ff4081',
                    '&:hover': { backgroundColor: 'rgba(255, 64, 129, 0.2)' },
                    padding: '4px',
                  }}
                >
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  display: 'flex',
                  gap: 0.5,
                  p: 0.5,
                  background: 'rgba(0, 0, 0, 0.6)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <IconButton
                  size="small"
                  aria-label="Move screenshot earlier"
                  onClick={() => moveScreenshot(index, -1)}
                  disabled={uploading || index === 0}
                  sx={{ color: colors.text, padding: '4px' }}
                >
                  <ArrowBackIcon sx={{ fontSize: 16 }} />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label="Move screenshot later"
                  onClick={() => moveScreenshot(index, 1)}
                  disabled={uploading || index === screenshots.length - 1}
                  sx={{ color: colors.text, padding: '4px' }}
                >
                  <ArrowForwardIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            </Box>
          ))}
        </Box>
        </Box>
      )}

      {/* Upload Area */}
      {screenshots.length < maxScreenshots && (
        <Stack
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="hover-effect"
          style={{
            height: '120px',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
            border: `2px dashed ${isDragging ? colors.button : colors.border}`,
            backgroundColor: isDragging ? `${colors.button}20` : 'transparent',
            backdropFilter: 'blur(10px)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            hidden
            type="file"
            accept=".png,.jpg,.jpeg,.gif,.webp"
            multiple
            ref={fileInputRef}
            onChange={handleFileSelect}
          />
          {uploading && uploadingIndex === null ? (
            <Stack alignItems="center" gap={1}>
              <CircularProgress size={24} />
              <span style={{ color: colors.text }}>Uploading...</span>
            </Stack>
          ) : (
            <Stack alignItems="center" gap={1}>
              <UploadIcon style={{ color: colors.border }} />
              <span style={{ color: colors.text }}>
                {screenshots.length === 0 ? 'Upload Screenshots' : 'Add More Screenshots'}
              </span>
              <span style={{ color: colors.border, fontSize: '12px' }}>
                Supports PNG, JPG, GIF, WEBP (up to {maxScreenshots - screenshots.length} more)
              </span>
            </Stack>
          )}
        </Stack>
      )}
    </Stack>
  );
};

export default ScreenshotUploader;

