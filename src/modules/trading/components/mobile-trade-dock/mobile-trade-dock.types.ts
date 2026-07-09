export interface UseMobileTradeDockReturn {
  /** Opens the AI suggestion sheet (footer's Ask AI cell). */
  openAskAi: () => void
  /** Opens the account modal when connected, else the connect-wallet flow
   * (footer's Account cell). */
  openAccount: () => void
  /** Opens the Settings modal on the Appearance section (footer's Settings cell). */
  openSettings: () => void
}
