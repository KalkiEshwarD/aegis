# Middleware

This directory contains the Gin middleware for the Aegis backend.

## Files

*   `auth.go`: This file provides an authentication middleware that validates JWT tokens from the `Authorization` header. It also includes helper functions for extracting user information from the request context and requiring admin privileges.
*   `error.go`: This file contains an error handling middleware that catches errors that occur during request processing and returns a standardized JSON error response.
*   `rate_limit.go`: This file implements a rate limiting middleware to prevent abuse. It limits the number of requests per IP address.
*   `security.go`: This file provides middleware for adding important security headers to HTTP responses, such as `Content-Security-Policy`, `X-Frame-Options`, and `Strict-Transport-Security`.

## Functionality

Middleware in this directory is used to process incoming HTTP requests before they reach the actual handlers. This allows for the implementation of cross-cutting concerns such as:

*   **Authentication and Authorization**: Ensuring that only authenticated and authorized users can access certain endpoints.
*   **Error Handling**: Providing a consistent error response format across the entire API.
*   **Rate Limiting**: Protecting the application from denial-of-service attacks.
*   **Security**: Hardening the application against common web vulnerabilities.
