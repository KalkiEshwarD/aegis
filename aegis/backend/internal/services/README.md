# Services

This directory contains the core business logic of the Aegis backend, organized into various services. Each service is responsible for a specific domain of the application.

## Files

*   `admin_service.go`: Provides administrative functionalities, such as retrieving dashboard statistics.
*   `auth_service.go`: Handles user authentication, including the generation and parsing of JSON Web Tokens (JWT).
*   `base_service.go`: Implements a base service with common functionalities like database access.
*   `crypto_manager.go`: A centralized manager for all cryptographic operations, including key generation, password derivation, and file encryption/decryption.
*   `encryption.go`: Provides services for encryption and decryption, specifically using AES-GCM.
*   `file_service.go`: Manages file and folder operations, including uploads, downloads, deletions, and moves.
*   `file_storage_service.go`: Interacts with a file storage system (like Minio) to handle the underlying storage of file objects.
*   `interfaces.go`: Defines the service interfaces for various parts of the application, promoting a modular and testable architecture.
*   `key_management.go`: Manages cryptographic keys, including generation of random keys, salts, and IVs, as well as key derivation from passwords.
*   `room_service.go`: Manages "rooms" which are collaborative spaces for sharing files and folders.
*   `share_service.go`: Manages the password-based sharing of files, including creating, retrieving, and deleting shares.
*   `user_service.go`: Handles user-related operations like registration, login, and profile updates.

## Functionality

Services in this directory encapsulate the business logic of the application. They are responsible for:

*   Orchestrating calls to repositories to interact with the database.
*   Performing complex business operations.
*   Enforcing business rules and validation.
*   Interacting with external services, such as the file storage service.

By separating the business logic into services, the application becomes more modular, maintainable, and easier to test.