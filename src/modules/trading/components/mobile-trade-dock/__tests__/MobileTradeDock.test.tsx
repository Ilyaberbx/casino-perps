import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MobileTradeDock } from '../MobileTradeDock'

// MobileTradeDock is retired by the casino re-skin (PRD 0008 §6, D8): the app
// shell owns the global mobile tab bar now, so this component renders nothing.
describe('MobileTradeDock', () => {
  it('renders nothing — the shell owns the mobile tab bar', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/my-bets']}>
        <MobileTradeDock />
      </MemoryRouter>,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
