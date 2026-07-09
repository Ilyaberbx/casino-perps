import type { HandleAvailability } from './onboarding-stepper.types'

/** Inline availability indicator copy for the Handle step (PRD-0006 UI-1). */
export function availabilityLabel(availability: HandleAvailability): string | null {
  if (availability === 'checking') return 'Checking…'
  if (availability === 'available') return '✓ Available'
  if (availability === 'taken') return '✗ Taken'
  return null
}
