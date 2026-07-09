export interface Web3AvatarProps {
  /** Custom icon URL when the account has one set; otherwise null → web3-avatar. */
  readonly iconUrl: string | null
  /** The Native Wallet address that deterministically seeds the default avatar. */
  readonly address: string
  /** Square edge length in px. */
  readonly size: number
  readonly className?: string
}
