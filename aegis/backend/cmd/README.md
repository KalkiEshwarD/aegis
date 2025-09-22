# cmd

This directory contains the main entry point for the Aegis backend application.

## Files

*   `main.go`: This is the primary executable for the backend. It initializes the database, services, and HTTP router, and then starts the web server.
*   `main` and `cmd`: These appear to be compiled binaries or artifacts and are not essential to the source code.

## Functionality

The `main.go` file is responsible for:

*   Loading the application configuration.
*   Connecting to the database and running migrations.
*   Initializing all the necessary services (authentication, file storage, etc.).
*   Setting up the Gin HTTP router with middleware for CORS, rate limiting, and error handling.
*   Defining the GraphQL endpoint and playground.
*   Defining RESTful API endpoints for file downloads and other actions.
*   Starting the HTTP server and handling graceful shutdown.
