import React, { memo } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  IconButton,
  Paper,
  Slide,
  Divider,
} from '@mui/material';
import { Close as CloseIcon, CloudUpload as UploadIcon } from '@mui/icons-material';
import { FileUploadProgress } from '../../types';

// Utility function to truncate filename from the middle
const truncateMiddle = (str: string, maxLength: number = 30): string => {
  if (str.length <= maxLength) return str;
  const start = Math.floor(maxLength / 2) - 2;
  const end = Math.floor(maxLength / 2) - 2;
  return `${str.substring(0, start)}...${str.substring(str.length - end)}`;
};

interface UploadStatusPaneProps {
  uploads: FileUploadProgress[];
  onRemoveUpload: (file: File) => void;
  onClearCompleted: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const UploadStatusPane: React.FC<UploadStatusPaneProps> = ({
  uploads,
  onRemoveUpload,
  onClearCompleted,
  isOpen,
  onClose,
}) => {
  if (uploads.length === 0 && !isOpen) return null;

  const activeUploads = uploads.filter(u => u.status !== 'completed');
  const completedUploads = uploads.filter(u => u.status === 'completed');

  return (
    <Slide direction="left" in={isOpen || uploads.length > 0} mountOnEnter unmountOnExit>
      <Paper
        elevation={6}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 400,
          maxHeight: 300,
          zIndex: 1300,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: uploads.length > 0 ? '1px solid' : 'none',
            borderBottomColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <UploadIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={600}>
              Uploads ({uploads.length})
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose} sx={{ p: 0.5 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Content */}
        {uploads.length > 0 && (
          <Box sx={{ maxHeight: 240, overflow: 'auto' }}>
            {/* Active Uploads */}
            {activeUploads.length > 0 && (
              <Box sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {activeUploads.map((upload, index) => (
                    <Box key={`${upload.file.name}-${index}`}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontWeight: 600,
                            flex: 1,
                            mr: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {truncateMiddle(upload.file.name)}
                        </Typography>
                        <Typography 
                          variant="caption" 
                          color="primary"
                          sx={{ fontWeight: 500, flexShrink: 0 }}
                        >
                          {upload.status === 'encrypting' ? 'Encrypting...' :
                           upload.status === 'uploading' ? 'Uploading...' :
                           upload.status}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={upload.progress}
                        color={upload.status === 'error' ? 'error' : 'primary'}
                        sx={{ height: 4, borderRadius: 2 }}
                      />
                      {upload.error && (
                        <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                          {upload.error}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Completed Uploads */}
            {completedUploads.length > 0 && (
              <>
                {activeUploads.length > 0 && <Divider />}
                <Box sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {completedUploads.map((upload, index) => (
                      <Box key={`${upload.file.name}-${index}`} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontWeight: 600,
                            flex: 1,
                            mr: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {truncateMiddle(upload.file.name)}
                        </Typography>
                        <Typography 
                          variant="caption" 
                          color="success.main"
                          sx={{ fontWeight: 500, flexShrink: 0 }}
                        >
                          ✓ Done
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </>
            )}
          </Box>
        )}
      </Paper>
    </Slide>
  );
};

export default memo(UploadStatusPane);