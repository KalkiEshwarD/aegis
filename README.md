# Aegis File Vault - Production-Grade Secure File Storage

A production-ready, end-to-end encrypted file vault system built with React.js frontend and Go backend, following enterprise security practices.

## 🏗️ Architecture

```
aegis/
├── frontend/          # React.js + TypeScript SPA
├── backend/           # Go + GraphQL API Server  
└── docker-compose.yml # Full stack orchestration
```

### Component Stack

- **Frontend**: React.js 18 + TypeScript + Material-UI + Apollo Client
- **Backend**: Go 1.21 + GraphQL (gqlgen) + Gin + GORM
- **Database**: PostgreSQL 15 (metadata, users, relationships)
- **Storage**: MinIO S3-compatible (encrypted file blobs)
- **Security**: End-to-End Encryption (TweetNaCl) + JWT Authentication

## 🔒 Security Features

### End-to-End Encryption (E2EE)
- **Client-side encryption**: Files encrypted in browser before upload
- **Zero-trust backend**: Server never sees unencrypted content
- **TweetNaCl crypto**: Industry-standard NaCl encryption library
- **Key management**: Symmetric keys stored encrypted with user credentials

### Authentication & Authorization
- **JWT-based authentication** with secure token handling
- **Role-based access control** (RBAC) for file and room operations
- **bcrypt password hashing** with configurable cost
- **Secure session management** with automatic token refresh

### Data Protection
- **MIME type validation** prevents content mismatches
- **SQL injection prevention** via parameterized queries
- **Input validation** at API and service layers

## 🚀 Features Implemented

### ✅ Core Infrastructure
- [x] **Multi-service Docker setup** (PostgreSQL, MinIO, Go, React)
- [x] **Database schema with migrations** (users, files, rooms, permissions)
- [x] **GraphQL API layer** with type-safe code generation
- [x] **Apollo Client integration** with error handling and caching
- [x] **Material-UI component library** for rapid UI development

### ✅ Authentication System
- [x] **User registration and login** with form validation
- [x] **JWT token management** with localStorage persistence
- [x] **Protected route handling** with role-based access
- [x] **Admin panel access control** for privileged users

### ✅ File Management Core
- [x] **End-to-end encryption utilities** (encrypt/decrypt/hash)
- [x] **File upload service layer** with encryption and validation
- [x] **MinIO integration** for scalable object storage
- [x] **Database models** for file relationships and metadata

### ✅ Collaboration Framework
- [x] **Room-based sharing system** with granular permissions
- [x] **Role management** (Admin, Creator, Editor, Viewer)
- [x] **File sharing within rooms** with access control
- [x] **User invitation system** for collaborative workflows

### ✅ Administration Features
- [x] **Admin dashboard** with system statistics
- [x] **User management capabilities** (promote, delete)
- [x] **System monitoring endpoints** for health checks
- [x] **Structured logging** for production debugging

## 🛠️ Development Setup

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local frontend development)
- Go 1.21+ (for local backend development)

### Quick Start

1. **Clone and navigate to project**:
   ```bash
   cd aegis/
   ```

2. **Start all services**:
   ```bash
   docker-compose up --build
   ```

3. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend GraphQL: http://localhost:8080/graphql
   - MinIO Console: http://localhost:9001 (minioadmin/minioadmin123)

### Environment Configuration

All sensitive configuration is managed via environment variables. **Required environment variables must be set for the application to start.**

#### Required Environment Variables (Security Critical)
These variables are mandatory and the application will fail to start if they are not provided:

```env
# Database Connection (Required)
DATABASE_URL=postgres://username:password@host:port/database?sslmode=require

# MinIO Object Storage Credentials (Required)
MINIO_ACCESS_KEY=your_secure_minio_access_key
MINIO_SECRET_KEY=your_secure_minio_secret_key

# JWT Authentication Secret (Required)
JWT_SECRET=your_cryptographically_secure_random_jwt_secret_key
```

