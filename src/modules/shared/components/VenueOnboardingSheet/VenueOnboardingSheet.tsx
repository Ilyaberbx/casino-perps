import { PixelButton } from '../pixel-button'
import { Sheet } from '../Sheet'
import { InputForm } from './InputForm'
import { MigrationNotice } from './MigrationNotice'
import { StepRow } from './StepRow'
import { useVenueOnboardingSheetContent } from './use-venue-onboarding-sheet-content'
import styles from './venue-onboarding-sheet.module.css'
import type { VenueOnboardingSheetProps } from './venue-onboarding-sheet.types'

/**
 * Venue-agnostic onboarding sheet. Composes the `Sheet` primitive with:
 * header, optional migration notice, venue logo, headline, read-only step
 * list (`StepRow` × N), divider, upfront input form, footer (Cancel + primary).
 *
 * Driven by the `VenueOnboarding` port. Action callbacks for wallet /
 * network / page-reload CTAs are passed in via `actions` (the host wires
 * them — `shared/` cannot reach `account/`). See ADR-0026.
 */
export function VenueOnboardingSheet({
  isOpen,
  onClose,
  venueLogoUrl,
  showMigrationNotice,
  onDismissMigrationNotice,
  actions,
}: VenueOnboardingSheetProps) {
  const content = useVenueOnboardingSheetContent({
    actions,
    showMigrationNotice,
    onDismissMigrationNotice,
  })

  const ariaLabel = content.venueLabel
    ? `${content.venueLabel} onboarding`
    : 'Venue onboarding'

  return (
    <Sheet isOpen={isOpen} onClose={onClose} side="right" ariaLabel={ariaLabel}>
      <div className={styles.body}>
        <header className={styles.header}>
          <h2 className={styles.title}>{content.venueLabel} setup</h2>
        </header>
        {content.showMigrationNotice && (
          <MigrationNotice onDismiss={content.onDismissMigrationNotice} />
        )}
        {venueLogoUrl && (
          <div className={styles.logo}>
            <img src={venueLogoUrl} alt={`${content.venueLabel} logo`} />
          </div>
        )}
        <p className={styles.headline}>{content.headline}</p>
        <ol className={styles.steps}>
          {content.steps.map((step, index) => (
            <StepRow
              key={step.id}
              step={step}
              index={index}
              actions={actions}
              onRetry={content.onRetryStep}
              onResetLocalState={content.onResetLocalState}
            />
          ))}
        </ol>
        <div className={styles.divider} aria-hidden="true" />
        <InputForm
          inputs={content.inputs}
          values={content.values}
          onValueChange={content.onValueChange}
        />
        <footer className={styles.footer}>
          <PixelButton type="button" variant="default" onClick={onClose}>
            Cancel
          </PixelButton>
          <PixelButton
            type="button"
            variant="accentFilled"
            disabled={content.isPrimaryDisabled}
            onClick={content.onPrimaryClick}
          >
            {content.primaryLabel}
          </PixelButton>
        </footer>
      </div>
    </Sheet>
  )
}
