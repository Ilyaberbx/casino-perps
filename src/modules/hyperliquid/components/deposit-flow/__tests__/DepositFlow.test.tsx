import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createElement } from 'react'
import { errAsync, okAsync } from 'neverthrow'
import { useSelectedWallet } from '@/modules/account'
import type { WalletAddress } from '@/modules/shared/domain'
import { DepositSheetProvider } from '@/modules/shared/providers/deposit-sheet-provider'
import { DepositFlowContext } from '../../../providers/deposit-flow-provider/deposit-flow-provider.context'
import type { DepositFlowState } from '../../../providers/deposit-flow-provider'
import { DepositFlow } from '../DepositFlow'
import { buildDepositFlowState } from '../__fixtures__/build-deposit-flow-state'

const ADDRESS = '0x3333333333333333333333333333333333333333' as WalletAddress

const defaultAuthState = {
  ready: true,
  authenticated: true,
  walletReady: true,
  primaryWalletAddress: ADDRESS as WalletAddress | null,
  getMasterViemAccount: async () => null,
  getBroadcastWalletClient: async () => null,
  createAgentWallet: async () => ({ address: '0x0000000000000000000000000000000000000000', walletId: 'w' }),
  attachAgentSigner: async () => true,
  removeAgentSigner: async () => true,
  privyId: null,
  walletAddress: null,
  walletSource: null,
  getAccessToken: async () => null,
  logout: async () => undefined,
  hasMfa: false,
  enrollMfa: () => okAsync(undefined),
  loginWithWallet: () => errAsync(new Error('stub') as never),
  openConnectModal: () => undefined,
  closeConnectModal: () => undefined,
  isConnectModalOpen: false,
  exportableAddresses: [],
  exportWallet: async () => {},
  importPrivateKey: async () => ({ address: '0x0000000000000000000000000000000000000000' }),
  apiClient: {} as never,
}

const defaultSelectedWallet = {
  selectedAddress: null as WalletAddress | null,
  masterAddress: null as WalletAddress | null,
  nativeAddress: null as WalletAddress | null,
  isSelectionConnectable: true,
}

vi.mock('@/modules/account', () => ({
  useAuth: vi.fn(() => defaultAuthState),
  useSelectedWallet: vi.fn(() => defaultSelectedWallet),
}))

function renderBody(state: DepositFlowState): void {
  const tree = createElement(DepositFlowContext.Provider, { value: state }, createElement(DepositFlow))
  render(createElement(DepositSheetProvider, { defaultOpen: true, children: tree }))
}

describe('DepositFlow body', () => {
  it('renders the receive QR + self-custody warning in needs-funding', () => {
    renderBody(buildDepositFlowState({ phase: 'needs-funding', walletUsdc: 1.5 }))
    expect(screen.getByText(/Add cash only from a wallet you control/i)).toBeInTheDocument()
    expect(screen.getByText('$1.50')).toBeInTheDocument()
    expect(screen.getByLabelText('Copy address')).toBeInTheDocument()
  })

  it('shows the Selected Wallet address (not the native primary) when an imported wallet is selected', () => {
    const SELECTED_IMPORTED = '0x4444444444444444444444444444444444444444' as WalletAddress
    vi.mocked(useSelectedWallet).mockReturnValueOnce({
      selectedAddress: SELECTED_IMPORTED,
      masterAddress: SELECTED_IMPORTED,
      nativeAddress: ADDRESS,
      isSelectionConnectable: true,
    })
    renderBody(buildDepositFlowState({ phase: 'needs-funding', walletUsdc: 1.5 }))
    // The copyable address span carries the full address in its `title`.
    expect(screen.getByTitle(SELECTED_IMPORTED)).toBeInTheDocument()
    expect(screen.queryByTitle(ADDRESS)).not.toBeInTheDocument()
  })

  it('renders the Switch to Arbitrum CTA in wrong-chain', async () => {
    const switchChain = vi.fn()
    renderBody(buildDepositFlowState({ phase: 'wrong-chain', switchChain }))
    const button = screen.getByRole('button', { name: 'Switch to Arbitrum' })
    await userEvent.click(button)
    expect(switchChain).toHaveBeenCalledOnce()
  })

  it('renders the amount input + deposit button in ready', () => {
    renderBody(
      buildDepositFlowState({ phase: 'ready', amount: '50', isAmountValid: true }),
    )
    expect(screen.getByLabelText('Amount (USDC)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Cash' })).toBeEnabled()
  })

  it('shows the soft gas warning in no-gas but keeps the button enabled', () => {
    renderBody(
      buildDepositFlowState({ phase: 'no-gas', amount: '50', isAmountValid: true }),
    )
    expect(screen.getByText(/need a little ETH on Arbitrum/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Cash' })).toBeEnabled()
  })

  it('busies the button and changes copy in signing', () => {
    renderBody(
      buildDepositFlowState({ phase: 'signing', amount: '50', isAmountValid: true }),
    )
    const button = screen.getByRole('button', { name: 'Confirm in your wallet…' })
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toBeDisabled()
  })

  it('shows two distinct rows (sent ✓ + crediting pending) in sent', () => {
    renderBody(buildDepositFlowState({ phase: 'sent', transactionHash: '0xfeed' }))
    expect(screen.getByText('Sent from wallet')).toBeInTheDocument()
    expect(screen.getByText('Crediting to Hyperliquid…')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Start trading' }),
    ).not.toBeInTheDocument()
  })

  it('flips the second row to available + shows Start trading in credited', () => {
    renderBody(buildDepositFlowState({ phase: 'credited', transactionHash: '0xfeed' }))
    expect(screen.getByText('Funds available on Hyperliquid')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start trading' })).toBeInTheDocument()
  })

  it('renders an inline error callout + retry for transfer-failed', async () => {
    const retry = vi.fn()
    renderBody(
      buildDepositFlowState({ phase: 'error', errorReason: 'transfer-failed', retry }),
    )
    expect(screen.getByText(/didn't go through/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('announces transitions via an aria-live status region', () => {
    renderBody(buildDepositFlowState({ phase: 'sent' }))
    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-live', 'polite')
  })
})
