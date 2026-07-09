import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { AccentColorPicker } from '../AccentColorPicker'
import { ACCENT_COLORS } from '../../../providers/theme-provider/theme-provider.constants'

describe('AccentColorPicker', () => {
  it('renders a swatch button for every predefined color', () => {
    render(<AccentColorPicker colors={ACCENT_COLORS} selectedColorId="cyan" onSelect={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(ACCENT_COLORS.length)
  })

  it('marks the selected color via aria-pressed', () => {
    render(<AccentColorPicker colors={ACCENT_COLORS} selectedColorId="mint" onSelect={vi.fn()} />)
    expect(screen.getByTestId('accent-color-mint')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('accent-color-cyan')).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onSelect with the clicked color id', async () => {
    const onSelect = vi.fn()
    render(<AccentColorPicker colors={ACCENT_COLORS} selectedColorId="cyan" onSelect={onSelect} />)
    await userEvent.click(screen.getByTestId('accent-color-coral'))
    expect(onSelect).toHaveBeenCalledWith('coral')
  })
})
