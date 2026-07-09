import { describe, it, expect, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { AuthBridgeForTest, type BridgeProps } from '../__fixtures__/auth-bridge-for-test'
import { AuthContext, type AuthState } from '../auth-provider.context'

vi.mock('@privy-io/react-auth', () => ({
  useLoginWithEmail: () => ({
    sendCode: vi.fn(),
    loginWithCode: vi.fn(),
    state: { status: 'initial' },
  }),
}))

vi.mock('@/modules/shared/providers/toast-provider', () => ({
  useToast: () => ({ show: vi.fn(), dismiss: vi.fn(), dismissAll: vi.fn() }),
}))

vi.mock('@/app/logger', () => {
  const child = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn(() => child) }
  return { logger: { ...child, child: vi.fn(() => child) } }
})

// Stable callbacks shared across renders so the value memo's deps that depend on
// them never change for an *unrelated* re-render — isolating the wallet-derived
// arrays as the only variable under test.
const getAccessToken = async () => 'jwt'
const logout = async () => {}
const enrollMfa = async () => {}
const exportWallet = async () => {}
const importPrivateKey = async () => ({ address: '0x0000000000000000000000000000000000000000' })
const createAgentWallet = async () => ({
  address: '0x0000000000000000000000000000000000000000',
  walletId: 'w',
})
const attachAgentSigner = async () => true
const removeAgentSigner = async () => true
const loginWithWallet = async () => {}
const linkWallet = async () => '0x0000000000000000000000000000000000000000'
const getMasterViemAccount = async () => null
const getBroadcastWalletClient = async () => null
const getAgentWalletBroadcastClient = async () => null
const switchMasterWalletChain = async () => 'switched' as const

const exportable: ReadonlyArray<string> = []
const connectable = ['0xaaaa000000000000000000000000000000000001']
const externals = [
  { address: '0xaaaa000000000000000000000000000000000001', walletClientType: 'metamask' },
]

function baseProps(
  overrides: Partial<BridgeProps>,
): Omit<BridgeProps, 'children'> {
  return {
    apiBaseUrl: '',
    ready: true,
    authenticated: true,
    privyId: 'did:privy:abc',
    walletAddress: '0xaaaa000000000000000000000000000000000001',
    walletClientType: 'metamask',
    walletsReady: true,
    isBroadcastWalletReady: true,
    connectableMasterAddresses: connectable,
    externalWallets: externals,
    exportableAddresses: exportable,
    hasMfa: false,
    getAccessToken,
    logout,
    enrollMfa,
    exportWallet,
    importPrivateKey,
    createAgentWallet,
    attachAgentSigner,
    removeAgentSigner,
    loginWithWallet,
    linkWallet,
    getMasterViemAccount,
    getBroadcastWalletClient,
    getAgentWalletBroadcastClient,
    switchMasterWalletChain,
    ...overrides,
  }
}

function Capture({ sink }: { sink: (value: AuthState) => void }) {
  return (
    <AuthContext.Consumer>
      {(value) => {
        if (value !== null) sink(value)
        return null
      }}
    </AuthContext.Consumer>
  )
}

describe('AuthValueProvider context-value identity (Opt-C1 stability guard)', () => {
  it('keeps the context value identity STABLE across an unrelated re-render with the same wallets input', () => {
    const seen: AuthState[] = []
    const sink = (value: AuthState) => seen.push(value)

    const { rerender } = render(
      <AuthBridgeForTest {...baseProps({})}>
        <Capture sink={sink} />
      </AuthBridgeForTest>,
    )

    const firstValue = seen[seen.length - 1]

    // Unrelated re-render: flip a primitive the AuthState does NOT include
    // (apiBaseUrl is the same; we re-pass the *same* wallet-derived arrays, as
    // AuthBridge's `useMemo([wallets])` would on a Privy tick that didn't change
    // the wallet set). Same array references → value memo must not recompute.
    act(() => {
      rerender(
        <AuthBridgeForTest {...baseProps({})}>
          <Capture sink={sink} />
        </AuthBridgeForTest>,
      )
    })

    const secondValue = seen[seen.length - 1]
    expect(secondValue).toBe(firstValue)
  })

  it('CHANGES the context value identity when the wallets input actually changes', () => {
    const seen: AuthState[] = []
    const sink = (value: AuthState) => seen.push(value)

    const { rerender } = render(
      <AuthBridgeForTest {...baseProps({})}>
        <Capture sink={sink} />
      </AuthBridgeForTest>,
    )

    const firstValue = seen[seen.length - 1]

    // A real wallet-set change: new (different-content) arrays, as AuthBridge's
    // `useMemo([wallets])` produces when `wallets` changes. The value memo must
    // recompute and publish a new context identity.
    const nextConnectable = ['0xbbbb000000000000000000000000000000000002']
    const nextExternals = [
      { address: '0xbbbb000000000000000000000000000000000002', walletClientType: 'coinbase_wallet' },
    ]
    act(() => {
      rerender(
        <AuthBridgeForTest
          {...baseProps({
            connectableMasterAddresses: nextConnectable,
            externalWallets: nextExternals,
          })}
        >
          <Capture sink={sink} />
        </AuthBridgeForTest>,
      )
    })

    const secondValue = seen[seen.length - 1]
    expect(secondValue).not.toBe(firstValue)
  })
})
