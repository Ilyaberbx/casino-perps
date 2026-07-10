import { useMemo } from 'react'
import { useAuth } from '../../providers/auth-provider'
import { useOnboardingFlow } from '../../hooks/use-onboarding-flow'
import { useWalletMutations } from '../../hooks/use-wallet-mutations'
import { formatWalletAddress } from '@/modules/shared/utils/format-wallet-address'
import type { Wallet } from '../../domain/types'
import { MAX_USER_WALLETS, MAX_IMPORTED_WALLETS, WALLET_SOURCE_LABEL } from './account-modal.constants'
import { resolveConnectorIcon } from './account-modal.utils'
import type { WalletRowView, WalletsSectionView } from './account-modal.types'

/**
 * Drives the Wallets section (PRD-0006 UI-5 / Slice 06). Lists the **user**
 * wallets — the Native (embedded) row and imported (`external`) rows — plus a
 * read-only, **uncounted** Agent row (G-6). All select/import/remove behaviour
 * lives in the shared `useWalletMutations` hook (the single source of truth via
 * `applyMe`); this hook only adds the row/agent projection on top so the modal
 * and the header Quick-Wallet Switcher stay in lock-step.
 */
export function useWalletsSection(): WalletsSectionView {
  const { externalWallets, exportableAddresses } = useAuth()
  const flow = useOnboardingFlow()
  const mutations = useWalletMutations()

  const serverWallets = useMemo<ReadonlyArray<Wallet>>(
    () => (flow.kind === 'ready' ? flow.me.wallets : []),
    [flow],
  )

  const connectorIconByAddress = useMemo<ReadonlyMap<string, string | null>>(
    () =>
      new Map(
        externalWallets.map((w) => [
          w.address.toLowerCase(),
          resolveConnectorIcon(w.walletClientType),
        ]),
      ),
    [externalWallets],
  )

  // The set the per-row exportability cross-check reads (ADR-0076 D-5). A `Set`
  // for O(1) membership; lower-cased to match the server-stored addresses.
  const exportableSet = useMemo(
    () => new Set(exportableAddresses.map((a) => a.toLowerCase())),
    [exportableAddresses],
  )

  const rows = useMemo<ReadonlyArray<WalletRowView>>(
    () =>
      serverWallets.map((w) =>
        toRow(w, mutations.selectedAddress, connectorIconByAddress, exportableSet),
      ),
    [serverWallets, mutations.selectedAddress, connectorIconByAddress, exportableSet],
  )

  return {
    isReady: flow.kind === 'ready',
    rows,
    walletCount: rows.length,
    walletCap: MAX_USER_WALLETS,
    importedCount: mutations.importedCount,
    importCap: MAX_IMPORTED_WALLETS,
    isImportAtCap: mutations.isImportAtCap,
    importHint: mutations.importHint,
    isImporting: mutations.isImporting,
    onSelect: mutations.onSelect,
    onImport: mutations.onImport,
    onRemove: mutations.onRemove,
  }
}

function toRow(
  wallet: Wallet,
  selectedAddress: string | null,
  connectorIconByAddress: ReadonlyMap<string, string | null>,
  exportableSet: ReadonlySet<string>,
): WalletRowView {
  const isNative = wallet.source === 'embedded'
  const isExternal = wallet.source === 'external'
  // `Wallet.source` is the provenance source of truth (ADR-0076 D-6): `embedded`
  // + `imported` are owner-exportable; link-only `external` is not.
  // `exportableSet` (Privy-managed addresses live in the session) is the runtime
  // guard, so export is offered only when BOTH agree (belt-and-suspenders).
  const isExportableProvenance = wallet.source === 'embedded' || wallet.source === 'imported'
  const isExportable = isExportableProvenance && exportableSet.has(wallet.address.toLowerCase())
  return {
    address: wallet.address,
    truncatedAddress: formatWalletAddress(wallet.address),
    source: wallet.source,
    sourceLabel: WALLET_SOURCE_LABEL[wallet.source],
    isSelected: wallet.address === selectedAddress,
    isNative,
    isRemovable: isExternal,
    isExportable,
    connectorIconUrl: isExternal
      ? (connectorIconByAddress.get(wallet.address.toLowerCase()) ?? null)
      : null,
  }
}
