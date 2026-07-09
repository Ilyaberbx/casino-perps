import type { Unsubscribe, WalletAddress } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type { HyperliquidGateway } from '../gateway'
import { createWebData2Stream, type WebData2Stream } from './web-data2-stream'
import {
  createAllDexsClearinghouseStateStream,
  type AllDexsClearinghouseStateStream,
} from './all-dexs-clearinghouse-state-stream'
import { createHyperliquidPullService, type HyperliquidPullService } from './hyperliquid-pull'

/**
 * The structural shape shared by the three Acting-keyed account sources
 * (`WebData2Stream`, `AllDexsClearinghouseStateStream`, `HyperliquidPullService`):
 * a latest-value getter, a fan-out subscribe, an address re-evaluation hint, and
 * teardown. `TSub` is the subscribe payload (non-null for the streams); `TCur`
 * is the `current()` return (nullable for the streams, the snapshot for pull).
 * The selector below is generic over this shape so one implementation serves all
 * three.
 */
interface ActingSourceLike<TSub, TCur> {
  current(): TCur
  subscribe(onUpdate: (value: TSub) => void): Unsubscribe
  refreshAddress(): void
  stop(): void
}

/**
 * Lazily-diverging selector over a (viewing, acting) source pair (ADR-0038 D-2).
 *
 * When the Acting Address equals the Viewing Address — the normal, non-spectating
 * steady state — the selector **aliases the viewing source**: every subscription
 * lands on the existing viewing instance, so NO second WebSocket / pull is opened
 * (zero steady-state cost). When the addresses diverge (while Spectating), the
 * selector lazily creates the acting instance and routes subscriptions there, so
 * the order flow reads the connected wallet while the dock reads the spectated
 * one. On `refreshActingAddress()` (wallet rotation) or convergence back to a
 * single address (stop-spectating), it re-routes every live subscription and
 * tears the acting instance down when it is no longer needed.
 *
 * `isDiverged()` is read at subscribe time and on every `refreshActingAddress()`;
 * it must reflect "acting !== viewing" using the same closures the underlying
 * sources read, so the routing decision can never disagree with the address each
 * instance subscribes to.
 */
function createActingSourceSelector<TSub, TCur>(options: {
  readonly viewing: ActingSourceLike<TSub, TCur>
  readonly createActing: () => ActingSourceLike<TSub, TCur>
  readonly isDiverged: () => boolean
}): ActingSourceLike<TSub, TCur> {
  const { viewing, createActing, isDiverged } = options
  let acting: ActingSourceLike<TSub, TCur> | null = null
  // Each live subscription records which source it is currently routed to plus
  // its unsubscribe handle, so a re-route can swap them atomically.
  interface Routed {
    onUpdate: (value: TSub) => void
    routedToActing: boolean
    unsub: Unsubscribe
  }
  const routed = new Set<Routed>()

  function ensureActing(): ActingSourceLike<TSub, TCur> {
    if (acting === null) acting = createActing()
    return acting
  }

  function teardownActingIfUnused(): void {
    if (acting === null) return
    const stillRoutedToActing = [...routed].some((entry) => entry.routedToActing)
    if (stillRoutedToActing) return
    acting.stop()
    acting = null
  }

  function attach(entry: Routed, toActing: boolean): void {
    const source = toActing ? ensureActing() : viewing
    entry.routedToActing = toActing
    entry.unsub = source.subscribe(entry.onUpdate)
  }

  return {
    current() {
      const useActing = isDiverged()
      const source = useActing ? ensureActing() : viewing
      return source.current()
    },
    subscribe(onUpdate) {
      const entry: Routed = { onUpdate, routedToActing: false, unsub: () => {} }
      attach(entry, isDiverged())
      routed.add(entry)
      return () => {
        entry.unsub()
        routed.delete(entry)
        teardownActingIfUnused()
      }
    },
    refreshAddress() {
      // Driven on BOTH spectate enter/leave (viewing change → divergence may flip)
      // and wallet rotation (acting address change). Re-key the acting instance
      // if one exists — harmless when the acting address is unchanged (its stream
      // bails on the same address) and required when it rotated — then re-route
      // every live subscription whose target source changed. The viewing source's
      // own re-key is driven by the venue-level refreshAddress(), never here.
      if (acting !== null) acting.refreshAddress()
      const shouldUseActing = isDiverged()
      for (const entry of routed) {
        if (entry.routedToActing === shouldUseActing) continue
        entry.unsub()
        attach(entry, shouldUseActing)
      }
      teardownActingIfUnused()
    },
    stop() {
      for (const entry of routed) entry.unsub()
      routed.clear()
      if (acting !== null) {
        acting.stop()
        acting = null
      }
    },
  }
}

