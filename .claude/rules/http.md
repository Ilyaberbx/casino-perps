# HTTP Rules

There is one HTTP transport in the client. Every network call goes through it. Module `api/` folders are thin endpoint wrappers on top — they do not own transport.

## 1. One transport: `modules/shared/http/`

`apps/client/src/modules/shared/http/` is the only place that calls `fetch` (or any equivalent). It owns:

- the `fetch` call,
- attaching the `Authorization: Bearer <Privy JWT>` header,
- 401 retry-once-with-fresh-token,
- session-expired notification,
- mapping HTTP/network/parse failures into a typed `HttpError` union.

Module-level `api/` folders (`account/api/`, `trading/api/`, …) contain **endpoint wrappers only**: a function per endpoint that calls `client.get` / `client.post`, parses the response with Zod, and returns a `ResultAsync<T, HttpError>`. They must not call `fetch`, must not read `localStorage`, must not touch headers, must not handle 401s. If an endpoint wrapper grows transport concerns, the transport belongs in `shared/http/`, not the wrapper.

## 2. Frozen public surface

The `shared/http/` module exposes exactly this surface. Adding to it requires an ADR.

- `createApiClient({ getAccessToken }): ApiClient`
  - `getAccessToken: () => Promise<string | null>` — called per request, never cached by the client.
- `client.get<T>(url: string): ResultAsync<T, HttpError>`
- `client.post<T>(url: string, body: unknown): ResultAsync<T, HttpError>`
- `subscribeToSessionExpired(handler: () => void): () => void`
  - Returns an unsubscribe function. Multiple subscribers supported.
- `HttpError` — discriminated union, each variant carries a `kind`:
  - `SessionExpiredError { kind: 'session-expired' }`
  - `ApiError { kind: 'api'; status: number; body: unknown; requestId?: string }`
  - `NetworkError { kind: 'network'; cause: unknown }`
  - `ParseError { kind: 'parse'; cause: unknown }`
- Observability helpers (pure; sanctioned by ADR-0049): `requestIdFrom(value)`, `describeHttpError(error)`, `readRequestId(response)`, `REQUEST_ID_HEADER`.

No other `HttpError` variants. No public `request<T>(method, url, body)` escape hatch. No exported `fetch` re-export.

`ApiError.requestId` (the server's `x-request-id` correlation id) and the observability helpers were added per **ADR-0049**; they carry no transport behaviour and do not relax the no-escape-hatch rules above.

## 3. Behavioural contract

These behaviours are part of the contract — feature code depends on them, and they are tested in `shared/http/__tests__/`.

- **Per-call token.** Every request calls `getAccessToken()` immediately before the fetch. The client does not cache the token across calls.
- **Missing token → `NetworkError` before fetch.** If `getAccessToken()` resolves to `null`, the client returns `err(NetworkError)` without issuing the request. No silent unauthenticated request.
- **401 → retry once with a fresh token.** On a 401 response, the client calls `getAccessToken()` again and retries the same request once. POST bodies are re-sent on the retry. The retry uses a fresh `AbortController` — the original controller is not double-applied.
- **Second 401 → `SessionExpiredError` + notify.** If the retry also returns 401, the client returns `err(SessionExpiredError)` and synchronously notifies every subscriber registered via `subscribeToSessionExpired`. Notification happens once per failed retry, not once per subscriber call.
- **Other non-2xx → `ApiError`** with the status and parsed body (or raw text if body parsing fails).
- **Network failures → `NetworkError`** with `cause` set to the underlying error.
- **Response parse failures → `ParseError`** with `cause` set to the Zod or JSON error.

## 4. No magic numbers — use `http-status-codes`

Status-code references go through the [`http-status-codes`](https://www.npmjs.com/package/http-status-codes) package: `import { StatusCodes } from 'http-status-codes'`. Compare with `StatusCodes.UNAUTHORIZED`, `StatusCodes.NOT_FOUND`, etc. Raw `401`, `404`, `500` literals are forbidden in client code, both inside `shared/http/` and in endpoint wrappers.
