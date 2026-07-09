import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PlaceOrderRequest } from '@/modules/shared/domain'
import { SuggestionPreviewSheet } from '../SuggestionPreviewSheet'
import {
  installSheetEnvironment,
  makePreviewWrapper,
  connectedAuth,
} from '../__fixtures__/render-preview'
import {
  makeFakeTrader,
  makePlaceError,
  makeStoredSuggestion,
} from '../__fixtures__/suggestion-preview'
import {
  EXPIRED_NOTICE,
  NO_TRADE_NOTICE,
  PLACE_LABEL,
} from '../suggestion-preview.constants'

beforeAll(() => {
  installSheetEnvironment()
})

beforeEach(() => {
  installSheetEnvironment()
})

function renderSheet(options: Parameters<typeof makePreviewWrapper>[0]) {
  const Wrapper = makePreviewWrapper(options)
  const root = document.getElementById('root') as HTMLElement
  return render(
    <Wrapper>
      <SuggestionPreviewSheet />
    </Wrapper>,
    { container: root },
  )
}

describe('SuggestionPreviewSheet', () => {
  it('keeps the Sheet closed and renders no suggestion when there is no target', () => {
    renderSheet({ trader: makeFakeTrader(), defaultTarget: null })
    // The dialog is not shown (isOpen=false drives `Sheet`'s showModal), and no
    // raw suggestion is rendered. The Place button lives inside the closed
    // dialog body, so its mere presence in the JSDOM tree is not "shown".
    expect(screen.getByTestId('sheet-dialog')).not.toHaveAttribute('open')
    expect(screen.queryByTestId('raw-suggestion')).not.toBeInTheDocument()
  })

  it('renders the raw view and the editable legs when open', () => {
    const suggestion = makeStoredSuggestion({
      agentId: 'minara',
      rawSuggestion: { side: 'long', confidence: 72 },
    })
    renderSheet({
      trader: makeFakeTrader(),
      defaultTarget: { suggestion, readOnly: false },
    })
    expect(screen.getByTestId('raw-suggestion')).toBeInTheDocument()
    expect(screen.getByTestId('editable-legs')).toBeInTheDocument()
    expect(screen.getByText('minara')).toBeInTheDocument()
    expect(screen.getByText('LONG')).toBeInTheDocument()
    expect(screen.getByRole('meter', { name: 'Confidence' })).toBeInTheDocument()
  })

  it('shows the Place button enabled when canPlace is true', () => {
    renderSheet({
      trader: makeFakeTrader(),
      defaultTarget: { suggestion: makeStoredSuggestion(), readOnly: false },
    })
    const place = screen.getByTestId('preview-place-order')
    expect(place).toHaveTextContent(PLACE_LABEL)
    expect(place).toBeEnabled()
  })

  it('disables the Place button when validation fails', () => {
    renderSheet({
      trader: makeFakeTrader({ issues: [{ field: 'size', message: 'No margin' }] }),
      defaultTarget: { suggestion: makeStoredSuggestion(), readOnly: false },
    })
    expect(screen.getByTestId('preview-place-order')).toBeDisabled()
  })

  it('shows the Expired callout and hides the Place button for an expired target', () => {
    renderSheet({
      trader: makeFakeTrader(),
      defaultTarget: { suggestion: makeStoredSuggestion(), readOnly: true },
    })
    expect(screen.getByText('Expired')).toBeInTheDocument()
    expect(screen.getByText(EXPIRED_NOTICE)).toBeInTheDocument()
    expect(screen.queryByTestId('preview-place-order')).not.toBeInTheDocument()
  })

  it('shows the No-trade notice and hides the legs + Place for a neutral suggestion', () => {
    const suggestion = makeStoredSuggestion({
      rawSuggestion: { side: 'neutral', stopLossPrice: null, takeProfitPrice: null },
    })
    renderSheet({
      trader: makeFakeTrader(),
      defaultTarget: { suggestion, readOnly: false },
    })
    // The raw view still renders (with `--` for the missing exit levels), but a
    // neutral "no-trade" suggestion is non-executable: no editable legs, no Place.
    expect(screen.getByTestId('raw-suggestion')).toBeInTheDocument()
    expect(screen.getByText(NO_TRADE_NOTICE)).toBeInTheDocument()
    expect(screen.queryByTestId('editable-legs')).not.toBeInTheDocument()
    expect(screen.queryByTestId('preview-place-order')).not.toBeInTheDocument()
  })

  it('freezes the legs for an expired (read-only) target', () => {
    renderSheet({
      trader: makeFakeTrader(),
      defaultTarget: { suggestion: makeStoredSuggestion(), readOnly: true },
    })
    expect(screen.getByTestId('leg-margin')).toBeDisabled()
    expect(screen.getByTestId('leg-entry')).toBeDisabled()
  })

  it('hides the Place button when the wallet is disconnected', () => {
    renderSheet({
      trader: makeFakeTrader(),
      defaultTarget: { suggestion: makeStoredSuggestion(), readOnly: false },
      auth: { ...connectedAuth, authenticated: false, walletReady: false },
    })
    expect(screen.queryByTestId('preview-place-order')).not.toBeInTheDocument()
    // The raw view still renders — only the gated affordance is absent.
    expect(screen.getByTestId('raw-suggestion')).toBeInTheDocument()
  })

  it('places the order through the venue trader when Place is clicked', async () => {
    const onPlace = vi.fn<(request: PlaceOrderRequest) => void>()
    const trader = makeFakeTrader({ onPlace })
    renderSheet({
      trader,
      defaultTarget: { suggestion: makeStoredSuggestion(), readOnly: false },
    })
    const user = userEvent.setup()
    await user.click(screen.getByTestId('preview-place-order'))
    expect(onPlace).toHaveBeenCalledTimes(1)
  })

  it('shows an error callout when a place fails', async () => {
    const trader = makeFakeTrader({ placeError: makePlaceError('rejected', 'Venue said no') })
    renderSheet({
      trader,
      defaultTarget: { suggestion: makeStoredSuggestion(), readOnly: false },
    })
    const user = userEvent.setup()
    await user.click(screen.getByTestId('preview-place-order'))

    await waitFor(() => expect(screen.getByText('Order failed')).toBeInTheDocument())
    expect(screen.getByText('Venue said no')).toBeInTheDocument()
  })

  it('surfaces a field-tagged issue inline under its leg', () => {
    renderSheet({
      trader: makeFakeTrader({ issues: [{ field: 'size', message: 'Only $3 available now' }] }),
      defaultTarget: { suggestion: makeStoredSuggestion(), readOnly: false },
    })
    const marginIssue = screen.getByTestId('leg-margin-issue')
    expect(within(marginIssue).getByText('Only $3 available now')).toBeInTheDocument()
  })
})
