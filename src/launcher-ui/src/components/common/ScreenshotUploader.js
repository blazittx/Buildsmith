import React, { useRef, useState } from 'react';
import { CircularProgress, Stack, Box, IconButton, Typography } from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';
import DeleteIcon from '@mui/icons-material/Delete';
import { colors } from '../../theme/colors';

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
    if (screenshots.length >= maxScreenshots) {
      if (window.electronAPI) {
        window.electronAPI.showCustomNotification(
          'Upload Limit Reached',
          `You can only upload up to ${maxScreenshots} screenshots.`
        );
      }
      return;
    }

    setUploading(true);
    if (index !== null) {
      setUploadingIndex(index);
    }

    try {
      const sessionID =
        headers.sessionID ||
        (window.Cookies && window.Cookies.get && window.Cookies.get('sessionID'));
      const fetchHeaders = {
        'Content-Type': 'application/json',
        ...(sessionID ? { sessionID } : {}),
      };
      const uploadUrl = headers.uploadUrl || 'https://cdn.diabolical.services/generateUploadUrl';

      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: fetchHeaders,
        body: JSON.stringify({
          fileExt: file.name.split('.').pop(),
          contentType: file.type,
          size_bytes: file.size,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to generate upload URL');
      }

      const { url, key } = await res.json();

      const uploadRes = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file');
      }

      const imageUrl = `https://cdn.diabolical.services/${key}`;
      
      if (index !== null) {
        // Replace screenshot at index
        const newScreenshots = [...screenshots];
        newScreenshots[index] = imageUrl;
        onScreenshotsChange(newScreenshots);
      } else {
        // Add new screenshot
        onScreenshotsChange([...screenshots, imageUrl]);
      }

      if (window.electronAPI) {
        window.electronAPI.showCustomNotification('Upload Complete', 'Screenshot uploaded successfully.');
      }
    } catch (err) {
      console.error('❌ Upload failed:', err);
      if (window.electronAPI) {
        window.electronAPI.showCustomNotification(
          'Upload Failed',
          err.message === 'Quota check failed'
            ? 'You have exceeded your storage quota. Please upgrade your plan or delete some files.'
            : err.message || 'Could not upload your screenshot.'
        );
      }
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
      if (window.electronAPI) {
        window.electronAPI.showCustomNotification(
          'Upload Limit',
          `You can only upload up to ${maxScreenshots} screenshots total.`
        );
      }
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
      if (window.electronAPI) {
        window.electronAPI.showCustomNotification(
          'Upload Limit',
          `You can only upload up to ${maxScreenshots} screenshots total.`
        );
      }
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

  const handleDelete = (index) => {
    const newScreenshots = screenshots.filter((_, i) => i !== index);
    onScreenshotsChange(newScreenshots);
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
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: 2,
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
            </Box>
          ))}
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

