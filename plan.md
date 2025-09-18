# Project Execution Plan: Production-Grade Secure File Vault

## 1. Understand Requirements
This section synthesizes the core requirements from the project document and the additional specified features into a clear set of functional and non-functional goals.

### Functional Requirements

#### User & Authentication:
- User registration and login
- JWT-based authentication for API access

#### File Operations:
- Single and multiple file uploads with drag-and-drop support
- Content hashing (SHA-256) for integrity verification
- MIME type validation to prevent content mismatches
- List, view, and delete owned files

#### Search & Filtering:
- Performant search by filename
- Combine filters for MIME type, size, date range, and uploader

#### Collaboration & Sharing (Rooms):
- Create secure, invite-only "File Rooms"
- Assign granular roles to room members: Admin, Content Creator, Content Editor, Content Viewer
- Share files within a room context based on user permissions

#### Admin Panel:
- Dashboard to view system-wide statistics
- Manage all users, files, and rooms
- View detailed analytics like download counts and user access lists

#### Statistics:
- Users can view their storage usage and file counts

### Non-Functional Requirements

#### Security:
- **End-to-End Encryption (E2EE)**: Files must be encrypted on the client side before upload and decrypted only on the client side. The server must never have access to unencrypted file content
- Role-Based Access Control (RBAC) for all file and room operations

#### Performance:
- Per-user API rate limiting (configurable, e.g., 2 requests/sec)
- Per-user storage quotas (configurable, e.g., 10 MB)
- Optimized database queries for fast search and filtering at scale

#### Scalability:
- The architecture must support horizontal scaling of the backend service

#### Deployability:
- The entire application stack must be containerized using Docker and manageable via Docker Compose

#### Testability:
- The system must be designed for automated testing, with a defined strategy for UI, API, and unit tests

## 2. System Architecture
We will adopt a modern, containerized, three-tier architecture that separates concerns, enhances security, and is built for scalability.

### Architecture Diagram

```
+----------------+      +-------------------------+      +--------------------+
|                |      |                         |      |                    |
|   User/Client  |----->|   Go Backend Service    |----->|  PostgreSQL DB     |
| (React.js SPA) |      |     (GraphQL API)       |      | (Metadata, Users)  |
|                |      |                         |      +--------------------+
+----------------+      +-------------------------+      +--------------------+
                         |                         |      |                    |
                         |                         |      |  MinIO Object      |
                         +------------------------->|  Storage (S3 API)  |
                                                   | (Encrypted Files)  |
                                                   +--------------------+
```

### Component Breakdown

**Frontend (Client)**: A React.js Single Page Application (SPA) responsible for all UI rendering and user interaction. It handles client-side encryption/decryption and communicates with the backend via a GraphQL API.

**Backend (Go Service)**: A stateless Go application that serves the GraphQL API. It manages business logic, user authentication, authorization (RBAC), file metadata, and interactions with the database and object storage. It never handles unencrypted file data.

**Database (PostgreSQL)**: Stores all metadata, including user information, file hashes, user_file mappings, room details, permissions, and statistics. It does not store file content (blobs).

**File Storage (MinIO)**: An S3-compatible object storage server. It stores the actual file content, which is received in its encrypted form. All interactions with MinIO are proxied through the Go backend to ensure security and control.

### Data Flow (File Upload with E2EE)

1. **Client**: The user selects a file. The React app reads the file, calculates its SHA-256 hash, and encrypts the file content using a symmetric key.

2. **API Call**: The client sends the encrypted file content along with metadata (filename, hash, size) to the Go backend via a GraphQL mutation.

3. **Backend**: The backend checks if a file with the same hash already exists in the files table.
   - **If duplicate**: It simply creates a new entry in the user_files table, linking the current user to the existing file blob.
   - **If new**: It uploads the encrypted file content to MinIO via its S3 API and creates entries in the files and user_files tables.

4. **Client**: Receives confirmation from the backend after successful upload.

5. **Download**: For downloads, the client requests the file via GraphQL; the backend retrieves the encrypted file from MinIO and streams it back to the client, which then decrypts it.
## 3. Tech Stack & Tools
The tech stack is chosen to align with the project requirements and to facilitate rapid development.

### Backend
- **Language**: Go (Golang)
- **API Layer**: GraphQL (gqlgen library)
- **Database**: PostgreSQL (GORM or sqlx for DB interaction)

### Frontend
- **Framework**: React.js with TypeScript
- **UI Framework**: Material-UI or Chakra UI (for pre-built components to speed up development)
- **State/API**: Apollo Client for React

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Object Storage**: MinIO

### Testing
- **E2E/API Automation**: Playwright
- **Backend Unit Tests**: Go's standard testing package
- **CI/CD**: GitHub Actions

