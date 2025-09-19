import React, { useState, useEffect, useRef, memo } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Link,
  Alert,
  InputAdornment,
  IconButton,
  Snackbar
} from '@mui/material';
import { Visibility, VisibilityOff, Storage, Email, Person } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { sanitizeUserInput, isValidEmail, isValidUsername } from '../../utils/sanitization';

// Validation schema
const validationSchema = yup.object({
  username: yup
    .string()
    .required('Username is required')
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be at most 50 characters')
    .matches(/^[a-zA-Z0-9]+$/, 'Username must contain only alphanumeric characters'),
  email: yup
    .string()
    .required('Email is required')
    .email('Please enter a valid email address'),
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
  confirmPassword: yup
    .string()
    .required('Please confirm your password')
    .oneOf([yup.ref('password')], 'Passwords must match'),
});

interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const Register: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const isMountedRef = useRef(true);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid }
  } = useForm<RegisterFormData>({
    resolver: yupResolver(validationSchema),
    mode: 'onChange', // Enable real-time validation
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const onSubmit = async (data: RegisterFormData) => {
    if (!isMountedRef.current) return;

    setError('');
    setLoading(true);

    try {
      // Sanitize inputs
      const sanitizedUsername = sanitizeUserInput(data.username);
      const sanitizedEmail = sanitizeUserInput(data.email);
      const sanitizedPassword = sanitizeUserInput(data.password);

      // Additional validation
      if (!sanitizedUsername || !sanitizedEmail || !sanitizedPassword) {
        throw new Error('Invalid input data');
      }

      // Validate formats
      if (!isValidUsername(sanitizedUsername)) {
        throw new Error('Invalid username format');
      }

      if (!isValidEmail(sanitizedEmail)) {
        throw new Error('Invalid email format');
      }

      await registerUser(sanitizedUsername, sanitizedEmail, sanitizedPassword);
      if (isMountedRef.current) {
        navigate('/dashboard');
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err.message || 'Registration failed. Please try again.');
        setSnackbarOpen(true);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Container component="main" maxWidth="sm">
        <Paper elevation={1} sx={{ 
          padding: 4, 
          width: '100%',
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: 3
        }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box sx={{ 
              width: 60, 
              height: 60, 
              borderRadius: 3, 
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3
            }}>
              <Storage sx={{ fontSize: 32, color: 'white' }} />
            </Box>
            <Typography component="h1" variant="h4" gutterBottom sx={{ fontWeight: 600, color: '#1f2937' }}>
              Join AegisDrive
            </Typography>
            <Typography variant="h6" color="#6b7280" gutterBottom>
              Create your secure vault
            </Typography>

            <Box component="form" role="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 3, width: '100%' }}>
              <Controller
                name="username"
                control={control}
                render={({ field }: { field: any }) => (
                  <TextField
                    {...field}
                    margin="normal"
                    required
                    fullWidth
                    id="username"
                    label="Username"
                    name="username"
                    autoComplete="username"
                    autoFocus
                    error={!!errors.username}
                    helperText={errors.username?.message}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Person sx={{ color: '#6b7280' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                          borderColor: errors.username ? '#ef4444' : '#d1d5db',
                        },
                        '&:hover fieldset': {
                          borderColor: errors.username ? '#ef4444' : '#3b82f6',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: errors.username ? '#ef4444' : '#3b82f6',
                        },
                      },
                    }}
                  />
                )}
              />
              <Controller
                name="email"
                control={control}
                render={({ field }: { field: any }) => (
                  <TextField
                    {...field}
                    margin="normal"
                    required
                    fullWidth
                    id="email"
                    label="Email Address"
                    name="email"
                    autoComplete="email"
                    error={!!errors.email}
                    helperText={errors.email?.message}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Email sx={{ color: '#6b7280' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                          borderColor: errors.email ? '#ef4444' : '#d1d5db',
                        },
                        '&:hover fieldset': {
                          borderColor: errors.email ? '#ef4444' : '#3b82f6',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: errors.email ? '#ef4444' : '#3b82f6',
                        },
                      },
                    }}
                  />
                )}
              />
              <Controller
                name="password"
                control={control}
                render={({ field }: { field: any }) => (
                  <TextField
                    {...field}
                    margin="normal"
                    required
                    fullWidth
                    name="password"
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    autoComplete="new-password"
                    error={!!errors.password}
                    helperText={errors.password?.message}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle password visibility"
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            sx={{ color: '#6b7280' }}
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                          borderColor: errors.password ? '#ef4444' : '#d1d5db',
                        },
                        '&:hover fieldset': {
                          borderColor: errors.password ? '#ef4444' : '#3b82f6',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: errors.password ? '#ef4444' : '#3b82f6',
                        },
                      },
                    }}
                  />
                )}
              />
              <Controller
                name="confirmPassword"
                control={control}
                render={({ field }: { field: any }) => (
                  <TextField
                    {...field}
                    margin="normal"
                    required
                    fullWidth
                    name="confirmPassword"
                    label="Confirm Password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    autoComplete="new-password"
                    error={!!errors.confirmPassword}
                    helperText={errors.confirmPassword?.message}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle confirm password visibility"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            edge="end"
                            sx={{ color: '#6b7280' }}
                          >
                            {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                          borderColor: errors.confirmPassword ? '#ef4444' : '#d1d5db',
                        },
                        '&:hover fieldset': {
                          borderColor: errors.confirmPassword ? '#ef4444' : '#3b82f6',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: errors.confirmPassword ? '#ef4444' : '#3b82f6',
                        },
                      },
                    }}
                  />
                )}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading || !isValid}
                sx={{
                  mt: 3,
                  mb: 2,
                  backgroundColor: isValid ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  fontSize: '1rem',
                  fontWeight: 600,
                  py: 1.5,
                  borderRadius: 2,
                  textTransform: 'none',
                  '&:hover': {
                    backgroundColor: isValid ? '#2563eb' : '#9ca3af',
                  },
                  '&:disabled': {
                    backgroundColor: '#9ca3af',
                    color: 'white'
                  }
                }}
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </Button>
              <Box textAlign="center">
                <Link 
                  component={RouterLink} 
                  to="/login" 
                  variant="body2"
                  sx={{ 
                    color: '#3b82f6',
                    textDecoration: 'none',
                    '&:hover': {
                      textDecoration: 'underline'
                    }
                  }}
                >
                  {"Already have an account? Sign in"}
                </Link>
              </Box>
            </Box>
          </Box>
        </Paper>
      </Container>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity="error" 
          sx={{ width: '100%' }}
        >
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default memo(Register);
