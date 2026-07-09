import type {
  VenueOnboardingErrorCta,
  VenueOnboardingStepErrorStatus,
} from '@/modules/shared/domain/venue-onboarding'
import type { AgentApprovalErrorReason } from '../agent-wallet-provider/agent-wallet-provider.types'
import type { BuilderFeeApprovalErrorReason } from '../builder-fee-provider/builder-fee-provider.types'
import type { DepositErrorReason } from '../deposit-provider/deposit-provider.types'

/**
 * Per-error CTA mapping (#166 / slice 6). Each reason in the agent + builder
 * approval-error unions maps to a `{ headline, copy, cta }` tuple consumed by
 * the generic onboarding sheet. Adding a new reason to either union is a
 * compile-error in the exhaustive switches below — TypeScript guards
 * completeness via the `never` arm, matching the file's promise as the single
 * edit point for widening.
 */

// Arbitrum is the signing chain for Hyperliquid user-signed actions. The user-
// facing copy interpolates the network name; chain ID drives `switch-network`
// CTAs handed off to the wallet shim. Slice 6 ships a static target — slice 7
// may thread the current/target pair dynamically (see issue body).
const HYPERLIQUID_SIGNING_CHAIN_NAME = 'Arbitrum One'
const HYPERLIQUID_SIGNING_CHAIN_ID = 42161

interface ErrorCopy {
  readonly headline: string
  readonly copy: string
  readonly cta: VenueOnboardingErrorCta
}

const RETRY_CTA: VenueOnboardingErrorCta = { kind: 'retry' }

// ADR-0036: every slot-conflict recovery is in-house — same-name re-approval
// replaces a stranded agent; a 0% re-approval frees a builder slot. No CTA in
// this file links to app.hyperliquid.xyz (D-5: the property is structural).
const REPLACE_AGENT_CTA: VenueOnboardingErrorCta = { kind: 'retry', label: 'Replace agent' }

const REPLACE_SELECTED_AGENT_CTA: VenueOnboardingErrorCta = {
  kind: 'retry',
  label: 'Replace selected agent',
}

const REVOKE_AND_APPROVE_CTA: VenueOnboardingErrorCta = {
  kind: 'retry',
  label: 'Revoke & approve',
}

const SWITCH_NETWORK_CTA: VenueOnboardingErrorCta = {
  kind: 'switch-network',
  targetChainId: HYPERLIQUID_SIGNING_CHAIN_ID,
  chainName: HYPERLIQUID_SIGNING_CHAIN_NAME,
}

// First-deposit affordance. Opens the in-app deposit sheet (shared
// `deposit-sheet-provider.open()`, threaded as the `openDeposit` host action)
// instead of handing the user off to app.hyperliquid.xyz. The milestone signal
// is unchanged — `queryHasEverFunded` still drives step completion (ADR-0027);
// only the affordance moved in-app (.design/hyperliquid-deposit/ Chunk 4).
const OPEN_DEPOSIT_CTA: VenueOnboardingErrorCta = {
  kind: 'open-deposit',
  label: 'Deposit funds',
}

const RECONNECT_WALLET_CTA: VenueOnboardingErrorCta = { kind: 'reconnect-wallet' }

const RESET_LOCAL_STATE_CTA: VenueOnboardingErrorCta = {
  kind: 'reset-local-state',
  confirmCopy: 'This will clear your local agent key. You will need to re-approve a new agent.',
}

const WALLET_REJECTED_COPY: ErrorCopy = {
  headline: 'Signature cancelled',
  copy: 'You cancelled the signature. Try again when you are ready.',
  cta: RETRY_CTA,
}

const CHAIN_MISMATCH_COPY: ErrorCopy = {
  headline: 'Wrong network',
  copy: `Switch your wallet to ${HYPERLIQUID_SIGNING_CHAIN_NAME} to sign this action.`,
  cta: SWITCH_NETWORK_CTA,
}

const BUILDER_NOT_FUNDED_COPY: ErrorCopy = {
  headline: 'Approval blocked on our side',
  copy: 'This is blocked on our side — the builder address is not yet funded. Try again shortly; if it persists, contact support.',
  cta: RETRY_CTA,
}

