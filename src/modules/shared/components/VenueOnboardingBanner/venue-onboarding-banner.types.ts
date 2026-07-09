export interface VenueOnboardingBannerProps {
  /**
   * Whether the user has a connected wallet. Banner stays hidden when
   * disconnected — the shared module cannot reach `useIsWalletConnected`
   * (lives in `account/`), so we accept it as a prop and the consumer wires
   * it from `account/`.
   */
  readonly isWalletConnected: boolean
}

interface HiddenState {
  readonly kind: 'hidden'
}

interface IncompleteState {
  readonly kind: 'incomplete'
  readonly message: string
  readonly ctaLabel: string
  readonly onClick: () => void
  readonly onDismiss: () => void
}

interface InFlightState {
  readonly kind: 'in-flight'
  readonly message: string
  readonly onClick: () => void
  readonly onDismiss: () => void
}

export type VenueOnboardingBannerState =
  | HiddenState
  | IncompleteState
  | InFlightState
