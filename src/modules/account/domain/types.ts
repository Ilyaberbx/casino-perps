export type PrivyId = string

/**
 * Wallet provenance (ADR-0076 D-6). `embedded` = Privy-generated Native wallet;
 * `imported` = a raw private key the user imported into Privy's TEE-sharded
 * infrastructure (exportable); `external` = a link-only wallet (MetaMask et al.)
 * Privy holds no key for (not exportable). The exportability discriminator:
 * `embedded` and `imported` are owner-exportable, `external` is not.
 */
export type WalletSource = 'embedded' | 'external' | 'imported'

export type Wallet = {
  chain: string
  address: string
  isSelected: boolean
  source: WalletSource
}

export type User = {
  privyId: PrivyId
  email: string
  handle: string
  iconUrl: string | null
}

export type Me = {
  user: User
  wallets: Wallet[]
}

export type OnboardingInput = {
  privyId: PrivyId
  walletAddress: string
  source: WalletSource
  handle: string
  // Omitted when the invite gate is disabled (the server treats it as optional
  // and only requires it when `INVITE_GATE_ENABLED` is on).
  inviteCode?: string
}

export type AuthError =
  | { kind: 'no-credential' }
  | { kind: 'cancelled' }
  | { kind: 'not-configured' }
  | { kind: 'unknown'; cause: unknown }

/**
 * Outcome of `switchMasterWalletChain` (ADR-0080). A neutral, module-boundary-safe
 * union the venue flows consume without importing `account/`'s `AuthError`:
 * `'switched'` = Privy's `ConnectedWallet.switchChain` resolved (the caller must
 * still verify the chain actually changed — Privy resolves without updating stale
 * providers); `'rejected'` = the user declined the switch (non-destructive);
 * `'failed'` = no resolvable wallet or any other switch failure.
 */
export type ChainSwitchOutcome = 'switched' | 'rejected' | 'failed'
