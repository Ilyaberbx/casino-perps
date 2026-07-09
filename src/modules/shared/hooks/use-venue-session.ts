import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createConnectionSupervisor,
  type ConnectionSupervisor,
  type ConnectionSupervisorSnapshot,
} from '../services/connection-supervisor'
import type { Venue } from '../domain/venue'
import type { ConnectionRecoveryContextValue } from '../providers/connection-recovery'
import type { VenueSession, VenueSessionOptions } from './use-venue-session.types'

const RECONNECT_GUARD_MS = 1500

/**
 * Owns the venue session lifecycle that used to live in `app/App.tsx`'s
 * composition root: venue create / rebuild-on-generation / dispose, the
 * connection supervisor + data-staleness feed, and the reconnect guard. Returns
 * the active venue plus the connection-recovery value.
 *
 * Address mirroring is **not** here. It lives in `app/selected-wallet-bridge.tsx`
 * (`SelectedWalletBridge`), which owns the holder write + venue refresh and
 * re-keys both to the Selected Wallet (PRD-0006). That bridge sits inside the
 * account session so it can read `useSelectedWallet`; this hook sits above it.
 * The venue-rebuild path here no longer touches the address — the bridge's
 * effect depends on `venue`, so a rebuild re-mirrors the address into the fresh
 * venue's closure.
 *
 * Relocation, not redesign — the behaviours below are load-bearing and backed
 * by ADRs; preserve them:
 * - The `useState` lazy-init + dep-driven rebuild effect is deliberate: under
 *   React 19 + React Compiler a `useMemo` factory can re-run on stable deps and
 *   tear down every WS sub ("Bug C"). This pattern guarantees one venue per
 *   `(venueId, reconnectGeneration)`.
 * - `dispose()` runs on the *previous* venue during a rebuild (in the `setVenue`
 *   updater) and on unmount (ADR-0015).
 */
export function useVenueSession<TVenueId extends string>(
  options: VenueSessionOptions<TVenueId>,
): VenueSession {
  const {
    venueId,
    createVenue,
    logger,
    setTimeout: scheduleTimeout = setTimeout,
    clearTimeout: cancelTimeout = clearTimeout,
  } = options

  // Bumping this counter forces a venue rebuild. Fresh gateway → fresh SDK
  // transports → all WS subs reopen. This is the venue-level "force reconnect"
  // hook the connection banner triggers.
  const [reconnectGeneration, setReconnectGeneration] = useState(0)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const reconnectGuardRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Bug C: `useMemo` is not a stable cache under React 19 + React Compiler —
  // the auto-memoisation pass can re-execute the factory on subsequent renders
  // even when deps are stable, which creates a new venue + new WebSocketTransport
  // and tears down all WS subs on every cycle. `useState`'s lazy initializer +
  // an effect that handles dep bumps gives a strict "one venue per
  // (venueId, reconnectGeneration)" guarantee.
  const [venue, setVenue] = useState<Venue>(() => {
    logger.info({ venueId, reconnectGeneration: 0 }, 'venue rebuild')
    return createVenue(venueId)
  })
  const isFirstVenueRef = useRef(true)
  useEffect(() => {
    if (isFirstVenueRef.current) {
      isFirstVenueRef.current = false
      return
    }
    // Dep-driven rebuild: a venueId switch or a reconnect-generation bump
    // recreates the venue (fresh gateway + fresh SDK transports).
    logger.info({ venueId, reconnectGeneration }, 'venue rebuild')
    const next = createVenue(venueId)
    setVenue((prev) => {
      prev.dispose?.()
      return next
    })
  }, [venueId, reconnectGeneration, createVenue, logger])

  useEffect(() => {
    void venue.capabilities.marketData?.refresh()
    return () => {
      venue.dispose?.()
    }
  }, [venue])

  // Connection supervisor — watches the venue's connection capability for
  // option-B aggregate-down detection, and is fed `notifyTick` by the portfolio
  // reader (when available) for option-C data-staleness detection.
  const [supervisorSnapshot, setSupervisorSnapshot] = useState<ConnectionSupervisorSnapshot>(
    () => ({
      health: 'healthy',
      degradedSinceMs: null,
      lastTickAt: null,
      stallSeconds: null,
    }),
  )

  useEffect(() => {
    const supervisor: ConnectionSupervisor = createConnectionSupervisor({
      statusSources: [venue.capabilities.connection],
      logger,
    })
    const unsubSupervisor = supervisor.subscribe(setSupervisorSnapshot)

    // Feed data-flow ticks for staleness watchdog. Portfolio's `all` scope
    // snapshot fires on every webData2 tick — the readiest address-bound
    // signal of "data is flowing". If portfolio is absent or wallet-less, the
    // staleness check stays inert (notifyTick never called → lastTickAt null).
    const portfolio = venue.capabilities.portfolio
    const unsubPortfolio = portfolio?.subscribeSnapshot('all', () => supervisor.notifyTick())

    return () => {
      unsubPortfolio?.()
      unsubSupervisor()
      supervisor.stop()
    }
  }, [venue, logger])

  const reconnect = useCallback(() => {
    if (reconnectGuardRef.current !== null) return
    setIsReconnecting(true)
    setReconnectGeneration((g) => g + 1)
    // Brief guard so the button doesn't flicker between consecutive clicks
    // while the new venue's first subscribe-promise resolves.
    reconnectGuardRef.current = scheduleTimeout(() => {
      setIsReconnecting(false)
      reconnectGuardRef.current = null
    }, RECONNECT_GUARD_MS)
  }, [scheduleTimeout])

  useEffect(() => {
    return () => {
      if (reconnectGuardRef.current !== null) {
        cancelTimeout(reconnectGuardRef.current)
        reconnectGuardRef.current = null
      }
    }
  }, [cancelTimeout])

  const recovery = useMemo<ConnectionRecoveryContextValue>(
    () => ({
      health: supervisorSnapshot.health,
      stallSeconds: supervisorSnapshot.stallSeconds,
      degradedSinceMs: supervisorSnapshot.degradedSinceMs,
      isReconnecting,
      reconnect,
    }),
    [supervisorSnapshot, isReconnecting, reconnect],
  )

  return { venue, recovery }
}
