# Hooks

This directory contains custom React hooks that encapsulate reusable logic and state management for the Aegis frontend.

## Files

*   `useDashboardNavigation.ts`: This hook manages the state and logic for the main dashboard navigation, including the selected navigation item, the current folder path, and breadcrumb navigation.
*   `useFileOperations.ts`: This hook provides functions for performing file operations, such as downloading, deleting, and sharing files. It also manages the state for file operation errors and loading indicators.
*   `useFileSorting.ts`: This hook manages the state and logic for sorting and filtering the file list.
*   `useFileUpload.ts`: This hook handles the entire file upload process, including file validation, encryption, and communication with the backend.
*   `useUserMenu.ts`: This hook manages the state and logic for the user menu in the application header, including opening and closing the menu and handling menu item clicks.

## Functionality

Custom hooks in this directory are used to extract component logic into reusable functions. This helps to keep components clean and focused on rendering the UI, while the hooks handle the complex state management and side effects.

By using custom hooks, the application can share logic between different components and improve the overall code organization and reusability.
