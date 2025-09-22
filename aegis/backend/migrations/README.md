# Database Migrations

This directory contains the SQL migration files for the Aegis backend. These files are used to manage the evolution of the database schema over time.

## Files

Each file in this directory represents a single database migration. The files are numbered sequentially to ensure that they are applied in the correct order. The file names also provide a brief description of the changes they contain.

For example:

*   `001_initial_schema.sql`: This file creates the initial database schema.
*   `002_add_user_file_unique_constraint.sql`: This file adds a unique constraint to the `user_files` table.

## Functionality

Database migrations provide a way to version control the database schema. This allows for:

*   **Reproducible Environments**: New development environments can be quickly set up with the correct database schema.
*   **Collaboration**: Multiple developers can work on the database schema without conflicts.
*   **Rollbacks**: The database schema can be easily rolled back to a previous version if necessary.

These migration files are automatically executed by the application when it starts up, ensuring that the database schema is always up-to-date.
