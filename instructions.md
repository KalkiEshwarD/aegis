# Comprehensive Instructions for Production-Grade Code Generation

## 0. Core Principles

**Decomposition is Mandatory**: Never generate complex applications as a single file. Decompose the system into a logical multi-file and multi-directory structure based on features, layers (API, service, data access), or components.

**Security is Not Optional**: Implement security from the start. All generated code must adhere to the "Security First" principle. Assume all user input is untrusted.

**Configuration via Environment**: All configuration, especially secrets, credentials, and environment-specific settings (e.g., database URLs, API keys), must be managed through environment variables. Never hardcode these values.

**Stateless First**: Design backend services to be stateless. State should be externalized to a database, cache, or object store to enable horizontal scalability.

**Follow the Plan**: Adhere strictly to the provided architectural plan, technology stack, and data models. Do not introduce unrequested technologies or deviate from the specified design patterns.

**Iterative & Production-Ready Features**: Adopt a feature-by-feature development model.

**Keep it Simple**: Implement the simplest possible solution to meet the requirements of the current feature.

**Vertical Slices**: Each feature must be a complete, "production-ready" vertical slice of functionality.

**Test Before Proceeding**: A feature is only considered complete when it is accompanied by comprehensive unit tests that validate its correctness. Do not begin the next feature until the current one is fully developed and tested.

## 1. System Architecture & Scaffolding

**Three-Tier Architecture**: Unless specified otherwise, structure applications with a clear separation of concerns:

- **Frontend (Client)**: Manages UI and user interaction.
- **Backend (Service)**: Contains business logic, API endpoints, and orchestrates data flow.
- **Data Tier**: Consists of databases, object stores, and other persistent storage.

**Directory Structure**: Create a logical and clean directory structure. For a typical web service, this includes:

- `/cmd` or `/src`: Main application entry points.
- `/pkg` or `/lib`: Shared libraries and internal logic.
- `/internal` or `/src/app`: Private application code.
- `/api` or `/routes`: API definitions, handlers, and controllers.
- `/models` or `/domain`: Core data structures and business logic.
- `/store` or `/data`: Data access layer (database interaction).
- `/config`: Configuration loading and management.
- `/scripts`: Build, deployment, or utility scripts.
- `/migrations`: Database schema migration files.

**Containerization**: Generate a Dockerfile for each service and a `docker-compose.yml` file to orchestrate the entire application stack for local development.

## 2. Backend Service Generation

**API Contract First**: Before writing implementation logic, define a clear API contract using a schema like OpenAPI (for REST) or a GraphQL Schema Definition Language (SDL).

**Layered Logic**: Structure backend code into distinct layers:

- **Handler/Controller Layer**: Parses incoming requests, validates input, and calls the service layer. It should not contain business logic.
- **Service Layer**: Orchestrates business logic. It validates data in the context of business rules and coordinates data access.
- **Data Access Layer (DAL/Repository)**: Abstracts all interaction with the database. The service layer should only interact with the DAL, not directly with the database driver.

**Input Validation**: Rigorously validate all incoming data at the API handler level (e.g., path parameters, query strings, request bodies). Check for correct types, formats, ranges, and lengths.

**Structured Logging**: Implement structured, leveled logging (e.g., JSON format). Logs should include contextual information like request IDs, user IDs, and timestamps to facilitate debugging.

## 3. Data & Persistence

**Use the Right Tool for the Job**:

- **Relational Databases** (e.g., PostgreSQL): For structured metadata, user information, and relations.
- **Object Storage** (e.g., S3-compatible services): For storing unstructured data like files, images, or backups. Do not store large binary blobs in the database.

**Database Migrations**: Always generate database schema changes as versioned migration files. Use a standard migration tool to manage the schema lifecycle. Do not rely on ORM "auto-sync" features in production.

**Query Optimization**: Generate efficient database queries. Use indexes for frequently queried columns, especially foreign keys and columns used in WHERE, JOIN, or ORDER BY clauses.

## 4. Security Implementation

**Authentication & Authorization**:

- Implement robust user authentication. Use a standard, secure method for password hashing (e.g., bcrypt, Argon2).
- Generate JWTs for session management and API access, including claims for user ID and roles.
- Enforce Role-Based Access Control (RBAC) at the API and service layers for every operation. Check permissions on every request.

**End-to-End Encryption (E2EE)**: For applications handling sensitive files, implement E2EE.

- Encryption and decryption logic must reside on the client-side.
- The backend must be treated as a zero-trust environment; it should only handle encrypted data blobs and their associated metadata.

**Prevent Common Vulnerabilities**: Actively generate code that prevents OWASP Top 10 vulnerabilities, including:

