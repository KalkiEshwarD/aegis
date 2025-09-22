# Database

This directory is responsible for managing the database connection for the Aegis backend.

## Files

*   `database.go`: This file contains the core logic for connecting to the database, running migrations, and closing the connection. It supports both PostgreSQL and SQLite databases.
*   `db.go`: This file provides a `DB` struct that encapsulates the `gorm.DB` instance. It also includes functions for creating a new `DB` service and accessing the underlying `gorm.DB` instance. A global `DB` instance is also provided for convenience in tests.

## Functionality

This package provides a centralized way to manage the database connection. The `Connect` function in `database.go` reads the database URL from the configuration and initializes a GORM database instance. The `AutoMigrate` function can be used to automatically run database migrations, although it is currently commented out in favor of manual migrations.

The `DB` struct in `db.go` acts as a service that can be injected into other parts of the application, allowing them to access the database in a controlled way.
