import { describe, expect, it, vi, beforeEach } from 'vitest'
import { okAsync } from 'neverthrow'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VenueOnboardingSheet } from '../VenueOnboardingSheet'
import {
  buildFakeActions,
  buildFakeVenueOnboarding,
  wrapWithOnboarding,
} from '../__fixtures__/fake-venue-onboarding'
import type {
  VenueOnboardingErrorCta,
  VenueOnboardingStep,
  VenueOnboardingStepStatus,
} from '../../../domain'

// Install the same minimal HTMLDialogElement polyfill the Sheet primitive
// uses — jsdom 29 does not implement showModal/close/Escape semantics.
type DialogProto = HTMLDialogElement & {
  show(): void
  showModal(): void
  close(): void
  open: boolean
}
function installDialogPolyfill(): void {
  const proto = HTMLDialogElement.prototype as DialogProto
  const marker = proto.show as unknown as { __polyfilled?: boolean } | undefined
  if (marker && marker.__polyfilled) return
  const open = function open(this: HTMLDialogElement): void {
    this.setAttribute('open', '')
    Object.defineProperty(this, 'open', { configurable: true, value: true })
  }
  ;(open as unknown as { __polyfilled: boolean }).__polyfilled = true
  proto.show = open
  proto.showModal = open
  proto.close = function close(this: HTMLDialogElement): void {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    Object.defineProperty(this, 'open', { configurable: true, value: false })
    this.dispatchEvent(new Event('close'))
  }
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    const openDialog = document.querySelector('dialog[open]')
    if (!(openDialog instanceof HTMLDialogElement)) return
    const cancel = new Event('cancel', { cancelable: true })
    const notPrevented = openDialog.dispatchEvent(cancel)
    if (notPrevented) openDialog.close()
  })
}

beforeEach(() => {
  installDialogPolyfill()
  document.body.innerHTML = ''
  const root = document.createElement('div')
  root.id = 'root'
  document.body.appendChild(root)
})

function renderInRoot(ui: React.ReactElement, wrapper: React.ComponentType<{ children: React.ReactNode }>) {
  const root = document.getElementById('root') as HTMLElement
  return render(ui, { container: root, wrapper })
}

function makeStep(
  id: string,
  status: VenueOnboardingStepStatus,
  overrides: Partial<VenueOnboardingStep> = {},
): VenueOnboardingStep {
  return {
    id,
    label: overrides.label ?? `Step ${id}`,
    description: overrides.description ?? `Description for ${id}`,
    status,
    inputs: overrides.inputs,
    capability: overrides.capability,
  }
}

function errorStatus(
  cta: VenueOnboardingErrorCta,
  overrides: Partial<{ headline: string; copy: string; reason: string; causeChain: string }> = {},
): VenueOnboardingStepStatus {
  return {
    kind: 'error',
    reason: overrides.reason ?? 'failed',
    headline: overrides.headline ?? 'Something went wrong',
    copy: overrides.copy ?? 'Try again or contact support.',
    cta,
    causeChain: overrides.causeChain,
  }
}

