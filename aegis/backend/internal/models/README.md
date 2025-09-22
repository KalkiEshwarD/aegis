# Models

This directory contains the GORM data models for the Aegis backend.

## File

*   `models.go`: This file defines the Go structs that map to the database tables. These structs are used by GORM to perform database operations.

## Functionality

This package defines the data structures that represent the core entities of the application, such as:

*   **User**: Represents a user of the application.
*   **File**: Represents a unique file stored in the system, identified by its content hash.
*   **UserFile**: Represents a user's specific instance of a file, including its name and encryption key.
*   **Folder**: Represents a folder that can contain files and other folders.
*   **Room**: Represents a collaborative space where users can share files and folders.
*   **FileShare**: Represents a publicly shared file with password protection and other access controls.

These models include GORM tags to specify database constraints, relationships, and other properties. They are used by the repository layer to interact with the database.
