# Utilities

This directory contains various utility packages and functions that are used throughout the Aegis frontend.

## Files

*   `auth.ts`: Provides authentication-related utilities, such as a function for refreshing JWT tokens.
*   `crypto.ts` & `cryptoManager.ts`: These files contain a centralized manager and utility functions for all cryptographic operations, including key derivation, encryption, and decryption.
*   `dataTransformation.ts`: Contains functions for transforming data, such as formatting file sizes and converting between different data types.
*   `errorHandling.ts`: Provides utilities for handling and displaying errors in a consistent way.
*   `fileOperations.ts` & `fileUtils.tsx`: These files provide helper functions for working with files, such as calculating file hashes, detecting MIME types, and getting file icons.
*   `pagination.ts`: Contains utilities for paginating data.
*   `sanitization.ts`: Provides functions for sanitizing user input to prevent security vulnerabilities.
*   `sortingFiltering.ts`: Contains helper functions for sorting and filtering slices of data.
*   `validation.ts` & `validationConfig.ts`: These files provide a framework and configuration for validating data, including functions for validating emails, passwords, and other common data types.

## Functionality

This package provides a collection of reusable functions that encapsulate common tasks and operations. By using these utilities, the rest of the application can avoid code duplication and focus on its core business logic.
