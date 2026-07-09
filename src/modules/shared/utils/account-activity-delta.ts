import type { AccountActivityDelta } from '@/modules/shared/domain'
import type { AccountActivityRow } from './account-activity-delta.types'
import { ACTIVITY_ZONE, HLP_VAULT_ADDRESS, USDC_ASSET } from './account-activity-delta.constants'
import { formatTokenAmount } from './format-number'
import { formatWalletAddress } from './format-wallet-address'

const LABELS: Record<AccountActivityDelta['type'], string> = {
  accountClassTransfer: 'Account Transfer',
  deposit: 'Deposit',
  internalTransfer: 'Internal Transfer',
  liquidation: 'Liquidation',
  rewardsClaim: 'Rewards Claim',
  spotTransfer: 'Spot Transfer',
  subAccountTransfer: 'Subaccount Transfer',
  vaultCreate: 'Vault Create',
  vaultDeposit: 'Vault Deposit',
  vaultDistribution: 'Vault Distribution',
  vaultWithdraw: 'Vault Withdraw',
  withdraw: 'Withdraw',
  send: 'Send',
  deployGasAuction: 'Deploy Gas Auction',
  cStakingTransfer: 'Staking Transfer',
  borrowLend: 'Borrow / Lend',
  spotGenesis: 'Spot Genesis',
  activateDexAbstraction: 'Activate Dex Abstraction',
  vaultLeaderCommission: 'Vault Leader Commission',
}

/**
 * Truncate a ledger address (`destination` / `vault`) to the canonical
 * checksummed `0x<head4>…<tail4>` display form via `formatWalletAddress`. Live
 * ledger addresses are valid EVM addresses, but the data is off the wire, so a
 * malformed string is caught and returned verbatim — never a throw that would
 * crash the Account Activity panel (the bug class `renderUnknownDelta` guards).
 */
function shortAddress(addr: string): string {
  try {
    return formatWalletAddress(addr)
  } catch {
    return addr
  }
}

function num(s: string): number {
  const v = Number(s)
  return Number.isFinite(v) ? v : 0
}

/** Known vault name (HLP) for the To/From column, else the generic "Vault". */
function vaultName(vault: string): string {
  return vault.toLowerCase() === HLP_VAULT_ADDRESS ? 'HLP' : ACTIVITY_ZONE.vault
}

/** A formatted "Fee" cell ("1 USDC"), or null when the fee is zero (renders `--`). */
function feeDisplay(amount: string, asset: string): string | null {
  const value = num(amount)
  if (value === 0) return null
  return `${formatTokenAmount(value)} ${asset}`
}

/**
 * Renders one row per delta kind. Switch is exhaustive: a new SDK delta
 * forces the `renderUnknownDelta` `never` default branch to fail typecheck, so
 * the static-type-equivalence assertion in
 * `hyperliquid/services/account-activity-reader.ts` plus this `never` arm
 * together close the loop. Shared between the Portfolio "Account Activity" tab
 * and the trading Account Dock's Account Activity tab.
 *
 * Sign convention for `changeAmount`: positive increases the account balance
 * (deposits, distributions, transfers in); negative decreases it (withdrawals,
 * vault deposits, transfers out). `usdValue` is always the unsigned magnitude.
 */
