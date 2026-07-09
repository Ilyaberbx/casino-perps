import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RawSuggestionView } from '../RawSuggestionView'
import { makeRawSuggestion } from '../__fixtures__/suggestion-preview'
import { NO_LEVEL_PLACEHOLDER } from '../suggestion-preview.constants'

describe('RawSuggestionView', () => {
  it('renders the agent badge', () => {
    render(<RawSuggestionView raw={makeRawSuggestion()} agentId="minara" symbol="BTC" />)
    expect(screen.getByText('minara')).toBeInTheDocument()
  })

  it('renders the market icon and symbol', () => {
    render(<RawSuggestionView raw={makeRawSuggestion()} agentId="minara" symbol="ETH" />)
    expect(screen.getByText('ETH')).toBeInTheDocument()
    // AssetIcon labels its img / placeholder with the base asset.
    expect(screen.getByAltText('ETH')).toBeInTheDocument()
  })

  it('renders a long side as LONG', () => {
    render(<RawSuggestionView raw={makeRawSuggestion({ side: 'long' })} agentId="minara" symbol="BTC" />)
    expect(screen.getByText('LONG')).toBeInTheDocument()
  })

  it('renders a short side as SHORT', () => {
    render(<RawSuggestionView raw={makeRawSuggestion({ side: 'short' })} agentId="minara" symbol="BTC" />)
    expect(screen.getByText('SHORT')).toBeInTheDocument()
  })

  it('renders the confidence value as a percentage', () => {
    render(<RawSuggestionView raw={makeRawSuggestion({ confidence: 72 })} agentId="minara" symbol="BTC" />)
    expect(screen.getByText('72%')).toBeInTheDocument()
  })

  it('exposes the confidence as a meter with aria-valuenow', () => {
    render(<RawSuggestionView raw={makeRawSuggestion({ confidence: 72 })} agentId="minara" symbol="BTC" />)
    const meter = screen.getByRole('meter', { name: 'Confidence' })
    expect(meter).toHaveAttribute('aria-valuenow', '72')
    expect(meter).toHaveAttribute('aria-valuemin', '0')
    expect(meter).toHaveAttribute('aria-valuemax', '100')
  })

  it('renders the entry, stop-loss and take-profit levels', () => {
    const raw = makeRawSuggestion({
      entryPrice: 60000,
      stopLossPrice: 58000,
      takeProfitPrice: 65000,
    })
    render(<RawSuggestionView raw={raw} agentId="minara" symbol="BTC" />)
    expect(screen.getByText('Entry')).toBeInTheDocument()
    expect(screen.getByText('60000')).toBeInTheDocument()
    expect(screen.getByText('Stop loss')).toBeInTheDocument()
    expect(screen.getByText('58000')).toBeInTheDocument()
    expect(screen.getByText('Take profit')).toBeInTheDocument()
    expect(screen.getByText('65000')).toBeInTheDocument()
  })

  it('renders the no-level placeholder for a neutral suggestion with null SL/TP', () => {
    const raw = makeRawSuggestion({
      side: 'neutral',
      entryPrice: 60000,
      stopLossPrice: null,
      takeProfitPrice: null,
    })
    render(<RawSuggestionView raw={raw} agentId="minara" symbol="BTC" />)
    expect(screen.getByText('NEUTRAL')).toBeInTheDocument()
    expect(screen.getByText('60000')).toBeInTheDocument()
    // Both missing exit levels show the placeholder, never a phantom "0".
    expect(screen.getAllByText(NO_LEVEL_PLACEHOLDER)).toHaveLength(2)
  })

  it('renders each reason and risk note', () => {
    const raw = makeRawSuggestion({
      reasons: ['Momentum is positive', 'Funding favours longs'],
      risks: ['Macro print on Friday'],
    })
    render(<RawSuggestionView raw={raw} agentId="minara" symbol="BTC" />)
    expect(screen.getByText('Reasons')).toBeInTheDocument()
    expect(screen.getByText('Momentum is positive')).toBeInTheDocument()
    expect(screen.getByText('Funding favours longs')).toBeInTheDocument()
    expect(screen.getByText('Risks')).toBeInTheDocument()
    expect(screen.getByText('Macro print on Friday')).toBeInTheDocument()
  })

  it('renders no Reasons section when reasons is empty', () => {
    render(<RawSuggestionView raw={makeRawSuggestion({ reasons: [] })} agentId="minara" symbol="BTC" />)
    expect(screen.queryByText('Reasons')).not.toBeInTheDocument()
  })

  it('renders no Risks section when risks is empty', () => {
    render(<RawSuggestionView raw={makeRawSuggestion({ risks: [] })} agentId="minara" symbol="BTC" />)
    expect(screen.queryByText('Risks')).not.toBeInTheDocument()
  })

  it('clamps the meter fill but keeps aria-valuenow at the raw confidence', () => {
    render(<RawSuggestionView raw={makeRawSuggestion({ confidence: 130 })} agentId="minara" symbol="BTC" />)
    const meter = screen.getByRole('meter', { name: 'Confidence' })
    expect(meter).toHaveAttribute('aria-valuenow', '130')
  })
})
