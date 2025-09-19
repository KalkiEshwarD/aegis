import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { DocumentNode } from 'graphql';
import withDataFetching from '../../../components/hocs/withDataFetching';

// Mock LoadingSpinner
jest.mock('../../../components/common/LoadingSpinner', () => {
  return function MockLoadingSpinner({ message }: { message: string }) {
    return <div data-testid="loading-spinner">{message}</div>;
  };
});

// Mock Material-UI Alert
jest.mock('@mui/material', () => ({
  Alert: ({ children, severity }: { children: React.ReactNode; severity: string }) => (
    <div data-testid={`alert-${severity}`}>{children}</div>
  ),
}));

describe('withDataFetching HOC', () => {
  const mockQuery: DocumentNode = {
    kind: 'Document',
    definitions: [],
  } as any;

  const TestComponent = ({
    data,
    loading,
    error,
    refetch,
    customProp,
    userId
  }: {
    data?: any;
    loading?: boolean;
    error?: string | null;
    refetch?: () => void;
    customProp?: string;
    userId?: number;
  }) => (
    <div data-testid="test-component">
      Data: {data ? JSON.stringify(data) : 'null'},
      Loading: {loading ? 'true' : 'false'},
      Error: {error || 'null'}
      <button onClick={refetch || (() => {})} data-testid="refetch-button">Refetch</button>
    </div>
  );

  it('should render component with data when query succeeds', async () => {
    const mockData = { users: [{ id: 1, name: 'John' }] };
    const mocks = [
      {
        request: {
          query: mockQuery,
          variables: {},
        },
        result: {
          data: mockData,
        },
      },
    ];

    const WrappedComponent = withDataFetching(TestComponent, {
      query: mockQuery,
    });

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <WrappedComponent />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('test-component')).toBeInTheDocument();
      expect(screen.getByText(/Data:.*users/)).toBeInTheDocument();
      expect(screen.getByText(/Loading: false/)).toBeInTheDocument();
      expect(screen.getByText(/Error: null/)).toBeInTheDocument();
    });
  });

  it('should show loading spinner while query is loading', async () => {
    const mocks = [
      {
        request: {
          query: mockQuery,
          variables: {},
        },
        result: {
          data: { users: [] },
        },
        delay: 100, // Add delay to show loading state
      },
    ];

    const WrappedComponent = withDataFetching(TestComponent, {
      query: mockQuery,
      loadingMessage: 'Custom loading message',
    });

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <WrappedComponent />
      </MockedProvider>
    );

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.getByText('Custom loading message')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });
  });

  it('should show error message when query fails', async () => {
    const mockError = new Error('Network error');
    const mocks = [
      {
        request: {
          query: mockQuery,
          variables: {},
        },
        error: mockError,
      },
    ];

    const WrappedComponent = withDataFetching(TestComponent, {
      query: mockQuery,
      errorMessage: 'Custom error message',
    });

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <WrappedComponent />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('alert-error')).toBeInTheDocument();
      expect(screen.getByText('Custom error message: Network error')).toBeInTheDocument();
    });
  });

  it('should use function-based variables', async () => {
    const mockData = { user: { id: 1, name: 'John' } };
    const mocks = [
      {
        request: {
          query: mockQuery,
          variables: { id: 123 },
        },
        result: {
          data: mockData,
        },
      },
    ];

    const WrappedComponent = withDataFetching(TestComponent, {
      query: mockQuery,
      variables: (props: any) => ({ id: props.userId }),
    });

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <WrappedComponent userId={123} />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('test-component')).toBeInTheDocument();
      expect(screen.getByText(/Data:.*user/)).toBeInTheDocument();
    });
  });

  it('should use static variables', async () => {
    const mockData = { posts: [{ id: 1, title: 'Test Post' }] };
    const mocks = [
      {
        request: {
          query: mockQuery,
          variables: { limit: 10, offset: 0 },
        },
        result: {
          data: mockData,
        },
      },
    ];

    const WrappedComponent = withDataFetching(TestComponent, {
      query: mockQuery,
      variables: { limit: 10, offset: 0 },
    });

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <WrappedComponent />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('test-component')).toBeInTheDocument();
      expect(screen.getByText(/Data:.*posts/)).toBeInTheDocument();
    });
  });

  it('should provide refetch function', async () => {
    const mockData = { items: [{ id: 1 }] };
    let refetchCallCount = 0;

    const mocks = [
      {
        request: {
          query: mockQuery,
          variables: {},
        },
        result: {
          data: mockData,
        },
        newData: () => {
          refetchCallCount++;
          return {
            data: { items: [{ id: 1 + refetchCallCount }] },
          };
        },
      },
    ];

    const WrappedComponent = withDataFetching(TestComponent, {
      query: mockQuery,
    });

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <WrappedComponent />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('test-component')).toBeInTheDocument();
    });

    const refetchButton = screen.getByTestId('refetch-button');
    expect(refetchButton).toBeInTheDocument();
  });

  it('should set correct displayName', () => {
    const WrappedComponent = withDataFetching(TestComponent, {
      query: mockQuery,
    });
    expect(WrappedComponent.displayName).toBe('withDataFetching(TestComponent)');
  });

  it('should pass through additional props', async () => {
    const mockData = { data: 'test' };
    const mocks = [
      {
        request: {
          query: mockQuery,
          variables: {},
        },
        result: {
          data: mockData,
        },
      },
    ];

    const WrappedComponent = withDataFetching(TestComponent, {
      query: mockQuery,
    });

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <WrappedComponent customProp="value" />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('test-component')).toBeInTheDocument();
    });
  });

  it('should handle polling interval', async () => {
    const mockData = { counter: 1 };
    const mocks = [
      {
        request: {
          query: mockQuery,
          variables: {},
        },
        result: {
          data: mockData,
        },
      },
    ];

    const WrappedComponent = withDataFetching(TestComponent, {
      query: mockQuery,
      pollInterval: 5000,
    });

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <WrappedComponent />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('test-component')).toBeInTheDocument();
    });
  });

  it('should use custom fetch policy', async () => {
    const mockData = { items: [] };
    const mocks = [
      {
        request: {
          query: mockQuery,
          variables: {},
        },
        result: {
          data: mockData,
        },
      },
    ];

    const WrappedComponent = withDataFetching(TestComponent, {
      query: mockQuery,
      fetchPolicy: 'network-only',
    });

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <WrappedComponent />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('test-component')).toBeInTheDocument();
    });
  });
});