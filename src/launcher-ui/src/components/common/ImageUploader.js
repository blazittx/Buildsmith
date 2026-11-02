import React, { useRef, useState } from 'react';
import { CircularProgress, Stack } from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';
import { colors } from '../../theme/colors';
import { uploadToCdn } from '../../utils/cdnUpload';
import { notify, uploadErrorMessage } from '../../utils/notify';

const ImageUploader = ({
  onUpload,
  currentImageUrl,
  uploading,
  setUploading,
  headers,
  style = {},
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef();

  const handleFileUpload = async file => {
    setUploading(true);

    try {
      const { publicUrl } = await uploadToCdn(file, { sessionID: headers.sessionID });
      onUpload(publicUrl);
      notify('Upload Complete', 'Your image was uploaded.');
    } catch (err) {
      console.error('Upload failed:', err);
      notify('Upload Failed', uploadErrorMessage(err, 'Could not upload your image.'));
      // Reset the upload state by calling onUpload with null
      onUpload(null);
    } finally {
      setUploading(false);
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
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFileUpload(file);
    }
  };

  return (
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
        backgroundColor: isDragging ? `${colors.button}20` : colors.background,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        ...style,
      }}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        hidden
        type="file"
        accept=".png,.jpg,.jpeg,.gif,.webp"
        ref={fileInputRef}
        onChange={e => {
          const file = e.target.files[0];
          if (file) handleFileUpload(file);
        }}
      />
      {uploading ? (
        <Stack alignItems="center" gap={1}>
          <CircularProgress size={24} />
          <span style={{ color: colors.text }}>Uploading...</span>
        </Stack>
      ) : currentImageUrl ? (
        <Stack alignItems="center" gap={1}>
          <UploadIcon style={{ color: colors.button }} />
          <span style={{ color: colors.text }}>Image Uploaded ✅</span>
          <span style={{ color: colors.border, fontSize: '12px' }}>Click or drag to change</span>
        </Stack>
      ) : (
        <Stack alignItems="center" gap={1}>
          <UploadIcon style={{ color: colors.border }} />
          <span style={{ color: colors.text }}>Upload</span>
          <span style={{ color: colors.border, fontSize: '12px' }}>
            Supports PNG, JPG, GIF, WEBP
          </span>
        </Stack>
      )}
    </Stack>
  );
};

export default ImageUploader;
