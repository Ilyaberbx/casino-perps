import { useEffect, useRef } from 'react'

export interface SessionBootstrapOptions {
  /** Whether the wallet session is live (`useIsWalletConnected()`). */
  readonly isConnected: boolean
  /** Whether the bootstrap read may run now (session live + any extra preconditions). */
  readonly canBootstrap: boolean
  /**
   * Identity of the account the bootstrap is keyed to (slice 07: the Selected
   * Wallet master address). When it changes mid-session — without a disconnect —
   * the provider state is `onReset()`'d and the bootstrap re-runs for the new
   * account, so switching the Selected Wallet re-evaluates readiness without
   * tearing the session down. Omit (or hold stable) for callers that key only on
   * the connect session. A `null`→non-null transition does not re-fire the reset
   * (it is treated as the initial bootstrap, not a re-key).
   */
  readonly bootstrapKey?: string | null
  /**
   * Clear provider state. Fires on a full wallet disconnect (`isConnected` →
   * false) AND on a mid-session `bootstrapKey` re-key (Selected Wallet switch).
   * Must therefore be safe to run on a mere account switch — do NOT wipe
   * account-stable persisted state here; use `onDisconnect` for that.
   */
  onReset(): void
  /**
   * Fires ONLY on a full wallet disconnect (`isConnected` → false), never on a
   * mid-session `bootstrapKey` re-key. The seam for end-of-session cleanup that
   * must survive an account switch but not a logout — e.g. wiping the plaintext
   * Hyperliquid agent key from localStorage (SEC-M1). Optional.
   */
  onDisconnect?(): void
  /**
   * Run the one-shot bootstrap read. `isCancelled()` is true once the effect has
   * torn down (session ended / unmounted) — bail out of any `setState` after an
   * await when it returns true.
   */
  run(isCancelled: () => boolean): void | Promise<void>
}

/**
 * The reset-on-disconnect + bootstrap-once scaffolding shared by the Hyperliquid
 * session providers (`use-deposit`, `use-builder-fee`, the agent-wallet bootstrap)
 * — WR-GEN-01. Owns the `startedRef` (one bootstrap per connect session) and the
 * `cancelled` guard; each provider supplies only its `onReset` and `run` thunk.
 *
 * Callbacks are held in refs so the effects key purely on `isConnected` /
 * `canBootstrap`: an `onReset`/`run` identity change must NOT re-fire the reset
 * cleanup mid-session or re-run a completed bootstrap.
 */
export function useSessionBootstrap(options: SessionBootstrapOptions): void {
  const { isConnected, canBootstrap, bootstrapKey = null } = options
  const startedRef = useRef(false)
  // The account identity the current bootstrap ran against. A change mid-session
  // (Selected Wallet switch) re-keys: reset state + allow a fresh bootstrap.
  const bootstrapKeyRef = useRef<string | null>(null)

  // Keep the latest callbacks in refs (synced in an effect, never during render —
  // react-hooks/refs) so the lifecycle effects below key purely on
  // `isConnected` / `canBootstrap` and don't re-fire on a callback identity change.
  const onResetRef = useRef(options.onReset)
  const onDisconnectRef = useRef(options.onDisconnect)
  const runRef = useRef(options.run)
  useEffect(() => {
    onResetRef.current = options.onReset
    onDisconnectRef.current = options.onDisconnect
    runRef.current = options.run
  })

  // Reset effect: fires cleanup when isConnected goes false (wallet disconnect).
  // `onDisconnect` fires ONLY here (true logout), never on the mid-session re-key
  // path below — so end-of-session wipes (the agent-key localStorage purge) don't
  // run on a mere Selected-Wallet switch.
  useEffect(() => {
    if (!isConnected) return
    return () => {
      onResetRef.current()
      onDisconnectRef.current?.()
      startedRef.current = false
      bootstrapKeyRef.current = null
    }
  }, [isConnected])

  // Bootstrap effect: runs once per connect session, and again whenever the
  // bootstrapKey (the account identity) changes mid-session. A mid-session key
  // change resets the provider state for the previous account before re-running.
  useEffect(() => {
    if (!canBootstrap) return

    const hasKeyChanged =
      bootstrapKey !== null && bootstrapKeyRef.current !== null && bootstrapKey !== bootstrapKeyRef.current
    if (hasKeyChanged) {
      onResetRef.current()
      startedRef.current = false
    }
    if (startedRef.current) return

    startedRef.current = true
    bootstrapKeyRef.current = bootstrapKey

    let cancelled = false
    void runRef.current(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [canBootstrap, bootstrapKey])
}
