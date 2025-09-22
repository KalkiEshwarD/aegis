# Errors

This directory contains the custom error handling implementation for the Aegis backend.

## File

*   `errors.go`: This file defines a custom `Error` type, a set of standard error codes, and functions for creating and wrapping errors. It also includes a mechanism for loading error codes from a shared JSON file.

## Functionality

This package provides a structured way to handle errors throughout the application. Key features include:

*   **Custom Error Type**: The `Error` struct includes an error code, a message, and the original underlying error. This allows for consistent error responses and easy debugging.
*   **Standardized Error Codes**: A set of predefined error codes (e.g., `ErrCodeNotFound`, `ErrCodeUnauthorized`) are used to classify errors. These codes can be shared with the frontend for consistent error handling on the client-side.
*   **APIError Struct**: The `ToAPIError` method converts a custom `Error` into a standardized `APIError` struct, which is then sent as a JSON response to the client.
*   **Error Wrapping**: The `Wrap` function allows you to wrap an existing error with additional context, preserving the original error information.
