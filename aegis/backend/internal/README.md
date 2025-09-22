# Internal

This directory contains the core application logic for the Aegis backend. It is organized into several packages, each with a specific responsibility.

## Directory Structure

*   `config/`: This package is responsible for loading and managing the application's configuration from environment variables.
*   `database/`: This package handles the database connection, and provides a `gorm.DB` instance to the rest of the application.
*   `errors/`: This package defines custom error types used throughout the application, allowing for consistent error handling and responses.
*   `handlers/`: This package contains the HTTP handlers for the RESTful API endpoints. These handlers are responsible for parsing requests, calling the appropriate services, and writing responses.
*   `middleware/`: This package provides Gin middleware for tasks such as authentication, authorization, rate limiting, and error handling.
*   `models/`: This package defines the GORM models that represent the database tables.
*   `repositories/`: This package contains the data access layer of the application. It is responsible for all communication with the database.
*   `services/`: This package contains the business logic of the application. It orchestrates the calls to repositories and other services to perform complex operations.
*   `shared/`: This directory is a symlink to the root `shared` directory, allowing access to shared files.
*   `utils/`: This package provides utility functions that are used throughout the application.
