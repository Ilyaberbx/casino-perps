# shared/http (client)

> **Scope of this file:** non-obvious context only. Update in the same PR that changes the module's public surface, ownership, or dependencies.

## Purpose

The single authenticated HTTP transport for the whole client. Every server-bound request goes through here. Module-level `api/` folders are thin endpoint wrappers on top of this client and own no transport concerns. See `apps/client/.claude/rules/http.md` for the contract.

## Public surface

- `createApiClient({ getAccessToken, baseUrl }): ApiClient` — factory. `getAccessToken` is called per request, never cached.
- `client.get<T>(path): ResultAsync<T, HttpError>`
- `client.post<T>(path, body): ResultAsync<T, HttpError>`
- `client.subscribeToSessionExpired(handler): () => void` — multi-subscriber; returns an unsubscribe.
- `HttpError` discriminated union via `kind` field:
  - `SessionExpiredError { kind: 'session-expired' }`
  - `ApiError { kind: 'api'; status; path; body; requestId? }`
  - `NetworkError { kind: 'network'; cause }`
  - `ParseError { kind: 'parse'; cause }` (reserved for endpoint-wrapper Zod failures; the transport itself never produces it today)
- Types: `ApiClient`, `CreateApiClientArgs`, `HttpError`, `SessionExpiredHandler`.
- Observability helpers (pure):
  - `requestIdFrom(value): string | undefined` — digs the server `x-request-id` out of a raw `ApiError` **or** a domain error wrapping one in `.cause` (one level). Use it in failure-log fields across feature modules; returns `undefined` for failures that never reached the server.
  - `describeHttpError(error): { kind; status?; requestId? }` — safe structured log fields for any `HttpError`. Never includes the response body.
  - `readRequestId(response): string | undefined` — reads `x-request-id` off an Axios response (used internally by the transport).
  - `REQUEST_ID_HEADER = 'x-request-id'`.

## Owns

- The Axios instance. The single place in the client that talks to the network for backend calls.
- The `Authorization: Bearer <Privy JWT>` header (attached per call from the injected `getAccessToken`).
- 401 → fresh-token → retry-once policy. Second 401 surfaces `SessionExpiredError` and notifies subscribers.
- `http-status-codes` is the only place client code references status codes — no magic numbers anywhere.
- The `x-request-id` correlation id: read off every failed response onto `ApiError.requestId`, paired with the server's `RequestLoggingMiddleware` (which echoes the same id on the `request` log line). Lets a client failure log name the exact server line + cause.

## Depends on

- `axios` — HTTP transport.
- `neverthrow` — `ResultAsync` for the public surface.
- `http-status-codes` — `StatusCodes.UNAUTHORIZED` etc.

## Cross-app contract

None directly. The transport is generic; `account/api/` (and future module `api/` folders) are the endpoint-specific consumers. The Privy JWT contract lives in `account/` (token source) and is verified server-side.

## Gotchas

- **Per-call token, not cached.** Every request re-invokes `getAccessToken()`. Do not memoise the token inside the client.
- **POST body re-sent on retry.** The request config (including the body) is rebuilt with the fresh token; the original request was rejected by the auth guard before any controller ran, so retry is side-effect-free. This is a contract — see the test "non-idempotent POST is not double-applied".
- **`validateStatus: () => true` on the Axios instance.** We map non-2xx to `HttpError` ourselves rather than catching Axios throws — keeps the 401-retry path on the Result rail, not the throw rail.
- **`ParseError` is currently unused by the transport.** The transport returns response body as-is via `response.data`; endpoint wrappers that Zod-parse return values map their own parse failures into `ParseError`.

## Out of scope

- Schema validation of response bodies (endpoint wrappers' job).
- Anything not authenticated by Privy JWT (none today).
