import { IconSelect } from '@/modules/shared/components/icon-select'
import type { IconSelectOption } from '@/modules/shared/components/icon-select'
import { VenueIcon } from '@/modules/shared/components/venue-icon'
import { SOON_BADGE } from './perp-suggestion-sheet.constants'
import styles from './perp-suggestion-sheet.module.css'
import type { SuggestionVenueId } from '../../api/suggestions.types'
import type { DexSelectorProps } from './perp-suggestion-sheet.types'

const VENUE_ICON_SIZE = 18

/**
 * The DEX selection step (slice 04): a shared `IconSelect` dropdown listing every
 * venue the suggestion can target, each backed by its venue icon. Hyperliquid is
 * live and selectable; Extended is `disabled` with a "soon" suffix — listed but
 * never selectable (the hook also rejects a coming-soon venue). Dumb — state +
 * handler come from the sheet hook.
 */
export function DexSelector({ options, selectedVenueId, onSelect }: DexSelectorProps) {
  const dexOptions: IconSelectOption[] = options.map((dex) => ({
    value: dex.id,
    label: dex.comingSoon ? `${dex.label} · ${SOON_BADGE}` : dex.label,
    disabled: dex.comingSoon,
    icon: <VenueIcon venueId={dex.id} label={dex.label} size={VENUE_ICON_SIZE} />,
  }))

  return (
    <IconSelect
      options={dexOptions}
      value={selectedVenueId}
      // IconSelect emits the option's `value`, which is always one of our
      // `SuggestionVenueId`s; the hook re-validates against DEX_OPTIONS.
      onChange={(value) => onSelect(value as SuggestionVenueId)}
      ariaLabel="Select DEX"
      className={styles.dexDropdown}
    />
  )
}
