import { Modal } from '../modal'
import styles from './settings-modal.module.css'
import { SettingsNav } from './SettingsNav'
import { SettingsPane } from './SettingsPane'
import { useSettingsModal } from './use-settings-modal'
import { SETTINGS_MODAL_ARIA_LABEL, SETTINGS_MODAL_TITLE } from './settings-modal.constants'

/**
 * Dumb host for the Settings modal. Wraps the shared `Modal` (centered, titled)
 * and lays out a two-column shell: a left vertical nav rail (`<SettingsNav>`) + a
 * right active-section pane (`<SettingsPane>`). On mobile the rail collapses to a
 * top scroll strip (driven by `isMobile`) and the `Modal` primitive already goes
 * full-screen at the same breakpoint. Mirrors `ManageFundsModal`.
 */
export function SettingsModal() {
  const {
    isOpen,
    activeSection,
    close,
    onSelectSection,
    sections,
    isMobile,
    theme,
    onSelectTheme,
    colors,
    selectedColorId,
    onSelectColor,
    tradingMode,
    onSelectTradingMode,
  } = useSettingsModal()

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      ariaLabel={SETTINGS_MODAL_ARIA_LABEL}
      title={SETTINGS_MODAL_TITLE}
    >
      <div className={styles.layout}>
        <SettingsNav
          sections={sections}
          activeSection={activeSection}
          onSelect={onSelectSection}
          isMobile={isMobile}
        />
        <section className={styles.pane}>
          <SettingsPane
            activeSection={activeSection}
            theme={theme}
            onSelectTheme={onSelectTheme}
            colors={colors}
            selectedColorId={selectedColorId}
            onSelectColor={onSelectColor}
            tradingMode={tradingMode}
            onSelectTradingMode={onSelectTradingMode}
          />
        </section>
      </div>
    </Modal>
  )
}
