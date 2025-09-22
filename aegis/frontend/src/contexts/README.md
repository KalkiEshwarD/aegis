# Contexts

This directory contains React context providers that are used for managing global state in the Aegis frontend.

## File

*   `AuthContext.tsx`: This file defines the `AuthContext` and `AuthProvider`, which are used to manage the application's authentication state. It provides the current user, the authentication token, and functions for logging in, registering, and logging out.

## Functionality

Contexts in this directory are used to share state and functionality across different components without having to pass props down through the component tree. This is particularly useful for global state, such as the authentication status of the user.

The `AuthContext` allows any component in the application to access the current user's information and to perform authentication-related actions.
