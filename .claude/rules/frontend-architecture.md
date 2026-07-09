# Frontend Architecture Rules

The web app is organized as **modules**. A module is a bounded domain area (e.g. `trading`, a venue like `mock-venue` or `hyperliquid`, or `shared`). Inside every module, code follows a **smart hook + dumb component** pattern, with strict separation between business logic, UI, and external systems.

`app/` is the composition root — the only place that imports from multiple modules and wires them together (router, providers, venue selection).

## Top-level layout

```
src/
  app/                           ← composition root: main.tsx, App.tsx, router
  modules/
    trading/                     ← domain module
      pages/                     (lazy: only when a route exists)
      components/
      services/                  (lazy: only when stateful/side-effectful logic exists)
      providers/                 (lazy)
      hooks/                     (lazy: cross-component hooks within the module)
      api/                       (lazy: endpoint wrappers — see http.md)
      domain/                    (module-internal types/interfaces, if any)
      trading.types.ts           (module-scoped, if any)
      trading.constants.ts
      trading.utils.ts
      trading.config.ts          (env-derived runtime config, if any)
      index.ts                   ← public API (mandatory)
    mock-venue/                  ← venue module: implements the Adapter port
      services/
      mock-venue.utils.ts        (pure generators)
      mock-venue.types.ts
      mock-venue.constants.ts
      index.ts
    hyperliquid/                 (future venue)
    shared/
      components/
      hooks/
      providers/
      layout/
      domain/                    ← Adapter port + domain types (Market, Order, Trade…)
      http/                      ← the only HTTP transport — see http.md
      tokens/
      utils/
      constants/
                                 (no top-level index.ts — deep imports only)
```

## Closed module folder taxonomy

The set of permitted folder kinds inside a module is **closed**. A module may use any of:

- `pages/` — route-addressable compositions
- `components/` — feature components (default home for UI)
- `providers/` — React providers (one provider per folder; see "Provider unit pattern")
- `hooks/` — cross-component hooks (see "Narrowed `hooks/` folder")
- `services/` — stateful or side-effectful units
- `api/` — endpoint wrappers on top of `shared/http/`
- `domain/` — module-internal types

Plus, at the module root: `<module>.types.ts`, `<module>.utils.ts`, `<module>.constants.ts`, `<module>.config.ts`, and the mandatory `index.ts`.

**Anything outside this list requires an ADR.** No `ui/`, no `lib/`, no `helpers/`, no `modals/`, no `sheets/`, no `views/`, no `state/`. A module uses what it needs from the closed list — no folder is mandatory, but no folder kind outside the list is permitted.

`shared/` adds `tokens/`, `layout/`, `http/`, plus the same closed kinds where they make sense.

## Smart hook + dumb component

1. **Component files are dumb.** No `useState`, `useEffect`, `useCallback`, handlers, inline `<style>` blocks, or inline named type declarations. The only legal hook calls inside a component are `useXComponent()` (the feature hook) and `useMemo`/`useCallback` *only* when wrapping a value passed straight through to a child.
2. **Hooks are smart and return one object.** `useXComponent()` owns all state, side effects, derived values, selectors, navigation, and handlers.
3. **The hook lives next to the component**, not in a module-level `hooks/` folder. The module's `hooks/` folder is reserved for **cross-component** hooks consumed by ≥2 components within the same module.
4. **The hook never imports JSX or styles.** It must be unit-testable in isolation.
5. **Sub-components stay dumb.** Sibling sub-components in the same feature folder receive prop slices from the parent; they do not call `useXComponent()` or subscribe to stores. The parent's hook is the single state owner. Sub-components follow the same 200-line cap recursively.

## Hexagonal: ports and venues

- The `Adapter` port (interface) and core domain types (`Market`, `Order`, `Trade`, `Candle`, …) live in **`modules/shared/domain/`**.
- Venue modules (`mock-venue/`, `hyperliquid/`, …) implement the port and export a factory: `createMockVenue(): Adapter`, `createHyperliquidVenue(config): Adapter`.
- **`trading/` never imports a venue module.** It depends on the port only.
- **`app/` is the composition root**: it imports the chosen venue, instantiates it, and passes the resulting `Adapter` into trading via context.
- This means: adding a new venue requires editing `app/` only.

## Module public API

