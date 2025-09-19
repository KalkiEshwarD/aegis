import React from 'react';
import { render, screen } from '@testing-library/react';
import withLoading from '../../../components/hocs/withLoading';

// Mock LoadingSpinner
jest.mock('../../../components/common/LoadingSpinner', () => {
  return function MockLoadingSpinner({ message }: { message: string }) {
    return <div data-testid="loading-spinner">{message}</div>;
  };
});

// Mock Material-UI components
jest.mock('@mui/material', () => ({
  Alert: ({ children, severity }: { children: React.ReactNode; severity: string }) => (
    <div data-testid={`alert-${severity}`}>{children}</div>
  ),
}));

describe('withLoading HOC', () => {
  const TestComponent = ({
    isLoading,
    error,
    data
  }: {
    isLoading: boolean;
    error: string | null;
    data: string;
  }) => (
    <div data-testid="test-component">
      Loading: {isLoading ? 'true' : 'false'},
      Error: {error || 'null'},
      Data: {data}
    </div>
  );

  it('should render component when not loading and no error', () => {
    const WrappedComponent = withLoading(TestComponent);

    render(<WrappedComponent data="test data" />);

    expect(screen.getByTestId('test-component')).toBeInTheDocument();
    expect(screen.getByText('Loading: false, Error: null, Data: test data')).toBeInTheDocument();
  });

  it('should show loading spinner when loading is true', () => {
    const WrappedComponent = withLoading(TestComponent);

    render(<WrappedComponent loading={true} data="test data" />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByTestId('test-component')).not.toBeInTheDocument();
  });

  it('should show custom loading message', () => {
    const WrappedComponent = withLoading(TestComponent, {
      loadingMessage: 'Custom loading message',
    });

    render(<WrappedComponent loading={true} data="test data" />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.getByText('Custom loading message')).toBeInTheDocument();
  });

  it('should show error alert when error exists and showError is true', () => {
    const WrappedComponent = withLoading(TestComponent);

    render(<WrappedComponent error="Test error" data="test data" />);

    expect(screen.getByTestId('alert-error')).toBeInTheDocument();
    expect(screen.getByText('An error occurred: Test error')).toBeInTheDocument();
    expect(screen.queryByTestId('test-component')).not.toBeInTheDocument();
  });

  it('should show custom error message', () => {
    const WrappedComponent = withLoading(TestComponent, {
      errorMessage: 'Custom error message',
    });

    render(<WrappedComponent error="Test error" data="test data" />);

    expect(screen.getByTestId('alert-error')).toBeInTheDocument();
    expect(screen.getByText('Custom error message: Test error')).toBeInTheDocument();
  });

  it('should not show error when showError is false', () => {
    const WrappedComponent = withLoading(TestComponent, {
      showError: false,
    });

    render(<WrappedComponent error="Test error" data="test data" />);

    expect(screen.queryByTestId('alert-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('test-component')).toBeInTheDocument();
    expect(screen.getByText('Loading: false, Error: Test error, Data: test data')).toBeInTheDocument();
  });

  it('should render component when loading is false and error exists but showError is false', () => {
    const WrappedComponent = withLoading(TestComponent, {
      showError: false,
    });

    render(<WrappedComponent loading={false} error="Test error" data="test data" />);

    expect(screen.getByTestId('test-component')).toBeInTheDocument();
    expect(screen.getByText('Loading: false, Error: Test error, Data: test data')).toBeInTheDocument();
  });

  it('should prioritize loading over error display', () => {
    const WrappedComponent = withLoading(TestComponent);

    render(<WrappedComponent loading={true} error="Test error" data="test data" />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.queryByTestId('alert-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('test-component')).not.toBeInTheDocument();
  });

  it('should pass through props correctly', () => {
    const WrappedComponent = withLoading(TestComponent);

    render(<WrappedComponent data="custom data" customProp="value" />);

    expect(screen.getByTestId('test-component')).toBeInTheDocument();
    expect(screen.getByText('Loading: false, Error: null, Data: custom data')).toBeInTheDocument();
  });

  it('should handle null error prop', () => {
    const WrappedComponent = withLoading(TestComponent);

    render(<WrappedComponent error={null} data="test data" />);

    expect(screen.getByTestId('test-component')).toBeInTheDocument();
    expect(screen.getByText('Loading: false, Error: null, Data: test data')).toBeInTheDocument();
  });

  it('should handle undefined error prop', () => {
    const WrappedComponent = withLoading(TestComponent);

    render(<WrappedComponent error={undefined} data="test data" />);

    expect(screen.getByTestId('test-component')).toBeInTheDocument();
    expect(screen.getByText('Loading: false, Error: null, Data: test data')).toBeInTheDocument();
  });

  it('should handle boolean loading prop', () => {
    const WrappedComponent = withLoading(TestComponent);

    const { rerender } = render(<WrappedComponent loading={true} data="test data" />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

    rerender(<WrappedComponent loading={false} data="test data" />);

    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    expect(screen.getByTestId('test-component')).toBeInTheDocument();
  });

  it('should set correct displayName', () => {
    const WrappedComponent = withLoading(TestComponent);
    expect(WrappedComponent.displayName).toBe('withLoading(TestComponent)');
  });

  it('should handle component with custom displayName', () => {
    const ComponentWithDisplayName = () => <div>Test</div>;
    ComponentWithDisplayName.displayName = 'CustomComponent';

    const WrappedComponent = withLoading(ComponentWithDisplayName);
    expect(WrappedComponent.displayName).toBe('withLoading(CustomComponent)');
  });

  it('should work with different prop combinations', () => {
    const WrappedComponent = withLoading(TestComponent);

    // Test with only loading
    const { rerender } = render(<WrappedComponent loading={true} />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

    // Test with only error
    rerender(<WrappedComponent error="Error message" />);

    expect(screen.getByTestId('alert-error')).toBeInTheDocument();

    // Test with neither
    rerender(<WrappedComponent />);

    expect(screen.getByTestId('test-component')).toBeInTheDocument();
  });
});