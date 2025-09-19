import React from 'react';
import { render, screen } from '@testing-library/react';
import withErrorBoundary from '../../../components/hocs/withErrorBoundary';

// Mock ErrorBoundary
const mockErrorBoundary = jest.fn();
jest.mock('../../../components/common/ErrorBoundary', () => {
  return function MockErrorBoundary({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
    mockErrorBoundary({ fallback });
    return <div data-testid="error-boundary">{children}</div>;
  };
});

describe('withErrorBoundary HOC', () => {
  const TestComponent = ({ message }: { message: string }) => (
    <div data-testid="test-component">{message}</div>
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should wrap component with ErrorBoundary', () => {
    const WrappedComponent = withErrorBoundary(TestComponent);

    render(<WrappedComponent message="Hello World" />);

    expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
    expect(screen.getByTestId('test-component')).toBeInTheDocument();
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('should pass fallback to ErrorBoundary when provided', () => {
    const fallback = <div data-testid="custom-fallback">Error occurred</div>;
    const WrappedComponent = withErrorBoundary(TestComponent, { fallback });

    render(<WrappedComponent message="Test" />);

    expect(mockErrorBoundary).toHaveBeenCalledWith({ fallback });
  });

  it('should pass undefined fallback when not provided', () => {
    const WrappedComponent = withErrorBoundary(TestComponent);

    render(<WrappedComponent message="Test" />);

    expect(mockErrorBoundary).toHaveBeenCalledWith({ fallback: undefined });
  });

  it('should pass through props to wrapped component', () => {
    const WrappedComponent = withErrorBoundary(TestComponent);

    render(<WrappedComponent message="Custom Message" />);

    expect(screen.getByText('Custom Message')).toBeInTheDocument();
  });

  it('should set correct displayName', () => {
    const WrappedComponent = withErrorBoundary(TestComponent);
    expect(WrappedComponent.displayName).toBe('withErrorBoundary(TestComponent)');
  });

  it('should handle component with custom displayName', () => {
    const ComponentWithDisplayName = () => <div>Test</div>;
    ComponentWithDisplayName.displayName = 'CustomComponent';

    const WrappedComponent = withErrorBoundary(ComponentWithDisplayName);
    expect(WrappedComponent.displayName).toBe('withErrorBoundary(CustomComponent)');
  });

  it('should handle component without displayName', () => {
    const AnonymousComponent = () => <div>Test</div>;

    const WrappedComponent = withErrorBoundary(AnonymousComponent);
    expect(WrappedComponent.displayName).toBe('withErrorBoundary(AnonymousComponent)');
  });

  it('should render children inside ErrorBoundary', () => {
    const WrappedComponent = withErrorBoundary(TestComponent);

    render(<WrappedComponent message="Nested Content" />);

    const errorBoundary = screen.getByTestId('error-boundary');
    const testComponent = screen.getByTestId('test-component');

    expect(errorBoundary).toContainElement(testComponent);
  });

  it('should work with different component types', () => {
    // Test with arrow function component
    const ArrowComponent = () => <div data-testid="arrow-component">Arrow</div>;
    const WrappedArrow = withErrorBoundary(ArrowComponent);

    const { rerender } = render(<WrappedArrow />);

    expect(screen.getByTestId('arrow-component')).toBeInTheDocument();

    // Test with function declaration component
    function DeclaredComponent() {
      return <div data-testid="declared-component">Declared</div>;
    }
    const WrappedDeclared = withErrorBoundary(DeclaredComponent);

    rerender(<WrappedDeclared />);

    expect(screen.getByTestId('declared-component')).toBeInTheDocument();
  });
});