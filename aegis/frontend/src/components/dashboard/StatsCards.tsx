import React, { memo } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Box,
  Typography,
} from '@mui/material';
import {
  Storage as StorageIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import { formatFileSize } from '../../utils/fileUtils';

interface StatsCardsProps {
  statsData?: any;
  statsLoading: boolean;
}

const StatsCards: React.FC<StatsCardsProps> = ({
  statsData,
  statsLoading,
}) => {
  return (
    <Grid container spacing={3} sx={{ mb: 4 }}>
      <Grid item xs={12} sm={6} md={3}>
        <Card sx={{ border: '1px solid #e5e7eb', boxShadow: 'none' }}>
          <CardContent>
            <Box display="flex" alignItems="center">
              <Box sx={{
                p: 1.5,
                borderRadius: 2,
                backgroundColor: '#eff6ff',
                mr: 2
              }}>
                <StorageIcon sx={{ color: '#2563eb', fontSize: 24 }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#1f2937' }}>
                  {statsLoading ? '...' : statsData?.myStats?.total_files || 0}
                </Typography>
                <Typography variant="body2" color="#6b7280">
                  Total Files
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card sx={{ border: '1px solid #e5e7eb', boxShadow: 'none' }}>
          <CardContent>
            <Box display="flex" alignItems="center">
              <Box sx={{
                p: 1.5,
                borderRadius: 2,
                backgroundColor: '#f0fdf4',
                mr: 2
              }}>
                <CloudUploadIcon sx={{ color: '#16a34a', fontSize: 24 }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#1f2937' }}>
                  {statsLoading ? '...' : formatFileSize(statsData?.myStats?.used_storage || 0)}
                </Typography>
                <Typography variant="body2" color="#6b7280">
                  Storage Used
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card sx={{ border: '1px solid #e5e7eb', boxShadow: 'none' }}>
          <CardContent>
            <Box display="flex" alignItems="center">
              <Box sx={{
                p: 1.5,
                borderRadius: 2,
                backgroundColor: '#fef3c7',
                mr: 2
              }}>
                <StorageIcon sx={{ color: '#d97706', fontSize: 24 }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#1f2937' }}>
                  {statsLoading ? '...' : formatFileSize(statsData?.myStats?.storage_quota || 0)}
                </Typography>
                <Typography variant="body2" color="#6b7280">
                  Storage Quota
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card sx={{ border: '1px solid #e5e7eb', boxShadow: 'none' }}>
          <CardContent>
            <Box display="flex" alignItems="center">
              <Box sx={{
                p: 1.5,
                borderRadius: 2,
                backgroundColor: '#fdf2f8',
                mr: 2
              }}>
                <StorageIcon sx={{ color: '#dc2626', fontSize: 24 }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#1f2937' }}>
                  {statsLoading ? '...' : `${Math.round((statsData?.myStats?.storage_savings || 0) / 1024)}KB`}
                </Typography>
                <Typography variant="body2" color="#6b7280">
                  Space Saved
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default memo(StatsCards);