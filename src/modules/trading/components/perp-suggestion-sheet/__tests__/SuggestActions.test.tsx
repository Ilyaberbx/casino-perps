import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SuggestActions } from '../SuggestActions'
import {
  CHECKING_ACCESS_LABEL,
  ESTIMATE_LABEL,
  EXECUTE_LABEL,
  GRANT_ACCESS_LABEL,
  RE_ESTIMATE_LABEL,
  TOP_UP_LABEL,
} from '../perp-suggestion-sheet.constants'
import { makeEstimateResult } from '../__fixtures__/suggestions'
import type {
  DelegationGate,
  EstimateState,
  ExecuteState,
  SuggestActionsProps,
} from '../perp-suggestion-sheet.types'

function makeProps(overrides: Partial<SuggestActionsProps> = {}): SuggestActionsProps {
  return {
    isConnected: true,
    estimate: { phase: 'idle' } as EstimateState,
    execute: { phase: 'idle' } as ExecuteState,
    canEstimate: true,
    canExecute: false,
    isEstimateStale: false,
    estimateAgeLabel: null,
    delegationGate: 'active' as DelegationGate,
    onEstimate: vi.fn(),
    onExecute: vi.fn(),
    onGrantAccess: vi.fn(),
    ...overrides,
  }
}

describe('SuggestActions — disconnected', () => {
  it('renders only the connect hint, no estimate/execute affordances', () => {
    render(<SuggestActions {...makeProps({ isConnected: false })} />)
    expect(screen.getByText('Connect your wallet to ask an agent.')).toBeInTheDocument()
    expect(screen.queryByTestId('suggest-actions')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: ESTIMATE_LABEL })).not.toBeInTheDocument()
  })
})

describe('SuggestActions — estimate phases', () => {
  it('shows the Estimate button at idle and calls onEstimate on click', async () => {
    const user = userEvent.setup()
    const onEstimate = vi.fn()
    render(<SuggestActions {...makeProps({ onEstimate })} />)
    await user.click(screen.getByRole('button', { name: ESTIMATE_LABEL }))
    expect(onEstimate).toHaveBeenCalledTimes(1)
  })

  it('disables the Estimate button and shows a loading label while estimating', () => {
    render(
      <SuggestActions
        {...makeProps({ estimate: { phase: 'loading' }, canEstimate: false })}
      />,
    )
    expect(screen.getByRole('button', { name: 'Estimating…' })).toBeDisabled()
  })

  it('surfaces a specific estimate error reason (not a blanket string)', () => {
    render(
      <SuggestActions
        {...makeProps({
          estimate: {
            phase: 'error',
            error: {
              title: 'Network error',
              detail: 'Could not reach the server. Check your connection and retry.',
              details: [],
              retryable: true,
            },
          },
        })}
      />,
    )
    expect(
      screen.getByText('Could not reach the server. Check your connection and retry.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Could not price this call.')).not.toBeInTheDocument()
  })

  it('lists every estimate validation issue together when more than one', () => {
    render(
      <SuggestActions
        {...makeProps({
          estimate: {
            phase: 'error',
            error: {
              title: 'Invalid request',
              detail: '"PEPE" is not a listed market',
              details: [
                '"PEPE" is not a listed market',
                'Leverage 50x exceeds the 40x venue cap',
              ],
              retryable: false,
            },
          },
        })}
      />,
    )
    const list = screen.getByTestId('failure-issues')
    expect(list).toHaveTextContent('"PEPE" is not a listed market')
    expect(list).toHaveTextContent('Leverage 50x exceeds the 40x venue cap')
  })

  it('renders the cost / sufficiency readout when ready (balance moved to the persistent footer)', () => {
    render(
      <SuggestActions
        {...makeProps({
          estimate: {
            phase: 'ready',
            result: makeEstimateResult({
              costUsd: '0.75',
              agentBalanceUsd: '12.00',
              sufficient: true,
            }),
            producedAt: 1_000_000,
          },
        })}
      />,
    )
    const readout = screen.getByTestId('estimate-readout')
    expect(readout).toHaveTextContent('$0.75')
    expect(screen.getByTestId('estimate-sufficient')).toHaveTextContent('Yes')
    // The Agent Balance figure is no longer repeated in the readout (slice 08) —
    // the persistent SheetAgentBalance footer owns it.
    expect(readout).not.toHaveTextContent('$12.00')
  })

  it('shows "No" sufficiency when the balance does not cover the cost', () => {
    render(
      <SuggestActions
        {...makeProps({
          estimate: {
            phase: 'ready',
            result: makeEstimateResult({ sufficient: false }),
            producedAt: 1_000_000,
          },
        })}
      />,
    )
    expect(screen.getByTestId('estimate-sufficient')).toHaveTextContent('No')
  })
})

describe('SuggestActions — execute gating', () => {
  it('does not render Execute before an estimate exists (idle estimate)', () => {
    render(<SuggestActions {...makeProps({ estimate: { phase: 'idle' } })} />)
    expect(screen.queryByRole('button', { name: EXECUTE_LABEL })).not.toBeInTheDocument()
  })

  it('renders an enabled Execute once estimated, sufficient, and canExecute', async () => {
    const user = userEvent.setup()
    const onExecute = vi.fn()
    render(
      <SuggestActions
        {...makeProps({
          canExecute: true,
          estimate: {
            phase: 'ready',
            result: makeEstimateResult({ sufficient: true }),
            producedAt: 1_000_000,
          },
          onExecute,
        })}
      />,
    )
    const execute = screen.getByRole('button', { name: EXECUTE_LABEL })
    expect(execute).toBeEnabled()
    await user.click(execute)
    expect(onExecute).toHaveBeenCalledTimes(1)
  })

  it('keeps Execute disabled when estimated+sufficient but canExecute is false', () => {
    render(
      <SuggestActions
        {...makeProps({
          canExecute: false,
          estimate: {
            phase: 'ready',
            result: makeEstimateResult({ sufficient: true }),
            producedAt: 1_000_000,
          },
        })}
      />,
    )
    expect(screen.getByRole('button', { name: EXECUTE_LABEL })).toBeDisabled()
  })
})

