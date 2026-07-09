import { Avatar } from 'web3-avatar-react'
import { FallbackImage } from '@/modules/shared/components/fallback-image'
import type { Web3AvatarProps } from './account-avatar.types'
import styles from './account-avatar.module.css'

/**
 * The account avatar (PRD-0006 UI-2/UI-3). Renders `iconUrl` when the account
 * has a custom icon set, otherwise a deterministic `web3-avatar` gradient seeded
 * from the **Native Wallet address** (lower-cased). The image path runs through
 * `FallbackImage`, so a broken `iconUrl` also degrades to the gradient.
 *
 * Square pixel framing (no `border-radius`) overrides `web3-avatar`'s default
 * circular skin to match the pixel-art system.
 */
export function Web3Avatar({ iconUrl, address, size, className }: Web3AvatarProps) {
  const sources = iconUrl === null ? [] : [iconUrl]
  const seed = address.toLowerCase()
  const wrapClass = className === undefined ? styles.frame : `${styles.frame} ${className}`

  return (
    <span className={wrapClass} style={{ width: size, height: size }}>
      <FallbackImage
        sources={sources}
        alt="Account avatar"
        width={size}
        height={size}
        className={styles.image}
        fallback={
          <span data-testid="web3-avatar" data-avatar-seed={seed} className={styles.avatarWrap}>
            <Avatar
              address={seed}
              style={{ width: size, height: size, borderRadius: 0 }}
            />
          </span>
        }
      />
    </span>
  )
}
