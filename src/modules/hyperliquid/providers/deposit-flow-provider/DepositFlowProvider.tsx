import { useMemo, type ReactNode } from 'react'
import { createPublicClient, http } from 'viem'
import { arbitrum } from 'viem/chains'
import { logger } from '@/app/logger'
import { useAuth, useSelectedWallet } from '@/modules/account'
import { useVenueOptional } from '@/modules/shared/providers/venue-provider'
import { createHyperliquidDepositService } from '../../services/hyperliquid-deposit-service'
import { resolveArbitrumRpcUrl } from '../../services/hyperliquid-deposit.config'
import { ARBITRUM_RPC_TIMEOUT_MS } from '../../services/hyperliquid-deposit.constants'
import { DepositFlowContext } from './deposit-flow-provider.context'
import { useOwnDepositFlow } from './use-deposit-flow'

// Resolve the optional VITE_ARBITRUM_RPC_URL override once at import (Vite inlines
// env at build — it never changes at runtime), and warn once on a misconfigured
// value rather than silently falling back to the rate-limited public RPC. Mirrors
// app/logger.ts's resolve-and-warn-at-module-scope pattern, keeping the provider
// component dumb (no effect).
// `import.meta.env` is typed without our custom VITE_* keys; widen to the env
// record the resolver reads (same cast as app/venues.ts for the SDK config).
const arbitrumRpc = resolveArbitrumRpcUrl(import.meta.env as Record<string, string | undefined>)
const depositConfigLog = logger.child({ module: 'hyperliquid-deposit-flow' })
if (arbitrumRpc.invalidRaw !== null) {
  depositConfigLog.warn({ invalidValue: arbitrumRpc.invalidRaw }, 'invalid arbitrum rpc override')
} else {
  depositConfigLog.debug({ usingCustomRpc: arbitrumRpc.url !== undefined }, 'arbitrum rpc')
}

/**
 * DepositFlowProvider owns the HL deposit state machine. Mounted once by the
 * generic deposit-sheet host as `venue.deposit.provider`. Self-contained: it
 * builds its own viem Arbitrum public client + the viem-only deposit service
 * (NEVER the @nktkas SDK — ADR-0028 D-4), reads the broadcast `WalletClient`
 * accessor and primary address from `useAuth()` (ADR-0028 D-1), and consumes
 * the active venue's live `portfolio` reader for phase-2 credit detection (the
 * EXISTING account-value stream — no new gateway method).
 */
export function DepositFlowProvider({ children }: { children: ReactNode }) {
  const {
    primaryWalletAddress,
    getBroadcastWalletClient,
    switchMasterWalletChain,
    walletSource,
    isBroadcastWalletReady,
  } = useAuth()
  // ADR-0060: the deposit signs + broadcasts as the SELECTED WALLET (embedded
  // included). `masterAddress` resolves to the Selected Wallet when connectable,
  // else the Privy-canonical primary wallet — so this is the broadcast wallet's
  // address AND the balance-read target. The embedded wallet is always in
  // `useWallets()`, so an embedded-selected master proceeds through preflight to
  // the balance/chain/gas checks rather than aborting `wallet-unavailable`.
  const { masterAddress } = useSelectedWallet()
  const depositAddress = masterAddress ?? primaryWalletAddress
  const venue = useVenueOptional()
  // ACTING-keyed reader (`ownAccount`, ADR-0038) so the credit-detection watch
  // reflects the User's own net worth even while Spectating, never the
  // Spectated Address's.
  const portfolioReader = venue?.capabilities.ownAccount?.portfolio ?? null

  const service = useMemo(
    () =>
      createHyperliquidDepositService({
        publicClient: createPublicClient({
          chain: arbitrum,
          transport: http(arbitrumRpc.url, { timeout: ARBITRUM_RPC_TIMEOUT_MS }),
        }),
        logger,
      }),
    [],
  )

  const state = useOwnDepositFlow({
    service,
    portfolioReader,
    address: depositAddress,
    getBroadcastWalletClient,
    switchMasterWalletChain,
    walletSource,
    isBroadcastWalletReady,
    logger,
  })

  return <DepositFlowContext.Provider value={state}>{children}</DepositFlowContext.Provider>
}
