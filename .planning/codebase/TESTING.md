# Testing Patterns

**Analysis Date:** 2025-03-10

## Test Framework

**Runner:**
- Vitest 4.0.18
- Config: `vitest.config.ts`
- Environment: Node.js (not jsdom — unit tests, not component tests)
- Globals enabled: `describe`, `it`, `expect`, `beforeEach`, `afterEach`, etc. available without imports

**Assertion Library:**
- Vitest built-in assertions via `expect()` (no additional library needed)
- Supports `.toBe()`, `.toEqual()`, `.toBeGreaterThan()`, `.toContain()`, `.toThrow()`, etc.

**Run Commands:**
```bash
npm test              # Run tests in watch mode
npm run test:run      # Run tests once (CI mode)
npm run test:coverage # Run with coverage report
```

**Coverage:**
- Reporter: text, json, html
- Excludes: `node_modules`, `.next`, `**/*.test.ts`
- No enforcement level configured

## Test File Organization

**Location:**
- Co-located in `src/__tests__/` directory by feature area
- Follows domain structure: `src/__tests__/shopify/`, `src/__tests__/[domain]/`
- Not co-located with source files (separate test directory)

**Naming:**
- Pattern: `[feature].test.ts` (e.g., `encryption.test.ts`, `webhook-verification.test.ts`)
- All files match glob: `**/*.test.ts`, `**/*.test.tsx`

**Structure:**
```
src/__tests__/
├── shopify/
│   ├── encryption.test.ts
│   ├── webhook-verification.test.ts
│   ├── order-transform.test.ts
│   ├── rate-limit.test.ts
│   └── location-management.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('Feature Area', () => {
  beforeEach(() => {
    // Setup before each test
  })

  afterEach(() => {
    // Cleanup after each test
  })

  it('should do X when Y', () => {
    // Arrange
    const input = ...

    // Act
    const result = ...

    // Assert
    expect(result).toBe(...)
  })

  describe('Nested Feature', () => {
    it('should...', () => {})
  })
})
```

**Patterns:**
- Use `describe()` to group related tests by feature
- Nest `describe()` blocks for sub-features
- Test names start with "should" (descriptive, not technical)
- Arrange-Act-Assert (AAA) pattern within test bodies
- `beforeEach()`/`afterEach()` for setup/teardown that applies to multiple tests

**Example from `src/__tests__/shopify/webhook-verification.test.ts`:**
```typescript
describe('Webhook HMAC Verification', () => {
  const webhookSecret = 'test_webhook_secret_12345'

  function generateHmac(body: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('base64')
  }

  it('should generate valid HMAC for webhook body', () => {
    const body = JSON.stringify({ id: 123, name: '#1001' })
    const hmac = generateHmac(body, webhookSecret)

    expect(hmac).toMatch(/^[A-Za-z0-9+/]+=*$/)
  })
})
```

## Mocking

**Framework:** `vi` from Vitest

**Patterns:**
```typescript
// Environment variable stubbing
vi.stubEnv('TOKEN_ENCRYPTION_KEY', TEST_KEY)
vi.unstubAllEnvs()

// Module reset
vi.resetModules()

// Dynamic imports to get fresh modules with mocked env
const { encryptToken } = await import('@/lib/encryption')
```

**Example from `src/__tests__/shopify/encryption.test.ts`:**
```typescript
beforeAll(() => {
  vi.stubEnv('TOKEN_ENCRYPTION_KEY', TEST_KEY)
})

afterAll(() => {
  vi.unstubAllEnvs()
})

it('should encrypt and decrypt a token correctly', async () => {
  // Dynamic import to get fresh module with mocked env
  const { encryptToken, decryptToken } = await import('@/lib/encryption')

  const originalToken = 'shpat_abc123xyz789'
  const encrypted = encryptToken(originalToken)
  const decrypted = decryptToken(encrypted)

  expect(decrypted).toBe(originalToken)
})
```

**What to Mock:**
- Environment variables: Use `vi.stubEnv()` before dynamic imports
- External services: Not mocked — tests use real crypto/hash implementations (unit test scope)
- Database: Not mocked — tests assume no database (functions under test are synchronous helpers)

**What NOT to Mock:**
- Crypto functions (actual crypto used for real-world testing)
- JSON parsing (real parsing tested)
- Data transformation logic (real transformations tested)
- Array/object manipulation (real operations tested)

