import React, { ComponentType } from 'react';
import { useQuery } from '@apollo/client';
import { DocumentNode } from 'graphql';
import { Alert } from '@mui/material';
import LoadingSpinner from '../common/LoadingSpinner';

interface WithDataFetchingOptions<P = any> {
  query: DocumentNode;
  variables?: Record<string, any> | ((props: P) => Record<string, any>);
  loadingMessage?: string;
  errorMessage?: string;
  pollInterval?: number;
  fetchPolicy?: 'cache-first' | 'cache-and-network' | 'network-only' | 'cache-only' | 'no-cache';
}

interface DataFetchingProps<T = any> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function withDataFetching<P extends object, T = any>(
  WrappedComponent: ComponentType<P & DataFetchingProps<T>>,
  options: WithDataFetchingOptions<P>
) {
  const {
    query,
    variables = {},
    loadingMessage = 'Loading data...',
    errorMessage = 'Failed to load data',
    pollInterval,
    fetchPolicy = 'cache-and-network'
  } = options;

  const WithDataFetchingComponent: React.FC<P> = (props) => {
    const computedVariables = typeof variables === 'function' ? variables(props) : variables;

    const { data, loading, error, refetch } = useQuery<T>(query, {
      variables: computedVariables,
      pollInterval,
      fetchPolicy,
    });

    const errorMsg = error ? `${errorMessage}: ${error.message}` : null;

    if (loading) {
      return <LoadingSpinner message={loadingMessage} />;
    }

    if (error && errorMsg) {
      return (
        <Alert severity="error" sx={{ mt: 2 }}>
          {errorMsg}
        </Alert>
      );
    }

    return (
      <WrappedComponent
        {...props}
        data={data}
        loading={loading}
        error={errorMsg}
        refetch={refetch}
      />
    );
  };

  WithDataFetchingComponent.displayName = `withDataFetching(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithDataFetchingComponent;
}

export default withDataFetching;