import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { Popover } from '../Popover'

function Harness() {
  const anchorRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  return (
    <div data-testid="local-subtree">
      <button ref={anchorRef}>anchor</button>
      <Popover anchorRef={anchorRef} panelRef={panelRef} placement="bottom-end">
        <div ref={panelRef} data-testid="panel">
          panel content
        </div>
      </Popover>
    </div>
  )
}

describe('Popover', () => {
  it('portals its children to document.body, out of the local subtree', () => {
    render(<Harness />)
    const panel = screen.getByTestId('panel')
    expect(panel).toBeInTheDocument()
    // Escapes the rendering subtree — its parent is the portal host, not the
    // local container that would clip it.
    expect(panel.parentElement).toBe(document.body)
    expect(screen.getByTestId('local-subtree')).not.toContainElement(panel)
  })

  it('fixes the panel in the viewport so ancestor overflow cannot clip it', () => {
    render(<Harness />)
    const panel = screen.getByTestId('panel')
    expect(panel.style.position).toBe('fixed')
    expect(panel.style.top).not.toBe('')
    expect(panel.style.left).not.toBe('')
  })
})
