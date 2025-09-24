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
import { Visibility, VisibilityOff, Storage, Person } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { sanitizeUserInput, isValidEmail, isValidUsername } from '../../utils/sanitization';

// Validation schema
const validationSchema = yup.object({
  identifier: yup
    .string()
    .required('Username or email is required')
    .test('email-or-username', 'Please enter a valid email or username', function(value: string | undefined) {
      if (!value) return false;
      // Check if it's a valid email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(value)) return true;
      // Check if it's a valid username (alphanumeric only)
      const usernameRegex = /^[a-zA-Z0-9]+$/;
      return usernameRegex.test(value);
    }),
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
});

interface LoginFormData {
  identifier: string;
  password: string;
}

// Create a forwardRef RouterLink for MUI Link compatibility
const RouterLinkRef = React.forwardRef<HTMLAnchorElement, any>((props, ref) => (
  <RouterLink ref={ref} {...props} />
));

const Login: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const isMountedRef = useRef(true);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid }
  } = useForm<LoginFormData>({
    resolver: yupResolver(validationSchema),
    mode: 'onChange', // Enable real-time validation
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const onSubmit = async (data: LoginFormData) => {
    if (!isMountedRef.current) return;

    setError('');
    setLoading(true);

    try {
      // Sanitize inputs
      const sanitizedIdentifier = sanitizeUserInput(data.identifier);
      const sanitizedPassword = sanitizeUserInput(data.password);

      // Additional validation
      if (!sanitizedIdentifier || !sanitizedPassword) {
        throw new Error('Invalid input data');
      }

      // Validate email/username format
      const isEmail = sanitizedIdentifier.includes('@');
      if (isEmail && !isValidEmail(sanitizedIdentifier)) {
        throw new Error('Invalid email format');
      } else if (!isEmail && !isValidUsername(sanitizedIdentifier)) {
        throw new Error('Invalid username format');
      }

      await login(sanitizedIdentifier, sanitizedPassword);
      if (isMountedRef.current) {
        navigate('/dashboard');
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err.message || 'Login failed. Please check your credentials.');
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
              AegisDrive
            </Typography>
            <Typography variant="h6" color="#6b7280" gutterBottom>
              Sign in to your vault
            </Typography>

            <Box component="form" role="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 3, width: '100%' }}>
              <Controller
                name="identifier"
                control={control}
                render={({ field }: { field: any }) => (
                  <TextField
                    {...field}
                    margin="normal"
                    required
                    fullWidth
                    id="identifier"
                    label="Username or Email Address"
                    name="identifier"
                    autoComplete="username"
                    autoFocus
                    error={!!errors.identifier}
                    helperText={errors.identifier?.message}
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
                          borderColor: errors.identifier ? '#ef4444' : '#d1d5db',
                        },
                        '&:hover fieldset': {
                          borderColor: errors.identifier ? '#ef4444' : '#3b82f6',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: errors.identifier ? '#ef4444' : '#3b82f6',
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
                    autoComplete="current-password"
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
                {loading ? 'Signing In...' : 'Sign In'}
              </Button>
              <Box textAlign="center">
                <Link 
                  component={RouterLinkRef} 
                  to="/register" 
                  variant="body2"
                  sx={{ 
                    color: '#3b82f6',
                    textDecoration: 'none',
                    '&:hover': {
                      textDecoration: 'underline'
                    }
                  }}
                >
                  {"Don't have an account? Sign up"}
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

export default memo(Login);
