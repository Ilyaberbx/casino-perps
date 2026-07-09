import { useCallback, useEffect, useState } from 'react'
import { ResultAsync } from 'neverthrow'
import { toast } from '@/modules/shared/services/toast'
import { useAuth } from '../../../providers/auth-provider'
import { useOnboardingFlow } from '../../../hooks/use-onboarding-flow'
import { importWallet } from '../../../api/import-wallet'
import type { ImportKeySheetView } from './import-key-sheet.types'

/** A 32-byte hex private key, optional `0x` prefix. */
const PRIVATE_KEY_PATTERN = /^(0x)?[0-9a-fA-F]{64}$/

/**
 * Drives the raw-key import sheet (ADR-0076 D-6). Owns the masked key input, its
 * validation, the open/close state, and the submit pipeline:
 * `importPrivateKey` (Privy) → `POST /api/account/wallets/import` with
 * `source: 'imported'` → `applyMe` (refresh the canonical wallet list) → close.
 *
 * Secret hygiene (mandatory): the key lives only in component state, is
 * **cleared on close and on unmount**, and is **never logged** or surfaced — not
 * in toasts, not in errors. Toast/error copy is generic ("import failed"), never
 * echoing the key.
 */
export function useImportKeySheet(): ImportKeySheetView {
  const { apiClient, importPrivateKey } = useAuth()
  const flow = useOnboardingFlow()
  const applyMe = flow.kind === 'ready' ? flow.applyMe : undefined

  const [isOpen, setIsOpen] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Defence-in-depth: clear the key from state if the component unmounts while
  // the sheet is open (e.g. the modal is torn down mid-entry).
  useEffect(() => () => setKeyInput(''), [])

  const open = useCallback(() => {
    setKeyInput('')
    setError(null)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setKeyInput('')
    setError(null)
  }, [])

  const isValid = PRIVATE_KEY_PATTERN.test(keyInput.trim())

  const onSubmit = useCallback(() => {
    const trimmed = keyInput.trim()
    const isReady = PRIVATE_KEY_PATTERN.test(trimmed) && !isSubmitting
    if (!isReady) return
    setIsSubmitting(true)
    setError(null)
    const normalizedKey = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`

    void ResultAsync.fromPromise(importPrivateKey(normalizedKey), () => 'import-failed' as const)
      .andThen(({ address }) =>
        importWallet(apiClient, address, 'imported').mapErr(() => 'persist-failed' as const),
      )
      .match(
        (me) => {
          applyMe?.(me)
          setIsSubmitting(false)
          close()
          toast.show({
            variant: 'success',
            title: 'Wallet imported',
            description: 'Your imported wallet was added to your account.',
          })
        },
        () => {
          setIsSubmitting(false)
          setError('Could not import that private key. Check the key and try again.')
          toast.show({
            variant: 'error',
            title: 'Import failed',
            description: 'Could not import that private key.',
          })
        },
      )
  }, [keyInput, isSubmitting, importPrivateKey, apiClient, applyMe, close])

  return { isOpen, keyInput, isValid, isSubmitting, error, open, close, setKeyInput, onSubmit }
}
