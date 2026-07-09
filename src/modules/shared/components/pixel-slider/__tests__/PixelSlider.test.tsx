import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PixelSlider } from '../PixelSlider'

const BASE_PROPS = {
  value: 5,
  min: 0,
  max: 10,
  ariaLabel: 'Test slider',
  onChange: () => {},
}

describe('PixelSlider', () => {
  it('renders an accessible range input', () => {
    render(<PixelSlider {...BASE_PROPS} />)
    const slider = screen.getByRole('slider', { name: 'Test slider' })
    expect(slider).toHaveAttribute('type', 'range')
    expect(slider).toHaveValue('5')
  })

  it('reports the changed value on input', () => {
    const onChange = vi.fn()
    render(<PixelSlider {...BASE_PROPS} onChange={onChange} />)
    const slider = screen.getByRole('slider', { name: 'Test slider' })
    setRangeValue(slider, 8)
    expect(onChange).toHaveBeenCalledWith(8)
  })

  it('fires onCommit on pointer release (commit-on-release)', () => {
    const onCommit = vi.fn()
    render(<PixelSlider {...BASE_PROPS} onCommit={onCommit} />)
    const slider = screen.getByRole('slider', { name: 'Test slider' })
    slider.dispatchEvent(new Event('pointerup', { bubbles: true }))
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('disables the input when disabled', () => {
    render(<PixelSlider {...BASE_PROPS} disabled />)
    expect(screen.getByRole('slider', { name: 'Test slider' })).toBeDisabled()
  })

  it('writes the runtime fill custom property from the value', () => {
    const { container } = render(<PixelSlider {...BASE_PROPS} value={5} min={0} max={10} />)
    const track = container.querySelector('[style*="--pixel-slider-fill"]')
    expect(track).not.toBeNull()
    expect(track?.getAttribute('style')).toContain('--pixel-slider-fill: 50%')
  })
})

function setRangeValue(slider: HTMLElement, value: number): void {
  const input = slider as HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, String(value))
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