// User-action copy: the account has never been funded. The CTA opens the in-app
// deposit sheet (`open-deposit`) so the user funds without leaving the app.
// Distinct from BUILDER_NOT_FUNDED_COPY (which is an ops issue). Plan 04's
// mapDepositErrorReasonToStatus reuses this const directly. The first-deposit
// milestone signal is still `queryHasEverFunded` (ADR-0027 unchanged) — only the
// affordance changed from external-link to in-app deposit (Chunk 4).
const DEPOSIT_REQUIRED_COPY: ErrorCopy = {
  headline: 'Deposit funds to start trading',
  copy: 'You need to deposit funds to Hyperliquid before setting up trading. Deposit USDC right here, then continue.',
  cta: OPEN_DEPOSIT_CTA,
}

// ADR-0036 D-4: the builder revoke picker. The step attaches a select listing
// the user's active builder approvals (ours filtered out); the CTA chains two
// signatures — a 0% re-approval frees the chosen slot, then ours takes it.
const APPROVAL_CAP_REACHED_COPY: ErrorCopy = {
  headline: 'Builder approvals full',
  copy: 'You have reached Hyperliquid’s limit of 10 approved builders. Pick one below to revoke — you will sign twice: once to revoke it, once to approve ours.',
  cta: REVOKE_AND_APPROVE_CTA,
}

// ADR-0036 D-3: the agent victim picker. The step attaches a select listing the
// on-chain agents (name + expiry); approving under the chosen agent's exact
// name atomically replaces it — the app or bot that created it loses access.
const AGENT_SLOTS_FULL_COPY: ErrorCopy = {
  headline: 'Agent slots full',
  copy: 'All 3 of your Hyperliquid agent slots are in use. Pick one below to replace — the app or bot using it will lose its trading access.',
  cta: REPLACE_SELECTED_AGENT_CTA,
}

const NAME_COLLISION_COPY: ErrorCopy = {
  headline: 'Agent label already in use',
  copy: 'Pick a different label for this agent and try again.',
  cta: RETRY_CTA,
}

const RATE_LIMITED_COPY: ErrorCopy = {
  headline: 'Rate limited',
  copy: 'Hyperliquid is throttling requests. Wait a few seconds and try again.',
  cta: RETRY_CTA,
}

const SIGNING_UNAVAILABLE_COPY: ErrorCopy = {
  headline: 'Wallet not available',
  copy: 'Your wallet is not available to sign. Reconnect it and try again.',
  cta: RECONNECT_WALLET_CTA,
}

const CORRUPTED_KEY_COPY: ErrorCopy = {
  headline: 'Stored agent key is unreadable',
  copy: 'The agent key in your browser cannot be read. Reset it to continue.',
  cta: RESET_LOCAL_STATE_CTA,
}

const UNKNOWN_COPY: ErrorCopy = {
  headline: 'Approval failed',
  copy: 'Please try again. If this keeps happening, reload the page.',
  cta: RETRY_CTA,
}

// ADR-0077: Hyperliquid rejected a previously-used agent address (anti-replay).
// `approve()` now always mints a fresh key, so a labelled retry self-heals — no
// website round-trip, no reset. Should be unreachable post-fix; this keeps it
// recoverable rather than collapsing to the opaque UNKNOWN_COPY.
const AGENT_ADDRESS_REUSED_COPY: ErrorCopy = {
  headline: 'Agent key already used',
  copy: "This agent key was already used on Hyperliquid. We'll generate a fresh one — try again.",
  cta: REPLACE_AGENT_CTA,
}

const RELOAD_PAGE_CTA: VenueOnboardingErrorCta = { kind: 'reload-page' }

// ADR-0036 D-1/D-2: a stranded agent carrying our name is recovered in-house —
// re-approving under the same name atomically replaces it on Hyperliquid. One
// signature, no website round-trip.
const AGENT_EXISTS_NO_LOCAL_KEY_COPY: ErrorCopy = {
  headline: 'Trading key out of sync',
  copy: "Your agent is approved on Hyperliquid, but this browser doesn't have its key. We'll create a fresh key and replace it — one signature.",
  cta: REPLACE_AGENT_CTA,
}

