# Centralized Crypto Management Documentation

## Overview

This document describes the centralized cryptographic architecture implemented in the Aegis file vault project. The centralization consolidates all encryption, decryption, and key management operations into a unified system for better maintainability, security, and consistency.

## Architecture

### Backend Architecture

#### Core Components

1. **CryptoManager** (`internal/services/crypto_manager.go`)
   - Central hub for all cryptographic operations
   - Handles file encryption/decryption, key derivation, and password validation
   - Provides consistent API for all crypto operations across the application

2. **CryptoConfig** (`internal/config/crypto_config.go`)
   - Centralized configuration management for all crypto settings
   - Environment-based configuration with validation
   - Default values and security constraints

3. **Service Integration**
   - All services (ShareService, FileService, etc.) now use CryptoManager
   - Eliminates scattered crypto logic across multiple files
   - Consistent error handling and validation

#### Key Features

- **File Encryption**: NaCl secretbox for symmetric file encryption
- **Envelope Encryption**: AES-GCM for encrypting file keys
- **Key Derivation**: PBKDF2 with configurable iterations and salt
- **Password Validation**: Centralized password complexity validation
- **Share Management**: Encrypted password handling for file shares

### Frontend Architecture

#### Core Components

1. **CryptoManager** (`src/utils/cryptoManager.ts`)
   - Frontend counterpart to backend CryptoManager
   - Uses TweetNaCl for client-side encryption operations
   - Consistent API alignment with backend

2. **Crypto Configuration** (`src/config/crypto.ts`)
   - Centralized crypto configuration for frontend
   - Default values matching backend security parameters

#### Key Features

- **File Encryption**: TweetNaCl secretbox for client-side encryption
- **Password-based Key Derivation**: PBKDF2 implementation
- **Hash Calculation**: SHA-256 for file integrity verification
- **Type Safety**: Full TypeScript support with proper type definitions

## Configuration

### Environment Variables

```bash
# Crypto Configuration
CRYPTO_PBKDF2_ITERATIONS=100000     # PBKDF2 iteration count (default: 100000)
CRYPTO_PBKDF2_SALT_LENGTH=32        # Salt length in bytes (default: 32)
CRYPTO_AES_KEY_LENGTH=32            # AES key length in bytes (default: 32)
CRYPTO_PASSWORD_MIN_LENGTH=8        # Minimum password length (default: 8)
CRYPTO_PASSWORD_REQUIRE_UPPERCASE=true    # Require uppercase letters (default: true)
CRYPTO_PASSWORD_REQUIRE_LOWERCASE=true    # Require lowercase letters (default: true)
CRYPTO_PASSWORD_REQUIRE_NUMBERS=true      # Require numbers (default: true)
CRYPTO_PASSWORD_REQUIRE_SYMBOLS=false     # Require symbols (default: false)
```

### Default Configuration

If environment variables are not set, the system uses secure default values:
- PBKDF2 iterations: 100,000
- Salt length: 32 bytes
- AES key length: 32 bytes (256-bit)
- Password minimum length: 8 characters
- Password complexity: Uppercase, lowercase, and numbers required

## API Reference

### Backend CryptoManager

```go
// Create new crypto manager
cryptoManager, err := services.NewCryptoManager()

// Encrypt file data
encryptedData, nonce, err := cryptoManager.EncryptFile(fileData, encryptionKey)

// Decrypt file data
decryptedData, err := cryptoManager.DecryptFile(encryptedData, nonce, encryptionKey)

// Generate envelope encryption
envelopeKey, encryptedFileKey, err := cryptoManager.GenerateEnvelopeEncryption(fileKey, password)

// Decrypt envelope
fileKey, err := cryptoManager.DecryptEnvelope(encryptedFileKey, envelopeKey)

// Validate password
err := cryptoManager.ValidatePassword(password)

// Derive key from password
key, salt, err := cryptoManager.DeriveKeyFromPassword(password, nil)
```

### Frontend CryptoManager

```typescript
// Create new crypto manager
const cryptoManager = new CryptoManager();

// Encrypt file data
const result = await cryptoManager.encryptFile(fileData, encryptionKey);

// Decrypt file data
const decryptedData = await cryptoManager.decryptFile(encryptedData, nonce, encryptionKey);

// Derive key from password
const derivedKey = await cryptoManager.deriveKeyFromPassword(password, salt);

// Calculate file hash
const hash = await cryptoManager.calculateHash(fileData);

// Validate password
const isValid = cryptoManager.validatePassword(password);
```

