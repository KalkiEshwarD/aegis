import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLazyQuery, useMutation } from '@apollo/client';
import { 
  Box, 
  Paper, 
  Typography, 
  TextField, 
  Button, 
  Alert, 
  CircularProgress,
  IconButton,
  Divider
} from '@mui/material';
import { 
  Visibility, 
  VisibilityOff, 
  Download, 
  Description,
  Lock
} from '@mui/icons-material';
import { GET_SHARED_FILE, ACCESS_SHARED_FILE, DOWNLOAD_SHARED_FILE } from '../../apollo/queries';

interface SharedFileData {
  token: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  max_downloads: number | null;
  download_count: number;
  expires_at: string | null;
  created_at: string;
}

const ShareAccess: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [sharedFile, setSharedFile] = useState<SharedFileData | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const [getSharedFile] = useLazyQuery(GET_SHARED_FILE, {
    onCompleted: (data) => {
      if (data?.shareMetadata) {
        setSharedFile(data.shareMetadata);
        setIsLoading(false);
        setError('');
      }
    },
    onError: (error) => {
      console.error('Error fetching shared file:', error);
      setError('This share link is invalid or has expired.');
      setIsLoading(false);
    }
  });

  const [accessSharedFile] = useMutation(ACCESS_SHARED_FILE, {
    onCompleted: (data) => {
      if (data?.accessSharedFile) {
        setHasAccess(true);
        setError('');
      }
    },
    onError: (error) => {
      console.error('Error accessing shared file:', error);
      setError('Invalid password or access denied.');
    }
  });

  const [downloadSharedFile] = useMutation(DOWNLOAD_SHARED_FILE, {
    onCompleted: async (data) => {
      if (data?.accessSharedFile && token) {
        try {
          // Extract the decryption key from the GraphQL response URL
          const responseUrl = data.accessSharedFile;
          const url = new URL(responseUrl);
          const key = url.searchParams.get('key');
          
          // Construct the direct download URL using the new backend endpoint
          const directDownloadUrl = `http://localhost:8080/v1/share/${token}/download?key=${encodeURIComponent(key || '')}`;
          
          console.log('Initiating browser download from:', directDownloadUrl);
          
          // Use window.open with proper download attributes to trigger browser's native download dialog
          // This ensures the file goes to the user's configured Downloads folder
          const downloadWindow = window.open(directDownloadUrl, '_blank');
          
          // Close the download window after a short delay if it opened successfully
          if (downloadWindow) {
            setTimeout(() => {
              try {
                downloadWindow.close();
              } catch (e) {
                // Window might already be closed or restricted, ignore
              }
            }, 2000);
          }
          
          // Update download count locally (optimistically)
          if (sharedFile) {
            setSharedFile({
              ...sharedFile,
              download_count: sharedFile.download_count + 1
            });
          }
          setError('');
        } catch (error) {
          console.error('Download error:', error);
          setError('Failed to download file. Please try again.');
        }
      }
    },
    onError: (error) => {
      console.error('Error downloading file:', error);
      setError('Failed to download file. Please try again.');
    }
  });

  useEffect(() => {
    if (token) {
      getSharedFile({ variables: { token } });
    } else {
      setError('Invalid share link.');
      setIsLoading(false);
    }
  }, [token, getSharedFile]);

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password.trim()) {
            setError('Password is required');
            return;
        }

        setIsLoading(true);
        try {
            await accessSharedFile({
                variables: {
                    input: {
                        token: token,
                        master_password: password
                    }
                }
            });
        } catch (error) {
            // Error is handled by onError callback
            console.error('Error accessing shared file:', error);
        } finally {
            setIsLoading(false);
        }
    };  const handleDownload = async () => {
    console.log('Download initiated:', { token, passwordLength: password?.length || 0 });
    try {
      await downloadSharedFile({
        variables: { 
          input: {
            token: token,
            master_password: password
          }
        }
      });
    } catch (error) {
      console.error('Download error:', error);
      // Error handled in onError callback
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const isExpired = sharedFile?.expires_at && new Date(sharedFile.expires_at) < new Date();
  const isDownloadLimitReached = sharedFile?.max_downloads && sharedFile.max_downloads > 0 &&
    sharedFile.download_count >= sharedFile.max_downloads;

  if (isLoading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
        bgcolor="background.default"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error && !sharedFile) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
        bgcolor="background.default"
        p={2}
      >
        <Paper sx={{ p: 4, maxWidth: 400, textAlign: 'center' }}>
          <Typography variant="h5" color="error" gutterBottom>
            Access Denied
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            {error}
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => navigate('/login')}
            sx={{ mt: 2 }}
          >
            Go to Login
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box 
      display="flex" 
      justifyContent="center" 
      alignItems="center" 
      minHeight="100vh"
      bgcolor="background.default"
      p={2}
    >
      <Paper sx={{ p: 4, maxWidth: 500, width: '100%' }}>
        <Box display="flex" alignItems="center" mb={3}>
          <Description sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h5" component="h1">
            Shared File
          </Typography>
        </Box>

        {sharedFile && (
          <>
            <Box mb={3}>
              <Typography variant="h6" gutterBottom>
                {sharedFile.filename}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Size: {formatFileSize(sharedFile.size_bytes)}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Type: {sharedFile.mime_type}
              </Typography>
              {sharedFile.expires_at && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Expires: {formatDate(sharedFile.expires_at)}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary">
                Downloads: {sharedFile.download_count}
                {sharedFile.max_downloads && ` / ${sharedFile.max_downloads}`}
              </Typography>
            </Box>

            <Divider sx={{ my: 2 }} />

            {isExpired ? (
              <Alert severity="error">
                This shared file has expired and is no longer available.
              </Alert>
            ) : isDownloadLimitReached ? (
              <Alert severity="error">
                This shared file has reached its download limit and is no longer available.
              </Alert>
            ) : !hasAccess ? (
              <Box component="form" onSubmit={handlePasswordSubmit}>
                <Box display="flex" alignItems="center" mb={2}>
                  <Lock sx={{ mr: 1, color: 'warning.main' }} />
                  <Typography variant="h6">
                    Password Required
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  This file is password protected. Enter the password to access it.
                </Typography>
                
                {error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                )}

                <TextField
                  fullWidth
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  margin="normal"
                  InputProps={{
                    endAdornment: (
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    ),
                  }}
                />

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  sx={{ mt: 3, mb: 2 }}
                >
                  Access File
                </Button>
              </Box>
            ) : (
              <Box>
                <Alert severity="success" sx={{ mb: 2 }}>
                  You have access to this file!
                </Alert>

                {error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                )}

                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<Download />}
                  onClick={handleDownload}
                  sx={{ mb: 2 }}
                >
                  Download File
                </Button>

                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => navigate('/login')}
                >
                  Go to AegisDrive
                </Button>
              </Box>
            )}
          </>
        )}
      </Paper>
    </Box>
  );
};

export default ShareAccess;