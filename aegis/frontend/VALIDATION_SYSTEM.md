# Centralized Validation System

This document describes the centralized validation system implemented to resolve the validation rules loading issues.

## Problem Solved

Previously, the application was trying to load validation rules from `/shared/validation-rules.json` via HTTP requests, but this was failing with 404 errors because:
1. The shared directory was not served by the webpack dev server
2. The backend didn't have a route to serve these files
3. This caused login and registration to fail with validation errors

## Solution

Implemented a **centralized validation system** with the following components:

### 1. Core Validation Module (`src/utils/validation.ts`)
- Contains comprehensive validation functions that mirror the backend Go validation
- Provides type-safe interfaces for all validation rules
- Includes functions for email, username, password, file, string, numeric validation
- No external dependencies on JSON files

### 2. Validation Configuration (`src/utils/validationConfig.ts`)
- Centralized configuration for all validation rules
- Type-safe rule definitions
- Easy to modify and maintain
- Single source of truth for validation parameters

### 3. Updated Sanitization Module (`src/utils/sanitization.ts`)
- Now uses the centralized validation system instead of external JSON loading
- Synchronous validation functions (no more async/await issues)
- Fallback mechanisms for robustness
- Better error handling

### 4. Build System Integration
- Validation rules are automatically copied to the public directory during build
- Both development (`npm start`) and production (`npm run build`) builds include this
- Ensures the validation rules are always available

## Key Benefits

1. **Reliability**: No more 404 errors or network dependencies for validation
2. **Performance**: Synchronous validation without HTTP requests
3. **Type Safety**: Full TypeScript support with proper interfaces
4. **Maintainability**: Single source of truth for validation rules
5. **Consistency**: Same validation logic across frontend and backend
6. **Fallback**: Graceful degradation if external rules fail to load

## Usage Examples

```typescript
import { validateEmail, validateUsername, validateFile } from '../utils/validation';
import { isValidEmail, isValidUsername, isValidFile } from '../utils/sanitization';

// Using core validation (returns ValidationResult with errors)
const emailResult = validateEmail('user@example.com');
if (!emailResult.valid) {
  console.log('Errors:', emailResult.errors);
}

// Using sanitization helpers (returns boolean)
const isValid = isValidEmail('user@example.com');
```

## Configuration

All validation rules are defined in `src/utils/validationConfig.ts`:

- `USERNAME_VALIDATION_RULES`: Username format and length rules
- `EMAIL_VALIDATION_RULES`: Email format validation
- `PASSWORD_VALIDATION_RULES`: Password complexity requirements
- `FILE_VALIDATION_RULES`: File size and type restrictions

## Testing

The system includes comprehensive tests in `src/test/utils/sanitization.test.ts` that verify:
- Valid input acceptance
- Invalid input rejection
- Edge case handling
- Type safety
- Error conditions

## Maintenance

To update validation rules:
1. Modify the rules in `src/utils/validationConfig.ts`
2. Update the shared `validation-rules.json` if needed for consistency
3. Run tests to ensure everything works
4. Both files will be automatically synchronized during build

This centralized approach ensures that validation works reliably across all environments and provides a solid foundation for future enhancements.