// ADR-0036 D-6: under same-name replacement semantics a re-approve cannot
// duplicate an agent; reload routes the user into the one-click replace flow.
const KEYSTORE_WRITE_AFTER_APPROVAL_COPY: ErrorCopy = {
  headline: 'Approval succeeded but local save failed',
  copy: 'Your agent was approved on Hyperliquid, but this browser could not save its key. Reload the page — the app will detect it and offer a one-signature replacement.',
  cta: RELOAD_PAGE_CTA,
}

function copyForAgentReason(reason: AgentApprovalErrorReason): ErrorCopy {
  switch (reason) {
    case 'wallet-rejected':
      return WALLET_REJECTED_COPY
    case 'chain-mismatch':
      return CHAIN_MISMATCH_COPY
    case 'signing-unavailable':
      return SIGNING_UNAVAILABLE_COPY
    case 'corrupted-key':
      return CORRUPTED_KEY_COPY
    case 'agent-slots-full':
      return AGENT_SLOTS_FULL_COPY
    case 'name-collision':
      return NAME_COLLISION_COPY
    case 'rate-limited':
      return RATE_LIMITED_COPY
    case 'deposit-required':
      return DEPOSIT_REQUIRED_COPY
    case 'agent-exists-no-local-key':
      return AGENT_EXISTS_NO_LOCAL_KEY_COPY
    case 'keystore-write-after-approval':
      return KEYSTORE_WRITE_AFTER_APPROVAL_COPY
    case 'agent-address-reused':
      return AGENT_ADDRESS_REUSED_COPY
    case 'unknown':
    case 'approval-failed':
      return UNKNOWN_COPY
    default: {
      const exhaustive: never = reason
      return exhaustive
    }
  }
}

function copyForBuilderReason(reason: BuilderFeeApprovalErrorReason): ErrorCopy {
  switch (reason) {
    case 'wallet-rejected':
      return WALLET_REJECTED_COPY
    case 'chain-mismatch':
      return CHAIN_MISMATCH_COPY
    case 'signing-unavailable':
      return SIGNING_UNAVAILABLE_COPY
    case 'builder-not-funded':
      return BUILDER_NOT_FUNDED_COPY
    case 'deposit-required':
      return DEPOSIT_REQUIRED_COPY
    case 'approval-cap-reached':
      return APPROVAL_CAP_REACHED_COPY
    case 'rate-limited':
      return RATE_LIMITED_COPY
    case 'unknown':
    case 'approval-failed':
      return UNKNOWN_COPY
    default: {
      const exhaustive: never = reason
      return exhaustive
    }
  }
}

export function mapAgentErrorReasonToStatus(
  reason: AgentApprovalErrorReason,
  causeChain?: string,
): VenueOnboardingStepErrorStatus {
  const { headline, copy, cta } = copyForAgentReason(reason)
  return { kind: 'error', reason, headline, copy, cta, causeChain }
}

export function mapBuilderErrorReasonToStatus(
  reason: BuilderFeeApprovalErrorReason,
  causeChain?: string,
): VenueOnboardingStepErrorStatus {
  const { headline, copy, cta } = copyForBuilderReason(reason)
  return { kind: 'error', reason, headline, copy, cta, causeChain }
}

// Deposit step mapper (HIGH-2 / Plan 04). The deposit query is read-only so
// the reason union is narrow: only 'deposit-required', 'rate-limited', 'unknown'.
// 'deposit-required' reuses DEPOSIT_REQUIRED_COPY (in-app open-deposit CTA) — that
// is the CTA that StepRow renders inside its error sub-card (HIGH-1 mechanism).
function copyForDepositReason(reason: DepositErrorReason): ErrorCopy {
  switch (reason) {
    case 'deposit-required':
      return DEPOSIT_REQUIRED_COPY
    case 'rate-limited':
      return RATE_LIMITED_COPY
    case 'unknown':
      return UNKNOWN_COPY
    default: {
      const exhaustive: never = reason
      return exhaustive
    }
  }
}

export function mapDepositErrorReasonToStatus(
  reason: DepositErrorReason,
  causeChain?: string,
): VenueOnboardingStepErrorStatus {
  const { headline, copy, cta } = copyForDepositReason(reason)
  return { kind: 'error', reason, headline, copy, cta, causeChain }
}
