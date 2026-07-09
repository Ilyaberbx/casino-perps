# Testing Rules

Where tests live and what counts as a test. Universal — applies to every folder under `src/`, including `app/`. No exceptions.

## 1. Tests live in `__tests__/` siblings — never colocated

Every test file lives in a `__tests__/` folder placed as a **sibling** of the file it covers. Tests are never colocated next to production code.

```
✓ trading/components/order-entry/OrderEntry.tsx
  trading/components/order-entry/__tests__/OrderEntry.test.tsx

✗ trading/components/order-entry/OrderEntry.test.tsx     (colocated — forbidden)
✗ trading/__tests__/OrderEntry.test.tsx                  (wrong scope — must be sibling of file under test)
```

This rule is universal. `app/`, `modules/<name>/`, `modules/shared/` — same rule everywhere.

## 2. Naming and path mirror

- Test files: `*.test.ts` / `*.test.tsx`. No `*.spec.ts`, no `*.tests.ts`.
- The test file name mirrors the file under test: `foo/Bar.tsx` ↔ `foo/__tests__/Bar.test.tsx`; `foo/use-bar.ts` ↔ `foo/__tests__/use-bar.test.ts`.
- One test file per file under test. If a single file under test grows multiple test files, the file under test should be split first.

## 3. Test helpers live in `__fixtures__/` siblings

Non-test helpers used by tests — fixture types, fake builders, MSW handlers, render wrappers — live in a sibling `__fixtures__/` folder, never in `__tests__/` and never in production code.

```
✓ account/api/__fixtures__/users.ts                  (fake `User` builders)
✓ account/api/__fixtures__/handlers.ts               (MSW request handlers)
✓ account/api/__tests__/get-me.test.ts               (imports from ../__fixtures__/users)

✗ account/api/users.fixtures.ts                      (test helper colocated with prod — forbidden)
✗ account/api/__tests__/users.ts                     (helper inside __tests__/ — forbidden)
```

Test-only production exports (anything named `*ForTest`, `__test_*`, or otherwise gated for tests) move to the nearest `__fixtures__/`. Production `index.ts` does not export them. If a test needs to reach into production internals, the answer is a fixture or a refactor — not a back door.

## 4. Lint enforcement

A lint rule bans `*.test.*` files outside `__tests__/`. **Warn** today; will flip to **error** in the Phase 6 cleanup wave. Treat warnings as work-to-do, not noise: every new test file lands in a `__tests__/` folder from day one.
