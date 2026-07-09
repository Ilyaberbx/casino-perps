import type { AccentColor, AccentColorId } from '@/modules/shared/providers/theme-provider'

export interface AccentColorPickerProps {
  readonly colors: ReadonlyArray<AccentColor>
  readonly selectedColorId: AccentColorId
  onSelect(id: AccentColorId): void
}
