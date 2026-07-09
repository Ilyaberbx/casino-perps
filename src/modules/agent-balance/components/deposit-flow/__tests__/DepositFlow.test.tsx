import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DepositFlow } from '../DepositFlow'

const AGENT_WALLET = '0x4444444444444444444444444444444444444444' as const

describe('DepositFlow', () => {
  it('renders the Agent Wallet receive address (QR via CopyableAddress)', () => {
    render(<DepositFlow agentWalletAddress={AGENT_WALLET} />)
    expect(screen.getByLabelText(/deposit to agent balance/i)).toBeInTheDocument()
    // Truncated address surfaces the last 4 chars of the agent wallet.
    expect(screen.getByText(/4444/)).toBeInTheDocument()
  })

  it('is receive-only — it never renders a fund-from-wallet button', () => {
    render(<DepositFlow agentWalletAddress={AGENT_WALLET} />)
    expect(
      screen.queryByRole('button', { name: /fund agent wallet/i }),
    ).not.toBeInTheDocument()
  })

  it('shows a not-provisioned note before the Agent Wallet address resolves', () => {
    render(<DepositFlow agentWalletAddress={null} />)
    expect(screen.getByText(/not provisioned yet/i)).toBeInTheDocument()
  })
})