export function renderAccountActivityDelta(
  delta: AccountActivityDelta,
): AccountActivityRow {
  switch (delta.type) {
    case 'accountClassTransfer':
      return {
        kind: delta.type,
        action: LABELS[delta.type],
        asset: USDC_ASSET,
        from: delta.toPerp ? ACTIVITY_ZONE.spot : ACTIVITY_ZONE.perps,
        to: delta.toPerp ? ACTIVITY_ZONE.perps : ACTIVITY_ZONE.spot,
        destination: null,
        changeAmount: delta.toPerp ? num(delta.usdc) : -num(delta.usdc),
        changeAsset: USDC_ASSET,
        usdValue: num(delta.usdc),
        fee: null,
      }
    case 'deposit':
      return {
        kind: delta.type,
        action: LABELS[delta.type],
        asset: USDC_ASSET,
        from: ACTIVITY_ZONE.arbitrum,
        to: ACTIVITY_ZONE.hyperliquid,
        destination: null,
        changeAmount: num(delta.usdc),
        changeAsset: USDC_ASSET,
        usdValue: num(delta.usdc),
        fee: null,
      }
    case 'withdraw':
      return {
        kind: delta.type,
        action: LABELS[delta.type],
        asset: USDC_ASSET,
        from: ACTIVITY_ZONE.hyperliquid,
        to: ACTIVITY_ZONE.arbitrum,
        destination: null,
        changeAmount: -num(delta.usdc),
        changeAsset: USDC_ASSET,
        usdValue: num(delta.usdc),
        fee: feeDisplay(delta.fee, USDC_ASSET),
      }
    case 'internalTransfer':
      return {
        kind: delta.type,
        action: LABELS[delta.type],
        asset: USDC_ASSET,
        from: ACTIVITY_ZONE.perps,
        to: shortAddress(delta.destination),
        destination: shortAddress(delta.destination),
        changeAmount: -num(delta.usdc),
        changeAsset: USDC_ASSET,
        usdValue: num(delta.usdc),
        fee: feeDisplay(delta.fee, USDC_ASSET),
      }
    case 'subAccountTransfer':
      return {
        kind: delta.type,
        action: LABELS[delta.type],
        asset: USDC_ASSET,
        from: ACTIVITY_ZONE.perps,
        to: shortAddress(delta.destination),
        destination: shortAddress(delta.destination),
        changeAmount: null,
        changeAsset: USDC_ASSET,
        usdValue: num(delta.usdc),
        fee: null,
      }
    case 'spotTransfer':
      return {
        kind: delta.type,
        action: LABELS[delta.type],
        asset: delta.token,
        from: ACTIVITY_ZONE.spot,
        to: shortAddress(delta.destination),
        destination: shortAddress(delta.destination),
        changeAmount: -num(delta.amount),
        changeAsset: delta.token,
        usdValue: num(delta.usdcValue),
        fee: feeDisplay(delta.fee, delta.feeToken),
      }
    case 'send':
      return {
        kind: delta.type,
        action: LABELS[delta.type],
        asset: delta.token,
        from: delta.sourceDex === '' ? ACTIVITY_ZONE.perps : delta.sourceDex,
        to: delta.destinationDex === '' ? shortAddress(delta.destination) : delta.destinationDex,
        destination: shortAddress(delta.destination),
        changeAmount: -num(delta.amount),
        changeAsset: delta.token,
        usdValue: num(delta.usdcValue),
        fee: feeDisplay(delta.fee, delta.feeToken),
      }
    case 'liquidation':
      return {
        kind: delta.type,
        action: LABELS[delta.type],
        asset: delta.liquidatedPositions[0]?.coin ?? '--',
        from: ACTIVITY_ZONE.perps,
        to: null,
        destination: null,
        changeAmount: null,
        changeAsset: '',
        usdValue: num(delta.liquidatedNtlPos),
        fee: null,
      }
    case 'rewardsClaim':
      return {
        kind: delta.type,
        action: LABELS[delta.type],
        asset: delta.token,
        from: null,
        to: ACTIVITY_ZONE.spot,
        destination: null,
        changeAmount: num(delta.amount),
        changeAsset: delta.token,
        usdValue: null,
        fee: null,
      }
    case 'vaultCreate':
      return {
        kind: delta.type,
        action: LABELS[delta.type],
        asset: USDC_ASSET,
        from: ACTIVITY_ZONE.perps,
        to: vaultName(delta.vault),
        destination: shortAddress(delta.vault),
        changeAmount: -num(delta.usdc) - num(delta.fee),
        changeAsset: USDC_ASSET,
        usdValue: num(delta.usdc),
        fee: feeDisplay(delta.fee, USDC_ASSET),
      }
    case 'vaultDeposit':
      return {
        kind: delta.type,
        action: LABELS[delta.type],
        asset: USDC_ASSET,
        from: ACTIVITY_ZONE.perps,
        to: vaultName(delta.vault),
        destination: shortAddress(delta.vault),
        changeAmount: -num(delta.usdc),
        changeAsset: USDC_ASSET,
        usdValue: num(delta.usdc),
        fee: null,
      }
    case 'vaultDistribution':
      return {
        kind: delta.type,
        action: LABELS[delta.type],
        asset: USDC_ASSET,
        from: vaultName(delta.vault),
        to: ACTIVITY_ZONE.perps,
        destination: shortAddress(delta.vault),
        changeAmount: num(delta.usdc),
        changeAsset: USDC_ASSET,
        usdValue: num(delta.usdc),
        fee: null,
      }
    case 'vaultWithdraw':
      return {
        kind: delta.type,
        action: LABELS[delta.type],
        asset: USDC_ASSET,
        from: vaultName(delta.vault),
        to: ACTIVITY_ZONE.perps,
        destination: shortAddress(delta.vault),
        changeAmount: num(delta.netWithdrawnUsd),
        changeAsset: USDC_ASSET,
        usdValue: num(delta.netWithdrawnUsd),
        fee: feeDisplay(delta.commission, USDC_ASSET),
      }
    case 'vaultLeaderCommission':
      return {
        kind: delta.type,
        action: LABELS[delta.type],
        asset: USDC_ASSET,
        from: null,
        to: ACTIVITY_ZONE.perps,
        destination: null,
        changeAmount: num(delta.usdc),
        changeAsset: USDC_ASSET,
        usdValue: num(delta.usdc),
        fee: null,
      }
    case 'cStakingTransfer':
      return {
        kind: delta.type,
        action: LABELS[delta.type],
        asset: delta.token,
        from: delta.isDeposit ? ACTIVITY_ZONE.spot : ACTIVITY_ZONE.staking,
        to: delta.isDeposit ? ACTIVITY_ZONE.staking : ACTIVITY_ZONE.spot,
        destination: null,
        changeAmount: delta.isDeposit ? -num(delta.amount) : num(delta.amount),
        changeAsset: delta.token,
        usdValue: null,
        fee: null,
      }
    case 'deployGasAuction':
      return {
        kind: delta.type,
        action: LABELS[delta.type],
        asset: delta.token,
        from: null,
        to: null,
        destination: null,
        changeAmount: -num(delta.amount),
        changeAsset: delta.token,
        usdValue: null,
        fee: null,
      }
    case 'borrowLend':
      return {
        kind: delta.type,
        action: LABELS[delta.type],
        asset: delta.token,
        from: null,
        to: null,
        destination: null,
        changeAmount: null,
        changeAsset: delta.token,
        usdValue: null,
        fee: null,
      }
    case 'spotGenesis':
      return {
        kind: delta.type,
        action: LABELS[delta.type],
        asset: delta.token,
        from: null,
        to: ACTIVITY_ZONE.spot,
        destination: null,
        changeAmount: num(delta.amount),
        changeAsset: delta.token,
        usdValue: null,
        fee: null,
      }
    case 'activateDexAbstraction':
      return {
        kind: delta.type,
        action: LABELS[delta.type],
        asset: delta.token,
        from: delta.dex,
        to: null,
        destination: null,
        changeAmount: num(delta.amount),
        changeAsset: delta.token,
        usdValue: null,
        fee: null,
      }
    default:
      return renderUnknownDelta(delta)
  }
}

