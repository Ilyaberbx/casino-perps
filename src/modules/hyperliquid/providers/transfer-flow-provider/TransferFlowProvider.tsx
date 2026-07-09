import { useMemo, type ReactNode } from 'react'
import { logger } from '@/app/logger'
import { useAuth, useSelectedWallet } from '@/modules/account'
import { useVenueOptional } from '@/modules/shared/providers/venue-provider'
import { useTransferSheet } from '@/modules/shared/providers/transfer-sheet-provider'
import { toast } from '@/modules/shared/services/toast'
import { loadHyperliquidConfig } from '../../hyperliquid.config'
import { createNktkasHyperliquidExchangeGateway } from '../../gateway/nktkas-hyperliquid-exchange-gateway'
import { TransferFlowContext } from './transfer-flow-provider.context'
import { useOwnTransferFlow } from './use-transfer-flow'

// Load Hyperliquid config once at module init — mirrors BuilderFeeProvider.
const configResult = loadHyperliquidConfig(import.meta.env as Record<string, string | undefined>)
const isTestnet = configResult.isOk() ? configResult.value.network === 'testnet' : false

/**
 * TransferFlowProvider owns the HL Spot↔Perp transfer state machine. Mounted by
 * the generic transfer-sheet host as `venue.transfer.provider`. Self-contained:
 * builds its own exchange gateway (for the master-wallet-signed `usdClassTransfer`
 * action — mirrors BuilderFeeProvider), reads the master-wallet accessor from
 * `useAuth()` (ADR-0012 / ADR-0033 D-2), and consumes the active venue's live
 * `balances` (USDC available per account) and `accountMode` (`isApplicable`)
 * readers. On optimistic success it toasts + closes the host sheet. See ADR-0033.
 */
export function TransferFlowProvider({ children }: { children: ReactNode }) {
  const { getMasterViemAccount } = useAuth()
  // ADR-0060: sign the Spot↔Perp transfer as the Selected Wallet (embedded
  // included), threading the resolved master to the user-signed `usdClassTransfer`.
  const { masterAddress } = useSelectedWallet()
  const venue = useVenueOptional()
  const { prefill, close } = useTransferSheet()

  const gateway = useMemo(
    () => createNktkasHyperliquidExchangeGateway({ isTestnet, logger }),
    [],
  )

  const value = useOwnTransferFlow({
    gateway,
    // ACTING-keyed reads (`ownAccount`, ADR-0038) so the Perp↔Spot cap and
    // applicability reflect the User's own account even while Spectating.
    balances: venue?.capabilities.ownAccount?.balances ?? null,
    accountMode: venue?.capabilities.ownAccount?.accountMode ?? null,
    getMasterViemAccount,
    masterAddress,
    toast,
    onSuccess: close,
    logger,
    prefill,
  })

  return <TransferFlowContext.Provider value={value}>{children}</TransferFlowContext.Provider>
}
