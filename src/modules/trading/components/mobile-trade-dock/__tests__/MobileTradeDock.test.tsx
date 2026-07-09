import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SpectateProvider } from '@/modules/spectate'
import { SettingsProvider } from '@/modules/shared/providers/settings-provider'
import { MobileTradeDock } from '../MobileTradeDock'

const { openAskAiSpy, openConnectModalSpy, openAccountModalSpy, isConnectedRef } = vi.hoisted(
  () => ({
    openAskAiSpy: vi.fn(),
    openConnectModalSpy: vi.fn(),
    openAccountModalSpy: vi.fn(),
    isConnectedRef: { current: false },
  }),
)

vi.mock('../../../providers/perp-suggestion-sheet-provider', () => ({
  usePerpSuggestionSheet: () => ({ open: openAskAiSpy, close: () => {}, isOpen: false }),
}))
vi.mock('@/modules/account', () => ({
  useAuth: () => ({ openConnectModal: openConnectModalSpy }),
  useIsWalletConnected: () => isConnectedRef.current,
  useAccountModal: () => ({ open: openAccountModalSpy, close: () => {}, isOpen: false }),
}))
vi.mock('../../perp-suggestion-sheet', () => ({
  PerpSuggestionSheet: () => <div data-testid="mock-perp-suggestion-sheet" />,
}))
vi.mock('../../suggestion-preview', () => ({
  SuggestionPreviewSheet: () => <div data-testid="mock-suggestion-preview-sheet" />,
}))

function renderDock() {
  render(
    <MemoryRouter initialEntries={['/portfolio']}>
      <SpectateProvider>
        <SettingsProvider>
          <MobileTradeDock />
        </SettingsProvider>
      </SpectateProvider>
    </MemoryRouter>,
  )
}

describe('MobileTradeDock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isConnectedRef.current = false
  })

  it('renders the footer nav with the Trade/Portfolio/Ask AI/Account/Settings cells', () => {
    renderDock()
    const slot = screen.getByTestId('trading-mobile-bottom-nav-slot')
    expect(within(slot).getByTestId('mobile-nav-cell-trade')).toBeInTheDocument()
    expect(within(slot).getByTestId('mobile-nav-cell-portfolio')).toBeInTheDocument()
    expect(within(slot).getByTestId('mobile-nav-cell-ask-ai')).toBeInTheDocument()
    expect(within(slot).getByTestId('mobile-nav-cell-account')).toBeInTheDocument()
    expect(within(slot).getByTestId('mobile-nav-cell-settings')).toBeInTheDocument()
  })

  it('the Ask AI cell opens the suggestion sheet via the provider', async () => {
    const user = userEvent.setup()
    renderDock()

    await user.click(screen.getByTestId('mobile-nav-cell-ask-ai'))
    expect(openAskAiSpy).toHaveBeenCalledTimes(1)
  })

  it('the Account cell opens the connect-wallet flow when disconnected', async () => {
    const user = userEvent.setup()
    renderDock()

    await user.click(screen.getByTestId('mobile-nav-cell-account'))
    expect(openConnectModalSpy).toHaveBeenCalledTimes(1)
    expect(openAccountModalSpy).not.toHaveBeenCalled()
  })

  it('the Account cell opens the account modal when connected', async () => {
    isConnectedRef.current = true
    const user = userEvent.setup()
    renderDock()

    await user.click(screen.getByTestId('mobile-nav-cell-account'))
    expect(openAccountModalSpy).toHaveBeenCalledTimes(1)
    expect(openConnectModalSpy).not.toHaveBeenCalled()
  })
})