- Each module under `modules/` exposes a **mandatory `index.ts`** at the module root. This is its public API.
- Cross-module imports must go through `index.ts`: `import { TradingPage } from '@/modules/trading'` ✓; `import { useChart } from '@/modules/trading/components/chart/use-chart'` ✗.
- Within a module, deep imports between subfolders are fine — the boundary is the module edge, not every folder.
- A domain module's `index.ts` typically exports: its `Page` component(s), the providers required to wire it, and any types intended for cross-module use. **Hooks, components, services, utils, constants are private.**
- A venue module's `index.ts` typically exports: the `create<Venue>(): Adapter` factory and venue-specific config types.
- **`shared/` has no top-level barrel.** Import from subpaths: `@/modules/shared/hooks/use-is-mobile`, `@/modules/shared/domain/adapter`. The exception exists because `shared/` is heterogeneous and a single barrel would make it a god-import.

## File-kind discipline (mandatory)

Each kind of code goes in a specific file. These rules are strict.

### Types — `*.types.ts`

> Every named `interface`, `type Foo = …`, and `enum` declaration lives in a `*.types.ts` file. **No exceptions for "only used once".**

- Inline structural types in function signatures, hook generics, and one-shot annotations stay inline: `function parse(s: string): { ok: boolean; value: number }` ✓. They are not named declarations.
- The moment a structural type is given a name (`type FooProps = …`, `interface FooProps {…}`), it moves to a `*.types.ts` file — even if it is referenced exactly once. "Only used here" is not a carve-out.
- Component prop types, hook return types, union/discriminated types: all in `*.types.ts`.
- Cross-module domain types live in `modules/shared/domain/`.
- Lint-enforced: module-scope `type` / `interface` declarations in `*.tsx` files are flagged (warn → error).

### Constants — `*.constants.ts`

> Static literal data lives in `*.constants.ts`. **Default to `as const`** for immutability and literal narrowing.

- `as const` is the default — it gives deep immutability and preserves literal types for free.
- Use `Readonly<T>` / `ReadonlyArray<T>` only when you explicitly want to widen to a domain type (e.g. `ReadonlyArray<Market>`).
- Primitives (`export const MAX_LEVERAGE = 100`) need no annotation.
- **Constants files are data leaves.** They may import only from `shared/tokens/`, `shared/domain/`, and other `*.constants.ts`. **No utils, services, components, or hooks.**
- Env-derived runtime configuration is **not** a constant. It goes in `*.config.ts` and is not `as const`.
- Design tokens live in `shared/tokens/`, not in `*.constants.ts` files.

### Utilities — `*.utils.ts`

> Pure, side-effect-free helper functions live in `*.utils.ts`. **Any module-scope non-component function lives in a `*.utils.ts` file. No exceptions.**

- A utility has **no React imports, no IO, no module state**. If it has side effects or holds state, it is a service.
- "Module-scope" means top-level in the file. Functions defined **inside a component body or hook closure** are unaffected — those are local helpers, not module exports.
- The "trivial one-shot stays inline" carve-out applies to inlining at the **call site** (literal expression in JSX or another function). It does not authorise a top-level helper function declared outside `*.utils.ts`.
- Naming: `<scope>.utils.ts` (e.g. `account-dock.utils.ts`, `trading.utils.ts`).
- Lint-enforced: module-scope non-component (non-PascalCase, non-JSX-returning) function declarations in `*.tsx` files are flagged (warn → error).

### Services — `services/`

> Stateful or side-effectful units live in `services/`.

- A service talks to the network, wraps a port (`Adapter`, storage), holds module-internal state, or exposes a lifecycle (start/stop/subscribe).
- A service file may export a factory (`createOrderService(adapter)`) returning an object. **A service never exports React components or hooks.**
- Pure helpers consumed by services are still utilities, not services.

### Styles — `*.module.css` or `*.styles.ts`

- `*.module.css` is preferred for static styling.
- `*.styles.ts` is allowed only when styles depend on props/state at runtime.
- The component imports styles. The hook does not.

### Placement mirror

The same placement rule applies to `*.types.ts`, `*.constants.ts`, and `*.utils.ts`:

- **Component-scoped** → colocated with the component (`account-dock/account-dock.utils.ts`).
- **Module-scoped** → at the module root (`trading/trading.utils.ts`).
- **Cross-module** → in `shared/utils/`, `shared/constants/` (rare; most cross-module statics belong in `tokens/` or `domain/`).

## Provider unit pattern

A React provider is a **unit**: provider component + context + consumer hook + types live together in their own folder under `providers/`.

