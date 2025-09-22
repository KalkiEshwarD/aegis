# Dashboard Components

This directory contains the main dashboard components, such as the file browser, folder tree, and search bar.

## Files

*   `Dashboard.tsx`: The main component for the user dashboard. It brings together the `DashboardAppBar`, `DashboardSidebar`, and the main content area, which can be one of `FileExplorer`, `SharedView`, `StarredView`, or `TrashView`.
*   `DashboardAppBar.tsx`: The app bar component for the main dashboard. It typically contains the application title, search bar, and user profile menu.
*   `DashboardSidebar.tsx`: The sidebar component for the main dashboard. It provides navigation links to different sections of the dashboard, such as "My Files", "Shared with me", "Starred", and "Trash".
*   `SharedDashboard.tsx`: A dashboard component specifically for displaying files and folders that have been shared with the user.
*   `SharedDashboardSidebar.tsx`: The sidebar component for the shared dashboard.
*   `SharedView.tsx`: A view that displays files and folders shared with the user.
*   `StarredView.tsx`: A view that displays starred files and folders.
*   `StatsCards.tsx`: A component that displays statistics about the user's files, such as the number of files, storage used, etc.
*   `TrashView.tsx`: A view that displays files and folders that have been moved to the trash.
