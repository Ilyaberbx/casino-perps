import { Result } from 'neverthrow'

const PRIVY_STORAGE_PREFIX = 'privy:'

/**
 * Best-effort purge of Privy's `localStorage` session keys.
 *
 * Privy's own `logout()` only clears the session for the *currently configured*
 * app id. A key written by a previously configured `VITE_PRIVY_APP_ID` (after a
 * dev app-id swap) survives logout and keeps a dead, unrefreshable token around;
 * the server then rejects it as `TOKEN_INVALID` on every request, leaving the
 * app stuck "disconnected" with no clean recovery short of a manual
 * "Clear site data". Wiping every `privy:`-prefixed key guarantees the next
 * login starts from a clean slate.
 *
 * `localStorage` access can throw (privacy mode / disabled storage), so the
 * whole body is wrapped at the boundary — a failure degrades to a no-op,
 * mirroring the `*-store.ts` convention elsewhere in the app.
 */
export function clearPrivyStorage(): void {
  Result.fromThrowable(
    () => {
      // Collect first, then remove: `removeItem` re-indexes the store, so
      // mutating while iterating by index would skip keys. `Storage.key(i)` is
      // the reliable enumeration API (`Object.keys(localStorage)` does not
      // enumerate Storage entries).
      const staleKeys: string[] = []
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i)
        if (key !== null && key.startsWith(PRIVY_STORAGE_PREFIX)) {
          staleKeys.push(key)
        }
      }
      for (const key of staleKeys) {
        window.localStorage.removeItem(key)
      }
    },
    (cause) => cause,
  )()
}
