import { describe, it, expect, beforeAll } from 'vitest'
import { okAsync, ResultAsync } from 'neverthrow'
import { NetworkError } from '@/modules/shared/http'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PerpSuggestionSheet } from '../PerpSuggestionSheet'
import { useSuggestionPreviewSheet } from '../../../providers/suggestion-preview-provider'
import {
  AGENT_BALANCE_LABEL,
  ESTIMATE_LABEL,
  EXECUTE_LABEL,
  SOON_BADGE,
  TOP_UP_LABEL,
} from '../perp-suggestion-sheet.constants'
import { installDialogPolyfill } from '../__fixtures__/dialog-polyfill'
import { makeSheetWrapper } from '../__fixtures__/render-sheet'
import {
  fakeAgentBalance,
  fakeExecuteCompleted,
  fakeHistoryOk,
  makeFakeDeps,
} from '../__fixtures__/fake-deps'
import {
  makeEstimateResult,
  makeStoredSuggestion,
} from '../__fixtures__/suggestions'
import type { PerpSuggestionSheetDeps } from '../perp-suggestion-sheet.types'

beforeAll(() => installDialogPolyfill())

/** Renders the preview target as JSON so tests can assert what opened. */
function PreviewProbe() {
  const { target } = useSuggestionPreviewSheet()
  if (!target) return <div data-testid="preview-closed" />
  return (
    <div data-testid="preview-open">
      <span data-testid="preview-suggestion-id">{target.suggestion.id}</span>
      <span data-testid="preview-readonly">{String(target.readOnly)}</span>
    </div>
  )
}

/** A deferred execute dep: the accept POST hangs until `resolve()` is invoked. */
function makeExecuteGate() {
  const holder: { resolve: () => void } = { resolve: () => undefined }
  const execute: PerpSuggestionSheetDeps['executeSuggestion'] = () =>
    ResultAsync.fromPromise(
      new Promise<{ status: 'pending'; suggestionId: string }>((resolve) => {
        holder.resolve = () => resolve({ status: 'pending', suggestionId: 'sug-x' })
      }),
      (cause) => new NetworkError('unreachable', cause),
    )
  return { execute, resolve: () => holder.resolve() }
}

function renderSheet(
  deps: PerpSuggestionSheetDeps,
  options: Parameters<typeof makeSheetWrapper>[0] = {},
) {
  const Wrapper = makeSheetWrapper(options)
  return render(
    <Wrapper>
      <PerpSuggestionSheet deps={deps} />
      <PreviewProbe />
    </Wrapper>,
  )
}

/** Drag the margin slider to a valid value so the Estimate gate (`canEstimate`)
 *  opens — the default margin is now $0 (invalid), which keeps Estimate disabled. */
function seedMargin(value = '1000') {
  fireEvent.change(screen.getByTestId('field-marginUsd'), { target: { value } })
}

