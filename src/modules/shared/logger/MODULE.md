# shared/logger (client)

> **Scope of this file:** non-obvious context only. Update in the same PR that changes the module's public surface, ownership, or dependencies.

## Purpose

The single client-side `Logger` port plus its foundational adapters. Mirrors the server's `shared/logger` interface (call shape `(fields, message)`, methods `info`/`warn`/`error`/`debug`) and adds `child(fields)` for per-file `module` pre-binding — a client-only need not surfaced on the server's port. The configured singleton is **not** here; it lives in `app/logger.ts`.

## Public surface

- `Logger` (type) — `info`/`warn`/`error`/`debug` taking `(fields, message)` plus `child(fields): Logger`.
- `LogLevel` — `'debug' | 'info' | 'warn' | 'error'`.
- `LogFields` — `Record<string, unknown>`.
- `LoggerAdapter` (type) — same four leveled methods, no `child`. Sinks implement this.
- `CreateLoggerOptions` — `{ level: LogLevel; adapter: LoggerAdapter }`.
- `createLogger(options)` — factory: applies the level filter **before** dispatch, owns `child()` field merge.
- `ConsoleLoggerAdapter` — adapter that calls `console.<level>(message, fields)` (no `JSON.stringify`, preserves DevTools object inspection).
- `MultiLoggerAdapter(adapters)` — composes N adapters; per-adapter `try/catch` so one broken sink never silences the rest. Records reach adapters in registration order.
- `NoopLogger` — `Logger` that drops every record. For tests / explicit silencing.
- `formatAddress(address: WalletAddress | null): string` — renders `0x…<last4>`, `'unknown'` for `null`. Lower-cased to match `brandSdkAddress` normalisation. The authorised path for placing a `WalletAddress` into `LogFields`.
- `scrubAddresses(message: string): string` — redacts every `0x`-prefixed 40-hex address embedded in arbitrary text to the `0x…<last4>` form. Use at logging boundaries when the source string (e.g. an SDK error message) may contain a raw wallet address.

## Owns

- The `Logger` port shape on the client.
- `child()` merge semantics: **call-site fields win on key collision** (matches Pino bindings semantics). Chained `child().child()` merges every layer.
- Wallet-address rendering for log records (`formatAddress`). Interpolating a raw `WalletAddress` into a log field is forbidden by `apps/client/.claude/rules/logging.md`.
- **Log-level resolution** (`resolve-log-level.ts`): the pure `resolveLogLevel(rawLevel, isDev)` that applies the optional `VITE_LOG_LEVEL` override (override wins, Zod-validated, invalid → default + `invalidRaw` flag) over the `debug`(dev)/`info`(prod) default. **Not exported from the barrel** — `app/logger.ts` imports it by subpath (the one sanctioned `shared/logger` value-importer). See `apps/client/.claude/rules/logging.md`.

## Depends on

- `WalletAddress` from `@/modules/shared/domain/wallet-address` (type only, used by `formatAddress`).
- `zod` — used by `resolve-log-level.ts` to validate the `VITE_LOG_LEVEL` override. The port machinery (`create-logger`, adapters, `formatAddress`) remains dependency-free and runs outside React contexts (services, factories, the error boundary's static `getDerivedStateFromError`).

## Cross-app contract

None at runtime. The interface deliberately matches `apps/server/src/shared/logger` (`(fields, message)`, same level names) so a future shared package is a one-step move; the client adds `child()` as a strict superset.

## Gotchas

- **No `console.*` outside this module.** Project rule (lint-enforced once ADR-0011 lands): the only legal `console.*` callsite in `apps/client/src/` is `adapters/console-logger-adapter.ts`. Adding new adapters that talk to `console.*` is fine inside this folder; doing it anywhere else is not.
- **Do not import the singleton from here.** The configured logger lives in `app/logger.ts`. This module is the machinery; consumers either receive `logger: Logger` via factory options or import the singleton from `@/app/logger`. Importing `@/modules/shared/logger` outside `app/logger.ts` is a type-only import (`import type { Logger }`).
- **Filter happens before dispatch.** A record below threshold never reaches the adapter — adapters do not need to re-check `level`.
- **`MultiLoggerAdapter` swallows per-adapter failures.** This is intentional: a Sentry transport failing must not silence the console transport. If you need per-adapter failure visibility, add a wrapping adapter that captures the throw — do not remove the `try/catch`.
- **`formatAddress` is the only authorised path** for placing a `WalletAddress` into `LogFields`. `apps/client/.claude/rules/logging.md` rule 1 forbids interpolating raw addresses.

## Out of scope

- The configured singleton (`app/logger.ts`).
- Sentry / remote sinks. The shape supports them via `MultiLoggerAdapter`; shipping one is a follow-up PRD.
- Request-id / trace-id correlation, sampling, batching, rate limiting.
- Server-side logging — `apps/server/src/shared/logger` already has Pino + redaction.
