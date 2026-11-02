import React, { useState } from 'react';
import { Box, Stack, Typography, CircularProgress, IconButton } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { colors } from '../../theme/colors';
import ConfirmDialog from '../common/ConfirmDialog';

const UnityPackageManage = ({ cdnPackages, loadingCdn, deletingPackages, onDelete }) => {
  const [pending, setPending] = useState(null);

  if (loadingCdn) {
    return (
      <Typography variant="body2" sx={{ color: colors.text, opacity: 0.7 }}>
        Loading packages...
      </Typography>
    );
  }

  if (cdnPackages.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: colors.text, opacity: 0.7 }}>
        No uploaded packages to manage.
      </Typography>
    );
  }

  return (
    <>
      <Box sx={{ maxHeight: 320, overflowY: 'auto', padding: 1 }}>
        <Stack spacing={1}>
          {cdnPackages.map(pkg => {
            const packageId = pkg.package_id;
            const isDeleting = deletingPackages.has(packageId);
            return (
              <Box
                key={pkg.id || packageId}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: 2,
                  px: 2,
                  py: 1,
                  justifyContent: 'space-between',
                  opacity: isDeleting ? 0.7 : 1,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                  <FolderIcon sx={{ color: colors.text, opacity: 0.7 }} />
                  <Typography variant="body2" sx={{ color: colors.text }} noWrap>
                    {packageId}
                  </Typography>
                  <Typography variant="caption" sx={{ color: colors.text, opacity: 0.6 }}>
                    {pkg.created_at ? new Date(pkg.created_at).toLocaleString() : ''}
                  </Typography>
                </Box>
                {isDeleting ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <IconButton
                    aria-label={`Delete ${packageId}`}
                    onClick={() => setPending(pkg)}
                    sx={{ color: colors.error }}
                  >
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                )}
              </Box>
            );
          })}
        </Stack>
      </Box>
      <ConfirmDialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        onConfirm={() => {
          const pkg = pending;
          setPending(null);
          onDelete(pkg);
        }}
        title="Delete package"
        message={`Remove ${pending?.package_id} for everyone on this team?`}
        confirmText="Delete"
      />
    </>
  );
};

export default UnityPackageManage;
