/**
 * The shared phase-transition arms for the fund-movement flow family
 * (`send` / `withdraw` / `evm-core`). Every one of these flows preserves its
 * always-present form fields across every transition by re-threading a
 * `carried` object, and the `review → form → signing → error/sent` transitions
 * are byte-identical: each is `{ ...carried, phase, …extra }`. This factory
 * holds those transitions in one place, parameterised only by the `carried`
 * value and the per-flow error/sent payloads.
 *
 * The factory is intentionally NOT a whole reducer: the flow-specific arms
 * (`TOKEN_SELECTED`, `AMOUNT_CHANGED`, `DIRECTION_CHANGED`, `RESET`, …) differ
 * per flow and stay local, where their exhaustiveness check still proves the
 * switch covers every action. Each flow's reducer delegates only the shared
 * arms here.
 */

/** The flows that share these transitions all end the happy path on `sent`. */
type SharedPhase = 'review' | 'form' | 'signing' | 'sent' | 'error'

/**
 * Build the shared phase-transition arms over a `carried` base. `TCarried` is
 * the flow's always-present form fields (re-threaded on every transition).
 * `TReason` is the flow's typed error reason. `TSentExtra` is any extra payload
 * the `sent` state carries (e.g. evm-core's `transactionHash`); defaults to an
 * empty object for flows whose `sent` carries nothing.
 */
export function createFlowTransitions<TCarried, TReason, TSentExtra extends object = object>(
  carried: TCarried,
) {
  return {
    /** `REVIEWED`: advance to the review confirmation. */
    reviewed(): TCarried & { readonly phase: 'review' } {
      return { ...carried, phase: 'review' }
    },
    /** `BACK` / `RETRY`: return to the form with input preserved. */
    toForm(): TCarried & { readonly phase: 'form' } {
      return { ...carried, phase: 'form' }
    },
    /** `SUBMITTED`: enter the signing state. */
    signing(): TCarried & { readonly phase: 'signing' } {
      return { ...carried, phase: 'signing' }
    },
    /** `FAILED`: land on the non-terminal error, carrying the typed reason. */
    failed(reason: TReason): TCarried & { readonly phase: 'error'; readonly errorReason: TReason } {
      return { ...carried, phase: 'error', errorReason: reason }
    },
    /** `SENT`: land on the confirmation, folding in any flow-specific extra. */
    sent(extra: TSentExtra): TCarried & { readonly phase: 'sent' } & TSentExtra {
      return { ...carried, phase: 'sent', ...extra }
    },
  }
}

/** Surface the phase union so flow types can reference the shared set. */
export type SharedFlowPhase = SharedPhase
