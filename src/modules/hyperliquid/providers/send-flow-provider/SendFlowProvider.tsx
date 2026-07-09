import { useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'
import type { Balance } from '@/modules/shared/domain'
import { logger } from '@/app/logger'
import { useAuth, useRecipientSuggestions, useSelectedWallet } from '@/modules/account'
import { useVenueOptional } from '@/modules/shared/providers/venue-provider'
import { toast } from '@/modules/shared/services/toast'
import { loadHyperliquidConfig } from '../../hyperliquid.config'
import { createNktkasHyperliquidExchangeGateway } from '../../gateway/nktkas-hyperliquid-exchange-gateway'
import { createNktkasHyperliquidGateway } from '../../gateway'
import { useFlowMetaFetch } from '../../components/shared-flow/use-flow-meta-fetch'
import { SendFlowContext } from './send-flow-provider.context'
import { useOwnSendFlow } from './use-send-flow'
import {
  buildSendableTokens,
  buildSpotSendTokenIndex,
  readUsdcAvailable,
  type SpotSendTokenIndex,
} from './send-flow.utils'

// Load Hyperliquid config once at module init — mirrors WithdrawFlowProvider.
const configResult = loadHyperliquidConfig(import.meta.env as Record<string, string | undefined>)
const isTestnet = configResult.isOk() ? configResult.value.network === 'testnet' : false

const EMPTY_TOKEN_INDEX: SpotSendTokenIndex = new Map()

/**
 * SendFlowProvider owns the HL send state machine (usdSend / spotSend to an
 * external address). Mounted by the generic send-sheet host as
 * `venue.send.provider`. Self-contained: builds its own exchange gateway (for the
 * master-wallet-signed `usdSend` / `spotSend` actions — mirrors
 * WithdrawFlowProvider) AND a read gateway used once to resolve the spot token
 * `"NAME:0xTOKENID"` identifiers. Reads the master-wallet accessor from
 * `useAuth()` + the resolved Selected-Wallet master from `useSelectedWallet()`
 * (ADR-0012 / ADR-0060), and consumes the active venue's live `balances` reader +
 * `accountMode` capability. USDC's send route is account-mode-aware
 * (hyperliquid-account-modes.md §0/§3): a SEGREGATED account sends perp USDC via
 * `usdSend` (perps-scope `available`), a UNIFIED account sends its spot-held
 * pooled USDC via `spotSend` (the `'all'`-scope unified USDC row) — reading only
 * the perps scope stranded unified users at $0. Held spot tokens send via
 * `spotSend`. On optimistic success it toasts; the body's `sent` confirmation +
 * Done button handle dismissal.
 */
export function SendFlowProvider({ children }: { children: ReactNode }) {
  const { getMasterViemAccount } = useAuth()
  const { masterAddress } = useSelectedWallet()
  const venue = useVenueOptional()

  // Recipient suggestions: the user's own wallets (minus the Selected Wallet — the
  // blocked self-send) + addresses they recently sent to. Sourced from the shared
  // `account` hook (the only module allowed to read the wallet list); the send
  // machine records the recipient on success via `recordRecipient`.
  const { walletSuggestions, recentSuggestions, recordRecipient } = useRecipientSuggestions({
    selfAddress: masterAddress,
  })

  const gateway = useMemo(
    () => createNktkasHyperliquidExchangeGateway({ isTestnet, logger }),
    [],
  )
  const readGateway = useMemo(
    () => createNktkasHyperliquidGateway({ isTestnet, logger }),
    [],
  )

  // Resolve `symbol → "NAME:0xTOKENID"` once from the spot meta. A spot token
  // whose id never resolves is excluded from the picker (see buildSendableTokens).
  // The fetch status is surfaced (not swallowed) so the picker can show a loading
  // / error+retry state instead of a bare dropdown. `retryAssets` re-runs it.
  const { tokenIndex, metaStatus, retryAssets } = useFlowMetaFetch<SpotSendTokenIndex>({
    readGateway,
    project: buildSpotSendTokenIndex,
    emptyIndex: EMPTY_TOKEN_INDEX,
    logModule: 'hyperliquid-send-flow',
    logger,
  })

  // Perp USDC `available` (the segregated usdSend cap) and the `'all'`-scope rows
  // (the unified USDC cap + the spotSend caps) — the same mode-aware reads
  // withdraw/transfer use (ADR-0033). Reads the ACTING-keyed reader (`ownAccount`,
  // ADR-0038) so the send caps reflect the User's own account even while
  // Spectating, never the Spectated Address.
  const balances = venue?.capabilities.ownAccount?.balances ?? null
  const accountMode = venue?.capabilities.accountMode ?? null
  const [perpUsdcAvailable, setPerpUsdcAvailable] = useState(0)
  const [allBalances, setAllBalances] = useState<ReadonlyArray<Balance>>([])
  useEffect(() => {
    if (!balances) return
    const unsubPerps = balances.subscribe('perps', (rows) =>
      setPerpUsdcAvailable(readUsdcAvailable(rows)),
    )
    const unsubAll = balances.subscribe('all', (rows) => setAllBalances(rows))
    return () => {
      unsubPerps()
      unsubAll()
    }
  }, [balances])

  // Default to segregated when the mode is unknown (the classic assumption — never
  // strip a classic user of the perp-USDC send on a transient failure), matching
  // the withdraw flow (WithdrawFlowProvider).
  const [isSegregated, setIsSegregated] = useReducer(
    (_prev: boolean, next: boolean) => next,
    accountMode?.current().isSegregated ?? true,
  )
  useEffect(() => {
    if (!accountMode) {
      setIsSegregated(true)
      return
    }
    setIsSegregated(accountMode.current().isSegregated)
    return accountMode.subscribe((mode) => setIsSegregated(mode.isSegregated))
  }, [accountMode])

  const flowLog = useMemo(() => logger.child({ module: 'hyperliquid-send-flow' }), [])
  const tokens = useMemo(
    () => buildSendableTokens(isSegregated, perpUsdcAvailable, allBalances, tokenIndex, flowLog),
    [isSegregated, perpUsdcAvailable, allBalances, tokenIndex, flowLog],
  )

  const value = useOwnSendFlow({
    gateway,
    getMasterViemAccount,
    masterAddress,
    tokens,
    walletSuggestions,
    recentSuggestions,
    onRecordRecipient: recordRecipient,
    metaStatus,
    retryAssets,
    toast,
    onSuccess: () => {},
    logger,
  })

  return <SendFlowContext.Provider value={value}>{children}</SendFlowContext.Provider>
}
