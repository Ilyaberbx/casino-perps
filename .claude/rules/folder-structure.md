# Folder & Naming Structure

## Folders are kebab-case

Every directory under `src/` is kebab-case. Folders are groupings, not code entities, so they share the rule for non-component files.

```
src/modules/trading/components/order-entry/   ✓
src/modules/trading/components/OrderEntry/    ✗
src/modules/mock-venue/                       ✓
```

## React component files are PascalCase.tsx

A `.tsx` file that exports a React component is PascalCase; the file name matches the component name. Sibling sub-components in the same folder follow the same rule.

```
order-entry/OrderEntry.tsx     ✓ exports OrderEntry
order-entry/SizeInput.tsx      ✓ exports SizeInput
order-entry/order-entry.tsx    ✗
```

## Folder ↔ component file

A folder `<thing>/` houses a primary component file `<Thing>.tsx`. The kebab is the dash-cased form of the Pascal. Acronyms keep their casing.

```
order-entry/   ↔   OrderEntry.tsx
account-dock/  ↔   AccountDock.tsx
hud/           ↔   HUD.tsx
```

## Non-component files are kebab-case

```
use-order-entry.ts
order-entry.module.css
order-entry.constants.ts
order-entry.types.ts
order-entry.utils.ts
```

## Top-level structure

The app is organized into **modules**. See `frontend-architecture.md` for the architectural rules.

```
src/
  app/                           ← composition root (router, main.tsx, App.tsx)
  modules/
    <domain-module>/             ← e.g. trading/
    <venue-module>/              ← e.g. mock-venue/, hyperliquid/
    shared/                      ← cross-module primitives
```

A module is a kebab-case folder under `src/modules/`. Its internal layout uses any of the **closed taxonomy**: `pages/`, `components/`, `providers/`, `hooks/`, `services/`, `api/`, `domain/`. Plus, at the module root: `<module>.types.ts`, `<module>.utils.ts`, `<module>.constants.ts`, `<module>.config.ts`, and the mandatory `index.ts`.

None are mandatory — a module uses what it needs from the list. **Anything outside the list requires an ADR.** No `ui/`, `lib/`, `helpers/`, `modals/`, `sheets/`, `views/`, `state/`. UI lives in `components/`. See `frontend-architecture.md` for the full taxonomy rationale.

## Where a component lives

- **Module feature folder** (`modules/<name>/components/<feature>/`) — default. Holds the component, its colocated hook, styles, constants, types, utils, and sibling sub-components.
- **`modules/shared/components/`** — a leaf component that has **no internal state of its own** AND is imported by **≥2 modules**. May be a single-file `.tsx` if it has no siblings.
- The hook lives **next to** its component, never in a module-level `hooks/` folder. Module `hooks/` is for cross-component hooks within that module.

## Component folder rule

A component is a single bare `.tsx` file *only* when nothing else belongs with it. As soon as it has any sibling — hook, styles, types, constants, utils, sub-component — it gets its own folder.

```
✓ shared/components/EmptyState.tsx                 (truly alone — no styles, no types)

✓ trading/components/account-dock/                 (has hook + styles + types + sub-components)
    AccountDock.tsx
    DockTabs.tsx
    OpenOrdersPanel.tsx
    use-account-dock.ts
    account-dock.module.css
    account-dock.types.ts
    index.ts

✗ trading/components/AccountDock.tsx               (has a hook → must be a folder)
✗ trading/components/account-dock/AccountDock.tsx
  trading/components/account-dock.module.css       (styles must live inside the folder)
```

## Module public API

- Each module under `modules/` exposes a **mandatory `index.ts`** at the module root. This is its public surface.
- `shared/` has **no top-level `index.ts`** — import from subpaths (`@/modules/shared/hooks/use-is-mobile`).
- A `shared/components/<leaf>/` folder may have an `index.ts` if the bundle has multiple files; a single-file leaf at `shared/components/<Leaf>.tsx` does not.

## Promotion rule

A component starts inside its module's `components/` folder. Move it to `modules/shared/components/` the day a **second module** imports it — not in anticipation. If it doesn't fit the leaf rule above, it doesn't belong in `shared/`.

## Disallowed

- PascalCase folders (`OrderEntry/`, `Modules/`).
- Mixed-case folders (`orderEntry/`).
- Per-component subfolders inside a feature for sub-components (`order-entry/size-input/SizeInput.tsx`). Sub-components stay flat next to the parent.
- Bare `.tsx` files when sibling files exist (see component folder rule).
- Cross-module deep imports — go through `modules/<name>/index.ts`.
- A `trading/` import of any venue module.
- A venue module import of `trading/`.
- Module folder kinds outside the closed taxonomy. In particular, **`ui/` is dissolved** — UI components live in `components/`. `modals/`, `sheets/`, `views/`, `lib/`, `helpers/`, `state/` are not permitted folder kinds.

## Carve-out

- **`app/`** is composition only — small, kebab-case files, no module rules apply. It imports from module `index.ts` barrels and wires them.
