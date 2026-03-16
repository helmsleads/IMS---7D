# Coding Conventions

**Analysis Date:** 2025-03-10

## Naming Patterns

**Files:**
- API files in `src/lib/api/`: kebab-case (e.g., `clients.ts`, `billing-automation.ts`, `dashboard-layouts.ts`)
- Component files: PascalCase (e.g., `ABCAnalysisWidget.tsx`, `ShippingModal.tsx`)
- Hook files in `src/lib/hooks/`: camelCase with `use` prefix (e.g., `useAnimatedNumber.ts`, `useDashboardLayout.ts`)
- Utility/helper files: kebab-case (e.g., `rate-limit.ts`, `encryption.ts`)

**Functions:**
- Exported async functions: camelCase (e.g., `getClients()`, `saveDashboardLayout()`, `recordBoxUsage()`)
- Helper functions (non-exported): camelCase (e.g., `mergeWithRegistry()`, `loadFromLocalStorage()`, `findExistingLocation()`)
- React component functions: PascalCase (e.g., `function ABCAnalysisWidget()`)
- Callbacks and handlers: camelCase with descriptive prefix (e.g., `debouncedSupabaseSave`, `validateSignature`)

**Variables:**
- Constants (module-level): UPPER_SNAKE_CASE for truly constant values (e.g., `CLASS_COLORS`, `STORAGE_KEY_PREFIX`, `DEBOUNCE_MS`, `RATE_LIMITS`)
- Regular variables: camelCase (e.g., `supabase`, `client`, `widgets`, `countA`, `shipmentId`)
- Destructured database results: snake_case matching database columns (e.g., `qty_on_hand`, `created_at`, `account_manager_id`)
- State variables: camelCase (e.g., `setCurrent`, `setWidgets`, `currentLayout`)
- Refs: camelCase with `Ref` suffix (e.g., `startTimeRef`, `rafRef`, `debounceRef`)

**Types & Interfaces:**
- PascalCase (e.g., `Client`, `ClientWithSummary`, `ClientOrder`, `Props`, `ABCItem`)
- Readonly database types in interfaces use database column naming: snake_case (e.g., `qty_on_hand`, `client_id`)
- Union types for enums: camelCase (e.g., `ownerType: "user" | "client"`, `dashboardType: "admin" | "portal"`)
- Record/object type keys: match usage context (database columns stay snake_case, app state uses camelCase)

## Code Style

**Formatting:**
- No ESLint or Prettier config in repo — relies on TypeScript strict mode and developer discipline
- Standard: 2-space indentation
- Line length: No hard limit observed, but most lines under 100 characters
- Quotes: Double quotes in JS/TS (`"@/lib/supabase"`), single quotes in test strings (e.g., `'test_token'`)

**Linting:**
- TypeScript strict mode enabled in `tsconfig.json`
- ESLint pragma used occasionally: `// eslint-disable-next-line @typescript-eslint/no-explicit-any` for intentional type escapes
- No automated linting on commit (no pre-commit hooks)

## Import Organization

**Order:**
1. External libraries (React, Next, third-party packages)
2. Internal `@/` path aliases (components, lib, types)
3. Type imports (optional, mixed with regular imports)

**Example:**
```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { ClientIndustry } from "@/types/database";

// OR with types:
import type { WidgetConfig } from "@/lib/dashboard/types";
import { generateRecommendedLayout } from "@/lib/dashboard/recommended-presets";
```

**Path Aliases:**
- `@/lib/*`: Core utilities, API functions, hooks
- `@/components/*`: React components
- `@/types/*`: TypeScript interfaces and types
- `@/app/*`: Next.js app router pages and routes

## Error Handling

**Patterns:**
- Supabase queries: Destructure `{ data, error }` and check `if (error)` explicitly
- Throw `new Error(error.message)` for fatal errors in API functions
- Console logging for errors: `console.error("[context]", error)` with descriptive prefix
- Fallback logic: Check for `error.code === "PGRST116"` (not found) and return `null` instead of throwing
- Try/catch for JSON parsing and localStorage: catch block silently returns null or ignores error
- No try/catch chains — separate concerns into different functions

