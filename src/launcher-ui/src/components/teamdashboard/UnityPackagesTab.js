import React from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import UploadRoundedIcon from '@mui/icons-material/UploadRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import UnityPackageUpload from './UnityPackageUpload';
import UnityPackageDownload from './UnityPackageDownload';
import UnityPackageManage from './UnityPackageManage';

const UnityPackagesTab = ({
  unityTab,
  onUnityTabChange,
  unityPackages,
  scanning,
  uploadingPackages,
  uploadedPackages,
  cdnPackages,
  loadingCdn,
  downloadingPackages,
  onUpload,
  onDownload,
  deletingPackages,
  onDelete,
}) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden' }}>
      <Tabs
        value={unityTab}
        onChange={onUnityTabChange}
        textColor="inherit"
        indicatorColor="primary"
        variant="standard"
        sx={{
          minHeight: 32,
          height: 32,
          '& .MuiTab-root': {
            minHeight: 32,
            height: 32,
            padding: '0 12px',
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 1.2,
            gap: 0.5,
          },
          '& .MuiTab-iconWrapper': {
            fontSize: 16,
            marginRight: 4,
          },
        }}
      >
        <Tab
          label="Upload"
          icon={<UploadRoundedIcon sx={{ fontSize: 16 }} />}
          iconPosition="start"
          sx={{ minHeight: 32, height: 32, padding: '0 12px', fontSize: 13 }}
        />
        <Tab
          label="Download"
          icon={<DownloadRoundedIcon sx={{ fontSize: 16 }} />}
          iconPosition="start"
          sx={{ minHeight: 32, height: 32, padding: '0 12px', fontSize: 13 }}
        />
        <Tab
          label="Manage"
          icon={<DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />}
          iconPosition="start"
          sx={{ minHeight: 32, height: 32, padding: '0 12px', fontSize: 13 }}
        />
      </Tabs>
      {unityTab === 0 && (
        <UnityPackageUpload
          unityPackages={unityPackages}
          scanning={scanning}
          uploadingPackages={uploadingPackages}
          uploadedPackages={uploadedPackages}
          cdnPackages={cdnPackages}
          onUpload={onUpload}
        />
      )}
      {unityTab === 1 && (
        <UnityPackageDownload
          cdnPackages={cdnPackages}
          loadingCdn={loadingCdn}
          downloadingPackages={downloadingPackages}
          onDownload={onDownload}
        />
      )}
      {unityTab === 2 && (
        <UnityPackageManage
          cdnPackages={cdnPackages}
          loadingCdn={loadingCdn}
          deletingPackages={deletingPackages}
          onDelete={onDelete}
        />
      )}
    </Box>
  );
};

export default UnityPackagesTab;