## Fixtures and Factories

**Test Data:**
```typescript
// Factory function for creating test objects
function createMockShopifyOrder(overrides: Partial<ShopifyOrder> = {}): ShopifyOrder {
  return {
    id: 12345678901234,
    name: '#1001',
    email: 'customer@example.com',
    created_at: '2024-01-15T10:30:00-05:00',
    financial_status: 'paid',
    fulfillment_status: null,
    line_items: [...],
    shipping_address: {...},
    // ... more defaults
    ...overrides,
  }
}

// Usage in test
const order = createMockShopifyOrder({ name: '#9999' })
```

**Location:**
- Defined in test files themselves (not in separate fixtures directory)
- Scoped to the test suite that uses them
- Reusable across multiple test cases in same file via spread operator overrides

**Example from `src/__tests__/shopify/order-transform.test.ts`:**
```typescript
function createMockShopifyOrder(overrides: Partial<ShopifyOrder> = {}): ShopifyOrder {
  return {
    // ... 40+ lines of default values
    ...overrides,
  }
}

it('should handle special characters in order', () => {
  const order = createMockShopifyOrder({
    note: 'Special chars: éàü 中文 🎉',
  })
  // test logic...
})
```

## Coverage

**Requirements:** None enforced — no minimum threshold configured

**View Coverage:**
```bash
npm run test:coverage
# Generates coverage/index.html (open in browser)
# Also outputs text report to console
```

**Current coverage:** Not measured (no baseline exists)

## Test Types

**Unit Tests:**
- Scope: Pure functions (encryption, HMAC verification, data transformation)
- Approach: Call function with inputs, assert outputs
- No database, no external API calls
- Fast execution (<1ms per test)

**Integration Tests:**
- Not present in current codebase
- Would test API functions with real or stubbed database

**E2E Tests:**
- Not present
- Not configured

## Common Patterns

**Async Testing:**
```typescript
it('should encrypt and decrypt a token correctly', async () => {
  const { encryptToken, decryptToken } = await import('@/lib/encryption')

  const originalToken = 'shpat_abc123xyz789'
  const encrypted = encryptToken(originalToken)
  const decrypted = decryptToken(encrypted)

  expect(decrypted).toBe(originalToken)
})
```

**Error Testing:**
```typescript
it('should throw on invalid encrypted format', async () => {
  const { decryptToken } = await import('@/lib/encryption')

  const invalidEncrypted = 'a'.repeat(32) + ':invalidhexdata'

  expect(() => decryptToken(invalidEncrypted)).toThrow()
})
```

**Environment-Dependent Tests:**
```typescript
describe('Rate Limiting (In-Memory Fallback)', () => {
  beforeEach(() => {
    // Ensure no Redis is configured so we use in-memory
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
    vi.resetModules()
  })

  it('should allow requests under the limit', async () => {
    const { checkRateLimit, RATE_LIMITS } = await import('@/lib/rate-limit')

    const result = await checkRateLimit('test-user-1', RATE_LIMITS.api)

    expect(result.success).toBe(true)
    expect(result.remaining).toBe(RATE_LIMITS.api.limit - 1)
  })
})
```

**Data Validation Tests:**
```typescript
it('should validate correct signature', () => {
  const body = JSON.stringify({ test: 'data' })
  const secret = 'my_secret'
  const validHmac = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64')

  expect(validateSignature(body, validHmac, secret)).toBe(true)
})

it('should reject tampered body', () => {
  const originalBody = JSON.stringify({ amount: 100 })
  const tamperedBody = JSON.stringify({ amount: 1000 })
  const secret = 'my_secret'
  const hmac = crypto.createHmac('sha256', secret).update(originalBody, 'utf8').digest('base64')

  expect(validateSignature(tamperedBody, hmac, secret)).toBe(false)
})
```

## Testing Gaps

**Areas with tests:**
- Shopify integration utilities (5 test files)
  - Encryption/decryption
  - Webhook HMAC verification
  - OAuth HMAC verification
  - Order transformation logic
  - Rate limiting logic
  - Location management logic

**Areas without tests:**
- API layer functions in `src/lib/api/` (no unit tests)
- React components (no component tests)
- Page routes (no E2E tests)
- Error handling flows
- Database integration
- Cron job logic

---

*Testing analysis: 2025-03-10*