/**
 * The three Acting-Address-keyed account sources for the order flow, each a
 * lazily-diverging selector over its viewing counterpart (ADR-0038 D-1/D-2).
 * Plus `refreshActingAddress()` (re-key on wallet rotation) and `stop()`
 * (compose into the venue's dispose).
 */
export interface ActingAccountSources {
  readonly stream: WebData2Stream
  readonly allDexsClearinghouseStateStream: AllDexsClearinghouseStateStream
  readonly pull: HyperliquidPullService
  refreshActingAddress(): void
  stop(): void
}

export function createActingAccountSources(options: {
  readonly gateway: HyperliquidGateway
  readonly viewingStream: WebData2Stream
  readonly viewingAllDexsStream: AllDexsClearinghouseStateStream
  readonly viewingPull: HyperliquidPullService
  readonly getAddress: () => WalletAddress | null
  readonly getActingAddress: () => WalletAddress | null
  readonly logger: Logger
}): ActingAccountSources {
  const isDiverged = (): boolean => options.getActingAddress() !== options.getAddress()

  const streamSelector = createActingSourceSelector({
    viewing: options.viewingStream,
    createActing: () =>
      createWebData2Stream({
        gateway: options.gateway,
        getAddress: options.getActingAddress,
        logger: options.logger,
      }),
    isDiverged,
  })

  const allDexsSelector = createActingSourceSelector({
    viewing: options.viewingAllDexsStream,
    createActing: () =>
      createAllDexsClearinghouseStateStream({
        gateway: options.gateway,
        getAddress: options.getActingAddress,
        logger: options.logger,
      }),
    isDiverged,
  })

  const pullSelector = createActingSourceSelector({
    viewing: options.viewingPull,
    createActing: () =>
      createHyperliquidPullService({
        gateway: options.gateway,
        getAddress: options.getActingAddress,
        logger: options.logger,
      }),
    isDiverged,
  })

  // The selectors only carry `current` / `subscribe` from the underlying source
  // shapes; the order-flow readers consume exactly those. We re-attach the
  // structural extras the reader types still nominally require (connectionStatus
  // on the streams) from the viewing instance — order-flow readers never read
  // them, and the viewing connection state is the venue-level truth.
  const stream: WebData2Stream = {
    current: () => streamSelector.current(),
    subscribe: (onUpdate) => streamSelector.subscribe(onUpdate),
    connectionStatus: options.viewingStream.connectionStatus,
    refreshAddress: () => streamSelector.refreshAddress(),
    stop: () => streamSelector.stop(),
  }
  const allDexsClearinghouseStateStream: AllDexsClearinghouseStateStream = {
    current: () => allDexsSelector.current(),
    subscribe: (onUpdate) => allDexsSelector.subscribe(onUpdate),
    connectionStatus: options.viewingAllDexsStream.connectionStatus,
    refreshAddress: () => allDexsSelector.refreshAddress(),
    stop: () => allDexsSelector.stop(),
  }
  const pull: HyperliquidPullService = {
    current: () => pullSelector.current(),
    subscribe: (onUpdate) => pullSelector.subscribe(onUpdate),
    refreshAddress: () => pullSelector.refreshAddress(),
    stop: () => pullSelector.stop(),
  }

  return {
    stream,
    allDexsClearinghouseStateStream,
    pull,
    refreshActingAddress() {
      stream.refreshAddress()
      allDexsClearinghouseStateStream.refreshAddress()
      pull.refreshAddress()
    },
    stop() {
      stream.stop()
      allDexsClearinghouseStateStream.stop()
      pull.stop()
    },
  }
}
