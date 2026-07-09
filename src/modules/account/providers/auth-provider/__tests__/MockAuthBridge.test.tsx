import { describe, it, expect } from 'vitest'
import { useEffect, useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MockAuthBridge } from '../MockAuthBridge'
import { useAuth } from '../use-auth'
import { useIsWalletConnected } from '../../../components/use-is-wallet-connected'

const MOCK_ADDRESS = '0x000000000000000000000000000000000000dEaD'

function Probe() {
  const auth = useAuth()
  const isConnected = useIsWalletConnected()
  return (
    <div>
      <span data-testid="connected">{String(isConnected)}</span>
      <span data-testid="ready">{String(auth.ready)}</span>
      <span data-testid="authenticated">{String(auth.authenticated)}</span>
      <span data-testid="wallet-ready">{String(auth.walletReady)}</span>
      <span data-testid="address">{auth.walletAddress ?? 'null'}</span>
      <span data-testid="privy-id">{auth.privyId ?? 'null'}</span>
    </div>
  )
}

describe('MockAuthBridge', () => {
  it('reports a connected mock wallet through useAuth() / useIsWalletConnected()', () => {
    render(
      <MockAuthBridge apiBaseUrl="" config={{ walletAddress: MOCK_ADDRESS }}>
        <Probe />
      </MockAuthBridge>,
    )

    expect(screen.getByTestId('connected').textContent).toBe('true')
    expect(screen.getByTestId('ready').textContent).toBe('true')
    expect(screen.getByTestId('authenticated').textContent).toBe('true')
    expect(screen.getByTestId('wallet-ready').textContent).toBe('true')
    expect(screen.getByTestId('address').textContent).toBe(MOCK_ADDRESS)
    expect(screen.getByTestId('privy-id').textContent).toMatch(/^did:privy:/)
  })

  it('provides a dummy getAccessToken that resolves a non-null token', async () => {
    function TokenProbe() {
      const { getAccessToken } = useAuth()
      const [token, setToken] = useState<string | null>(null)
      useEffect(() => {
        void getAccessToken().then(setToken)
      }, [getAccessToken])
      return <span data-testid="token">{token ?? 'null'}</span>
    }
    render(
      <MockAuthBridge apiBaseUrl="" config={{ walletAddress: MOCK_ADDRESS }}>
        <TokenProbe />
      </MockAuthBridge>,
    )
    await waitFor(() => expect(screen.getByTestId('token').textContent).not.toBe('null'))
  })
})