describe('VenueOnboardingSheet — base rendering', () => {
  it('renders the venue label headline and step list', () => {
    const onboarding = buildFakeVenueOnboarding({
      venueLabel: 'Hyperliquid',
      steps: [
        makeStep('agent', 'complete', { label: 'Agent wallet' }),
        makeStep('builder', 'pending', { label: 'Builder fee' }),
      ],
    })
    renderInRoot(
      <VenueOnboardingSheet isOpen onClose={() => {}} actions={buildFakeActions()} />,
      wrapWithOnboarding({ onboarding }),
    )
    expect(
      screen.getByText(/To start trading on Hyperliquid, you'll sign 2 requests/i),
    ).toBeInTheDocument()
    expect(screen.getByText('Agent wallet')).toBeInTheDocument()
    expect(screen.getByText('Builder fee')).toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onboarding = buildFakeVenueOnboarding()
    renderInRoot(
      <VenueOnboardingSheet isOpen onClose={onClose} actions={buildFakeActions()} />,
      wrapWithOnboarding({ onboarding }),
    )
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when Escape is pressed mid-running', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onboarding = buildFakeVenueOnboarding({
      steps: [makeStep('agent', 'running')],
    })
    renderInRoot(
      <VenueOnboardingSheet isOpen onClose={onClose} actions={buildFakeActions()} />,
      wrapWithOnboarding({ onboarding }),
    )
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('calls runAll when the primary button is clicked', async () => {
    const user = userEvent.setup()
    const runAll = vi.fn(() => okAsync<void, never>(undefined))
    const onboarding = buildFakeVenueOnboarding({
      steps: [makeStep('agent', 'pending')],
      runAll,
    })
    renderInRoot(
      <VenueOnboardingSheet isOpen onClose={() => {}} actions={buildFakeActions()} />,
      wrapWithOnboarding({ onboarding }),
    )
    await user.click(screen.getByRole('button', { name: /start setup/i }))
    expect(runAll).toHaveBeenCalled()
  })

  it('disables the primary button while a step is running', () => {
    const onboarding = buildFakeVenueOnboarding({
      steps: [makeStep('agent', 'running')],
    })
    renderInRoot(
      <VenueOnboardingSheet isOpen onClose={() => {}} actions={buildFakeActions()} />,
      wrapWithOnboarding({ onboarding }),
    )
    expect(screen.getByRole('button', { name: /signing/i })).toBeDisabled()
  })
})

describe('VenueOnboardingSheet — step icons', () => {
  it('renders all four step icon states', () => {
    const onboarding = buildFakeVenueOnboarding({
      steps: [
        makeStep('a', 'pending'),
        makeStep('b', 'running'),
        makeStep('c', 'complete'),
        makeStep('d', errorStatus({ kind: 'retry' })),
      ],
    })
    renderInRoot(
      <VenueOnboardingSheet isOpen onClose={() => {}} actions={buildFakeActions()} />,
      wrapWithOnboarding({ onboarding }),
    )
    expect(screen.getByTestId('step-icon-pending')).toBeInTheDocument()
    expect(screen.getByTestId('step-icon-running')).toBeInTheDocument()
    expect(screen.getByTestId('step-icon-complete')).toBeInTheDocument()
    expect(screen.getByTestId('step-icon-error')).toBeInTheDocument()
  })
})

describe('VenueOnboardingSheet — error CTAs', () => {
  it('renders Try again for retry CTA and re-fires retryStep', async () => {
    const user = userEvent.setup()
    const retryStep = vi.fn(() => okAsync<void, never>(undefined))
    const onboarding = buildFakeVenueOnboarding({
      steps: [makeStep('agent', errorStatus({ kind: 'retry' }))],
      retryStep,
    })
    renderInRoot(
      <VenueOnboardingSheet isOpen onClose={() => {}} actions={buildFakeActions()} />,
      wrapWithOnboarding({ onboarding }),
    )
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retryStep).toHaveBeenCalledWith('agent', expect.any(Object))
  })

  it('renders the venue-supplied label on a labelled retry CTA (ADR-0036 D-5)', async () => {
    const user = userEvent.setup()
    const retryStep = vi.fn(() => okAsync<void, never>(undefined))
    const onboarding = buildFakeVenueOnboarding({
      steps: [makeStep('agent', errorStatus({ kind: 'retry', label: 'Replace agent' }))],
      retryStep,
    })
    renderInRoot(
      <VenueOnboardingSheet isOpen onClose={() => {}} actions={buildFakeActions()} />,
      wrapWithOnboarding({ onboarding }),
    )
    await user.click(screen.getByRole('button', { name: 'Replace agent' }))
    expect(retryStep).toHaveBeenCalledWith('agent', expect.any(Object))
  })

  it('renders an external link CTA with venue-supplied label and noopener', () => {
    const onboarding = buildFakeVenueOnboarding({
      steps: [
        makeStep(
          'agent',
          errorStatus({
            kind: 'external-link',
            href: 'https://hyperliquid.xyz/docs',
            label: 'Open docs',
          }),
        ),
      ],
    })
    renderInRoot(
      <VenueOnboardingSheet isOpen onClose={() => {}} actions={buildFakeActions()} />,
      wrapWithOnboarding({ onboarding }),
    )
    const link = screen.getByRole('link', { name: 'Open docs' })
    expect(link).toHaveAttribute('href', 'https://hyperliquid.xyz/docs')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toMatch(/noopener/)
  })

  it('renders Switch to {chainName} CTA and calls switchChain then retry', async () => {
    const user = userEvent.setup()
    const switchChain = vi.fn(() => Promise.resolve())
    const retryStep = vi.fn(() => okAsync<void, never>(undefined))
    const onboarding = buildFakeVenueOnboarding({
      steps: [
        makeStep(
          'agent',
          errorStatus({
            kind: 'switch-network',
            targetChainId: 999,
            chainName: 'Arbitrum',
          }),
        ),
      ],
      retryStep,
    })
    renderInRoot(
      <VenueOnboardingSheet
        isOpen
        onClose={() => {}}
        actions={buildFakeActions({ switchChain })}
      />,
      wrapWithOnboarding({ onboarding }),
    )
    await user.click(screen.getByRole('button', { name: 'Switch to Arbitrum' }))
    expect(switchChain).toHaveBeenCalledWith(999)
    // Wait a microtask for the chained promise + retry.
    await Promise.resolve()
    expect(retryStep).toHaveBeenCalledWith('agent', expect.any(Object))
  })

  it('renders Reconnect wallet CTA and invokes reconnectWallet', async () => {
    const user = userEvent.setup()
    const reconnectWallet = vi.fn()
    const onboarding = buildFakeVenueOnboarding({
      steps: [makeStep('agent', errorStatus({ kind: 'reconnect-wallet' }))],
    })
    renderInRoot(
      <VenueOnboardingSheet
        isOpen
        onClose={() => {}}
        actions={buildFakeActions({ reconnectWallet })}
      />,
      wrapWithOnboarding({ onboarding }),
    )
    await user.click(screen.getByRole('button', { name: 'Reconnect wallet' }))
    expect(reconnectWallet).toHaveBeenCalled()
  })

  it('renders the open-deposit CTA with the venue label and invokes openDeposit', async () => {
    const user = userEvent.setup()
    const openDeposit = vi.fn()
    const onboarding = buildFakeVenueOnboarding({
      steps: [makeStep('deposit', errorStatus({ kind: 'open-deposit', label: 'Deposit funds' }))],
    })
    renderInRoot(
      <VenueOnboardingSheet
        isOpen
        onClose={() => {}}
        actions={buildFakeActions({ openDeposit })}
      />,
      wrapWithOnboarding({ onboarding }),
    )
    await user.click(screen.getByRole('button', { name: 'Deposit funds' }))
    expect(openDeposit).toHaveBeenCalled()
  })

  it('renders the venue-supplied reset-local-state label and asks for confirmation', async () => {
    const user = userEvent.setup()
    const retryStep = vi.fn(() => okAsync<void, never>(undefined))
    const confirmReset = vi.fn(() => true)
    const onboarding = buildFakeVenueOnboarding({
      steps: [
        makeStep(
          'agent',
          errorStatus({
            kind: 'reset-local-state',
            confirmCopy: 'Wipe agent and retry',
          }),
        ),
      ],
      retryStep,
    })
    renderInRoot(
      <VenueOnboardingSheet
        isOpen
        onClose={() => {}}
        actions={buildFakeActions({ confirmReset })}
      />,
      wrapWithOnboarding({ onboarding }),
    )
    await user.click(screen.getByRole('button', { name: 'Wipe agent and retry' }))
    expect(confirmReset).toHaveBeenCalledWith('Wipe agent and retry')
    await Promise.resolve()
    expect(retryStep).toHaveBeenCalledWith('agent', expect.any(Object))
  })

  it('renders Reload page CTA and invokes reload', async () => {
    const user = userEvent.setup()
    const reload = vi.fn()
    const onboarding = buildFakeVenueOnboarding({
      steps: [makeStep('agent', errorStatus({ kind: 'reload-page' }))],
    })
    renderInRoot(
      <VenueOnboardingSheet
        isOpen
        onClose={() => {}}
        actions={buildFakeActions({ reload })}
      />,
      wrapWithOnboarding({ onboarding }),
    )
    await user.click(screen.getByRole('button', { name: 'Reload page' }))
    expect(reload).toHaveBeenCalled()
  })

  it('renders Show details disclosure with the scrubbed causeChain', () => {
    const onboarding = buildFakeVenueOnboarding({
      steps: [
        makeStep(
          'agent',
          errorStatus(
            { kind: 'retry' },
            { causeChain: 'Error: foo\n  at boundary' },
          ),
        ),
      ],
    })
    renderInRoot(
      <VenueOnboardingSheet isOpen onClose={() => {}} actions={buildFakeActions()} />,
      wrapWithOnboarding({ onboarding }),
    )
    expect(screen.getByText(/Show details/i)).toBeInTheDocument()
    expect(screen.getByText(/Error: foo/)).toBeInTheDocument()
  })
})

