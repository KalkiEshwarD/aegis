import React, { ComponentType, useState, useEffect } from 'react';
import { Alert } from '@mui/material';
import LoadingSpinner from '../common/LoadingSpinner';

interface WithLoadingOptions {
  loadingMessage?: string;
  errorMessage?: string;
  showError?: boolean;
}

interface LoadingProps {
  isLoading: boolean;
  error?: string | null;
}

function withLoading<P extends object>(
  WrappedComponent: ComponentType<P & LoadingProps>,
  options: WithLoadingOptions = {}
) {
  const { loadingMessage = 'Loading...', errorMessage = 'An error occurred', showError = true } = options;

  const WithLoadingComponent: React.FC<P & { loading?: boolean; error?: string | null }> = (props) => {
    const { loading = false, error = null, ...restProps } = props;

    if (loading) {
      return <LoadingSpinner message={loadingMessage} />;
    }

    if (error && showError) {
      return (
        <Alert severity="error" sx={{ mt: 2 }}>
          {errorMessage}: {error}
        </Alert>
      );
    }

    return (
      <WrappedComponent
        {...(restProps as P)}
        isLoading={loading}
        error={error}
      />
    );
  };

  WithLoadingComponent.displayName = `withLoading(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithLoadingComponent;
}

export default withLoading;