```
providers/
  auth/
    AuthProvider.tsx              ← the Provider component
    auth.context.ts               ← createContext + default value (private)
    use-auth.ts                   ← the consumer hook
    auth.types.ts                 (optional — the context value shape)
    __tests__/                    (optional)
    __fixtures__/                 (optional — fake providers, mocked context values)
    index.ts                      ← exports Provider + hook only
```

Rules:

- **One provider per folder.** Folder name is the kebab form of the provider (`auth/`, `onboarding-flow/`).
- **`index.ts` exports the Provider component and the consumer hook.** Nothing else. The context object is private — consumers go through the hook.
- **`<provider-name>.context.ts`** holds the `createContext` call. Lowercase kebab name (it is not a React component file).
- **`use-<consumer>.ts`** holds the consumer hook. The hook reads the context, asserts presence (`if (!ctx) throw new Error('use<X> must be used within <X>Provider')`), and returns the value.
- Tests and fixtures follow the universal `__tests__/` / `__fixtures__/` rule (see `testing.md`).

This pattern is the **only** way to expose shared state across components in this codebase. See "Non-adoption of Zustand" below.

## Narrowed `hooks/` folder

A module's `hooks/` folder is for **cross-component hooks within the module** — hooks consumed by ≥2 components in the same module. It is not a junk drawer.

- **No `.tsx` files.** `hooks/` contains `.ts` only. JSX belongs to a component.
- **No providers.** Providers live in `providers/` per the provider-unit pattern.
- **No contexts.** A `createContext` call is part of a provider unit.
- **No single-consumer hooks.** A hook with one caller lives next to that caller, not in `hooks/`.

If a hook is only called by its own component, it lives in that component's folder. If a hook owns shared state across components, it is the consumer hook of a provider unit, not a free-standing entry in `hooks/`.

## Non-adoption of Zustand

The smart-hook + provider-unit pattern is the canonical way to share state in this codebase. **Zustand (and equivalent global stores: Redux, Jotai, MobX, Recoil, Valtio) is rejected.** Pattern preference is not justification for a stack swap. If you reach for one, stop and either: (a) lift state to a provider unit, (b) co-locate state in the parent's smart hook and pass slices down, or (c) propose an ADR with a concrete reason the provider pattern fails — not "I prefer stores".

## Pages and routing

- A **page** is a route-addressable composition. It owns layout and orchestration only — no data fetching directly, no business logic. Its hook composes other hooks.
- Pages are exported from their module's `index.ts`.
- The router lives in `app/`. `app/` imports each module's page and assembles the route tree.

## Component decomposition

- A dumb component must stay under **200 lines**. Decompose when the cap is reached, or earlier when JSX has distinct named regions (header, summary, list, empty state, footer).
- Sub-components live alongside the parent in the same feature folder.
- Promote a component to `shared/components/` only when it is imported by **≥2 modules**, not in anticipation.

## Hard import rules (lint-enforced)

1. **No cross-module deep imports.** A module may only be imported via its `index.ts`. `shared/` is the exception (deep imports only, no top-level barrel).
2. **`trading/` never imports a venue module.** It imports the `Adapter` port from `shared/domain/`.
3. **Venue modules import the port from `shared/domain/`.** They never import `trading/`.
4. **`app/` may import from any module's public API.** It is the only module allowed to.

These rules are enforced by `import/no-restricted-paths` in `eslint.config.js`. The zone definitions target each domain/venue module folder (`./src/modules/trading`, `./src/modules/mock-venue`) from anywhere outside the module, with `except: ['./index.ts', './index.tsx']` allowing only the public-API entry. `shared/` is intentionally **not** a zone — its deep imports are first-class. Two extra zones forbid `trading/ → mock-venue/` and `mock-venue/ → trading/` regardless of entry path.

The `@/` path alias (`@/* → src/*`) is configured in `tsconfig.app.json`, `vite.config.ts`, and `vitest.config.ts`. Cross-module imports should use the alias (`@/modules/trading`, `@/modules/shared/hooks/use-is-mobile`); the lint rule resolves both alias and relative forms via `eslint-import-resolver-typescript`.

## Carve-outs

- **`shared/` follows all module rules** with one exception: no top-level barrel. Same naming, same `*.types.ts` / `*.constants.ts` / `*.utils.ts` discipline.
- **`app/`** is small by design — composition only. Real logic does not live in `app/`.
