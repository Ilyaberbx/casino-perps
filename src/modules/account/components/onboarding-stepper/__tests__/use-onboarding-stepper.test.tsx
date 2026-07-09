import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { errAsync, okAsync } from 'neverthrow'
import { AuthContext, type AuthState } from '../../../providers/auth-provider/auth-provider.context'
import { OnboardingFlowContext } from '../../../providers/onboarding-flow-provider/onboarding-flow-provider.context'
import type { OnboardingState } from '../../../hooks/onboarding-flow.types'
import { createApiClient } from '@/modules/shared/http'
import { FakeAppConfigProvider } from '@/modules/shared/providers/app-config-provider/__fixtures__/fake-app-config-provider'
import { ThemeProvider } from '@/modules/shared/providers/theme-provider'
import { TradingModeProvider } from '@/modules/shared/providers/trading-mode-provider'
import { useOnboardingStepper } from '../use-onboarding-stepper'

const sendCode = vi.fn().mockResolvedValue(undefined)
const loginWithCode = vi.fn().mockResolvedValue(undefined)
const emailState = { status: 'initial' as string }
const toastShow = vi.fn()
const checkHandle = vi.fn()

vi.mock('@privy-io/react-auth', () => ({
  useLoginWithEmail: () => ({ sendCode, loginWithCode, state: emailState }),
}))

vi.mock('@/modules/shared/providers/toast-provider', () => ({
  useToast: () => ({ show: toastShow, dismiss: vi.fn(), dismissAll: vi.fn() }),
}))

vi.mock('../../../api/check-handle-available', () => ({
  checkHandleAvailable: (...args: unknown[]) => checkHandle(...args),
}))

vi.mock('@/app/logger', () => {
  const child = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn(() => child) }
  return { logger: { ...child, child: vi.fn(() => child) } }
})

beforeEach(() => {
  sendCode.mockReset().mockResolvedValue(undefined)
  loginWithCode.mockReset().mockResolvedValue(undefined)
  toastShow.mockReset()
  checkHandle.mockReset().mockReturnValue(okAsync({ available: true }))
  emailState.status = 'initial'
  // Reset persisted theme/mode so the Personalize-step defaults assert cleanly.
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
          <TradingModeProvider>
            <OnboardingFlowContext.Provider value={flow}>{children}</OnboardingFlowContext.Provider>
          </TradingModeProvider>
        </ThemeProvider>
      </FakeAppConfigProvider>
    </AuthContext.Provider>
  )
}

describe('useOnboardingStepper — email step', () => {
  it('disables Continue until the email is a valid format', () => {
    const { result, rerender } = renderHook(
      ({ email }: { email: string }) => {
        const view = useOnboardingStepper()
        if (view.step.kind === 'email' && view.step.email !== email) view.step.onEmailChange(email)
        return view
      },
      { wrapper: wrap(buildAuth()), initialProps: { email: '' } },
    )
    expect(result.current.step.kind).toBe('email')
    if (result.current.step.kind === 'email') expect(result.current.step.canContinue).toBe(false)

    act(() => {
      if (result.current.step.kind === 'email') result.current.step.onEmailChange('a@b.com')
    })
    rerender({ email: 'a@b.com' })
    if (result.current.step.kind === 'email') expect(result.current.step.canContinue).toBe(true)
  })

  it('sends the code and advances to the OTP step', async () => {
    const { result } = renderHook(() => useOnboardingStepper(), { wrapper: wrap(buildAuth()) })
    act(() => {
      if (result.current.step.kind === 'email') result.current.step.onEmailChange('a@b.com')
    })
    await act(async () => {
      if (result.current.step.kind === 'email') await result.current.step.onContinue()
    })
    expect(sendCode).toHaveBeenCalledWith({ email: 'a@b.com' })
    expect(result.current.step.kind).toBe('otp')
    expect(result.current.stepNumber).toBe(2)
  })
})

