/**
 * Best-effort connector-brand icon for an imported wallet (PRD-0006 UI-5),
 * keyed on Privy's `walletClientType`. Returns a remote brand-logo URL for known
 * connectors, or `null` for unknown/embedded types so the row falls back to the
 * deterministic `Web3Avatar` gradient. Graceful by construction — an unknown
 * connector is never an error, just a fallback.
 */
const CONNECTOR_ICON_BY_CLIENT_TYPE: Readonly<Record<string, string>> = {
  metamask: 'https://cdn.jsdelivr.net/gh/MetaMask/brand-resources@master/SVG/SVG_MetaMask_Icon_Color.svg',
  coinbase_wallet: 'https://avatars.githubusercontent.com/u/1885080?s=64',
  rabby_wallet: 'https://rabby.io/assets/images/logo-128.png',
  rainbow: 'https://avatars.githubusercontent.com/u/48327834?s=64',
  phantom: 'https://avatars.githubusercontent.com/u/78782331?s=64',
  wallet_connect: 'https://avatars.githubusercontent.com/u/37784886?s=64',
}

export function resolveConnectorIcon(walletClientType: string): string | null {
  return CONNECTOR_ICON_BY_CLIENT_TYPE[walletClientType] ?? null
}
