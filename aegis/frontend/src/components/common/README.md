# Common Components

This directory contains common, reusable components that are used throughout the application, such as buttons, dialogs, and layout components.

## Files

*   `ErrorBoundary.tsx`: A component that catches JavaScript errors anywhere in its child component tree and displays a fallback UI instead of the crashed component tree.
*   `FileExplorer.tsx`: The main component for browsing files and folders. It combines the `FolderTree` and `FileGrid` or `FileTable` components to provide a complete file browsing experience.
*   `FileGrid.tsx`: A component that displays files and folders in a grid layout.
*   `FileListItem.tsx`: A component that represents a single file or folder in the `FileTable`.
*   `FileTable.tsx`: A component that displays files and folders in a table layout.
*   `FileTile.tsx`: A component that represents a single file or folder in the `FileGrid`.
*   `FileToolbar.tsx`: A toolbar component that provides actions for managing files and folders, such as creating new folders, uploading files, and searching.
*   `FileUploadDropzone.tsx`: A component that allows users to upload files by dragging and dropping them onto the component.
*   `FolderTree.tsx`: A component that displays the folder hierarchy in a tree-like structure.
*   `LoadingSpinner.tsx`: A component that displays a loading spinner to indicate that an operation is in progress.
*   `SharedFileAccess.tsx`: A component for managing access to shared files.
*   `ShareLinkManager.tsx`: A component for creating, viewing, and managing shareable links for files.
*   `StarredSidebar.tsx`: A sidebar component that displays a list of starred files and folders.
*   `UploadProgress.tsx`: A component that displays the progress of file uploads.
