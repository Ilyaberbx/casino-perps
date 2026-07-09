import { Sheet } from '@/modules/shared/components/Sheet'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import { Callout } from '@/modules/shared/components/callout'
import { ConnectWalletGateButton } from '@/modules/account'
import { RawSuggestionView } from './RawSuggestionView'
import { EditableLegs } from './EditableLegs'
import { useSuggestionPreview } from './use-suggestion-preview'
import {
  PREVIEW_ARIA_LABEL,
  PREVIEW_TITLE,
  PLACE_LABEL,
  EXPIRED_NOTICE,
  NO_TRADE_NOTICE,
} from './suggestion-preview.constants'
import styles from './suggestion-preview.module.css'

/**
 * The right-side suggestion preview (ADR-0048, slice 10). Opens on a successful
 * execute or a history re-open while the chart stays visible behind it. Shows the
 * agent's raw response, the editable legs (re-validated against live state), and
 * the Place affordance — which routes through the venue `Trader.placeOrder` path
 * the order ticket uses. An expired suggestion is read-only: legs frozen, Place
 * gone. Dumb body; all state lives in `useSuggestionPreview`.
 */
export function SuggestionPreviewSheet() {
  const vm = useSuggestionPreview()
  return (
    <Sheet
      isOpen={vm.isOpen}
      onClose={vm.close}
      side="right"
      ariaLabel={PREVIEW_ARIA_LABEL}
      title={PREVIEW_TITLE}
    >
      <div className={styles.panel} data-testid="suggestion-preview-sheet">
        {vm.raw && vm.suggestion ? (
          <RawSuggestionView
            raw={vm.raw}
            agentId={vm.suggestion.agentId}
            symbol={vm.suggestion.requestParams.symbol}
          />
        ) : null}

        {vm.isNeutral ? (
          <Callout variant="warning" label="No trade">
            {NO_TRADE_NOTICE}
          </Callout>
        ) : null}

        {vm.readOnly ? (
          <Callout variant="warning" label="Expired">
            {EXPIRED_NOTICE}
          </Callout>
        ) : null}

        {/* A neutral suggestion is non-executable — no legs to edit, no Place. */}
        {vm.isNeutral ? null : (
          <>
            <EditableLegs
              edit={vm.edit}
              readOnly={vm.readOnly}
              issues={vm.issues}
              setMarginUsd={vm.setMarginUsd}
              setLeverage={vm.setLeverage}
              setEntry={vm.setEntry}
              setStopLoss={vm.setStopLoss}
              setTakeProfit={vm.setTakeProfit}
            />

            {vm.place.phase === 'error' ? (
              <Callout variant="error" label="Order failed">
                {vm.place.message}
              </Callout>
            ) : null}

            {vm.readOnly ? null : (
              <ConnectWalletGateButton>
                <PixelButton
                  variant="accentFilled"
                  fullWidth
                  onClick={vm.onPlace}
                  disabled={!vm.canPlace}
                  data-testid="preview-place-order"
                >
                  {vm.place.phase === 'placing' ? 'Placing…' : PLACE_LABEL}
                </PixelButton>
              </ConnectWalletGateButton>
            )}
          </>
        )}
      </div>
    </Sheet>
  )
}