## Security Features

### Encryption Standards

- **File Encryption**: NaCl/TweetNaCl secretbox (XSalsa20 + Poly1305)
- **Envelope Encryption**: AES-256-GCM
- **Key Derivation**: PBKDF2-SHA256 with 100,000+ iterations
- **Password Hashing**: bcrypt with cost factor 10

### Security Best Practices

1. **Key Isolation**: Each file has a unique encryption key
2. **Salt Generation**: Cryptographically secure random salts
3. **Password Complexity**: Configurable complexity requirements
4. **Constant-Time Operations**: Prevents timing attacks
5. **Memory Safety**: Secure key cleanup and handling

## Migration Guide

### From Old Architecture

The migration from the scattered crypto implementation to centralized management involved:

1. **Service Consolidation**: 
   - Moved from separate `encryption.go`, `key_management.go`, and `crypto.go` files
   - Consolidated into single `crypto_manager.go`

2. **Configuration Centralization**:
   - Environment-based configuration instead of hardcoded values
   - Validation and default value management

3. **API Standardization**:
   - Consistent error handling across all crypto operations
   - Unified function signatures and return types

4. **Frontend Alignment**:
   - Created matching frontend CryptoManager
   - Consistent API between frontend and backend

### Backward Compatibility

The centralized architecture maintains full backward compatibility:
- Existing encrypted files can be decrypted without changes
- Database schema remains unchanged
- All existing APIs continue to work
- Test suite passes without modification

## Testing

### Integration Tests

The centralized crypto manager is thoroughly tested with integration tests:
- Share creation and access with username restrictions
- File encryption/decryption workflows
- Password validation and complexity checking
- Envelope encryption for shared files

### Test Configuration

Tests use SQLite with PostgreSQL syntax conversion for compatibility:
- Automatic migration of PostgreSQL-specific syntax
- Proper handling of constraints and indexes
- Mock data with valid base64 encryption keys

## Performance Considerations

### Optimizations

1. **Lazy Initialization**: CryptoManager created only when needed
2. **Configuration Caching**: Crypto configuration loaded once and cached
3. **Efficient Key Derivation**: Configurable PBKDF2 iterations
4. **Memory Management**: Proper cleanup of sensitive data

### Monitoring

- Configuration validation at startup
- Error logging for crypto operations
- Performance metrics for key derivation

## Future Enhancements

### Planned Features

1. **Hardware Security Module (HSM) Support**: Integration with HSMs for key storage
2. **Key Rotation**: Automated key rotation for enhanced security
3. **Quantum-Safe Algorithms**: Preparation for post-quantum cryptography
4. **Audit Logging**: Detailed logging of all crypto operations

### Extension Points

The centralized architecture provides clear extension points:
- Pluggable encryption algorithms
- Configurable key derivation functions
- Custom password validation rules
- Additional envelope encryption methods

## Troubleshooting

### Common Issues

1. **Invalid Base64 Keys**: Ensure encryption keys are properly base64 encoded
2. **Configuration Errors**: Check environment variables and defaults
3. **Password Validation**: Verify password meets complexity requirements
4. **Key Derivation**: Ensure salt values are properly generated

### Debug Information

Enable debug logging for detailed crypto operation information:
```bash
export LOG_LEVEL=debug
```

### Error Codes

- `CRYPTO_001`: Invalid encryption key format
- `CRYPTO_002`: Password validation failed
- `CRYPTO_003`: Key derivation error
- `CRYPTO_004`: Encryption/decryption failure
- `CRYPTO_005`: Configuration validation error

## Security Considerations

### Best Practices

1. **Environment Variables**: Store sensitive configuration in environment variables
2. **Key Management**: Never log or expose encryption keys
3. **Password Handling**: Use secure password validation and complexity rules
4. **Random Generation**: Use cryptographically secure random number generators
5. **Memory Cleanup**: Properly clear sensitive data from memory

### Threat Model

The centralized crypto architecture protects against:
- Data breaches through strong encryption
- Password attacks through complexity requirements
- Timing attacks through constant-time operations
- Key compromise through proper key isolation
- Configuration errors through validation

## Conclusion

The centralized crypto management system provides a robust, secure, and maintainable foundation for all cryptographic operations in the Aegis file vault. By consolidating scattered crypto logic into a unified system, we've improved security, reduced complexity, and created a platform for future enhancements.

The architecture maintains full backward compatibility while providing modern security practices and configuration management. All tests pass, demonstrating that the centralization effort was successful without breaking existing functionality.