**Example from `src/lib/api/clients.ts`:**
```typescript
const { data, error } = await supabase
  .from("clients")
  .select("*")
  .order("company_name");

if (error) {
  // FK may not exist if migration hasn't been applied — fall back
  if (error.message.includes("relationship")) {
    // Retry with different query
  }
  throw new Error(error.message);
}
return data || [];
```

**Example from `src/lib/hooks/useDashboardLayout.ts`:**
```typescript
function loadFromLocalStorage(type, registry, ownerId) {
  try {
    const raw = localStorage.getItem(getStorageKey(type, ownerId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (parsed.version !== 1) return null;

    return mergeWithRegistry(parsed.widgets, registry);
  } catch {
    return null;
  }
}
```

## Logging

**Framework:** `console.error()` only (no structured logging library)

**Patterns:**
- Log errors with descriptive prefix in brackets: `console.error("[component-name]", error.message)`
- Used for API errors, cron job logs, and authentication failures
- Silent failures acceptable for non-critical operations (e.g., localStorage, dashboard save)
- No `console.log()` for debugging in committed code

**Example from `src/app/api/cron/daily-lot-expiration/route.ts`:**
```typescript
if (!cronSecret) {
  console.error("[daily-lot-expiration] CRON_SECRET not configured");
  return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
}
```

## Comments

**When to Comment:**
- Document **why**, not what — code should be self-documenting
- Complex business logic (e.g., ABC analysis calculations, rate limiting)
- Non-obvious data transformations (e.g., Shopify to IMS mapping)
- Migration workarounds and temporary fallbacks

**JSDoc/TSDoc:**
- Used sparingly for hook documentation
- Follows standard JSDoc format with `/**` and `* @param` tags
- Example from `src/lib/hooks/useAnimatedNumber.ts`:
```typescript
/**
 * Animates a number from 0 to the target value on mount using requestAnimationFrame.
 * Uses cubic ease-out for a natural deceleration feel.
 */
export function useAnimatedNumber(
  target: number,
  duration: number = 800
): number
```

**Inline comments:**
- Explain workarounds: `// FK may not exist if migration hasn't been applied — fall back`
- Clarify Supabase quirks: `// Handle Supabase array return for joined table`
- Mark future work: `// If no remote layout found, user keeps seeing recommended preset`

## Function Design

**Size:** Prefer small, single-responsibility functions
- API functions: 10-50 lines (query + error handling + return)
- Hook functions: 30-100 lines (composition of smaller callbacks)
- Helper utilities: <20 lines

**Parameters:**
- Prefer explicit parameters over options objects for <3 params
- Use `Partial<T>` for factory test helpers: `createMockOrder(overrides: Partial<ShopifyOrder>)`
- React component `Props` interface defined inline above component

**Return Values:**
- Async functions return `Promise<Type | null>` for operations that can fail silently
- Async functions return `Promise<Type>` and throw for operations that must succeed
- Hooks return plain objects with methods: `{ widgets, enabledWidgets, toggleWidget, moveWidget }`
- Helper functions return typed objects or arrays, never undefined (return empty array instead)

## Module Design

**Exports:**
- API files export interfaces first, then functions: `export interface Client { ... } export async function getClient() { ... }`
- Hooks export single named export: `export function useDashboardLayout() { ... }`
- Components export default: `export default function ABCAnalysisWidget() { ... }`
- Constants exported as `export const` or `export type`

**Barrel Files:**
- Not used — imports directly reference specific files
- Example: `import { getClients } from "@/lib/api/clients"` not from `@/lib/api`

**Module organization in API layer:**
```
src/lib/api/
  clients.ts           — Client queries and types
  billing-automation.ts — Billing RPCs and types
  dashboard.ts         — Dashboard data queries
  [domain].ts          — Domain-specific operations
```

---

*Convention analysis: 2025-03-10*
