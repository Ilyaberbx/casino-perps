import { Sheet } from '@/modules/shared/components/Sheet'
import { TabBar } from '@/modules/shared/components/tab-bar'
import type { TabBarTab } from '@/modules/shared/components/tab-bar'
import { X } from 'lucide-react'
import { AiMascot } from '@/modules/shared/components/ai-marker'
import { AssetIcon } from '@/modules/shared/components/asset-icon'
import { IconButton } from '@/modules/shared/components/icon-button'
import { SuggestTab } from './SuggestTab'
import { HistoryTab } from './HistoryTab'
import { SheetAgentBalance } from './SheetAgentBalance'
import { usePerpSuggestionSheetContent } from './use-perp-suggestion-sheet-content'
import {
  SHEET_TITLE,
  SUGGESTION_SHEET_ARIA_LABEL,
} from './perp-suggestion-sheet.constants'
import styles from './perp-suggestion-sheet.module.css'
import type { SheetTab } from './perp-suggestion-sheet.types'
import type { PerpSuggestionSheetProps } from './perp-suggestion-sheet.types'

const TABS: ReadonlyArray<TabBarTab<SheetTab>> = [
  { value: 'suggest', label: 'Suggest' },
  { value: 'history', label: 'History' },
]

/**
 * The left AI Sheet shell (ADR-0048, slice 07). Reuses the shared `Sheet`
 * (`side="left"`) off the provider controller; the three-eye motif marks its
 * identity. Hosts the `Suggest | History` tabs. Dumb body — all state lives in
 * `usePerpSuggestionSheetContent`.
 */
export function PerpSuggestionSheet({ deps }: PerpSuggestionSheetProps) {
  const vm = usePerpSuggestionSheetContent(deps)
  return (
    <Sheet
      isOpen={vm.isOpen}
      onClose={vm.close}
      side="left"
      ariaLabel={SUGGESTION_SHEET_ARIA_LABEL}
      hideClose
    >
      <div className={styles.panel} data-testid="perp-suggestion-sheet">
        <header className={styles.aiHeader}>
          <AiMascot
            size={30}
            animated={false}
            label="AI agent"
            className={styles.aiGlyph}
          />
          <AssetIcon market={vm.currentMarket} size={22} />
          <h2 className={styles.heading}>{SHEET_TITLE}</h2>
          <IconButton icon={X} ariaLabel="Close" title="Close" onClick={vm.close} />
        </header>
        <TabBar
          tabs={TABS}
          value={vm.tab}
          onChange={vm.setTab}
          fitted
          size="sm"
          ariaLabel="AI sheet tabs"
        />
        {vm.tab === 'suggest' ? (
          <SuggestTab vm={vm} />
        ) : (
          <HistoryTab history={vm.history} onReopen={vm.onReopenHistory} />
        )}
        {vm.isConnected ? <SheetAgentBalance balance={vm.agentBalance} /> : null}
      </div>
    </Sheet>
  )
}
