# Repositories

This directory contains the data access layer for the Aegis backend. Repositories are responsible for all communication with the database, abstracting the data source from the rest of the application.

## Files

*   `base_repository.go`: Provides a `BaseRepository` struct with common database functionalities, such as a method for validating resource ownership.
*   `room_repository.go`: Handles all database queries related to rooms, including fetching rooms, checking memberships, and managing file and folder sharing within rooms.
*   `user_resource_repository.go`: Manages database queries for user-owned resources like files and folders. It includes methods for filtering, retrieving, and validating ownership of these resources.

## Functionality

Repositories provide a clean API for the application's services to interact with the database. They encapsulate the GORM queries required to perform CRUD (Create, Read, Update, Delete) operations on the data models.

By using the repository pattern, the application's business logic (in the services) is decoupled from the data access logic. This makes the code easier to test, maintain, and reason about.