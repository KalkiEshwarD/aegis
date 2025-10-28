import React, { memo } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Chip,
  IconButton,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { FileUploadProgress } from '../../types';

interface UploadProgressProps {
  uploads: FileUploadProgress[];
  onRemoveUpload: (file: File) => void;
  onClearCompleted: () => void;
}

const UploadProgress: React.FC<UploadProgressProps> = ({
  uploads,
  onRemoveUpload,
  onClearCompleted,
}) => {
  if (uploads.length === 0) return null;

  return (
    <Box sx={{ mt: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="h6">Upload Progress</Typography>
        <IconButton size="small" onClick={onClearCompleted} title="Clear completed">
          <CloseIcon />
        </IconButton>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {uploads.map((upload, index) => (
          <Box key={`${upload.file.name}-${index}`} sx={{ minWidth: 200 }}>
            <Typography variant="body2" sx={{ mb: 1 }} noWrap>
              {upload.file.name}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={upload.progress}
              color={upload.status === 'error' ? 'error' : 'primary'}
              sx={{ mb: 1 }}
            />
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Chip
                size="small"
                label={
                  upload.status === 'completed' ? 'encrypted and uploaded' :
                  upload.status === 'encrypting' ? 'encrypting' :
                  upload.status
                }
                color={
                  upload.status === 'completed' ? 'success' :
                  upload.status === 'error' ? 'error' :
                  upload.status === 'uploading' || upload.status === 'encrypting' ? 'primary' : 'default'
                }
              />
              <IconButton
                size="small"
                onClick={() => onRemoveUpload(upload.file)}
                sx={{ p: 0.5 }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            {upload.error && (
              <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                {upload.error}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default memo(UploadProgress);