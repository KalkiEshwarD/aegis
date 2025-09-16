import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import LoadingSpinner from '../../../components/common/LoadingSpinner';

const theme = createTheme();

const renderLoadingSpinner = (message?: string) => {
  return render(
    <ThemeProvider theme={theme}>
      <LoadingSpinner message={message} />
    </ThemeProvider>
  );
};

describe('LoadingSpinner Component', () => {
  it('renders with default message', () => {
    renderLoadingSpinner();

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders with custom message', () => {
    const customMessage = 'Please wait...';
    renderLoadingSpinner(customMessage);

    expect(screen.getByText(customMessage)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders with empty custom message', () => {
    renderLoadingSpinner('');

    // When message is empty, it should use default 'Loading...'
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders with long custom message', () => {
    const longMessage = 'This is a very long loading message that should still be displayed correctly';
    renderLoadingSpinner(longMessage);

    expect(screen.getByText(longMessage)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders with special characters in message', () => {
    const specialMessage = 'Loading... 50% @#$%^&*()';
    renderLoadingSpinner(specialMessage);

    expect(screen.getByText(specialMessage)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('has correct styling and layout', () => {
    renderLoadingSpinner();

    const container = screen.getByText('Loading...').parentElement;
    expect(container).toHaveStyle({
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh'
    });
  });

  it('circular progress has correct size', () => {
    renderLoadingSpinner();

    const progress = screen.getByRole('progressbar');
    expect(progress).toHaveStyle({ width: '60px', height: '60px' }); // size={60}
  });
});