import React, { ComponentType } from 'react';
import ErrorBoundary from '../common/ErrorBoundary';

interface WithErrorBoundaryOptions {
  fallback?: React.ReactNode;
}

function withErrorBoundary<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: WithErrorBoundaryOptions = {}
) {
  const { fallback } = options;

  const WithErrorBoundaryComponent: React.FC<P> = (props) => {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };

  WithErrorBoundaryComponent.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithErrorBoundaryComponent;
}

export default withErrorBoundary;