import type { ResultAsync } from 'neverthrow'
import type { HttpError } from '@/modules/shared/http'
import type { AuthError, Me } from '../domain/types'

/**
 * Mutators for the canonical `me` cache, exposed on the `ready` variant so the
 * Account Modal's Wallets section can keep the single source of truth fresh
 * after a select/import/remove and on modal open (Workstream D — Selected-Wallet
 * server↔FE desync fix).
 *
 * - `applyMe` replaces the cached `me` with a server-returned payload (no
 *   network round-trip) — used after a mutation already returned a fresh `Me`.
 * - `refreshMe` re-GETs `/api/account/me` and applies the result — used on modal
 *   open to reconcile out-of-band changes (another device, a manual DB edit).
 *
 * Both are **optional** on the variant so existing `{ kind: 'ready', me }` test
 * literals stay valid; the production `useOwnOnboardingFlow` always supplies
 * them. Neither retriggers the initial one-shot resolve gate.
 */
export type ApplyMe = (me: Me) => void
export type RefreshMe = () => ResultAsync<Me, HttpError>

/**
 * Post-authentication onboarding FSM (PRD-0006 UI-1; mandatory-handle model,
 * ADR-0058). The pre-auth Email/OTP steps live in the connect-modal hook; this
 * machine owns the existence fork and the new-account Handle → 2FA steps.
 * The handle is collected BEFORE the account row exists — `submitHandle` IS the
 * account-creating `onboard` call, so no provisional/default handle is ever
 * persisted:
 *
 *   idle → resolving (getMe)
 *     ├─ getMe 200 (real handle)     → ready            (returning user)
 *     └─ getMe 404                   → needs-handle
 *           → submitHandle (POST onboard with the chosen handle)
 *                 → needs-mfa
 *                       → setupMfa | skipMfa → needs-personalize
 *                             → finishPersonalize → ready
 *
 * `needs-personalize` is the new-account-only "Personalize" step: client-only
 * appearance prefs (theme + trading layout) the user confirms before the modal
 * closes. Returning users (getMe 200 → ready) never enter it.
 *
 * `onboarding` is retained as a state for callers but is no longer entered —
 * the in-flight onboard call is reflected by the Handle step's own submitting
 * state, keeping the user on the Handle step until it resolves.
 */
export type OnboardingState =
  | { kind: 'idle' }
  | { kind: 'resolving' }
  | { kind: 'onboarding' }
  | {
      kind: 'needs-handle'
      submitHandle: (
        handle: string,
        inviteCode?: string,
      ) => ResultAsync<void, HttpError>
    }
  | {
      kind: 'needs-mfa'
      setupMfa: () => ResultAsync<void, AuthError>
      skipMfa: () => void
    }
  | { kind: 'needs-personalize'; finishPersonalize: () => void }
  | { kind: 'ready'; me: Me; applyMe?: ApplyMe; refreshMe?: RefreshMe }
  | { kind: 'error'; message: string }
