/** Return shape of the `useWalletExport` hook (ADR-0076 D-5). */
export interface WalletExportView {
  /** `true` while the MFA gate / export modal round-trip is in flight. */
  readonly isExporting: boolean
  /** Run the MFA-gated owner-only export for a Privy-managed wallet address. */
  onExport(address: string): Promise<void>
}