- **SQL Injection**: Use parameterized queries or prepared statements.
- **Cross-Site Scripting (XSS)**: Sanitize all user-provided data before rendering it on the frontend.
- **Insecure Deserialization**: Avoid deserializing untrusted data without proper checks.

## 5. Multi-File Code Generation

**Component-Based Frontend**: For frontends (e.g., React, Angular, Vue), generate code as a collection of small, reusable components. Each component should have its own file.

**Backend Modularity**: Decompose backend logic into multiple files based on features. For example: `user_service.go`, `file_service.go`, `room_handler.go`.

**Generate Entrypoints**: Create main entrypoint files (e.g., `main.go`, `index.js`) that are responsible for initializing the server, database connections, and wiring all the different modules together.

## 6. Testing Strategy

**Structured Test Generation**:

- **Naming and Location**: For every code file, generate a corresponding test file alongside it. Use standard language-specific naming conventions (e.g., `filename_test.go`, `filename.test.js`, `filename.spec.ts`).
- **Test Function Clarity**: Test functions must be clearly named to describe the behavior they are testing (e.g., `TestCreateUser_WithValidInput`, `it('should return an error for a duplicate email')`).

**Test Data Management**:

- **Fixtures Directory**: Create a dedicated top-level directory (e.g., `/testdata` or `/fixtures`) to store reusable dummy data files (e.g., JSON payloads, mock images).
- **Test Data Helpers**: For generating complex test objects, create helper functions or factories. This keeps the test logic clean and separates data setup from the test assertions.

**Multi-Layered Testing**:

- **Unit Tests**: Generate tests for individual functions and modules in isolation. Use mocks for external dependencies like databases or APIs.
- **Integration Tests**: Generate tests for the interaction between different layers, such as the service layer and the database.
- **E2E Tests**: Generate scripts for automated end-to-end testing frameworks (e.g., Playwright, Cypress) to validate critical user flows.

## 7. Error Handling & Debugging

**Graceful Failure**: All functions that can potentially fail (e.g., I/O operations, network requests, database calls) must handle errors gracefully. Never let an unhandled exception or panic crash the service. Use try-catch blocks, Result types, or Go's error return pattern.

**Avoid Infinite Loops**: When handling errors that might be transient (e.g., network timeout, service unavailability), do not simply retry in a tight loop. Implement a retry mechanism with exponential backoff and a maximum number of retries to prevent overwhelming a struggling service.

**Clear API Error Responses**: Design clear and consistent error responses for the API. Use appropriate HTTP status codes (e.g., 400 for bad input, 401/403 for auth issues, 500 for server errors). The response body should contain a machine-readable error code and a human-readable message.

**Contextual Error Logging**: When an error is caught, log it with as much context as possible. This includes the full stack trace, the request ID, the user ID (if available), and the input parameters that caused the error. This is critical for post-mortem debugging.

**Health Checks**: Implement a dedicated health check endpoint (e.g., `/healthz` or `/status`). This endpoint should check the status of critical dependencies like the database and object store, returning a 200 OK status if healthy and a 5xx status otherwise. This allows orchestrators to automatically restart unhealthy service instances.

## 8. Code Quality & Maintainability

**Respect Abstractions (DRY Principle)**: Before generating any new code, analyze the existing codebase for functions, methods, or components that already solve the problem. You must reuse existing abstractions. Do not re-implement logic that is already encapsulated. Adhere strictly to the "Don't Repeat Yourself" (DRY) principle.

**Single Responsibility Principle**: Generate functions, classes, and modules that have a single, well-defined responsibility. Code that is focused is easier to understand, test, and reuse.

**Readability and Documentation**: Generate clean, readable, and idiomatic code for the target language. Add concise comments to explain why a piece of code exists, especially for complex business logic, algorithms, or non-obvious workarounds. Generate documentation for public APIs and functions (e.g., GoDoc, JSDoc).

**Automated Formatting and Linting**: All generated code must adhere to standard formatting and linting rules for the target language (e.g., `gofmt` for Go, Prettier for JavaScript/TypeScript, Black for Python). This ensures consistency and prevents stylistic debates.

## 9. Continuous Documentation

**Document After Each Iteration**: Documentation is not a final step but a continuous process. After a feature is developed and tested, its documentation must be created or updated.

**Centralized Documentation**: All project documentation must be stored in a dedicated top-level `/docs` directory.

**Key Documentation to Generate**:

- **API Reference**: Ensure the API documentation (e.g., OpenAPI spec, GraphQL schema) is always in sync with the latest code.
- **README.md**: Maintain a clear and concise `README.md` with a project overview, setup instructions, and deployment steps.