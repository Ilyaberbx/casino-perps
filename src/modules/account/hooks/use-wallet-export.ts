import { useCallback, useState } from 'react'
import { ResultAsync } from 'neverthrow'
import { toast } from '@/modules/shared/services/toast'
import { useAuth } from '../providers/auth-provider'
import { coerceToAuthError } from '../providers/auth-provider/auth-provider.utils'
import type { AuthError } from '../domain/types'
import type { WalletExportView } from './use-wallet-export.types'

/**
 * Owner-only, MFA-gated private-key export (ADR-0076 D-5). The single export
 * orchestrator shared by the per-wallet overflow menu (`use-wallet-row-menu`)
 * and the Agent Wallet row (`use-wallets-section`) — ≥2 consumers, so it lives
 * in `hooks/`. Errors are values throughout (ResultAsync + toast, mirroring
 * `use-mfa-enrollment`); no logic leaks into the dumb components.
 *
 * The gate: export requires an enrolled MFA factor. If the user has none
 * (`!hasMfa`) we first `enrollMfa()`; a failed/declined enrolment aborts with a
 * toast and the export never runs. With MFA present (or after a successful
 * enrolment) we hand the address to Privy's export modal, which itself forces
 * MFA *verification* before revealing the key — the app never sees it.
 */
export function useWalletExport(): WalletExportView {
  const { hasMfa, enrollMfa, exportWallet } = useAuth()
  const [isExporting, setIsExporting] = useState(false)

  const onExport = useCallback(
    async (address: string): Promise<void> => {
      setIsExporting(true)

      const mfaReady: ResultAsync<void, AuthError> = hasMfa
        ? ResultAsync.fromSafePromise(Promise.resolve())
        : enrollMfa()
      const enrolled = await mfaReady
      if (enrolled.isErr()) {
        setIsExporting(false)
        toast.show({
          variant: 'error',
          title: 'Enable 2FA to export',
          description: 'Exporting a private key requires two-factor authentication.',
        })
        return
      }

      const exported = await ResultAsync.fromPromise(exportWallet(address), coerceToAuthError)
      setIsExporting(false)
      if (exported.isErr()) {
        toast.show({
          variant: 'error',
          title: 'Export failed',
          description: 'Could not open the private-key export. Please try again.',
        })
      }
    },
    [hasMfa, enrollMfa, exportWallet],
  )

  return { isExporting, onExport }
}
