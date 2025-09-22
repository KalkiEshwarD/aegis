# Backend

This directory contains the Go-based backend application for Aegis.

## Directory Structure

*   `cmd/`: Contains the main application entry point.
*   `graph/`: This directory holds the GraphQL schema, generated models, and resolvers.
*   `internal/`: Contains the core business logic of the application, separated into various packages like `handlers`, `services`, and `repositories`.
*   `migrations/`: Houses the SQL migration files for managing the database schema.
*   `shared/`: This directory is a symlink to the root `shared` directory, allowing access to shared files.
*   `templates/`: Contains HTML templates used by the application, such as for email notifications.
*   `test/`: Contains integration and internal tests for the backend application.
*   `Dockerfile`: The Dockerfile for building the backend application's Docker image.
*   `go.mod` & `go.sum`: These files manage the Go module's dependencies.
*   `gqlgen.yml`: The configuration file for `gqlgen`, a tool for generating Go code from a GraphQL schema.
*   `main` & `test_main`: These are likely compiled binaries for the main application and tests, respectively.

## Functionality

The backend is a Go application that uses the Gin framework for handling HTTP requests and `gqlgen` for its GraphQL API. It's responsible for:

*   User authentication and authorization.
*   File and folder management.
*   Interacting with the PostgreSQL database and MinIO object storage.
*   Serving the GraphQL API consumed by the frontend.