describe('SuggestActions — delegation gate', () => {
  it('shows a disabled "Checking access…" beat while the delegation status is unknown', () => {
    render(
      <SuggestActions
        {...makeProps({
          delegationGate: 'unknown',
          estimate: {
            phase: 'ready',
            result: makeEstimateResult({ sufficient: true }),
            producedAt: 1_000_000,
          },
        })}
      />,
    )
    const checking = screen.getByRole('button', { name: CHECKING_ACCESS_LABEL })
    expect(checking).toBeDisabled()
    expect(screen.queryByRole('button', { name: EXECUTE_LABEL })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: GRANT_ACCESS_LABEL }),
    ).not.toBeInTheDocument()
  })

  it('swaps Execute for "Grant signingless access" when the gate needs a grant', async () => {
    const user = userEvent.setup()
    const onGrantAccess = vi.fn()
    render(
      <SuggestActions
        {...makeProps({
          delegationGate: 'needs-grant',
          estimate: {
            phase: 'ready',
            result: makeEstimateResult({ sufficient: true }),
            producedAt: 1_000_000,
          },
          onGrantAccess,
        })}
      />,
    )
    expect(screen.queryByRole('button', { name: EXECUTE_LABEL })).not.toBeInTheDocument()
    const grant = screen.getByRole('button', { name: GRANT_ACCESS_LABEL })
    await user.click(grant)
    expect(onGrantAccess).toHaveBeenCalledTimes(1)
  })
})

describe('SuggestActions — insufficient balance', () => {
  it('disables Execute and does NOT render Top-Up here (the footer owns it, slice 08)', () => {
    render(
      <SuggestActions
        {...makeProps({
          estimate: {
            phase: 'ready',
            result: makeEstimateResult({ sufficient: false }),
            producedAt: 1_000_000,
          },
        })}
      />,
    )
    expect(screen.getByRole('button', { name: EXECUTE_LABEL })).toBeDisabled()
    expect(screen.queryByRole('button', { name: TOP_UP_LABEL })).not.toBeInTheDocument()
  })
})

describe('SuggestActions — execute error', () => {
  it('surfaces a mapped execute error as a callout', () => {
    render(
      <SuggestActions
        {...makeProps({
          execute: {
            phase: 'error',
            error: {
              title: 'Insufficient Agent Balance',
              detail: 'Top up your Agent Balance to cover the call price.',
              details: [],
              retryable: false,
            },
          },
        })}
      />,
    )
    expect(screen.getByText('Insufficient Agent Balance')).toBeInTheDocument()
    expect(
      screen.getByText('Top up your Agent Balance to cover the call price.'),
    ).toBeInTheDocument()
  })

  it('lists every execute validation issue together when more than one', () => {
    render(
      <SuggestActions
        {...makeProps({
          execute: {
            phase: 'error',
            error: {
              title: 'Invalid request',
              detail: '"PEPE" is not a listed market',
              details: [
                '"PEPE" is not a listed market',
                'Leverage 50x exceeds the 40x venue cap',
              ],
              retryable: false,
            },
          },
        })}
      />,
    )
    const list = screen.getByTestId('failure-issues')
    expect(list).toHaveTextContent('"PEPE" is not a listed market')
    expect(list).toHaveTextContent('Leverage 50x exceeds the 40x venue cap')
  })
})

describe('SuggestActions — estimate freshness (slice 07)', () => {
  it('renders the "updated Ns ago" marker next to cost when given a label', () => {
    render(
      <SuggestActions
        {...makeProps({
          estimate: {
            phase: 'ready',
            result: makeEstimateResult({ sufficient: true }),
            producedAt: 1_000_000,
          },
          estimateAgeLabel: 'updated 4s ago',
        })}
      />,
    )
    expect(screen.getByTestId('estimate-updated-ago')).toHaveTextContent(
      'updated 4s ago',
    )
  })

  it('swaps Execute for an explicit Re-estimate when the estimate is stale', async () => {
    const user = userEvent.setup()
    const onEstimate = vi.fn()
    render(
      <SuggestActions
        {...makeProps({
          canExecute: false,
          isEstimateStale: true,
          estimate: {
            phase: 'ready',
            result: makeEstimateResult({ sufficient: true }),
            producedAt: 1_000_000,
          },
          estimateAgeLabel: 'updated 12s ago',
          onEstimate,
        })}
      />,
    )
    expect(screen.queryByRole('button', { name: EXECUTE_LABEL })).not.toBeInTheDocument()
    const reEstimate = screen.getByRole('button', { name: RE_ESTIMATE_LABEL })
    await user.click(reEstimate)
    expect(onEstimate).toHaveBeenCalledTimes(1)
  })

  it('forces Re-estimate over Execute even when the stale quote is sufficient', () => {
    render(
      <SuggestActions
        {...makeProps({
          canExecute: false,
          isEstimateStale: true,
          estimate: {
            phase: 'ready',
            result: makeEstimateResult({ sufficient: true }),
            producedAt: 1_000_000,
          },
        })}
      />,
    )
    expect(screen.getByTestId('stale-estimate')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: EXECUTE_LABEL })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: TOP_UP_LABEL })).not.toBeInTheDocument()
  })
})
