import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPublicClient, http } from 'viem'
import type { Balance } from '@/modules/shared/domain'
import { logger } from '@/app/logger'
import { useAuth, useSelectedWallet } from '@/modules/account'
import { useVenueOptional } from '@/modules/shared/providers/venue-provider'
import { toast } from '@/modules/shared/services/toast'
import { loadHyperliquidConfig } from '../../hyperliquid.config'
import type { HyperliquidNetwork } from '../../hyperliquid.types'
import { createNktkasHyperliquidExchangeGateway } from '../../gateway/nktkas-hyperliquid-exchange-gateway'
import { createNktkasHyperliquidGateway } from '../../gateway'
import { createHyperEvmCoreService } from '../../services/hyperevm-core-service'
import { resolveHyperEvmRpcUrl } from '../../services/hyperevm.config'
import {
  defineHyperEvmChain,
  hyperEvmExplorerTxUrl,
  HYPEREVM_CHAIN_ID,
  HYPEREVM_DEFAULT_RPC_URL,
  HYPEREVM_RPC_TIMEOUT_MS,
} from '../../services/hyperevm.constants'
import { useFlowMetaFetch } from '../../components/shared-flow/use-flow-meta-fetch'
import { EvmCoreFlowContext } from './evm-core-flow-provider.context'
import { useOwnEvmCoreFlow } from './use-evm-core-flow'
import {
  buildEvmCoreTokenIndex,
  buildEvmCoreTokens,
  buildEvmCoreTokensFromIndex,
} from './evm-core-flow.utils'
import type { EvmCoreTokenIndex } from './evm-core-flow.utils'

// Load Hyperliquid config + resolve the HyperEVM RPC once at module init (Vite
// inlines env at build). Warn once on a misconfigured override rather than
// silently falling back to the public RPC (mirrors DepositFlowProvider).
const configResult = loadHyperliquidConfig(import.meta.env as Record<string, string | undefined>)
const NETWORK: HyperliquidNetwork =
  configResult.isOk() && configResult.value.network === 'testnet' ? 'testnet' : 'mainnet'
const isTestnet = NETWORK === 'testnet'
const hyperEvmRpc = resolveHyperEvmRpcUrl(import.meta.env as Record<string, string | undefined>)
const HYPEREVM_RPC_URL = hyperEvmRpc.url ?? HYPEREVM_DEFAULT_RPC_URL[NETWORK]
const HYPEREVM_CHAIN = defineHyperEvmChain(NETWORK, HYPEREVM_RPC_URL)

const evmCoreConfigLog = logger.child({ module: 'hyperliquid-evm-core-flow' })
if (hyperEvmRpc.invalidRaw !== null) {
  evmCoreConfigLog.warn({ invalidValue: hyperEvmRpc.invalidRaw }, 'invalid hyperevm rpc override')
}

const EMPTY_TOKEN_INDEX: EvmCoreTokenIndex = new Map()

/**
 * EvmCoreFlowProvider owns the HL EVM⇄Core state machine (both directions).
 * Mounted by the Manage Funds modal as `venue.evmCore.provider`. Self-contained:
 * builds its own exchange gateway (Core→EVM `spotSend`), a read gateway (resolve
 * the EVM-linked token index from the spot meta), and the viem-only HyperEVM core
 * service + public client (EVM→Core on-chain transfers, ADR-0069). Reads
 * `getMasterViemAccount` (sign `spotSend`) + `getBroadcastWalletClient` (broadcast
 * the EVM tx, switched to HyperEVM by the service) + the Selected-Wallet master
 * from `account/`, and consumes the active venue's live `balances` reader (`all`
 * scope = HyperCore spot holdings — the Core→EVM caps).
 */
export function EvmCoreFlowProvider({ children }: { children: ReactNode }) {
  const { getMasterViemAccount, getBroadcastWalletClient, switchMasterWalletChain } = useAuth()
  const { masterAddress } = useSelectedWallet()
  const venue = useVenueOptional()

  const gateway = useMemo(
    () => createNktkasHyperliquidExchangeGateway({ isTestnet, logger }),
    [],
  )
  const readGateway = useMemo(
    () => createNktkasHyperliquidGateway({ isTestnet, logger }),
    [],
  )
  const evmService = useMemo(
    () =>
      createHyperEvmCoreService({
        publicClient: createPublicClient({
          chain: HYPEREVM_CHAIN,
          transport: http(HYPEREVM_RPC_URL, { timeout: HYPEREVM_RPC_TIMEOUT_MS }),
        }),
        chain: HYPEREVM_CHAIN,
        logger,
      }),
    [],
  )

  // Resolve the EVM-linked token index once from the spot meta. The fetch status
  // is surfaced (not swallowed) so the picker can render a loading / error+retry
  // state instead of a bare empty dropdown. `retryAssets` re-runs the fetch.
  const { tokenIndex, metaStatus, retryAssets } = useFlowMetaFetch<EvmCoreTokenIndex>({
    readGateway,
    project: buildEvmCoreTokenIndex,
    emptyIndex: EMPTY_TOKEN_INDEX,
    logModule: 'hyperliquid-evm-core-flow',
    logger,
  })

  // The HyperCore (L1 spot) holdings — the Core→EVM caps (the `all`-scope read).
  // Reads the ACTING-keyed reader (`ownAccount`, ADR-0038) so the caps reflect
  // the User's own account even while Spectating, never the Spectated Address.
  const balances = venue?.capabilities.ownAccount?.balances ?? null
  const [coreBalances, setCoreBalances] = useState<ReadonlyArray<Balance>>([])
  useEffect(() => {
    if (!balances) return
    return balances.subscribe('all', (rows) => setCoreBalances(rows))
  }, [balances])

  const flowLog = useMemo(() => logger.child({ module: 'hyperliquid-evm-core-flow' }), [])
  const coreTokens = useMemo(
    () => buildEvmCoreTokens(coreBalances, tokenIndex, flowLog),
    [coreBalances, tokenIndex, flowLog],
  )
  const evmTokens = useMemo(() => buildEvmCoreTokensFromIndex(tokenIndex), [tokenIndex])

  const value = useOwnEvmCoreFlow({
    gateway,
    evmService,
    getMasterViemAccount,
    getBroadcastWalletClient,
    switchMasterWalletChain,
    masterAddress,
    coreTokens,
    evmTokens,
    hyperEvmChainId: HYPEREVM_CHAIN_ID[NETWORK],
    explorerTxUrl: (hash) => hyperEvmExplorerTxUrl(NETWORK, hash),
    metaStatus,
    retryAssets,
    toast,
    onSuccess: () => {},
    logger,
  })

  return <EvmCoreFlowContext.Provider value={value}>{children}</EvmCoreFlowContext.Provider>
}