describe('VenueOnboardingSheet — migration notice', () => {
  it('does not render when showMigrationNotice is false', () => {
    const onboarding = buildFakeVenueOnboarding()
    renderInRoot(
      <VenueOnboardingSheet
        isOpen
        onClose={() => {}}
        actions={buildFakeActions()}
        showMigrationNotice={false}
      />,
      wrapWithOnboarding({ onboarding }),
    )
    expect(screen.queryByTestId('migration-notice')).not.toBeInTheDocument()
  })

  it('renders and dispatches dismiss when flag is set', async () => {
    const user = userEvent.setup()
    const onDismissMigrationNotice = vi.fn()
    const onboarding = buildFakeVenueOnboarding()
    renderInRoot(
      <VenueOnboardingSheet
        isOpen
        onClose={() => {}}
        actions={buildFakeActions()}
        showMigrationNotice
        onDismissMigrationNotice={onDismissMigrationNotice}
      />,
      wrapWithOnboarding({ onboarding }),
    )
    expect(screen.getByTestId('migration-notice')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /dismiss migration notice/i }))
    expect(onDismissMigrationNotice).toHaveBeenCalled()
  })
})

describe('VenueOnboardingSheet — input form', () => {
  it('renders text input, select, and checkbox fields, reporting values via onValueChange', async () => {
    const user = userEvent.setup()
    const onboarding = buildFakeVenueOnboarding({
      steps: [
        makeStep('agent', 'pending', {
          inputs: [
            {
              kind: 'text',
              id: 'agentName',
              label: 'Agent label',
              minLength: 1,
              maxLength: 16,
              defaultValue: 'default',
            },
            {
              kind: 'select',
              id: 'network',
              label: 'Network',
              options: [
                { value: 'mainnet', label: 'Mainnet' },
                { value: 'testnet', label: 'Testnet' },
              ],
            },
            {
              kind: 'checkbox',
              id: 'tos',
              label: 'I accept the ToS',
              required: true,
            },
          ],
        }),
      ],
    })
    renderInRoot(
      <VenueOnboardingSheet isOpen onClose={() => {}} actions={buildFakeActions()} />,
      wrapWithOnboarding({ onboarding }),
    )
    const textInput = screen.getByLabelText('Agent label') as HTMLInputElement
    expect(textInput.value).toBe('default')
    await user.clear(textInput)
    await user.type(textInput, 'alpha')
    expect(textInput.value).toBe('alpha')

    const select = screen.getByLabelText('Network') as HTMLSelectElement
    await user.selectOptions(select, 'testnet')
    expect(select.value).toBe('testnet')

    const checkbox = screen.getByLabelText('I accept the ToS') as HTMLInputElement
    await user.click(checkbox)
    expect(checkbox.checked).toBe(true)
  })
})
