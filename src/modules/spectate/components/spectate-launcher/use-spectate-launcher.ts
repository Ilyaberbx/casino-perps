import { useState } from 'react'
import { parseWalletAddress } from '@/modules/shared/domain'
import { formatWalletAddress } from '@/modules/shared/utils/format-wallet-address'
import { toast } from '@/modules/shared/services/toast'
import { useSpectate } from '../../providers/spectate-provider'
import { SPECTATE_CONNECT_WALLET_MESSAGE } from '../../providers/spectate-provider/spectate-provider.constants'
import type {
  SpectateLauncherState,
  SpectateTab,
  SpectateWatchlistRow,
} from './spectate-launcher.types'

const INVALID_ADDRESS_MESSAGE = 'Enter a valid 0x wallet address (42 characters).'

export function useSpectateLauncher(isWalletConnected: boolean): SpectateLauncherState {
  const { startSpectating, watchlist, addToWatchlist, removeFromWatchlist } = useSpectate()
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<SpectateTab>('enter')
  const [addressInput, setAddressInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editingAddress, setEditingAddress] = useState<string | null>(null)
  const [labelDraft, setLabelDraft] = useState('')

  function resetForm(): void {
    setAddressInput('')
    setError(null)
    setEditingAddress(null)
    setLabelDraft('')
  }

  function onOpen(): void {
    if (!isWalletConnected) {
      toast.show({ variant: 'warning', title: SPECTATE_CONNECT_WALLET_MESSAGE })
      return
    }
    setIsOpen(true)
  }

  function onClose(): void {
    setIsOpen(false)
    setActiveTab('enter')
    resetForm()
  }

  function onSelectTab(tab: SpectateTab): void {
    setActiveTab(tab)
    setError(null)
  }

  function onAddressChange(value: string): void {
    setAddressInput(value)
    setError(null)
  }

  function onSubmit(): void {
    const parsed = parseWalletAddress(addressInput.trim())
    if (parsed.isErr()) {
      setError(INVALID_ADDRESS_MESSAGE)
      return
    }
    startSpectating(parsed.value)
    onClose()
  }

  function onSaveToWatchlist(): void {
    const parsed = parseWalletAddress(addressInput.trim())
    if (parsed.isErr()) {
      setError(INVALID_ADDRESS_MESSAGE)
      return
    }
    addToWatchlist({ address: parsed.value })
    setAddressInput('')
    setError(null)
    setActiveTab('watchlist')
  }

  function onSpectateEntry(address: string): void {
    const parsed = parseWalletAddress(address)
    if (parsed.isErr()) return
    startSpectating(parsed.value)
    onClose()
  }

  function onRemoveEntry(address: string): void {
    const parsed = parseWalletAddress(address)
    if (parsed.isErr()) return
    removeFromWatchlist(parsed.value)
  }

  function onStartEditLabel(address: string): void {
    const entry = watchlist.find((item) => item.address === address)
    setEditingAddress(address)
    setLabelDraft(entry?.label ?? '')
  }

  function onLabelDraftChange(address: string, value: string): void {
    const isEditingThisRow = editingAddress === address
    if (!isEditingThisRow) return
    setLabelDraft(value)
  }

  function onCommitLabel(address: string): void {
    const parsed = parseWalletAddress(address)
    if (parsed.isErr()) return
    const trimmed = labelDraft.trim()
    const hasLabel = trimmed.length > 0
    addToWatchlist(hasLabel ? { address: parsed.value, label: trimmed } : { address: parsed.value })
    setEditingAddress(null)
    setLabelDraft('')
  }

  const hasAddressInput = addressInput.trim().length > 0
  const canSubmit = hasAddressInput

  const watchlistRows: SpectateWatchlistRow[] = watchlist.map((item) => {
    const isEditing = editingAddress === item.address
    return {
      address: item.address,
      label: item.label,
      displayAddress: formatWalletAddress(item.address),
      isEditing,
      labelDraft: isEditing ? labelDraft : (item.label ?? ''),
    }
  })

  return {
    isOpen,
    activeTab,
    addressInput,
    error,
    canSubmit,
    watchlist,
    watchlistRows,
    onOpen,
    onClose,
    onSelectTab,
    onAddressChange,
    onSubmit,
    onSaveToWatchlist,
    onSpectateEntry,
    onRemoveEntry,
    onStartEditLabel,
    onLabelDraftChange,
    onCommitLabel,
  }
}
