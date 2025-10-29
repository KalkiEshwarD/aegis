# Aegis File Vault

A production-ready, end-to-end encrypted file vault system built with React TypeScript frontend and Go GraphQL backend, implementing zero-trust security where the backend never sees unencrypted file content.

## Architecture

```
aegis/
├── frontend/          # React 17 + TypeScript + Material-UI + Apollo Client
├── backend/           # Go 1.21 + Gin + GraphQL (gqlgen) + GORM
├── docker-compose.yml # Full stack orchestration
└── migrations/        # PostgreSQL database migrations
```

### Technology Stack

- **Frontend**: React 17 + TypeScript + Material-UI + Apollo Client
- **Backend**: Go 1.21 + Gin + GraphQL (gqlgen) + GORM
- **Database**: PostgreSQL with migrations
- **Storage**: MinIO S3-compatible for encrypted file blobs
- **Security**: TweetNaCl encryption + PBKDF2 key derivation + AES-GCM + JWT authentication

## Security Features

### End-to-End Encryption (E2EE)
- **Client-side encryption**: Files are encrypted in the browser before upload
- **Zero-trust backend**: Server never sees plaintext content
- **Industry-standard crypto**: TweetNaCl for encryption, PBKDF2 for key derivation
- **Secure key management**: Symmetric keys encrypted with user credentials

### Authentication & Authorization
- **JWT-based authentication** with secure token handling
- **Role-based access control** for file and room operations
- **bcrypt password hashing** with configurable cost
- **Secure session management** with automatic token refresh

### Data Protection
- **MIME type validation** prevents content mismatches
- **SQL injection prevention** via parameterized queries
- **Input validation** at API and service layers

## Features

### Core Infrastructure
- Multi-service Docker setup (PostgreSQL, MinIO, Go backend, React frontend)
- Database schema with migrations
- GraphQL API with type-safe code generation
- Apollo Client integration with error handling and caching
- Material-UI component library

### File Management
- End-to-end encrypted file upload and download
- File sharing with password-based permissions
- Folder organization
- File starring and search
- Drag-and-drop upload interface

### Collaboration
- Room-based sharing system with granular permissions
- User roles: Admin, Creator, Editor, Viewer
- Secure key sharing for collaborative access

### Administration
- Admin dashboard with system statistics
- User management capabilities
- System monitoring and health checks
- Structured logging for production debugging

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local frontend development)
- Go 1.21+ (for local backend development)

### Environment Setup

1. **Navigate to project directory**:
   ```bash
   cd aegis/
   ```

2. **Set required environment variables**:
   ```bash
   # Database (required)
   export DATABASE_URL="postgres://user:pass@host:port/db?sslmode=require"

   # MinIO Storage (required)
   export MINIO_ACCESS_KEY="your_secure_access_key"
   export MINIO_SECRET_KEY="your_secure_secret_key"

   # JWT Security (required)
   export JWT_SECRET="32-char-random-key"
   ```

3. **Start development stack**:
   ```bash
   docker-compose up --build
   ```

4. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend GraphQL: http://localhost:8080/graphql
   - MinIO Console: http://localhost:9001 (minioadmin/minioadmin123)

### Environment Variables

**Required** (application will not start without these):
- `DATABASE_URL`: PostgreSQL connection string
- `MINIO_ACCESS_KEY`: MinIO access key
- `MINIO_SECRET_KEY`: MinIO secret key
- `JWT_SECRET`: 32-character random key for JWT signing

**Optional** (have sensible defaults):
- `MINIO_ENDPOINT`: MinIO server endpoint (default: minio:9000)
- `MINIO_BUCKET`: Storage bucket name (default: aegis-files)
- `PORT`: Backend server port (default: 8080)
- `GIN_MODE`: Gin mode (default: debug)
- `CORS_ALLOWED_ORIGINS`: Allowed CORS origins

## Development

### Backend Development
```bash
cd backend/
go mod tidy
go run cmd/main.go
```

### Frontend Development
```bash
cd frontend/
npm install
npm start
```

### Code Generation
GraphQL types are auto-generated - never edit generated files:
```bash
cd backend/
go run github.com/99designs/gqlgen generate
```

### Testing
```bash
# Backend unit tests
cd backend/
go test ./internal/services -v -run TestCrypto

# Backend integration tests
go test ./test/integration/... -v

# Frontend tests
cd frontend/
npm test
```

## Production Deployment

### Security Hardening
- Replace default JWT secret with cryptographically secure key
- Enable HTTPS/TLS for all endpoints
- Implement rate limiting per user/IP
- Add audit logging for all file operations
- Configure MinIO with proper access policies

### Docker Production
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Project Structure

```
aegis/
├── backend/
│   ├── cmd/                    # Application entry points
│   ├── graph/                  # GraphQL schema and resolvers
│   ├── internal/
│   │   ├── config/            # Configuration management
│   │   ├── database/          # Database connection
│   │   ├── errors/            # Error handling
│   │   ├── handlers/          # HTTP request handlers
│   │   ├── middleware/        # Cross-cutting concerns
│   │   ├── models/            # GORM models
│   │   ├── repositories/      # Data access layer
│   │   ├── services/          # Business logic
│   │   └── utils/             # Utility functions
│   ├── migrations/            # Database migrations
│   └── test/                  # Test files
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── apollo/            # GraphQL client setup
│   │   └── utils/             # Frontend utilities
│   └── config/                # Build configuration
└── shared/                    # Shared validation rules
```

## Contributing

1. Follow the established architecture patterns
2. Implement interface-based services with dependency injection
3. Use client-side encryption for all file operations
4. Add comprehensive tests for new features
5. Update documentation for API changes

## License

Copyright Kalki Eshwar D 2025