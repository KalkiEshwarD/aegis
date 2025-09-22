# Configuration

This directory contains the application-level configuration for the Aegis frontend.

## Files

*   `api.ts`: This file defines the configuration for the GraphQL and REST APIs. It includes the API endpoints, timeouts, and retry settings for both development and production environments.
*   `crypto.ts`: This file contains the configuration for all cryptographic operations in the frontend. It defines settings for key derivation, encryption algorithms, and key lengths, ensuring that the frontend's cryptography is compatible with the backend.

## Functionality

This directory centralizes all the configuration for the application, making it easy to manage and update. The configuration is loaded from environment variables, which allows for different settings in development and production.

By using a separate configuration file for cryptography, the application can ensure that all cryptographic operations are performed with consistent and secure settings.
