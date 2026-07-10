import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PersonalizeStep } from '../PersonalizeStep'
import type { PersonalizeStepView } from '../onboarding-stepper.types'

function buildView(overrides: Partial<PersonalizeStepView> = {}): PersonalizeStepView {
  return {
    kind: 'personalize',
    theme: 'dark',
    onSelectTheme: vi.fn(),
    onDone: vi.fn(),
    ...overrides,
  }
}

describe('<PersonalizeStep />', () => {
  it('marks the current theme segment as pressed', () => {
    render(<PersonalizeStep view={buildView({ theme: 'white' })} />)
    expect(screen.getByRole('button', { name: /light/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('selecting the other theme calls onSelectTheme', async () => {
    const user = userEvent.setup()
    const onSelectTheme = vi.fn()
    render(<PersonalizeStep view={buildView({ theme: 'dark', onSelectTheme })} />)
    await user.click(screen.getByRole('button', { name: /light/i }))
    expect(onSelectTheme).toHaveBeenCalledWith('white')
  })

  it('Done calls onDone', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<PersonalizeStep view={buildView({ onDone })} />)
    await user.click(screen.getByRole('button', { name: /done/i }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