### Security
- **Password Hashing**: golang.org/x/crypto/bcrypt
- **Client-side E2EE**: A robust JS crypto library (tweetnacl-js or similar)

## 4. Design Phase

### Design Principles

**Security-First**: All design decisions prioritize security, especially data privacy through E2EE and strict access controls.

**Modularity**: The Go backend will be structured into distinct layers (API handler, service, data access) to ensure separation of concerns and ease of testing.

**Stateless Services**: The Go backend will be stateless to allow for easy horizontal scaling behind a load balancer.

### Database Schema (High-Level)

- **users**: id, email, password_hash, storage_quota, used_storage
- **files**: id, content_hash (SHA-256, UNIQUE), size_bytes
- **user_files**: id, user_id (owner), file_id, filename, metadata (stores encrypted key)
- **rooms**: id, name, creator_id
- **room_members**: room_id, user_id, role (e.g., 'admin', 'viewer')
- **room_files**: room_id, user_file_id
- **download_logs**: id, user_file_id, downloader_user_id, timestamp

### API Design (GraphQL Snippets)

```graphql
type Mutation {
  uploadFile(input: UploadFileInput!): UserFile!
  createRoom(name: String!): Room!
  addUserToRoom(roomId: ID!, userId: ID!, role: Role!): Boolean!
}

type Query {
  myFiles(filter: FileFilterInput): [UserFile!]!
  room(id: ID!): RoomDetails!
  adminStats: AdminDashboard!
}

enum Role {
  ADMIN
  CONTENT_CREATOR
  CONTENT_EDITOR
  CONTENT_VIEWER
}
```

### Frontend Component Design

- **AuthLayout**: Handles login and registration pages
- **AppLayout**: Main authenticated view with sidebar and content area
- **FileUploadDropzone**: Reusable component for file uploads
- **FileTable**: Displays lists of files with actions (download, delete, share)
- **RoomManager**: Component for creating rooms, inviting users, and setting permissions
- **AdminDashboard**: A view with charts and tables for admin analytics

## 5. Development Plan (7-Day Schedule)
This is an aggressive timeline focused on delivering a Minimum Viable Product (MVP) first, then layering on advanced features.

**MVP Definition**: A user can register, log in, upload files (with E2EE), view their own files, and delete them. All within a Dockerized environment.

### Day 1: Project Scaffolding & Foundation
**Goal**: Create a runnable "hello world" across the entire stack.

**Tasks**:
- Initialize Git repository
- Create docker-compose.yml for Go, Postgres, MinIO, and React services
- Backend: Set up Go project structure, basic GraphQL server, and database connection
- Database: Write initial schema migration files
- Frontend: Initialize React/TS app with basic routing and API client setup

### Day 2: User Authentication & Core File Upload
**Goal**: Users can sign up, log in, and upload a file.

**Tasks**:
- Backend: Implement user registration and login mutations (with password hashing and JWT generation)
- Backend: Implement the core file upload logic (hash check, metadata storage, pre-signed URL generation)
- Frontend: Build Login/Registration forms and connect to the API
- Frontend: Implement the file upload component

### Day 3: E2EE & File Management
**Goal**: Secure uploads and allow users to manage their files.

**Tasks**:
- Frontend: Integrate a crypto library to perform client-side encryption before upload
- Backend: Implement GraphQL queries for listing and deleting user_files
- Frontend: Build the main dashboard to list encrypted files. Add decryption logic for downloads

**Milestone**: MVP is feature-complete.

### Day 4: Search & Statistics
**Goal**: Implement server-side search and display user stats.

**Tasks**:
- Backend: Implement the search/filter GraphQL query
- Backend: Implement logic to calculate storage savings
- Frontend: Build the search bar and filter UI
- Frontend: Add a statistics component to the user dashboard

### Day 5: Collaborative Rooms & Permissions
**Goal**: Users can create rooms and share files securely.

**Tasks**:
- Backend: Implement GraphQL mutations/queries for creating rooms, managing members, and assigning roles
- Backend: Implement RBAC logic for all room-related actions
- Frontend: Build the UI for creating/managing rooms and viewing files within them
- E2EE Strategy: Implement key sharing (e.g., room owner encrypts the room's symmetric key with each member's public key)

### Day 6: Admin Panel & Automated Testing
**Goal**: Build the admin view and establish a testing foundation.

**Tasks**:
- Backend: Create admin-only GraphQL queries for system-wide data
- Frontend: Build the Admin Panel UI with basic stats and management tables
- Testing: Write critical Playwright tests for login, file upload, and file deletion flows

### Day 7: CI/CD, Deployment Prep, and Polish
**Goal**: Automate the build process and prepare for deployment.

