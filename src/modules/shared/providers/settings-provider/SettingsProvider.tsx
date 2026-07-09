import { useCallback, useMemo, useState } from 'react'
import { SettingsContext } from './settings-provider.context'
import { DEFAULT_SETTINGS_SECTION } from './settings.constants'
import type { SettingsContextValue, SettingsProviderProps, SettingsSection } from './settings-provider.types'

/**
 * Owns the `{ isOpen, activeSection, open, close, setActiveSection }` controller
 * for the in-app Settings modal. Mounted once at the app root so the header gear
 * and the mobile footer cell can open it from anywhere. Structural mirror of
 * `manage-funds-provider`.
 */
export function SettingsProvider({
  children,
  defaultOpen = false,
  defaultSection = DEFAULT_SETTINGS_SECTION,
}: SettingsProviderProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [activeSection, setActiveSection] = useState<SettingsSection>(defaultSection)

  const open = useCallback((section?: SettingsSection) => {
    if (section) setActiveSection(section)
    setIsOpen(true)
  }, [])
  const close = useCallback(() => setIsOpen(false), [])

  const value = useMemo<SettingsContextValue>(
    () => ({ isOpen, activeSection, open, close, setActiveSection }),
    [isOpen, activeSection, open, close],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}
