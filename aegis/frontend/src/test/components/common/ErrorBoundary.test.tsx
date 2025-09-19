import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import ErrorBoundary from '../../../components/common/ErrorBoundary';

const theme = createTheme();

// Test component that throws an error
const ErrorThrowingComponent = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

// Test component that throws an error in event handler
const ErrorInEventHandler = () => {
  const [shouldThrow, setShouldThrow] = React.useState(false);

  React.useEffect(() => {
    if (shouldThrow) {
      throw new Error('Event handler error');
    }
  }, [shouldThrow]);

  return (
    <button onClick={() => setShouldThrow(true)}>
      Trigger Error
    </button>
  );
};

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('ErrorBoundary Component', () => {
  // Mock console.error to avoid noise in test output
  const originalConsoleError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  beforeEach(() => {
    // Clear console.error mock before each test
    (console.error as jest.Mock).mockClear();
  });

  it('should render children when no error occurs', () => {
    renderWithTheme(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should catch and display error UI when child component throws', () => {
    renderWithTheme(
      <ErrorBoundary>
        <ErrorThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('An unexpected error occurred. Please try refreshing the page.')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('should display error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      writable: true,
    });

    renderWithTheme(
      <ErrorBoundary>
        <ErrorThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Test error/)).toBeInTheDocument();

    // Restore original environment
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv,
      writable: true,
    });
  });

  it('should not display error details in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production',
      writable: true,
    });

    renderWithTheme(
      <ErrorBoundary>
        <ErrorThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.queryByText(/Test error/)).not.toBeInTheDocument();

    // Restore original environment
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv,
      writable: true,
    });
  });

  it('should call console.error when error is caught', () => {
    renderWithTheme(
      <ErrorBoundary>
        <ErrorThrowingComponent />
      </ErrorBoundary>
    );

    expect(console.error).toHaveBeenCalledWith(
      'ErrorBoundary caught an error:',
      expect.any(Error),
      expect.any(Object)
    );
  });

  it('should retry and render children again when Try Again is clicked', () => {
    const { rerender } = renderWithTheme(
      <ErrorBoundary>
        <ErrorThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    // Initially shows error
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Click retry button
    fireEvent.click(screen.getByText('Try Again'));

    // Rerender with component that doesn't throw
    rerender(
      <ThemeProvider theme={theme}>
        <ErrorBoundary>
          <ErrorThrowingComponent shouldThrow={false} />
        </ErrorBoundary>
      </ThemeProvider>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should render custom fallback when provided', () => {
    const customFallback = <div>Custom error message</div>;

    renderWithTheme(
      <ErrorBoundary fallback={customFallback}>
        <ErrorThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('should handle errors thrown in event handlers', async () => {
    renderWithTheme(
      <ErrorBoundary>
        <ErrorInEventHandler />
      </ErrorBoundary>
    );

    // Initially renders normally
    expect(screen.getByText('Trigger Error')).toBeInTheDocument();

    // Click button to trigger error in useEffect
    fireEvent.click(screen.getByText('Trigger Error'));

    // Wait for error boundary to catch the error
    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  it('should handle multiple errors gracefully', () => {
    renderWithTheme(
      <ErrorBoundary>
        <ErrorThrowingComponent />
      </ErrorBoundary>
    );

    // First error is caught
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Try again should reset state
    fireEvent.click(screen.getByText('Try Again'));

    // Since we're still rendering the error component, it should show error again
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should handle async errors', async () => {
    const AsyncErrorComponent = () => {
      const [error, setError] = React.useState<Error | null>(null);

      React.useEffect(() => {
        const timer = setTimeout(() => {
          setError(new Error('Async error'));
        }, 100);

        return () => clearTimeout(timer);
      }, []);

      if (error) {
        throw error;
      }

      return <div>Loading...</div>;
    };

    renderWithTheme(
      <ErrorBoundary>
        <AsyncErrorComponent />
      </ErrorBoundary>
    );

    // Initially shows loading
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Wait for async error
    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  it('should handle nested error boundaries', () => {
    const NestedErrorTest = () => (
      <ErrorBoundary fallback={<div>Outer fallback</div>}>
        <div>
          <ErrorBoundary fallback={<div>Inner fallback</div>}>
            <ErrorThrowingComponent />
          </ErrorBoundary>
        </div>
      </ErrorBoundary>
    );

    renderWithTheme(<NestedErrorTest />);

    // Inner error boundary should catch the error
    expect(screen.getByText('Inner fallback')).toBeInTheDocument();
    expect(screen.queryByText('Outer fallback')).not.toBeInTheDocument();
  });

  it('should preserve error state across re-renders', () => {
    const { rerender } = renderWithTheme(
      <ErrorBoundary>
        <ErrorThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Rerender with same component
    rerender(
      <ThemeProvider theme={theme}>
        <ErrorBoundary>
          <ErrorThrowingComponent />
        </ErrorBoundary>
      </ThemeProvider>
    );

    // Should still show error state
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});