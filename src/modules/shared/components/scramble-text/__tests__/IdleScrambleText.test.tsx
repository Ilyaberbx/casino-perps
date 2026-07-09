import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IdleScrambleText } from '../IdleScrambleText'

describe('IdleScrambleText', () => {
  it('renders the resolved label at rest', () => {
    render(<IdleScrambleText runOnMount={false}>Portfolio</IdleScrambleText>)
    // Both the visible span and the visually-hidden accessible label carry the
    // resolved text when not mid-decode.
    expect(screen.getAllByText('Portfolio').length).toBeGreaterThanOrEqual(1)
  })

  it('registers the idle decode on the configured interval and clears it on unmount', () => {
    vi.useFakeTimers()
    const setSpy = vi.spyOn(window, 'setInterval')
    const clearSpy = vi.spyOn(window, 'clearInterval')
    try {
      const { unmount } = render(
        <IdleScrambleText runOnMount={false} intervalMs={15000}>
          Portfolio
        </IdleScrambleText>,
      )
      expect(setSpy).toHaveBeenCalledWith(expect.any(Function), 15000)
      unmount()
      expect(clearSpy).toHaveBeenCalled()
    } finally {
      setSpy.mockRestore()
      clearSpy.mockRestore()
      vi.useRealTimers()
    }
  })

  it('plays one decode on mount when runOnMount is set', () => {
    // Return a handle without invoking the callback so the decode does not recurse.
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1)
    try {
      render(<IdleScrambleText runOnMount>Portfolio</IdleScrambleText>)
      expect(rafSpy).toHaveBeenCalled()
    } finally {
      rafSpy.mockRestore()
    }
  })
})
