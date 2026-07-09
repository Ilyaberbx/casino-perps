import styles from './pagination.module.css'
import { pageWindow } from './pagination.utils'
import type { PaginationProps } from './pagination.types'

const DEFAULT_MAX_BUTTONS = 5

export function Pagination({
  page,
  pageCount,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onSelect,
  isFetchingMore = false,
  maxButtons = DEFAULT_MAX_BUTTONS,
  ariaLabel = 'Pagination',
  className,
}: PaginationProps) {
  const pages = pageWindow(page, pageCount, maxButtons)
  const rootClass = className === undefined ? styles.root : `${styles.root} ${className}`

  return (
    <nav className={rootClass} aria-label={ariaLabel}>
      <button
        type="button"
        className={styles.arrow}
        onClick={onPrev}
        disabled={!canPrev}
        aria-label="Previous page"
      >
        ‹
      </button>
      <ol className={styles.pages}>
        {pages.map((p) => {
          const isCurrent = p === page
          const pageClass = isCurrent ? `${styles.page} ${styles.pageActive}` : styles.page
          return (
            <li key={p}>
              <button
                type="button"
                className={pageClass}
                onClick={() => onSelect(p)}
                aria-current={isCurrent ? 'page' : undefined}
              >
                {p}
              </button>
            </li>
          )
        })}
      </ol>
      <button
        type="button"
        className={styles.arrow}
        onClick={onNext}
        disabled={!canNext}
        aria-label="Next page"
        data-loading={isFetchingMore ? 'true' : undefined}
      >
        ›
      </button>
    </nav>
  )
}
