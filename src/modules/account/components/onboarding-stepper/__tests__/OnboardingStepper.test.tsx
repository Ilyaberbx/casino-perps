import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { okAsync } from 'neverthrow'
import { AuthContext, type AuthState } from '../../../providers/auth-provider/auth-provider.context'
import { OnboardingFlowContext } from '../../../providers/onboarding-flow-provider/onboarding-flow-provider.context'
import type { OnboardingState } from '../../../hooks/onboarding-flow.types'
import { createApiClient } from '@/modules/shared/http'
import { FakeAppConfigProvider } from '@/modules/shared/providers/app-config-provider/__fixtures__/fake-app-config-provider'
import { ThemeProvider } from '@/modules/shared/providers/theme-provider'
import { OnboardingStepper } from '../OnboardingStepper'

const sendCode = vi.fn().mockResolvedValue(undefined)
const loginWithCode = vi.fn().mockResolvedValue(undefined)

vi.mock('@privy-io/react-auth', () => ({
  useLoginWithEmail: () => ({ sendCode, loginWithCode, state: { status: 'initial' } }),
}))

vi.mock('@/modules/shared/providers/toast-provider', () => ({
  useToast: () => ({ show: vi.fn(), dismiss: vi.fn(), dismissAll: vi.fn() }),
}))

vi.mock('@/app/logger', () => {
  const child = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn(() => child) }
  return { logger: { ...child, child: vi.fn(() => child) } }
})

beforeEach(() => {
  sendCode.mockReset().mockResolvedValue(undefined)
  loginWithCode.mockReset().mockResolvedValue(undefined)
  localStorage.clear()
})

function buildAuth(overrides: Partial<AuthState> = {}): AuthState {
  return {
    ready: true,
    authenticated: false,
    privyId: null,
    walletAddress: null,
    primaryWalletAddress: null,
    walletSource: null,
    walletReady: false,
    isBroadcastWalletReady: false,
    connectableMasterAddresses: [],
    externalWallets: [],
    hasMfa: false,
    getAccessToken: async () => null,
    logout: async () => {},
    enrollMfa: () => okAsync(undefined),
    loginWithWallet: () => okAsync(undefined),
    linkWallet: () => okAsync("0x0000000000000000000000000000000000000000"),
    openConnectModal: () => {},
    closeConnectModal: () => {},
    isConnectModalOpen: true,
    exportableAddresses: [],
    exportWallet: async () => {},
    importPrivateKey: async () => ({ address: '0x0000000000000000000000000000000000000000' }),
    apiClient: createApiClient({ getAccessToken: async () => null }),
    getMasterViemAccount: async () => null,
    getBroadcastWalletClient: async () => null,
    getAgentWalletBroadcastClient: async () => null,
    switchMasterWalletChain: async () => 'switched',
    createAgentWallet: async () => ({ address: '0x0000000000000000000000000000000000000000', walletId: 'w' }),
    attachAgentSigner: async () => true,
    removeAgentSigner: async () => true,
    ...overrides,
  }
}

function wrap(auth: AuthState, flow: OnboardingState = { kind: 'idle' }) {
  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={auth}>
      <FakeAppConfigProvider>
        <ThemeProvider>
          <OnboardingFlowContext.Provider value={flow}>{children}</OnboardingFlowContext.Provider>
        </ThemeProvider>
      </FakeAppConfigProvider>
    </AuthContext.Provider>
  )
}

describe('<OnboardingStepper />', () => {
  it('is hidden when isConnectModalOpen is false', () => {
    render(<OnboardingStepper />, { wrapper: wrap(buildAuth({ isConnectModalOpen: false })) })
    expect(screen.queryByTestId('onboarding-stepper')).not.toBeInTheDocument()
  })

  it('offers only email — no 2FA or external-wallet entry points', () => {
    render(<OnboardingStepper />, { wrapper: wrap(buildAuth()) })
    expect(screen.getByTestId('onboarding-stepper')).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /2fa/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /wallet/i })).not.toBeInTheDocument()
  })

  it('shows Step 1 of 5 on the email step', () => {
    render(<OnboardingStepper />, { wrapper: wrap(buildAuth()) })
    expect(screen.getByText(/step 1 of 5/i)).toBeInTheDocument()
  })

  it('advances to the OTP step (segmented boxes) after sending the code', async () => {
    const user = userEvent.setup()
    render(<OnboardingStepper />, { wrapper: wrap(buildAuth()) })
    await user.type(screen.getByLabelText(/email/i), 'a@b.com')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    expect(sendCode).toHaveBeenCalledWith({ email: 'a@b.com' })
    expect(screen.getByText(/step 2 of 5/i)).toBeInTheDocument()
    expect(screen.getAllByLabelText(/digit/i)).toHaveLength(6)
  })

  // Post-auth: once authenticated, `isConnectModalOpen` is always false (it is
  // gated on `!authenticated`). The Handle/2FA steps must still surface from
  // the FSM alone — otherwise an authenticated user whose account needs a handle
  // has no way to finish onboarding and the header account trigger never appears.
  it('renders the Handle step post-auth even when the connect modal is closed', () => {
    const flow: OnboardingState = { kind: 'needs-handle', submitHandle: () => okAsync(undefined) }
    render(<OnboardingStepper />, {
      wrapper: wrap(buildAuth({ authenticated: true, isConnectModalOpen: false }), flow),
    })
    expect(screen.getByTestId('onboarding-stepper')).toBeInTheDocument()
    expect(screen.getByText(/step 3 of 5/i)).toBeInTheDocument()
    expect(screen.getByRole('form', { name: /choose handle/i })).toBeInTheDocument()
  })

  it('renders the skippable 2FA step post-auth even when the connect modal is closed', () => {
    const flow: OnboardingState = {
      kind: 'needs-mfa',
      setupMfa: () => okAsync(undefined),
      skipMfa: vi.fn(),
    }
    render(<OnboardingStepper />, {
      wrapper: wrap(buildAuth({ authenticated: true, isConnectModalOpen: false }), flow),
    })
    expect(screen.getByText(/step 4 of 5/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /set up 2fa/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument()
  })

  // The mobile trading-layout picker was removed with pro mode (PRD-0008 D7);
  // the Personalize step now offers only the theme picker.
  it('renders the Personalize step (5) with the theme picker and Done', async () => {
    const user = userEvent.setup()
    const finishPersonalize = vi.fn()
    const flow: OnboardingState = { kind: 'needs-personalize', finishPersonalize }
    render(<OnboardingStepper />, {
      wrapper: wrap(buildAuth({ authenticated: true, isConnectModalOpen: false }), flow),
    })
    expect(screen.getByText(/step 5 of 5/i)).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /^theme$/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /done/i }))
    expect(finishPersonalize).toHaveBeenCalledTimes(1)
  })
})
