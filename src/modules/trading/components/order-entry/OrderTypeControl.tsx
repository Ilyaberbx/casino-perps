import { Popover } from '@/modules/shared/components/popover'
import { useOrderTypeControl } from './use-order-type-control'
import { ProTypeMenu } from './ProTypeMenu'
import type { OrderTypeControlProps } from './order-entry.types'
import styles from './order-entry.module.css'

/**
 * The order-type control: a 3-segment row — Market | Limit | [Pro ▾]. The first
 * two segments are direct selects; the third is a dropdown trigger whose menu
 * (`ProTypeMenu`) lists the capability-available Pro types. Selecting a Pro type
 * relabels the segment to that type + chevron; choosing Market/Limit resets it
 * to "Pro ▾". When no Pro flag is set the 3rd segment is omitted entirely and
 * the control degrades to Market | Limit (today's behavior). Dumb — all state
 * lives in `useOrderTypeControl`.
 */
export function OrderTypeControl({
  orderType,
  supportsStopOrders,
  supportsTwap,
  onOrderTypeChange,
}: OrderTypeControlProps) {
  const {
    proDescriptors,
    hasProTypes,
    proSegmentLabel,
    activeProType,
    isProActive,
    isMenuOpen,
    activeIndex,
    triggerRef,
    listRef,
    listboxId,
    optionId,
    selectMarket,
    selectLimit,
    onTriggerClick,
    onTriggerKeyDown,
    onListKeyDown,
    onOptionClick,
  } = useOrderTypeControl({
    orderType,
    supportsStopOrders,
    supportsTwap,
    onOrderTypeChange,
  })

  const isMarketActive = orderType === 'market'
  const isLimitActive = orderType === 'limit'
  const marketClass = isMarketActive
    ? `${styles.typeSegment} ${styles.typeSegmentActive}`
    : styles.typeSegment
  const limitClass = isLimitActive
    ? `${styles.typeSegment} ${styles.typeSegmentActive}`
    : styles.typeSegment
  const proClass = isProActive
    ? `${styles.typeSegment} ${styles.typeSegmentActive} ${styles.proSegmentRelabeled}`
    : styles.typeSegment

  return (
    <div className={styles.typeControl}>
      <div className={styles.typeSegments} role="group" aria-label="Order type">
        <button
          type="button"
          className={marketClass}
          aria-pressed={isMarketActive}
          onClick={selectMarket}
        >
          Market
        </button>
        <button
          type="button"
          className={limitClass}
          aria-pressed={isLimitActive}
          onClick={selectLimit}
        >
          Limit
        </button>
        {hasProTypes ? (
          <button
            type="button"
            ref={triggerRef}
            className={proClass}
            aria-haspopup="listbox"
            aria-expanded={isMenuOpen}
            aria-controls={isMenuOpen ? listboxId : undefined}
            aria-pressed={isProActive}
            onClick={onTriggerClick}
            onKeyDown={onTriggerKeyDown}
          >
            <span className={styles.typeSegmentLabel}>{proSegmentLabel}</span>
            <span className={styles.typeSegmentCaret} aria-hidden="true">
              ▾
            </span>
          </button>
        ) : null}
      </div>
      {hasProTypes && isMenuOpen ? (
        <Popover anchorRef={triggerRef} panelRef={listRef} placement="bottom-end">
          <ProTypeMenu
            descriptors={proDescriptors}
            activeIndex={activeIndex}
            selectedType={activeProType}
            listboxId={listboxId}
            optionId={optionId}
            listRef={listRef}
            onListKeyDown={onListKeyDown}
            onOptionClick={onOptionClick}
          />
        </Popover>
      ) : null}
    </div>
  )
}
