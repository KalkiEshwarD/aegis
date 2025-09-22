# Utilities

This directory contains various utility packages and functions that are used throughout the Aegis backend.

## Files

*   `crypto.go`: Provides cryptographic utilities, including functions for key derivation, encryption, and decryption.
*   `data_transformation.go`: Contains functions for transforming data, such as formatting file sizes and converting between different data types.
*   `file_operations.go`: Provides helper functions for working with files, such as calculating file hashes and detecting MIME types.
*   `pagination.go`: Contains utilities for paginating data, including functions for calculating offsets and creating pagination metadata.
*   `sanitization.go`: Provides functions for sanitizing user input to prevent security vulnerabilities like XSS and SQL injection.
*   `sorting_filtering.go`: Contains helper functions for sorting and filtering slices of data.
*   `validation.go`: Provides a framework for validating data, including functions for validating emails, passwords, and other common data types.

## Functionality

This package provides a collection of reusable functions that encapsulate common tasks and operations. By using these utilities, the rest of the application can avoid code duplication and focus on its core business logic.