describe('PerpSuggestionSheet — shell', () => {
  it('renders the sheet panel with the Suggest and History tabs', () => {
    renderSheet(makeFakeDeps())
    expect(screen.getByTestId('perp-suggestion-sheet')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Suggest' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'History' })).toBeInTheDocument()
  })

  it('lists Minara enabled and Native disabled with the soon badge', async () => {
    const user = userEvent.setup()
    renderSheet(makeFakeDeps())
    await user.click(screen.getByRole('button', { name: 'Select AI agent' }))
    expect(screen.getByRole('option', { name: /Minara/ })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    )
    const native = screen.getByRole('option', { name: /Native Agent/ })
    expect(native).toHaveAttribute('aria-disabled', 'true')
    expect(native).toHaveTextContent(SOON_BADGE)
  })

  it('renders the Minara param form (market/margin/leverage/style)', () => {
    renderSheet(makeFakeDeps())
    expect(screen.getByTestId('token-search')).toBeInTheDocument()
    expect(screen.getByTestId('field-marginUsd')).toBeInTheDocument()
    expect(screen.getByTestId('field-leverage')).toBeInTheDocument()
    expect(screen.getByTestId('field-style')).toBeInTheDocument()
  })
})

describe('PerpSuggestionSheet — disconnected', () => {
  it('hides the estimate/execute affordances and shows the connect hint', () => {
    renderSheet(makeFakeDeps(), { connected: false })
    expect(
      screen.getByText('Connect your wallet to ask an agent.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: ESTIMATE_LABEL }),
    ).not.toBeInTheDocument()
  })
})

describe('PerpSuggestionSheet — estimate gates execute → preview', () => {
  it('estimate stays hidden until clicked, then a completed dedup hit opens the preview readOnly:false', async () => {
    const user = userEvent.setup()
    const suggestion = makeStoredSuggestion({ id: 'executed' })
    renderSheet(
      makeFakeDeps({ delegationStatus: 'active', execute: fakeExecuteCompleted(suggestion) }),
      { accountValue: 5000 },
    )

    // No Execute affordance before an estimate exists.
    expect(
      screen.queryByRole('button', { name: EXECUTE_LABEL }),
    ).not.toBeInTheDocument()

    seedMargin()
    await user.click(screen.getByRole('button', { name: ESTIMATE_LABEL }))
    await screen.findByTestId('estimate-readout')

    const execute = await screen.findByRole('button', { name: EXECUTE_LABEL })
    await waitFor(() => expect(execute).toBeEnabled())

    expect(screen.getByTestId('preview-closed')).toBeInTheDocument()
    await user.click(execute)

    await screen.findByTestId('preview-open')
    expect(screen.getByTestId('preview-suggestion-id')).toHaveTextContent('executed')
    expect(screen.getByTestId('preview-readonly')).toHaveTextContent('false')
  })

  it('shows the agent-working loader while the paid call is in flight', async () => {
    const user = userEvent.setup()
    const gate = makeExecuteGate()
    renderSheet(
      makeFakeDeps({ delegationStatus: 'active', execute: gate.execute }),
      { accountValue: 5000 },
    )
    seedMargin()
    await user.click(screen.getByRole('button', { name: ESTIMATE_LABEL }))
    const execute = await screen.findByRole('button', { name: EXECUTE_LABEL })
    await waitFor(() => expect(execute).toBeEnabled())
    await user.click(execute)

    expect(await screen.findByTestId('agent-working')).toBeInTheDocument()
    gate.resolve()
    await waitFor(() =>
      expect(screen.queryByTestId('agent-working')).not.toBeInTheDocument(),
    )
  })
})

describe('PerpSuggestionSheet — history tab', () => {
  it('renders agent-badged rows newest-first as supplied', async () => {
    const user = userEvent.setup()
    const rows = [
      makeStoredSuggestion({ id: 'newest', agentId: 'minara' }),
      makeStoredSuggestion({ id: 'older', agentId: 'native' }),
    ]
    renderSheet(makeFakeDeps({ history: fakeHistoryOk(rows) }))
    await user.click(screen.getByRole('tab', { name: 'History' }))

    const list = await screen.findByTestId('history-list')
    const renderedRows = within(list).getAllByTestId('history-row')
    expect(renderedRows).toHaveLength(2)
    // Provider is shown as an icon: Minara's mark vs. the three-eye motif.
    expect(within(renderedRows[0]).getByRole('img', { name: 'Minara' })).toBeInTheDocument()
    expect(within(renderedRows[1]).getByRole('img', { name: 'AI agent' })).toBeInTheDocument()
  })

  it('shows the empty-state copy when there is no history', async () => {
    const user = userEvent.setup()
    renderSheet(makeFakeDeps({ history: fakeHistoryOk([]) }))
    await user.click(screen.getByRole('tab', { name: 'History' }))
    expect(
      await screen.findByText('No suggestions yet — ask an agent.'),
    ).toBeInTheDocument()
  })

  it('marks an expired row read-only and reopens it into the preview readOnly:true', async () => {
    const user = userEvent.setup()
    const expired = makeStoredSuggestion({
      id: 'stale',
      expiresAt: '2000-01-01T00:00:00.000Z',
    })
    renderSheet(makeFakeDeps({ history: fakeHistoryOk([expired]) }))
    await user.click(screen.getByRole('tab', { name: 'History' }))

    const row = await screen.findByTestId('history-row')
    expect(within(row).getByTestId('expired-badge')).toBeInTheDocument()

    await user.click(within(row).getByRole('button', { name: 'Open' }))
    await screen.findByTestId('preview-open')
    expect(screen.getByTestId('preview-suggestion-id')).toHaveTextContent('stale')
    expect(screen.getByTestId('preview-readonly')).toHaveTextContent('true')
  })

  it('reopens a still-valid row into the preview readOnly:false', async () => {
    const user = userEvent.setup()
    const valid = makeStoredSuggestion({
      id: 'live',
      expiresAt: '2999-01-01T00:00:00.000Z',
    })
    renderSheet(makeFakeDeps({ history: fakeHistoryOk([valid]) }))
    await user.click(screen.getByRole('tab', { name: 'History' }))

    const row = await screen.findByTestId('history-row')
    expect(within(row).queryByTestId('expired-badge')).not.toBeInTheDocument()

    await user.click(within(row).getByRole('button', { name: 'Open' }))
    await screen.findByTestId('preview-open')
    expect(screen.getByTestId('preview-suggestion-id')).toHaveTextContent('live')
    expect(screen.getByTestId('preview-readonly')).toHaveTextContent('false')
  })
})

describe('PerpSuggestionSheet — persistent Agent Balance (slice 08)', () => {
  it('renders the Agent Balance in the sheet BEFORE any estimate, scoped to the venue', () => {
    renderSheet(makeFakeDeps({ useAgentBalance: fakeAgentBalance(42) }))
    // No estimate readout yet — the balance is persistent, not post-estimate.
    expect(screen.queryByTestId('estimate-readout')).not.toBeInTheDocument()
    const panel = screen.getByTestId('sheet-agent-balance')
    expect(panel).toHaveTextContent(AGENT_BALANCE_LABEL)
    expect(screen.getByTestId('sheet-agent-balance-value')).toHaveTextContent(
      '$42.00',
    )
    expect(panel).toHaveAttribute('data-venue', 'hyperliquid')
  })

  it('stays visible on the History tab', async () => {
    const user = userEvent.setup()
    renderSheet(makeFakeDeps({ useAgentBalance: fakeAgentBalance(42) }))
    await user.click(screen.getByRole('tab', { name: 'History' }))
    expect(screen.getByTestId('sheet-agent-balance')).toBeInTheDocument()
  })

  it('shows the Top-Up affordance once a ready estimate is insufficient', async () => {
    const user = userEvent.setup()
    renderSheet(
      makeFakeDeps({
        delegationStatus: 'active',
        useAgentBalance: fakeAgentBalance(1),
        estimate: () =>
          okAsync(makeEstimateResult({ agentBalanceUsd: '0.10', sufficient: false })),
      }),
      { accountValue: 5000 },
    )
    // Pre-estimate: no top-up.
    expect(
      screen.queryByRole('button', { name: TOP_UP_LABEL }),
    ).not.toBeInTheDocument()

    seedMargin()
    await user.click(screen.getByRole('button', { name: ESTIMATE_LABEL }))
    await screen.findByTestId('estimate-readout')

    // The persistent footer surfaces a single Top-Up; the quote-time figure
    // supersedes the live reading (no contradictory numbers).
    const topUp = await screen.findByRole('button', { name: TOP_UP_LABEL })
    expect(topUp).toBeInTheDocument()
    expect(screen.getByTestId('sheet-agent-balance-value')).toHaveTextContent(
      '$0.10',
    )
  })

  it('is absent while disconnected (the header owns Connect)', () => {
    renderSheet(makeFakeDeps(), { connected: false })
    expect(screen.queryByTestId('sheet-agent-balance')).not.toBeInTheDocument()
  })
})
