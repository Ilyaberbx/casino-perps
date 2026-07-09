import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { SuggestTab } from '../SuggestTab'
import { MINARA_AGENT } from '../ai-agents.constants'
import { DEX_OPTIONS } from '../dex-options.constants'
import { ESTIMATE_LABEL } from '../perp-suggestion-sheet.constants'
import { makeFakeParamForm, makeSuggestSteps } from '../__fixtures__/suggestions'
import { buildIconMarketFromSymbol } from '@/modules/shared/utils/resolve-market-icon-url'
import type {
  ExecuteState,
  UsePerpSuggestionSheetContentReturn,
} from '../perp-suggestion-sheet.types'

function makeVm(
  overrides: Partial<UsePerpSuggestionSheetContentReturn> = {},
): UsePerpSuggestionSheetContentReturn {
  return {
    isOpen: true,
    close: vi.fn(),
    isConnected: true,
    currentMarket: buildIconMarketFromSymbol('BTC'),
    tab: 'suggest',
    setTab: vi.fn(),
    dexOptions: DEX_OPTIONS,
    selectedVenueId: 'hyperliquid',
    selectVenue: vi.fn(),
    agents: [MINARA_AGENT],
    selectedAgentId: 'minara',
    selectAgent: vi.fn(),
    agent: MINARA_AGENT,
    paramForm: makeFakeParamForm(),
    steps: makeSuggestSteps('params'),
    estimate: { phase: 'idle' },
    onEstimate: vi.fn(),
    canEstimate: true,
    isEstimateStale: false,
    estimateAgeLabel: null,
    execute: { phase: 'idle' } as ExecuteState,
    onExecute: vi.fn(),
    canExecute: false,
    loadingAnimated: true,
    delegationGate: 'active',
    onGrantAccess: vi.fn(),
    onTopUp: vi.fn(),
    agentBalance: {
      display: '$10.00',
      isLoading: false,
      isError: false,
      showTopUp: false,
      scopedVenueId: 'hyperliquid',
      onTopUp: vi.fn(),
    },
    history: { phase: 'loading' },
    onReopenHistory: vi.fn(),
    onUseCurrentMarket: vi.fn(),
    ...overrides,
  }
}

describe('SuggestTab', () => {
  it('renders the picker, param form, and actions when not executing', () => {
    render(<SuggestTab vm={makeVm()} />)
    expect(screen.getByTestId('agent-param-form')).toBeInTheDocument()
    expect(screen.getByTestId('suggest-actions')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: ESTIMATE_LABEL })).toBeInTheDocument()
    expect(screen.queryByTestId('agent-working')).not.toBeInTheDocument()
  })

  it('swaps the actions for the agent-working loader while executing', () => {
    render(<SuggestTab vm={makeVm({ execute: { phase: 'loading' } })} />)
    expect(screen.getByTestId('agent-working')).toBeInTheDocument()
    expect(screen.queryByTestId('suggest-actions')).not.toBeInTheDocument()
  })

  it('passes the selected agent label + icon into the loader', () => {
    render(<SuggestTab vm={makeVm({ execute: { phase: 'loading' } })} />)
    const loader = screen.getByTestId('agent-working')
    expect(loader).toHaveTextContent('Minara')
    expect(within(loader).getByAltText('Minara')).toBeInTheDocument()
  })

  it('shows the async-pending working notice while the durable job runs', () => {
    render(
      <SuggestTab
        vm={makeVm({ execute: { phase: 'pending', suggestionId: 'sug-1' } })}
      />,
    )
    const notice = screen.getByTestId('suggestion-pending')
    expect(notice).toHaveTextContent('Generating your suggestion')
    expect(notice).toHaveTextContent('notify you when it’s ready')
    expect(screen.queryByTestId('suggest-actions')).not.toBeInTheDocument()
    expect(screen.queryByTestId('agent-working')).not.toBeInTheDocument()
  })
})
