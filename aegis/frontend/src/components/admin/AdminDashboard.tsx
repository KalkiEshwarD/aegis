import React from 'react';
import {
  Box,
  Container,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Paper
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            aria-label="back"
            onClick={handleBackToDashboard}
            sx={{ mr: 2 }}
          >
            <ArrowBack />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Admin Dashboard
          </Typography>
          <Typography variant="body2">
            {user?.email}
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          System Administration
        </Typography>
        
        <Typography variant="body1" color="textSecondary" gutterBottom>
          Manage users, files, and system statistics.
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mt: 2 }}>
          <Paper sx={{ p: 2, textAlign: 'center', minWidth: 200, flex: '1 1 200px' }}>
            <Typography variant="h6" gutterBottom>
              Total Users
            </Typography>
            <Typography variant="h4" color="primary">
              0
            </Typography>
          </Paper>
          
          <Paper sx={{ p: 2, textAlign: 'center', minWidth: 200, flex: '1 1 200px' }}>
            <Typography variant="h6" gutterBottom>
              Total Files
            </Typography>
            <Typography variant="h4" color="primary">
              0
            </Typography>
          </Paper>
          
          <Paper sx={{ p: 2, textAlign: 'center', minWidth: 200, flex: '1 1 200px' }}>
            <Typography variant="h6" gutterBottom>
              Storage Used
            </Typography>
            <Typography variant="h4" color="primary">
              0 MB
            </Typography>
          </Paper>
          
          <Paper sx={{ p: 2, textAlign: 'center', minWidth: 200, flex: '1 1 200px' }}>
            <Typography variant="h6" gutterBottom>
              Active Rooms
            </Typography>
            <Typography variant="h4" color="primary">
              0
            </Typography>
          </Paper>
        </Box>

        {/* TODO: Add admin functionality like user management, file management, etc. */}
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            Administrative Actions
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Admin features will be implemented in the next phase.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default AdminDashboard;
