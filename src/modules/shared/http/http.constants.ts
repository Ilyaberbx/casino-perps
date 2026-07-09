/**
 * Per-request timeout for the shared axios transport. The browser imposes no
 * default on a hung XHR/fetch, so without this a stalled or cold-starting backend
 * leaves a request pending indefinitely — surfacing as a silent UI hang (e.g. the
 * post-login `getMe` never resolving, so the account button never appears). On
 * timeout axios throws an `AxiosError` (`code: 'ECONNABORTED'`), which the client
 * maps to a `NetworkError` the caller can act on. 15s comfortably covers a warm
 * round-trip while still failing fast when the backend is unreachable.
 */
export const HTTP_REQUEST_TIMEOUT_MS = 15_000
