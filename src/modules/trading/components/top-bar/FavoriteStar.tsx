import styles from './top-bar.module.css'
import type { FavoriteStarProps } from './top-bar.types'

export function FavoriteStar({ isFavorite, onToggle }: FavoriteStarProps) {
  const className = isFavorite ? styles.favoriteStarActive : styles.favoriteStar
  const label = isFavorite ? 'Remove from favorites' : 'Add to favorites'

  return (
    <button
      type="button"
      className={className}
      onClick={onToggle}
      aria-label={label}
      aria-pressed={isFavorite}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path
          fill={isFavorite ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinejoin="round"
          d="M8 1.75l1.86 3.77 4.16.6-3.01 2.94.71 4.14L8 11.25l-3.72 1.95.71-4.14L1.98 6.12l4.16-.6L8 1.75z"
        />
      </svg>
    </button>
  )
}
