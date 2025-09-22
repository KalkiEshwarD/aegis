# Higher-Order Components (HOCs)

This directory contains higher-order components (HOCs) that provide additional functionality to other components.

## Files

*   `index.ts`: This file exports all the HOCs from this directory, making it easier to import them elsewhere in the application.
*   `withAuth.tsx`: A HOC that checks if a user is authenticated before rendering a component. If the user is not authenticated, it can redirect them to the login page.
*   `withDataFetching.tsx`: A HOC that fetches data and passes it as props to the wrapped component. It can also handle loading and error states.
*   `withErrorBoundary.tsx`: A HOC that wraps a component with an `ErrorBoundary` to catch and handle any runtime errors.
*   `withLoading.tsx`: A HOC that displays a loading spinner while the wrapped component is fetching data or performing an asynchronous operation.
*   `withPermissions.tsx`: A HOC that checks if a user has the necessary permissions to view a component. If the user does not have the required permissions, it can render a fallback UI.
