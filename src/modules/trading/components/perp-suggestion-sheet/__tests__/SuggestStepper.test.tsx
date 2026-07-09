import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SuggestStepper } from '../SuggestStepper'
import { makeSuggestSteps } from '../__fixtures__/suggestions'
import { STEPPER_HINT_TITLE } from '../perp-suggestion-sheet.constants'

describe('SuggestStepper', () => {
  it('renders a single progressbar for the flow', () => {
    render(<SuggestStepper steps={makeSuggestSteps('dex')} />)
    const bar = screen.getByTestId('suggest-stepper')
    expect(bar).toHaveAttribute('role', 'progressbar')
    expect(bar).toHaveAttribute('aria-valuemax', '6')
  })

  it('shows the current step label and an N/total counter', () => {
    render(<SuggestStepper steps={makeSuggestSteps('params')} />)
    expect(screen.getByTestId('progress-label')).toHaveTextContent('Params')
    expect(screen.getByTestId('progress-count')).toHaveTextContent('3/6')
  })

  it('reflects completed steps in aria-valuenow', () => {
    // dex is current at the start → nothing complete yet.
    render(<SuggestStepper steps={makeSuggestSteps('dex')} />)
    expect(screen.getByTestId('suggest-stepper')).toHaveAttribute('aria-valuenow', '0')
  })

  it('advances the counter and fill as the flow progresses', () => {
    render(<SuggestStepper steps={makeSuggestSteps('preview')} />)
    expect(screen.getByTestId('progress-label')).toHaveTextContent('Preview')
    expect(screen.getByTestId('progress-count')).toHaveTextContent('6/6')
    expect(screen.getByTestId('suggest-stepper')).toHaveAttribute('aria-valuenow', '5')
  })

  it('renders nothing when there are no steps', () => {
    const { container } = render(<SuggestStepper steps={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  describe('hover/focus hint (Item 1)', () => {
    it('hides the step breakdown by default', () => {
      render(<SuggestStepper steps={makeSuggestSteps('params')} />)
      expect(screen.queryByTestId('stepper-hint')).not.toBeInTheDocument()
    })

    it('reveals the six-step breakdown on hover and hides it on unhover', async () => {
      const user = userEvent.setup()
      render(<SuggestStepper steps={makeSuggestSteps('params')} />)
      const bar = screen.getByTestId('suggest-stepper')

      await user.hover(bar)
      const hint = screen.getByTestId('stepper-hint')
      expect(hint).toHaveTextContent(STEPPER_HINT_TITLE)
      // All six step labels are listed in the breakdown.
      for (const label of ['DEX', 'Token', 'Params', 'Estimate', 'Execute', 'Preview']) {
        expect(hint).toHaveTextContent(label)
      }

      await user.unhover(bar)
      expect(screen.queryByTestId('stepper-hint')).not.toBeInTheDocument()
    })

    it('marks each step row with its status word and data-status', async () => {
      const user = userEvent.setup()
      render(<SuggestStepper steps={makeSuggestSteps('params')} />)
      await user.hover(screen.getByTestId('suggest-stepper'))

      const hint = screen.getByTestId('stepper-hint')
      // params is current → dex/token done, params now, the rest next.
      const rows = hint.querySelectorAll('[data-status]')
      const statuses = Array.from(rows).map((row) => row.getAttribute('data-status'))
      expect(statuses).toEqual([
        'complete',
        'complete',
        'current',
        'upcoming',
        'upcoming',
        'upcoming',
      ])
      expect(hint).toHaveTextContent('now')
      expect(hint).toHaveTextContent('done')
      expect(hint).toHaveTextContent('next')
    })

    it('reveals the hint on keyboard focus (a11y parity with hover)', async () => {
      const user = userEvent.setup()
      render(<SuggestStepper steps={makeSuggestSteps('estimate')} />)
      await user.tab()
      expect(screen.getByTestId('suggest-stepper')).toHaveFocus()
      expect(screen.getByTestId('stepper-hint')).toBeInTheDocument()
    })
  })
})
