# Testing Setup for Client-side Form Sanitation

This document outlines the setup for testing client-side form validation and security features implemented in the SolanaFlow waitlist form.

## Test Framework

The project uses:
- Jest as the test runner
- React Testing Library for component testing
- Jest DOM for DOM-specific assertions

## Test Structure

Two main test files have been created:

1. **validators.test.ts** - Unit tests for the form validation regexes and helper functions:
   - Email validation (RFC-5322 compliant)
   - Solana wallet address validation (Base-58, 32-44 chars)
   - Social media handle validation
   - Discord username validation

2. **WaitlistForm.test.tsx** - Component tests for the waitlist form:
   - maxLength attribute enforcement
   - Honeypot field anti-bot protection
   - Form submission validation

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run a specific test file
npm test -- validators.test.ts
```

## Mocks

The tests include several mocks to isolate the components under test:

- `fetch` - Mocked to avoid actual network requests
- `canvas-confetti` - Silenced to prevent side effects during tests
- `useToast` - Mocked to return a jest function

## Integration with CI/CD

To ensure proper code quality, add the test script to your CI pipeline before build steps:

```yaml
# Example CI workflow
steps:
  - name: Run tests
    run: npm test
  
  - name: Build
    run: npm run build
```

## Security Features Tested

The tests verify the implementation of several security features:

1. **Input Validation**:
   - Strictly typed regex patterns for all inputs
   - Appropriate error messages for invalid inputs

2. **Input Length Restriction**:
   - Hard maximum lengths on all form fields
   - Email: 254 characters
   - Wallet: 44 characters
   - Social handles: 32 characters
   - Discord: 37 characters

3. **Anti-Bot Measures**:
   - Honeypot field that is hidden from users
   - CSRF token verification

4. **UI Protection**:
   - Click-jacking prevention by setting overflow: hidden on body when modal is open 