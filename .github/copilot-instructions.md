# AI Coding Guidelines for Aegis File Vault

## Architecture Overview

Aegis is an **end-to-end encrypted file vault** with a React TypeScript frontend and Go GraphQL backend. The system implements zero-trust security where the backend never sees unencrypted file content.

**Core Components:**
- **Frontend**: React 17 + TypeScript + Material-UI + Apollo Client
- **Backend**: Go 1.21 + Gin + GraphQL (gqlgen) + GORM
- **Database**: PostgreSQL with migrations
- **Storage**: MinIO S3-compatible for encrypted file blobs
- **Security**: TweetNaCl encryption + PBKDF2 key derivation + AES-GCM

**Service Boundaries:**
- `services/` - Business logic with interface-based design
- `repositories/` - Data access layer
- `handlers/` - HTTP request handling
- `middleware/` - Cross-cutting concerns (auth, CORS)

## Critical Development Workflows

### Environment Setup
**Required environment variables must be set before starting:**
```bash
# Database (required)
DATABASE_URL=postgres://user:pass@host:port/db?sslmode=require

# MinIO Storage (required)
MINIO_ACCESS_KEY=key
MINIO_SECRET_KEY=secret

# JWT Security (required)
JWT_SECRET=32-char-random-key
```

**Start development stack:**
```bash
cd aegis/
docker-compose up --build
```

### Code Generation
**GraphQL types are auto-generated - never edit generated files:**
```bash
cd backend/
go run github.com/99designs/gqlgen generate
```

**After schema changes:**
1. Edit `graph/schema.graphql`
2. Run `gqlgen generate`
3. Implement resolvers in `graph/schema.resolvers.go`

### Testing Strategy
**Unit tests for crypto utilities:**
```bash
cd backend/
go test ./internal/services -v -run TestCrypto
```

**Integration tests:**
```bash
cd backend/
go test ./test/integration/... -v
```

**Manual Testing:**
1. DO NOT INSTALL PLAYWRIGHT
2. You have access to an MCP tool called Microsoft Playwright MCP.
3. You will utilize this MCP tool to perform manual end-to-end testing of the application just as a user would perform.
4. You may use the credentials:
    - Email: abshishek@example.com
    - Password: LamePass123!@#

## Project-Specific Patterns

### Encryption Implementation
**Client-side encryption using TweetNaCl:**
```typescript
// Frontend encryption (utils/crypto.ts)
const encrypted = await encryptFile(fileData, userKey);
```

**Key derivation with PBKDF2:**
```typescript
// 100k iterations, 256-bit AES-GCM
const derivedKey = await deriveKeyFromPassword(password, salt);
```

### Service Layer Architecture
**Interface-based services with dependency injection:**
```go
// services/interfaces.go
type FileServiceInterface interface {
    UploadFile(ctx context.Context, ...) error
}

// Implementation with constructor injection
func NewFileService(repo repositories.FileRepositoryInterface) FileServiceInterface {
    return &fileService{repo: repo}
}
```

### Database Patterns
**GORM models with soft deletes:**
```go
type UserFile struct {
    gorm.Model                    // Includes ID, CreatedAt, UpdatedAt, DeletedAt
    UserID       uint
    FileID       uint
    Filename     string
    EncryptionKey string         // Encrypted symmetric key
}
```

**Migrations in numbered SQL files:**
- `migrations/001_initial_schema.sql`
- `migrations/002_add_user_file_unique_constraint.sql`

### Error Handling
**Structured error responses:**
```go
// internal/errors/errors.go
type AppError struct {
    Code    string
    Message string
    Status  int
}
```

### Authentication Flow
**JWT-based auth with refresh tokens:**
```go
// Login returns user + JWT token
user, token, err := authService.Login(email, password)
```

**Protected routes via middleware:**
```go
// middleware/auth.go
func AuthRequired() gin.HandlerFunc
```

## Security-First Development

### File Encryption Flow
1. **Client generates symmetric key** for each file
2. **Encrypts file** with symmetric key using TweetNaCl
3. **Encrypts symmetric key** with user's master password
4. **Stores encrypted file** in MinIO, encrypted key in database
5. **Backend never sees** plaintext content

### Input Validation
**Validate at API boundaries:**
```go
// Use yup schemas for frontend validation
const fileSchema = yup.object({
  filename: yup.string().required().max(255),
  size: yup.number().max(MAX_FILE_SIZE)
});
```

### Database Security
**Parameterized queries via GORM:**
```go
db.Where("user_id = ? AND deleted_at IS NULL", userID).Find(&files)
```

## Key Files & Directories

**Essential reading for new developers:**
- `README.md` - Architecture and setup
- `backend/graph/schema.graphql` - API contract
- `backend/internal/services/interfaces.go` - Service boundaries
- `frontend/src/utils/crypto.ts` - Encryption implementation
- `docker-compose.yml` - Service orchestration
- `backend/migrations/` - Database evolution

**Generated files (do not edit):**
- `backend/graph/generated/`
- `backend/graph/model/models_gen.go`

## Common Pitfalls

- **Environment variables not set** → Application fails to start
- **Editing generated GraphQL code** → Changes lost on regeneration
- **Storing plaintext keys** → Security violation
- **Bypassing service interfaces** → Breaks dependency injection
- **Hardcoded credentials** → Use environment variables

## Development Commands

**Backend development:**
```bash
cd backend/
go mod tidy
go run cmd/main.go
```

**Frontend development:**
```bash
cd frontend/
npm install
npm start
```

**Database operations:**
```bash
# Reset database
docker-compose down -v
docker-compose up postgres
```

**Code quality:**
```bash
cd frontend/
npm run lint
npm run lint:fix
```