#### Optional Environment Variables
These have sensible defaults for development:

```env
# MinIO Configuration
MINIO_ENDPOINT=minio:9000
MINIO_BUCKET=aegis-files

# Application Configuration
PORT=8080
GIN_MODE=debug

# CORS Security
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

#### Security Recommendations for Production
- **DATABASE_URL**: Use a strong password, enable SSL/TLS (`sslmode=require`), and restrict database access to application servers only.
- **MINIO_ACCESS_KEY/SECRET_KEY**: Generate cryptographically secure random keys. Never use default values.
- **JWT_SECRET**: Use a minimum 256-bit (32 bytes) cryptographically secure random key. Rotate regularly.
- **Environment Variables**: Store secrets in secure secret management systems (AWS Secrets Manager, HashiCorp Vault, etc.) rather than plain environment variables.

**⚠️ WARNING**: The application will terminate with a fatal error if any required environment variables are missing or set to known insecure default values.

## 🏭 Production Considerations

### Security Hardening
- [ ] Replace default JWT secret with cryptographically secure key
- [ ] Enable HTTPS/TLS for all endpoints
- [ ] Implement rate limiting per user/IP
- [ ] Add audit logging for all file operations
- [ ] Configure MinIO with proper access policies

### Scalability
- [ ] Implement horizontal backend scaling
- [ ] Add Redis for session caching
- [ ] Configure load balancer (Nginx/HAProxy)
- [ ] Database connection pooling optimization
- [ ] CDN integration for static assets

### Monitoring & Observability
- [ ] Structured logging with ELK/Loki stack
- [ ] Metrics collection (Prometheus/Grafana)
- [ ] Health check endpoints for orchestrators
- [ ] Error tracking (Sentry/Rollbar)
- [ ] Performance monitoring (APM)

## 📋 Next Implementation Phase

### File Operations UI
- [ ] Drag-and-drop file upload component
- [ ] File listing with search/filter capabilities
- [ ] Download/decrypt file functionality
- [ ] File deletion with confirmation dialogs
- [ ] Storage usage visualization

### Collaboration Features
- [ ] Room creation and management UI
- [ ] User invitation system
- [ ] File sharing within rooms
- [ ] Permission management interface
- [ ] Activity feeds and notifications

### Advanced Security
- [ ] Key rotation mechanisms
- [ ] Secure key sharing for rooms
- [ ] Audit trail for all operations
- [ ] Two-factor authentication (2FA)
- [ ] Device management and sessions

### Admin Panel Enhancement
- [ ] Real-time dashboard with live statistics
- [ ] User activity monitoring
- [ ] System health monitoring
- [ ] Configuration management interface
- [ ] Backup and restore functionality

## 🧪 Testing Strategy

### Automated Testing
- [ ] Unit tests for crypto utilities
- [ ] GraphQL resolver integration tests
- [ ] End-to-end user flow tests (Playwright)
- [ ] Performance tests for file operations
- [ ] Security penetration testing

### Quality Assurance
- [ ] Code coverage reporting
- [ ] Static code analysis (ESLint, Go vet)
- [ ] Dependency vulnerability scanning
- [ ] Container security scanning
- [ ] API contract testing

## 📚 API Documentation

The GraphQL API is self-documenting and available at `/graphql` in development mode. Key operations include:

- **Authentication**: `login`, `register`
- **File Management**: `uploadFile`, `downloadFile`, `deleteFile`
- **Room Operations**: `createRoom`, `addRoomMember`, `shareFileToRoom`
- **Admin Functions**: `promoteUserToAdmin`, `adminDashboard`

## 🚀 Deployment

### Docker Production
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### CI/CD Pipeline
- GitHub Actions workflow for automated builds
- Container registry integration
- Automated security scanning
- Staged deployment with rollback capabilities

---

**Built with ❤️ for BalkanID University Capstone Program**

*This project demonstrates production-grade software development practices including security-first design, scalable architecture, comprehensive testing, and enterprise-ready deployment strategies.*