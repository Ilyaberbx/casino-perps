import { createMockVenue } from '@/modules/mock-venue'
import {
  createHyperliquidVenue,
  DepositFlow,
  DepositFlowProvider,
  HyperliquidOnboardingProvider,
  HYPERLIQUID_VENUE_ID,
  HYPERLIQUID_VENUE_LABEL,
  loadHyperliquidConfig,
  TransferFlow,
  TransferFlowProvider,
  WithdrawFlow,
  WithdrawFlowProvider,
  SendFlow,
  SendFlowProvider,
  EvmCoreFlow,
  EvmCoreFlowProvider,
  Hip3AbstractionProvider,
  useHyperliquidDeposit,
  useHyperliquidTransfer,
  useHyperliquidWithdraw,
  useHyperliquidSend,
  useHyperliquidEvmCore,
  useHyperliquidHip3Abstraction,
  useHyperliquidVenueOnboarding,
  type HyperliquidConfig,
} from '@/modules/hyperliquid'
import { logger } from './logger'
import { getCurrentAgentSigningWallet } from './agent-signing-wallet-holder'
import { connectionLiveness } from './connection-liveness'
import hyperliquidIcon from '@/assets/venues/hyperliquid.png'
import type { VenueId, VenueRegistryEntry } from './venues.types'

// app.hyperliquid.xyz/favicon.ico serves the SPA index.html (text/html), not an
// image — the real icon assets are the PWA manifest's android-chrome PNGs. The
// local fallback (hyperliquid.png) is the same 192px asset vendored at build.
const HYPERLIQUID_ICON_URL = 'https://app.hyperliquid.xyz/android-chrome-192x192.png'

const hyperliquidConfigResult = loadHyperliquidConfig(import.meta.env as Record<string, string | undefined>)

function buildHyperliquidEntry(config: HyperliquidConfig): VenueRegistryEntry {
  return {
    id: HYPERLIQUID_VENUE_ID,
    label: HYPERLIQUID_VENUE_LABEL,
    iconRemoteUrl: HYPERLIQUID_ICON_URL,
    iconLocalSrc: hyperliquidIcon,
    create: (ctx) => {
      const venue = createHyperliquidVenue({
        network: config.network,
        apiHttpUrl: config.apiHttpUrl,
        apiWsUrl: config.apiWsUrl,
        getAddress: ctx.getAddress,
        // The Acting Address (connected-only) keys the order-flow `ownAccount`
        // group so validation/preview/leverage/fees ignore spectate (ADR-0038).
        getActingAddress: ctx.getActingAddress,
        // Bridge the agent signing wallet from AgentWalletProvider via the
        // module-scope holder — same pattern as getAddress. The closure reads
        // the live getter; agent approval / wallet rotation never rebuilds the
        // venue. Returns null until an agent is approved (trader → typed error).
        getAgentWallet: getCurrentAgentSigningWallet,
        logger,
        // Resume-driven stream resync (ADR-0041). Module-scoped coordinator, so
        // it outlives venue rebuilds; AppShell starts its DOM listeners once.
        resyncSignal: connectionLiveness.resyncSignal,
        notifyActivity: connectionLiveness.notifyActivity,
      })
      // Attach the Hyperliquid onboarding capability (ADR-0026). The factory
      // returns a plain `Venue`; we layer the React-bound onboarding pair on
      // here so the factory stays free of provider imports (and stays usable
      // from non-React tests).
      return {
        ...venue,
        onboarding: {
          provider: HyperliquidOnboardingProvider,
          useVenueOnboarding: useHyperliquidVenueOnboarding,
        },
        // In-app deposit capability (ADR-0028 / Chunk 3). Layered here for the
        // same reason as onboarding: the factory stays free of provider/React
        // imports. mock-venue omits this slot, so no DepositTrigger renders.
        deposit: {
          provider: DepositFlowProvider,
          body: DepositFlow,
          useDeposit: useHyperliquidDeposit,
        },
        // In-app Spot↔Perp transfer capability (ADR-0033). Layered here for the
        // same reason as deposit/onboarding: the factory stays free of provider/
        // React imports. mock-venue omits this slot, so no TransferTrigger
        // renders for it.
        transfer: {
          provider: TransferFlowProvider,
          body: TransferFlow,
          useTransfer: useHyperliquidTransfer,
        },
        // In-app Withdraw-to-Arbitrum capability (mirrors the transfer slice;
        // master-signed `withdraw3`, ADR-0012). Layered here for the same reason
        // as deposit/transfer: the factory stays free of provider/React imports.
        // mock-venue omits this slot, so no Withdraw affordance renders for it.
        withdraw: {
          provider: WithdrawFlowProvider,
          body: WithdrawFlow,
          useWithdraw: useHyperliquidWithdraw,
        },
        // In-app Send capability (usdSend / spotSend to an external address;
        // master-signed, ADR-0012). Layered here for the same reason as the
        // other money-movement capabilities. mock-venue omits this slot.
        send: {
          provider: SendFlowProvider,
          body: SendFlow,
          useSend: useHyperliquidSend,
        },
        // In-app EVM⇄Core capability (HyperCore ⇄ HyperEVM token moves; Core→EVM
        // is master-signed `spotSend` to the token system address, ADR-0012).
        // Layered here for the same reason as the other money-movement
        // capabilities. mock-venue omits this slot.
        evmCore: {
          provider: EvmCoreFlowProvider,
          body: EvmCoreFlow,
          useEvmCore: useHyperliquidEvmCore,
        },
        // HIP-3 DEX-abstraction capability (ADR-0081). Lets a default account
        // opt into cross-DEX collateral abstraction so builder-deployed HIP-3
        // markets stop rejecting orders with "insufficient margin". Layered here
        // for the same reason as the other React-bound capabilities: the factory
        // stays free of provider/React imports. mock-venue omits this slot (no
        // HIP-3 markets), so the gate always passes through for it.
        hip3Abstraction: {
          provider: Hip3AbstractionProvider,
          useHip3Abstraction: useHyperliquidHip3Abstraction,
        },
      }
    },
  }
}

const baseVenues: VenueRegistryEntry[] = []
// mock-venue is a dev-only synthetic Venue. Gating on `import.meta.env.DEV`
// makes Vite replace the guard with `false` in prod builds, so Rollup
// dead-code-eliminates the block AND tree-shakes the createMockVenue import —
// the module never ships in the production bundle.
if (import.meta.env.DEV) {
  baseVenues.push({ id: 'mock', label: 'Mock', iconRemoteUrl: null, create: () => createMockVenue() })
}
if (hyperliquidConfigResult.isOk()) {
  baseVenues.push(buildHyperliquidEntry(hyperliquidConfigResult.value))
}

export const VENUES: ReadonlyArray<VenueRegistryEntry> = baseVenues

// Dev: VENUES[0] is mock (convenient default). Prod: VENUES[0] is hyperliquid.
// Env-derived, so it lives here in the composition root rather than in a
// *.constants.ts file (env config is not a constant).
export const DEFAULT_VENUE_ID: VenueId = VENUES[0]?.id ?? HYPERLIQUID_VENUE_ID

export function isVenueId(value: unknown): value is VenueId {
  return VENUES.some((venue) => venue.id === value)
}

export function findVenue(id: VenueId): VenueRegistryEntry {
  const venue = VENUES.find((entry) => entry.id === id)
  if (!venue) throw new Error(`unreachable: venue id "${id}" not in registry`)
  return venue
}

export function getHyperliquidConfigFailure(): string | null {
  if (hyperliquidConfigResult.isOk()) return null
  return hyperliquidConfigResult.error.message
}
