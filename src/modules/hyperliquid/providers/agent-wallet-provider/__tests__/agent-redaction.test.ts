/**
 * AGENT-05 redaction test.
 * Proves that the agent private key (64-hex-char pattern after 0x) never appears in:
 * 1. Any captured log record field during the approval flow
 * 2. Any outbound fetch() call body during the approval flow
 *
 * The agentAddress (0x + 40 hex chars) is explicitly allowed — only the 64-char key pattern is forbidden.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { okAsync, errAsync } from 'neverthrow'
import { useOwnAgentWallet } from '../use-agent-wallet'
import { buildFakeExchangeGateway } from '../../../gateway/__fixtures__/fake-exchange-gateway'
import { buildFakeLogger } from '../../../services/__fixtures__/web-data2'

// Private key pattern: exactly 0x followed by 64 lowercase hex chars
const PRIVATE_KEY_PATTERN = /^0x[0-9a-f]{64}$/

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrimaryWalletAddress = '0xdeadbeef00000000000000000000000000000001' as `0x${string}`

const defaultAuthState = {
  ready: true,
  authenticated: true,
  walletReady: true,
  primaryWalletAddress: mockPrimaryWalletAddress,
  getMasterViemAccount: async () => ({
    address: '0xmaster0000000000000000000000000000000001',
    signTypedData: async function fakeSignTypedData() { return '0x' },
  } as never),
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

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))
vi.mock('@/modules/account', () => ({
  useAuth: useAuthMock,
  useOnboardingFlow: vi.fn(() => ({ kind: 'ready', me: {} })),
  // ADR-0061: the agent key/name key on `nativeAddress`; the grant on
  // `masterAddress`. Both default to the primary so this redaction flow is unchanged.
  useSelectedWallet: vi.fn(() => ({
    selectedAddress: null,
    masterAddress: mockPrimaryWalletAddress,
    nativeAddress: mockPrimaryWalletAddress,
    isSelectionConnectable: true,
  })),
  useIsWalletConnected: () => {
    const a = useAuthMock()
    return a.ready && a.authenticated && a.walletReady
  },
}))
useAuthMock.mockReturnValue(defaultAuthState)

vi.mock('viem/accounts', async () => {
  const actual = await vi.importActual<typeof import('viem/accounts')>('viem/accounts')
  return {
    ...actual,
    generatePrivateKey: vi.fn(() => ('0x' + 'b'.repeat(64)) as `0x${string}`),
  }
})

import { useAuth, useOnboardingFlow } from '@/modules/account'

const NETWORK = 'testnet'

// ---------------------------------------------------------------------------
// Helper: scan a value recursively for private key pattern
// ---------------------------------------------------------------------------
function containsPrivateKeyPattern(value: unknown): boolean {
  if (typeof value === 'string') return PRIVATE_KEY_PATTERN.test(value)
  if (Array.isArray(value)) return value.some(containsPrivateKeyPattern)
  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(containsPrivateKeyPattern)
  }
  return false
}

describe('AGENT-05 redaction: agent private key never in logs or fetch body', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(useAuth).mockReturnValue({ ...defaultAuthState } as never)
    vi.mocked(useOnboardingFlow).mockReturnValue({ kind: 'ready', me: {} } as never)
  })

  it('no log field contains the private key pattern during approval flow', async () => {
    const { logger, records } = buildFakeLogger()

    const fakeGateway = buildFakeExchangeGateway({
      approveAgent: () => {
        // Give logger a chance to emit something (verifying it captures the right fields)
        logger.debug({ method: 'approveAgent' }, 'sdk call')
        return okAsync(undefined)
      },
    })

    // Thread the capturing logger into the hook so the swallow-point records the
    // hook emits itself flow into `records` — not just the local debug line above.
    const { result } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK, logger))

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    await act(async () => {
      await result.current.approve('test-wallet')
    })

    // Assert no log record field value matches the private key pattern
    for (const record of records) {
      for (const [fieldName, fieldValue] of Object.entries(record.fields)) {
        const hasKey = containsPrivateKeyPattern(fieldValue)
        expect(
          hasKey,
          `Log record field "${fieldName}" contains a value matching the private key pattern: ${JSON.stringify(fieldValue)}`,
        ).toBe(false)
      }
      const messageHasKey = PRIVATE_KEY_PATTERN.test(record.message)
      expect(
        messageHasKey,
        `Log record message contains private key pattern: "${record.message}"`,
      ).toBe(false)
    }
  })

  it('no fetch call body contains the private key pattern during approval flow', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ status: 'ok', response: { type: 'default' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    const fakeGateway = buildFakeExchangeGateway({
      approveAgent: () => okAsync(undefined),
    })

    const { result } = renderHook(() => useOwnAgentWallet(fakeGateway, NETWORK))

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    await act(async () => {
      await result.current.approve('test-wallet')
    })

    // Check all captured fetch calls for private key pattern in request body
    for (const call of fetchSpy.mock.calls) {
      const [, init] = call
      const body = init?.body
      if (typeof body === 'string') {
        expect(
          containsPrivateKeyPattern(body),
          `fetch call body contains private key pattern: ${body.substring(0, 100)}`,
        ).toBe(false)
      }
    }

    fetchSpy.mockRestore()
  })
})
