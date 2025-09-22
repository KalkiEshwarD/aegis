# Handlers

This directory contains the HTTP handlers for the RESTful API endpoints of the Aegis backend.

## File

*   `file_handler.go`: This file defines the `FileHandler` struct and its methods, which are responsible for handling file-related HTTP requests. Currently, it includes a `DownloadFile` method that allows authenticated users to download their files.

## Functionality

Handlers in this directory are responsible for:

*   Parsing and validating incoming HTTP requests.
*   Calling the appropriate services to perform business logic.
*   Handling errors and sending appropriate HTTP responses.
*   Setting response headers, such as `Content-Disposition` for file downloads.

This package acts as the controller layer in a traditional MVC architecture, connecting the web framework (Gin) to the application's services.
