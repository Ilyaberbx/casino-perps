# WebSocket Streaming Rules

There is one reconnection helper in the client. Every persistent stream — websocket-backed or any subscription whose owner exposes a `failureSignal` + `unsubscribe()` pair — goes through it. Venue gateways own the SDK calls; this rule owns *how* they are consumed.

## 1. One reconnect path: `shared/services/with-reconnect`

`apps/client/src/modules/shared/services/with-reconnect.ts` is the only reconnection implementation in the client. Every stream service in a venue module MUST wrap its SDK `subscribe*` call in `withReconnect`. No bespoke retry loops. No reliance on the SDK's internal retry budget as the only recovery path — that budget exhausts within minutes of flaky network (the bug behind ADR-0020) and is not user-recoverable.

## 2. Subscription contract

The `subscribe` callback returns `ResultAsync<TSub, TErr>` where:

- `TSub extends ReconnectableSubscription` — the resolved subscription value carries `failureSignal: AbortSignal` and `unsubscribe(): Promise<void>`. Both are structural: nominal SDK types (e.g. Hyperliquid's `Subscription`) satisfy by shape.
- `TErr extends ReconnectableGatewayError` — the error carries `kind: string` and `message: string`. Venue gateway error classes (e.g. `HyperliquidGatewayError`) satisfy by shape; narrowing is preserved at the callsite because TypeScript infers `TSub` / `TErr` from the gateway's own return type.

No `try/catch` wrapping a subscribe — surface the failure as `err(...)` and let `withReconnect` schedule the next attempt.

## 3. `ConnectionStatusSource` is the only connection-state surface

Every stream-owning service MUST expose `connectionStatus: ConnectionStatusSource` (from `@/modules/shared/domain`) to its consumers. The five states are exhaustive:

- `disconnected` — not yet subscribed, or explicitly stopped.
- `connecting` — first subscribe-promise pending.
- `connected` — subscribe-promise resolved; receiving ticks.
- `reconnecting` — mid-stream `failureSignal` aborted, or a subsequent attempt is pending after at least one successful connect.
- `error` — first subscribe-promise rejected before any success.

UI indicators (top-bar dot, portfolio footer pill, account-dock health) consume this source. **No module-local `isConnected` flags.** No branching on `useAuth().authenticated` as a proxy for connection state. One source of truth per stream.

## 4. Multiplex at the reader, not the consumer

Feature code (components, hooks, pages) MUST NOT call gateway `subscribe*` methods directly. Each venue's `services/` folder owns the multiplex: one upstream `withReconnect` subscription per logical channel, fanned out to N consumer-side `.subscribe(onUpdate)` listeners. Readers (`*-snapshot-reader.ts`, `*-stream.ts`) compose those multiplex services into capability-shaped outputs.

This keeps the SDK boundary thin (per the four-file lint allowlist for `@nktkas/hyperliquid` and any future venue SDK) and means there is exactly one reconnect handle per channel, not one per React subscriber.

## 5. Logging conventions (extends `logging.md`)

Every `withReconnect` callsite passes:

- `logger`: already child-bound (`logger.child({ module: '<venue>-stream' })` or per-service).
- `event`: short label in the form `'<channel> subscribe'` — e.g. `'l2Book subscribe'`, `'webData2 subscribe'`, `'candle subscribe'`. Used in both `info` (status transitions) and `warn` (failures) records.
- `logContext`: structured fields merged into every record. Conventional keys: `address` (formatted via `formatAddress()` — never raw), `symbol`, `interval`. No raw wallet addresses, no JWTs, no PII (see `logging.md`).

The helper emits `info` only on `connection status` transitions and `warn` on retryable failures. **Do not log a successful subscribe at the callsite** — `withReconnect` already logs the `connecting → connected` transition. Duplicating it produces noise and violates the "info = lifecycle, not per-call" rule.

## 6. Forbidden patterns

- `new WebSocket(...)`, `socket.io`, `pusher`, `ably`, `EventSource(...)` anywhere in `apps/client/src/`. If a future venue needs a native socket, wrap it in a structural `ReconnectableSubscription` adapter inside that venue's gateway folder — feature code MUST never see a raw socket.
- Raw `@nktkas/hyperliquid` (or any future venue SDK) `subscribe*` calls outside the four lint-allowed gateway files (see `apps/client/CLAUDE.md` "Tech stack").
- `try { ... } catch { ... }` around a subscribe call. Errors are values — return them via `ResultAsync` and let `withReconnect` handle the retry.
- A bespoke `setTimeout`-based retry loop in any service. If a use case appears that genuinely needs a different backoff policy, pass it via `WithReconnectOptions.backoff` — do not roll a parallel implementation.

## 7. Test conventions

- Tests of any service that uses `withReconnect` MUST inject `setTimeout` / `clearTimeout` / `random` via options. Never use real timers — the default 250 ms base × jitter makes assertions flaky.
- Fakes of `ReconnectableSubscription` are structural literals (`{ failureSignal: new AbortController().signal, unsubscribe: () => Promise.resolve() }`). Do not mock the venue SDK directly — that couples the test to a venue boundary the helper does not see.
- `with-reconnect.test.ts` lives at `modules/shared/services/__tests__/`. Per-stream-service tests live alongside their service.

## Conventions

- **Backoff defaults**: `{ baseMs: 250, maxMs: 30_000, factor: 2, jitter: true }`. Override only with a one-line comment explaining the reason (e.g. a venue that rate-limits aggressive reconnects).
- **`event` label format**: `'<channel> subscribe'`, lowercase, present-tense. Used by ops dashboards to filter — keep it stable across refactors.
- **`logContext` keys**: `address` (formatted), `symbol`, `interval`, `coin`. Never `userId`, `privyDid`, or any free-form user payload.

## Cross-references

- `docs/adr/0020-shared-reconnect-utility.md` — why the helper lives in `shared/`.
- `docs/adr/0010-sdk-owned-reconnect.md` — original SDK-owned reconnect decision; amended by ADR-0020.
- `apps/client/.claude/rules/logging.md` — record shape and redaction rules these stream logs must obey.