**Tasks**:
- CI/CD: Create a GitHub Actions workflow to build, lint, and run tests on every push
- Deployment: Finalize production Dockerfiles and a docker-compose.prod.yml
- Documentation: Write the README.md, API documentation, and setup instructions
- Reserve this day for bug fixing, UI polish, and final validation

## 6. Testing Strategy
**Unit Testing (Go)**: Focus on testing pure business logic functions in the backend, such as hashing algorithms, validation logic, and permission checks.

**Integration Testing (Go)**: Test the interaction between the service layer and the database to ensure queries are correct.

**End-to-End (E2E) & API Testing (Playwright)**: Automate critical user flows from the UI down to the API.

### User Acceptance Testing (UAT) Checklist

#### Authentication:
- [ ] A new user can successfully register
- [ ] A registered user can log in and out
- [ ] An unauthenticated user cannot access protected resources

#### File Management:
- [ ] A user can upload a file via drag-and-drop
- [ ] A user can download their own file, and it decrypts correctly
- [ ] A user can delete their own file

#### Collaboration:
- [ ] A user can create a new room
- [ ] A room admin can add a user with a Content Viewer role
- [ ] The Content Viewer can see files in the room but cannot upload or delete

#### Admin:
- [ ] An admin user can log in and see the admin dashboard
- [ ] The admin can view a list of all files in the system

## 7. Implementation & Deployment

### CI/CD Pipeline (GitHub Actions)
A workflow file (`.github/workflows/main.yml`) will automate the following on every push to the main branch:

1. **Checkout Code**: Fetch the latest commit
2. **Run Backend Tests**: Build the Go service and run all unit and integration tests
3. **Run Frontend Tests**: Install dependencies and run Playwright E2E tests
4. **Build Docker Images**: If all tests pass, build production-ready Docker images for the backend and frontend
5. **Push to Registry**: Tag and push the images to a container registry (e.g., GitHub Container Registry or Docker Hub)

### Deployment Strategy
**Environment**: A single Linux server (VPS) running Docker.

**Process**:
1. SSH into the server
2. Pull the latest version of the `docker-compose.prod.yml` file from the repo
3. Run `docker-compose -f docker-compose.prod.yml pull` to fetch the new images built by the CI pipeline
4. Run `docker-compose -f docker-compose.prod.yml up -d` to restart the services with the new images

**Monitoring & Rollback**:
- **Monitoring**: Basic application health can be checked via `docker ps` and `docker logs`. A dedicated health check endpoint (`/healthz`) will be added to the Go service
- **Rollback**: In case of failure, deployment can be rolled back by manually pulling the previous Docker image tag and restarting the containers

## 8. Validation & Go-Live
Before the final deadline, a thorough validation process will be executed:

- **Requirement Check**: Go through every functional and non-functional requirement and verify its implementation against the UAT checklist.
- **Security Audit**: Perform a manual review for common security vulnerabilities (e.g., OWASP Top 10), ensuring no secrets are hardcoded and all API endpoints enforce correct permissions.
- **Deployment Dry-Run**: Simulate a full deployment on a clean environment to ensure the process is smooth and documented correctly.
- **Final Review**: Review all deliverables: code, documentation, and Docker setup.

## 9. Risk Management

### Risk 1: Timeline Constraint & Scope Creep
**Mitigation**: Adhere strictly to the 7-day plan. De-scope non-essential "nice-to-have" features if time runs short. The MVP is the primary goal. Daily check-ins will be crucial to stay on track.

### Risk 2: Complexity of E2EE Key Management for Rooms
**Mitigation**: Implement a simple and well-documented key-sharing mechanism. Avoid complex schemes like key rotation or perfect forward secrecy, which are out of scope for a 7-day project. Clearly document the security model and its limitations.

### Risk 3: Integration or Tooling Issues
**Mitigation**: Rely on mature, well-documented libraries and tools. Allocate buffer time on Day 7 specifically for troubleshooting unforeseen technical hurdles.

## 10. Best Practices for Long-Term Success

- **Configuration Management**: All configuration (database URLs, secret keys, quotas) will be managed through environment variables, never hardcoded.
- **Comprehensive Logging**: Implement structured logging (e.g., JSON format) in the Go backend to facilitate easier debugging and monitoring in a production environment.
- **Database Migrations**: Use a migration tool (like golang-migrate/migrate) to manage database schema changes versionally and reliably.
- **Code Quality**: Enforce code formatting (gofmt) and linting in the CI pipeline to maintain a clean and consistent codebase.
- **Documentation**: Ensure GoDoc for backend functions and clear comments for complex frontend logic are written during development, not as an afterthought.