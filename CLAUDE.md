# Frontend rules

> **Scope of this file:** rules here apply to **`apps/client/` only**. If a rule also applies to the server, promote it to `/CLAUDE.md` instead. Repo-wide rules in `/CLAUDE.md` (code style, conventions, domain language, auth contract) are loaded automatically alongside this file.

## Tech stack

This is the canonical stack for `apps/client/`. Names + major versions only — `package.json` is the source of truth for exact versions; this list exists so neither a model nor a human has to re-derive *what kind of project this is* from the lockfile.

- **Runtime / framework:** React 19 (with the React Compiler enabled via `babel-plugin-react-compiler`), `react-dom` 19.
- **Build / dev server:** Vite 8 (`@vitejs/plugin-react`, `vite-tsconfig-paths` for the `@/*` alias).
- **Language:** TypeScript 6 (strict). Project references via `tsc -b`.
- **Routing:** `react-router-dom` 7.
- **Auth:** Privy (`@privy-io/react-auth`) in local-storage session mode; only the `account/` module imports it (see `docs/adr/0004-no-account-adapter-port.md`).
- **Errors as values:** `neverthrow` (`Result` / `ResultAsync`) — see `.claude/rules/error-handling.md`.
- **Validation / schemas:** Zod 3.
- **Charts:** `lightweight-charts` 5 for trading views, `chart.js` 4 + `react-chartjs-2` for portfolio/analytics.
- **Virtualization:** `@tanstack/react-virtual` 3 — headless windowing for long lists. Currently consumed by the Market Selection list only. See `docs/adr/0019-virtualize-market-selection-list.md`.
- **Hyperliquid SDK:** `@nktkas/hyperliquid` — imported by exactly four files in the SDK lint zone: `modules/hyperliquid/gateway/nktkas-hyperliquid-gateway.ts` (impl), `modules/hyperliquid/gateway/sdk-types.ts` (type re-exports), `modules/hyperliquid/gateway/sdk-error-mapping.ts` (instanceof checks for SDK error classes), and `modules/hyperliquid/gateway/nktkas-hyperliquid-exchange-gateway.ts` (exchange/signing). The constraint is lint-enforced (`no-restricted-imports`); see ADR-0009 and ADR-0010, and the `hyperliquid/MODULE.md` "Depends on" entry. Required env vars: `VITE_HYPERLIQUID_NETWORK` (`mainnet` | `testnet`); optional override `VITE_HYPERLIQUID_API_URL`.
- **QR encoding:** `qrcode` (headless encoder, with `@types/qrcode`) — imported only by the `shared/components/address-qr/` wrapper, which renders the module matrix itself as hard pixel `<rect>`s (no anti-alias) using the pixel tokens. No feature code imports the encoder directly. See ADR-0029.
- **PNG export:** `modern-screenshot` — DOM→PNG rasterizer for the shareable PnL card. Imported by exactly one file, `shared/components/pnl-card/use-pnl-card-export.ts` (captures the off-screen 1200×630 card at `scale: 2`, inlining the Monocraft `woff2` so the pixel font survives into the PNG). No feature code imports it directly. See ADR-0037.
- **Icons:** `lucide-react` — tree-shakeable SVG icons (named imports, `currentColor`-aware, numeric `size`). Used for compact action-row controls in the account dock (Cancel / Close / Modify / Manage / Transfer / Share / Edit), rendered inside the existing pixel-framed buttons. See ADR-0067.
- **Styling:** CSS Modules (`*.module.css`) by default; runtime-dependent styles in `*.styles.ts` (see `frontend-architecture.md`).
- **Testing:** Vitest 4 + `jsdom`, Testing Library (`@testing-library/react` + `user-event` + `jest-dom`), MSW 2 for HTTP mocks, `@vitest/coverage-v8`.
- **Linting:** ESLint 10 with `typescript-eslint`, `eslint-plugin-import` (+ `eslint-import-resolver-typescript`), `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`. Hard import rules from `frontend-architecture.md` are enforced here (`import/no-restricted-paths`).
- **Package manager:** pnpm (workspace root pins `packageManager`); Turbo orchestrates workspace scripts from the repo root.

If a change pulls in something not on this list (a UI framework, a different state library, a different test runner, a CSS-in-JS lib, a new charting lib), stop and propose an ADR in `docs/adr/` first. The stack above is load-bearing for the rules in `.claude/rules/`.

## Verification: `pnpm verify`

After any change in `apps/client/`, run `pnpm verify` (from `apps/client/`, or `pnpm --filter @perps/client verify` from the repo root). It is the single source of truth that the change is good — a change is **not** done until it exits 0. If a step is intentionally skipped (e.g. docs-only PR), say so explicitly.

`pnpm verify` runs, in order (fastest feedback first):

1. **`pnpm lint`** → `eslint .`. Catches the hard import rules from `frontend-architecture.md` (no cross-module deep imports, `trading/` ↮ venue modules) plus React Hooks and refresh rules.
2. **`pnpm typecheck`** → `tsc -b --noEmit`. Walks all project references; catches every type error including `Result` narrowing.
3. **`pnpm test`** → `vitest run`. Component tests via Testing Library + jsdom; HTTP mocked with MSW.
4. **`pnpm build`** → `tsc -b && vite build`. Confirms the production bundle builds (Vite + React Compiler).

Out of scope of `pnpm verify`:

- **Manual UI verification** — for visible UI changes, also exercise the feature in `pnpm dev` (golden path + edge cases). `verify` proves the code compiles, types, lints, and tests pass; it does not prove the screen looks right.
- **Preview / e2e** — `pnpm preview` is for inspecting the production bundle locally. No e2e suite exists yet; if one lands, fold it in.

## Frontend rule set

@.claude/rules/frontend-architecture.md
@.claude/rules/folder-structure.md
@.claude/rules/error-handling.md
@.claude/rules/testing.md
@.claude/rules/http.md
@.claude/rules/wallet-gate.md
@.claude/rules/logging.md
@.claude/rules/websocket-streaming.md
@.claude/rules/hyperliquid-account-modes.md

## Account module: no port/adapter

The `apps/client/src/modules/account/` module is openly coupled to Privy and to our own backend. It has **no** `AccountAdapter` port, no `MockAccountAdapter`, no `HttpAccountAdapter`. This is a deliberate deviation from the `trading/` and `portfolio/` modules — see `docs/adr/0004-no-account-adapter-port.md` before "fixing" the asymmetry.

Module shape:
- `domain/` — types only (`User`, `Wallet`, `OnboardingInput`)
- `api/` — thin fetch wrappers (`getMe()`, `onboard()`) using a shared `apiClient` that attaches the Privy JWT per call via `getAccessToken()`
- `providers/AuthProvider` — wraps `PrivyProvider`; exposes `useAuth()`. The rest of the app does **not** import from `@privy-io/react-auth` directly.
- `hooks/useOnboardingFlow` — mounted in `AppShell`, watches `ready && authenticated && wallet ready`, calls `getMe()`, on 404 calls `onboard()`.
- `components/` — UI.
