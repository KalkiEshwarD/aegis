# Configuration

This directory is responsible for managing the application's configuration.

## Files

*   `config.go`: This file defines the main `Config` struct and loads configuration values from environment variables. It also includes validation to ensure that the configuration is secure and well-formed.
*   `crypto_config.go`: This file defines the `CryptoConfig` struct, which holds settings for all cryptographic operations, such as key lengths and algorithm choices. It also loads these settings from environment variables.
*   `routes.go`: This file provides helper functions for building URLs to different API endpoints, based on the base URL and endpoint paths defined in the configuration.

## Functionality

This package centralizes all configuration management for the application. It reads environment variables, provides default values, and validates the configuration to prevent common security mistakes. The `Config` and `CryptoConfig` structs are then used throughout the application to access configuration settings in a type-safe way.
