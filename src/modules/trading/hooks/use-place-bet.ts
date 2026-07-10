import { useCallback, useState } from 'react'
import { useCapability } from '@/modules/shared/providers/venue-provider'
import { useVenueOnboarding } from '@/modules/shared/providers/venue-onboarding-provider'
import { toast } from '@/modules/shared/services/toast'
import { generateCloid } from '@/modules/shared/utils/generate-cloid'
import type { OrderDraft, PlaceOrderRequest } from '@/modules/shared/domain'
import { ORDER_CLOID_PREFIX } from '../components/order-entry/order-entry.constants'
import { defaultOnboardingValues } from './casino-trade.utils'
import type { PlaceBetPhase } from './casino-trade.types'

export interface PlaceBetArgs {
  /** The venue-agnostic bet draft (coin-unit market IOC). */
  readonly draft: OrderDraft
  /** Casino-flavoured toast copy, e.g. `$50 on BTC UP`. */
  readonly label: string
  /** Runs after a successful placement (close the sheet, clear the ticket). */
  readonly onPlaced: () => void
}

export interface UsePlaceBetReturn {
  readonly phase: PlaceBetPhase
  readonly isSettingUp: boolean
  readonly isPlacing: boolean
  place(args: PlaceBetArgs): void
}

/**
 * The place-bet action (D6/D17). A market IOC is submitted through the venue's
 * `Trader` port. When the venue still needs onboarding — the hidden HL agent
 * approve-and-register — this runs it FIRST behind a "Setting up your table…"
 * phase (no modal, no "agent wallet" copy), driving the shared
 * `useVenueOnboarding().runAll` with the steps' own defaults, then places the
 * order. The agent-wallet provider mints a fresh keypair per approval (HL
 * anti-replay, ADR-0077), so the silent path is safe to re-run.
 */
export function usePlaceBet(): UsePlaceBetReturn {
  const trader = useCapability('trader')
  const onboarding = useVenueOnboarding()
  const [phase, setPhase] = useState<PlaceBetPhase>('idle')

  const place = useCallback(
    ({ draft, label, onPlaced }: PlaceBetArgs) => {
      const isBusy = phase !== 'idle'
      if (isBusy) return

      const validation = trader.validateDraft(draft)
      if (validation.isErr()) {
        const firstIssue = validation.error[0]?.message ?? 'This bet is not valid'
        toast.show({ variant: 'error', title: 'Bet failed', description: firstIssue })
        return
      }
      const request: PlaceOrderRequest = {
        ...validation.value,
        clientOrderId: generateCloid(ORDER_CLOID_PREFIX),
      }

      const submit = (): void => {
        setPhase('placing')
        trader.placeOrder(request).match(
          () => {
            setPhase('idle')
            toast.show({ variant: 'success', title: 'Bet placed', description: label })
            onPlaced()
          },
          (error) => {
            setPhase('idle')
            toast.show({ variant: 'error', title: 'Bet failed', description: error.message })
          },
        )
      }

      const needsSetup = onboarding !== null && onboarding.status !== 'ready'
      if (!needsSetup) {
        submit()
        return
      }

      setPhase('setting-up')
      onboarding.runAll(defaultOnboardingValues(onboarding.steps)).match(
        () => submit(),
        (error) => {
          setPhase('idle')
          toast.show({
            variant: 'error',
            title: 'Could not set up your table',
            description: error.message,
          })
        },
      )
    },
    [phase, trader, onboarding],
  )

  return { phase, isSettingUp: phase === 'setting-up', isPlacing: phase === 'placing', place }
}