/**
 * Fallback for ledger delta kinds the live Hyperliquid API returns but the
 * pinned SDK type does not yet model (observed in the wild: `accountActivationGas`).
 * The static type-equivalence assertion in
 * `hyperliquid/services/account-activity-reader.ts` still guards the SDK
 * contract, and the `never` parameter keeps the switch above exhaustive over
 * the *known* union — a new SDK kind without its own `case` fails typecheck
 * here. But the SDK can lag the live API, so rather than throwing (which
 * crashed the whole Account Activity panel with an "Unexpected Application
 * Error") we humanize whatever arrived and keep the panel rendering.
 */
function renderUnknownDelta(delta: never): AccountActivityRow {
  // `delta` is `never` to the type system; at runtime it is the unmodelled
  // record. Read it through a permissive shape — the common fields across HL
  // deltas are `type` and an `amount`/`token` pair.
  const raw: { type: string; amount?: string; token?: string } = delta
  const token = typeof raw.token === 'string' ? raw.token : null
  const amount = typeof raw.amount === 'string' ? raw.amount : null
  return {
    kind: raw.type,
    action: humanizeDeltaKind(raw.type),
    asset: token ?? '--',
    from: null,
    to: null,
    destination: null,
    changeAmount: amount === null ? null : num(amount),
    changeAsset: token ?? '',
    usdValue: null,
    fee: null,
  }
}

/** `accountActivationGas` → `Account activation gas`. */
function humanizeDeltaKind(type: string): string {
  const spaced = type.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