describe('useOnboardingStepper — otp step', () => {
  async function advanceToOtp(result: { current: ReturnType<typeof useOnboardingStepper> }) {
    act(() => {
      if (result.current.step.kind === 'email') result.current.step.onEmailChange('a@b.com')
    })
    await act(async () => {
      if (result.current.step.kind === 'email') await result.current.step.onContinue()
    })
  }

  it('toasts and clears the field on a wrong/expired code', async () => {
    loginWithCode.mockRejectedValueOnce(new Error('invalid code'))
    const { result } = renderHook(() => useOnboardingStepper(), { wrapper: wrap(buildAuth()) })
    await advanceToOtp(result)

    await act(async () => {
      if (result.current.step.kind === 'otp') await result.current.step.onSubmit('000000')
    })
    expect(toastShow).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error' }),
    )
    if (result.current.step.kind === 'otp') expect(result.current.step.code).toBe('')
  })

  it('locks Resend for 60s then re-enables it', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useOnboardingStepper(), { wrapper: wrap(buildAuth()) })
    await advanceToOtp(result)
    if (result.current.step.kind === 'otp') {
      expect(result.current.step.resendSeconds).toBe(60)
      expect(result.current.step.canResend).toBe(false)
    }
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    if (result.current.step.kind === 'otp') {
      expect(result.current.step.resendSeconds).toBe(0)
      expect(result.current.step.canResend).toBe(true)
    }
    vi.useRealTimers()
  })
})

describe('useOnboardingStepper — handle step', () => {
  const handleFlow: OnboardingState = {
    kind: 'needs-handle',
    submitHandle: () => okAsync(undefined),
  }

  it('shows the handle step (3) when the FSM needs a handle', () => {
    const { result } = renderHook(() => useOnboardingStepper(), {
      wrapper: wrap(buildAuth({ authenticated: true }), handleFlow),
    })
    expect(result.current.step.kind).toBe('handle')
    expect(result.current.stepNumber).toBe(3)
  })

  it('gates Continue on format + availability and reports a 400 as an inline format error', async () => {
    checkHandle.mockReturnValue(
      errAsync({ kind: 'api', status: 400, body: {} }),
    )
    const { result } = renderHook(() => useOnboardingStepper(), {
      wrapper: wrap(buildAuth({ authenticated: true }), handleFlow),
    })
    await act(async () => {
      if (result.current.step.kind === 'handle') result.current.step.onHandleChange('bad handle')
    })
    if (result.current.step.kind === 'handle') {
      expect(result.current.step.canContinue).toBe(false)
      expect(result.current.step.formatError).not.toBeNull()
      expect(result.current.step.availability).not.toBe('taken')
    }
  })
})

describe('useOnboardingStepper — mfa step', () => {
  it('shows the mfa step (4) and exposes skip + setup', () => {
    const skipMfa = vi.fn()
    const flow: OnboardingState = {
      kind: 'needs-mfa',
      setupMfa: () => okAsync(undefined),
      skipMfa,
    }
    const { result } = renderHook(() => useOnboardingStepper(), {
      wrapper: wrap(buildAuth({ authenticated: true }), flow),
    })
    expect(result.current.step.kind).toBe('mfa')
    expect(result.current.stepNumber).toBe(4)
    act(() => {
      if (result.current.step.kind === 'mfa') result.current.step.onSkip()
    })
    expect(skipMfa).toHaveBeenCalledTimes(1)
  })
})

describe('useOnboardingStepper — personalize step', () => {
  it('shows the personalize step (5) with theme + mode pickers and Done', () => {
    const finishPersonalize = vi.fn()
    const flow: OnboardingState = { kind: 'needs-personalize', finishPersonalize }
    const { result } = renderHook(() => useOnboardingStepper(), {
      wrapper: wrap(buildAuth({ authenticated: true }), flow),
    })
    expect(result.current.step.kind).toBe('personalize')
    expect(result.current.stepNumber).toBe(5)
    if (result.current.step.kind === 'personalize') {
      expect(result.current.step.theme).toBe('dark')
      expect(result.current.step.tradingMode).toBe('pro')
    }
    act(() => {
      if (result.current.step.kind === 'personalize') result.current.step.onDone()
    })
    expect(finishPersonalize).toHaveBeenCalledTimes(1)
  })

  it('onSelectTradingMode flips the persisted trading mode', () => {
    const flow: OnboardingState = { kind: 'needs-personalize', finishPersonalize: vi.fn() }
    const { result } = renderHook(() => useOnboardingStepper(), {
      wrapper: wrap(buildAuth({ authenticated: true }), flow),
    })
    act(() => {
      if (result.current.step.kind === 'personalize') result.current.step.onSelectTradingMode('simple')
    })
    if (result.current.step.kind === 'personalize') {
      expect(result.current.step.tradingMode).toBe('simple')
    }
  })
})
