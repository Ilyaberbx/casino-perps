import { Result, ResultAsync } from 'neverthrow'
import { HttpTransport, type IRequestTransport } from '@nktkas/hyperliquid'
import {
  approveAgent,
  approveBuilderFee,
  cancel,
  cancelByCloid,
  modify,
  order,
  spotSend,
  twapCancel,
  twapOrder,
  updateLeverage,
  usdClassTransfer,
  usdSend,
  userDexAbstraction,
  withdraw3,
  type CancelByCloidParameters,
  type CancelParameters,
  type CancelSuccessResponse,
  type ModifyParameters,
  type ModifySuccessResponse,
  type OrderParameters,
  type OrderSuccessResponse,
  type TwapCancelParameters,
  type TwapCancelSuccessResponse,
  type TwapOrderParameters,
  type TwapOrderSuccessResponse,
  type UpdateLeverageParameters,
  type UpdateLeverageSuccessResponse,
} from '@nktkas/hyperliquid/api/exchange'
import {
  approvedBuilders,
  extraAgents,
  maxBuilderFee,
  userAbstraction,
  userNonFundingLedgerUpdates,
} from '@nktkas/hyperliquid/api/info'
import { signL1Action, type AbstractWallet, type Signature } from '@nktkas/hyperliquid/signing'
import { formatPrice, formatSize } from '@nktkas/hyperliquid/utils'
import type { WalletClient } from 'viem'
import type { Logger } from '@/modules/shared/logger'
import type { WalletAddress } from '@/modules/shared/domain'
import type { UserAbstractionResponse } from './sdk-types'
import {
  HYPERLIQUID_BUILDER_ADDRESS,
  HYPERLIQUID_BUILDER_FEE_TENTHS_OF_BPS,
} from '../hyperliquid.constants'
import { brandSdkAddress, formatTenthsOfBpsAsPercentString } from '../hyperliquid.utils'
import { HyperliquidGatewayError } from './hyperliquid-gateway.types'
import { mapSdkError } from './sdk-error-mapping'

// AGENT-05: The instrument() helper logs only {method, durationMs} — never agentName, never
// any private key hex. This file is in the @nktkas/hyperliquid ESLint lint zone.

export interface HyperliquidExchangeGateway {
  /**
   * Approve a Hyperliquid API wallet (agent) using the master wallet's EIP-712 signature.
   *
   * `masterWallet` must be a viem WalletClient (JSON-RPC account) so the @nktkas SDK can
   * call getChainId() to derive the correct signatureChainId for the approveAgent typed-data
   * domain. Passing a LocalAccount causes the SDK to default to chainId 1; if the user's
   * wallet is on another chain (e.g. Base = 8453) viem rejects the signTypedData call.
   */
  approveAgent(
    masterWallet: WalletClient,
    agentAddress: `0x${string}`,
    agentName: string,
  ): ResultAsync<void, HyperliquidGatewayError>

  /** Sign an HL L1 action with the agent wallet. Returns the raw EIP-712 signature components. */
  signL1Action(
    agentWallet: AbstractWallet,
    action: Record<string, unknown>,
    nonce: number,
  ): ResultAsync<{ r: string; s: string; v: number }, HyperliquidGatewayError>

  /**
   * Place one or more orders signed by the agent wallet. `params` is the
   * SDK-shaped order action (already-rounded `p`/`s`, asset id `a`, builder fee,
   * cloid, tif/grouping, trigger legs) — the trader adapter builds it from the
   * domain `PlaceOrderRequest`. The SDK signs the L1 action and POSTs to
   * `/exchange`. A `status:"ok"` envelope can still carry per-order `error`s in
   * `statuses[]`; the adapter unpacks those into `PlaceOrderOutcome` / typed
   * errors. This gateway returns the raw success response verbatim.
   */
  placeOrder(
    agentWallet: AbstractWallet,
    params: OrderParameters,
  ): ResultAsync<OrderSuccessResponse, HyperliquidGatewayError>

  /**
   * Cancel resting orders by `(asset, oid)`, signed by the agent wallet. The
   * open-orders snapshot reader maps each order's `oid → identifier`, so the
   * cancel affordance has the oid to hand; the trader resolves the asset id
   * from the order's symbol.
   */
  cancelOrder(
    agentWallet: AbstractWallet,
    params: CancelParameters,
  ): ResultAsync<CancelSuccessResponse, HyperliquidGatewayError>

  /**
   * Cancel resting orders by `(asset, cloid)`, signed by the agent wallet. Used
   * when only the client order id is known (PRD decision 7).
   */
  cancelOrderByCloid(
    agentWallet: AbstractWallet,
    params: CancelByCloidParameters,
  ): ResultAsync<CancelSuccessResponse, HyperliquidGatewayError>

  /**
   * Modify a resting order in place (no cancel-and-replace), signed by the
   * agent wallet. `params` carries the target `oid` plus the replacement order
   * fields. A successful modify keeps the order resting with the new params.
   */
  modifyOrder(
    agentWallet: AbstractWallet,
    params: ModifyParameters,
  ): ResultAsync<ModifySuccessResponse, HyperliquidGatewayError>

  /**
   * Place a native Hyperliquid TWAP order signed by the agent wallet (ADR-0034
   * D-3). `params` is the SDK-shaped `twapOrder` action — `twap: { a, b, s, r,
   * m, t }` (asset id, side, rounded size, reduce-only, duration in minutes,
   * randomize-timing). The total size is sliced into sub-orders the exchange
   * executes over `m` minutes; the SDK enforces `5 ≤ m ≤ 1440` at validation.
   * Agent-signed like every trade (no master-wallet prompt). A `status:"ok"`
   * envelope can still carry a TWAP `{ error }`; the adapter unpacks it. Returns
   * the raw success response verbatim.
   */
  placeTwapOrder(
    agentWallet: AbstractWallet,
    params: TwapOrderParameters,
  ): ResultAsync<TwapOrderSuccessResponse, HyperliquidGatewayError>

  /**
   * Cancel a running Hyperliquid TWAP order signed by the agent wallet
   * (ADR-0052). `params` is the SDK-shaped `twapCancel` action — `{ a, t }`
   * (asset id, twapId). This is a distinct exchange action from the standard
   * `cancel` (which targets resting `oid`s); the SDK rejects a TWAP id through
   * the normal cancel path. Agent-signed like every trade (no master-wallet
   * prompt, per ADR-0012). A `status:"ok"` envelope can still carry an
   * `{ error }` in `data.status`; the controller unpacks it. Returns the raw
   * success response verbatim.
   */
  cancelTwap(
    agentWallet: AbstractWallet,
    params: TwapCancelParameters,
  ): ResultAsync<TwapCancelSuccessResponse, HyperliquidGatewayError>

  /**
   * Update cross/isolated leverage for a coin, signed by the agent wallet
   * (PRD decision 12 / HL `updateLeverage{ asset, isCross, leverage }`).
   * Leverage AND margin mode are both expressed through this one action: the
   * leverage controller passes the current `isCross`, the margin-mode
   * controller passes the current `leverage` — HL has no separate margin-mode
   * action. It is account state applied immediately on change and must precede
   * an order; the order request carries no leverage.
   */
  updateLeverage(
    agentWallet: AbstractWallet,
    params: UpdateLeverageParameters,
  ): ResultAsync<UpdateLeverageSuccessResponse, HyperliquidGatewayError>

  /**
   * Round a price to Hyperliquid's tick rules (5 sig figs, ≤6 perp / ≤8 spot
   * minus szDecimals decimal places) via the SDK's `formatPrice`. HL rejects
   * orders with bad rounding, so the trader adapter routes every price through
   * here. Synchronous + pure (no signing, no network); wrapped in `Result`
   * because the SDK throws on a non-positive / non-numeric input.
   */
  formatPrice(
    price: number,
    szDecimals: number,
    marketType: 'perp' | 'spot',
  ): Result<string, HyperliquidGatewayError>

  /**
   * Round a size by truncating to `szDecimals` decimals via the SDK's
   * `formatSize`. Same rationale and shape as {@link formatPrice}.
   */
  formatSize(
    size: number,
    szDecimals: number,
  ): Result<string, HyperliquidGatewayError>

  /**
   * Approve the partner-builder fee rate (`HYPERLIQUID_BUILDER_FEE_TENTHS_OF_BPS`)
   * against `HYPERLIQUID_BUILDER_ADDRESS` using the master wallet's EIP-712
   * signature. Must be signed by the master wallet, not an agent — Hyperliquid
   * rejects approveBuilderFee signed by an agent/API wallet. See ADR-0024.
   */
  approveBuilderFee(
    masterWallet: WalletClient,
  ): ResultAsync<void, HyperliquidGatewayError>

  /**
   * Enable Hyperliquid **HIP-3 DEX abstraction** for the user (`userDexAbstraction`,
   * `enabled: true`). Once enabled, a DEFAULT (segregated) account auto-transfers
   * collateral from its main USDC perp / spot balance into a HIP-3 (builder-deployed)
   * perp DEX when opening a position there, and returns it to the same source when the
   * position closes — so a default account can trade HIP-3 markets (`xyz:NVDA`, …)
   * WITHOUT switching to unified / portfolio margin. This is the fix for the HIP-3
   * "insufficient margin" rejection (a HIP-3 DEX has its own isolated collateral pool
   * which is empty for a default account). Like `approveBuilderFee`, this is a
   * **user-signed action** (EIP-712 `HyperliquidTransaction:UserDexAbstraction`) — it
   * must be signed by the **master wallet** (`getMasterViemAccount`, ADR-0012), never an
   * agent/API wallet. After this resolves, `queryUserAbstraction` returns `dexAbstraction`
   * (still segregated per `isSegregatedAccount`). The SDK marks the underlying
   * `userDexAbstraction` `@deprecated` in favour of `userSetAbstraction`, but that only
   * offers `disabled | unifiedAccount | portfolioMargin` — none of which keep a *default*
   * account, so `dexAbstraction` is the only lever here. Optimistic on `status:ok`; maps
   * SDK/envelope errors to a typed err via `instrument()`; never throws.
   */
  enableDexAbstraction(
    masterWallet: WalletClient,
    user: WalletAddress,
  ): ResultAsync<void, HyperliquidGatewayError>

  /**
   * Move USDC between the user's Spot and Perp sub-accounts (`usdClassTransfer`).
   * `toPerp: true` is Spot→Perp; `false` is Perp→Spot. Like `approveBuilderFee`,
   * this is a **user-signed action** carrying EIP-712 typed data — it must be
   * signed by the **master wallet** (`getMasterViemAccount`, ADR-0012), not an
   * agent/API wallet (Hyperliquid rejects those). `amount` is the USDC amount
   * string (`1` = $1). Optimistic on `status:ok` — a single instant L1 action,
   * no bridge polling (ADR-0033 D-2). A `status:ok`-with-error envelope or a
   * thrown SDK error maps to a typed `err` via `instrument()` + `mapSdkError`;
   * never throws.
   */
  usdClassTransfer(
    masterWallet: WalletClient,
    params: { amount: string; toPerp: boolean },
  ): ResultAsync<void, HyperliquidGatewayError>

  /**
   * Withdraw USDC from the perp account to an Arbitrum L1 address (`withdraw3`).
   * User-signed action (EIP-712) — must be signed by the **master wallet**
   * (getMasterViemAccount, ADR-0012), never an agent. `amount` is the USDC
   * string ("1" = $1). Hyperliquid charges a flat $1 withdrawal fee on L1.
   * Optimistic on status:ok; maps SDK/envelope errors to a typed err via
   * instrument(); never throws.
   */
  withdraw3(
    masterWallet: WalletClient,
    params: { destination: WalletAddress; amount: string },
  ): ResultAsync<void, HyperliquidGatewayError>

  /**
   * Send perp USDC to another address (`usdSend`). No L1 bridge / flat fee —
   * the funds stay on Hyperliquid. User-signed action (EIP-712) — must be
   * signed by the **master wallet** (getMasterViemAccount, ADR-0012), never an
   * agent. `amount` is the USDC string ("1" = $1). Optimistic on status:ok;
   * maps SDK/envelope errors to a typed err via instrument(); never throws.
   */
  usdSend(
    masterWallet: WalletClient,
    params: { destination: WalletAddress; amount: string },
  ): ResultAsync<void, HyperliquidGatewayError>

  /**
   * Send a spot token to another address (`spotSend`). Stays on Hyperliquid.
   * `token` is the Hyperliquid token identifier `"NAME:0xTOKENID"`. User-signed
   * action (EIP-712) — must be signed by the **master wallet**
   * (getMasterViemAccount, ADR-0012), never an agent. `amount` is the token
   * amount string (not in wei). Optimistic on status:ok; maps SDK/envelope
   * errors to a typed err via instrument(); never throws.
   */
  spotSend(
    masterWallet: WalletClient,
    params: { destination: WalletAddress; token: string; amount: string },
  ): ResultAsync<void, HyperliquidGatewayError>

  /**
   * Read the on-chain approved builder fee rate (in tenths of bps) for the
   * given user/builder pair. Returns 0 when no approval exists.
   */
  queryMaxBuilderFee(
    user: WalletAddress,
  ): ResultAsync<number, HyperliquidGatewayError>

  /**
   * Enumerate the user's currently-valid Hyperliquid agent (extra agent)
   * wallets. Returns an array of `{ address, name, validUntil }` triples —
   * empty when the user has no agents on-file. Used by the agent-wallet
   * provider's bootstrap effect to detect the desync mode where an agent
   * exists on HL but the local keystore has no matching private key (#167),
   * and by the slots-full victim picker (ADR-0036) which renders each agent's
   * name + expiry.
   */
  queryAgents(
    user: WalletAddress,
  ): ResultAsync<
    ReadonlyArray<{ address: WalletAddress; name: string; validUntil: number }>,
    HyperliquidGatewayError
  >

  /**
   * Enumerate the builder addresses the user has active fee approvals for
   * (ADR-0036 D-4). HL caps a user at 10 concurrent builder approvals; when
   * `approveBuilderFee` rejects on that cap, this list feeds the revoke
   * picker. Returns lowercased branded addresses.
   */
  queryApprovedBuilders(
    user: WalletAddress,
  ): ResultAsync<ReadonlyArray<WalletAddress>, HyperliquidGatewayError>

  /**
   * Revoke a builder-fee approval by re-approving the builder at
   * `maxFeeRate: "0%"` (ADR-0036 D-4) — Hyperliquid has no dedicated revoke
   * action; a zero-rate approval frees one of the 10 builder slots. Master
   * wallet signature required, same as {@link approveBuilderFee}.
   */
  revokeBuilderFee(
    masterWallet: WalletClient,
    builder: WalletAddress,
  ): ResultAsync<void, HyperliquidGatewayError>

  /**
   * First Deposit predicate (ADR-0027, amended 2026-05-30). Returns true when
   * the user's non-funding ledger (queried from `startTime: 0`) has **at least
   * one entry** — i.e. the Account has *ever* been funded / had activity. We do
   * NOT match only `delta.type === 'deposit'`: an account is just as funded when
   * its USDC arrived via a transfer (`spotTransfer`, `internalTransfer`, `send`,
   * `subAccountTransfer`), a spot↔perp move (`accountClassTransfer`), or a vault
   * return (`vaultWithdraw`, `vaultDistribution`) as via a bridge `deposit`. A
   * genuinely never-funded address returns an empty ledger (`[]`). This is a
   * one-time milestone, NOT a live balance check: a later withdrawal does not
   * erase ledger history, so once true this stays true. The live "can this
   * account trade right now" question is **Tradeable Funds** (`accountValue >
   * 0`), which lives at the order-submit gate, not here, and remains the real
   * protection against 0-equity orders. Exposes only the boolean at the gateway
   * seam so the deposit provider never inspects the ledger itself.
   */
  queryHasEverFunded(
    user: WalletAddress,
  ): ResultAsync<boolean, HyperliquidGatewayError>

  /**
   * Read the user's account abstraction mode (`disabled | default |
   * unifiedAccount | portfolioMargin | dexAbstraction`). Address-only, no
   * signature. Colocated on the exchange gateway (like `queryMaxBuilderFee` /
   * `queryHasEverFunded`) so the HIP-3 abstraction provider can bootstrap its
   * status self-contained. Drives whether a default account still needs
   * `enableDexAbstraction` before it can trade HIP-3 markets: `dexAbstraction`,
   * `unifiedAccount`, and `portfolioMargin` all auto-abstract HIP-3 collateral;
   * `default` / `disabled` do not.
   */
  queryUserAbstraction(
    user: WalletAddress,
  ): ResultAsync<UserAbstractionResponse, HyperliquidGatewayError>
}

export interface NktkasHyperliquidExchangeGatewayOptions {
  /** Hyperliquid network. Maps to `isTestnet` on the HTTP transport. */
  readonly isTestnet: boolean
  /** Required structured logger. Bound to `module: 'hyperliquid-exchange-gateway'`. */
  readonly logger: Logger
  /** Optional HTTP transport override — used by tests with a fake IRequestTransport. */
  readonly httpTransport?: IRequestTransport
}

export function createNktkasHyperliquidExchangeGateway(
  options: NktkasHyperliquidExchangeGatewayOptions,
): HyperliquidExchangeGateway {
  const httpTransport: IRequestTransport =
    options.httpTransport ?? new HttpTransport({ isTestnet: options.isTestnet })

  // Bind logger once — never re-bind per method call (logging.md).
  const log = options.logger.child({ module: 'hyperliquid-exchange-gateway' })

  // AGENT-05: log fields are strictly {method} on entry and {method, durationMs} on exit.
  // No agentName, no key hex, no wallet address ever appears in log fields.
  function instrument<T>(
    method: string,
    run: () => Promise<T>,
  ): ResultAsync<T, HyperliquidGatewayError> {
    log.debug({ method }, 'sdk call')
    const startedAt = Date.now()
    return ResultAsync.fromPromise<T, HyperliquidGatewayError>(run(), (cause) => {
      const mapped = mapSdkError(cause)
      const durationMs = Date.now() - startedAt
      log.warn(
        { method, kind: mapped.kind, errorMessage: mapped.message, durationMs },
        'sdk call failed',
      )
      return mapped
    }).map((value) => {
      const durationMs = Date.now() - startedAt
      log.debug({ method, durationMs }, 'sdk call ok')
      return value
    })
  }

  return {
    approveAgent(masterWallet, agentAddress, agentName) {
      // AGENT-05: only {method} is logged — no agentName or key hex in instrument() entry log.
      // Cast: WalletClient satisfies AbstractViemJsonRpcAccount (signTypedData + getAddresses +
      // getChainId). The SDK's isViemJsonRpcAccount guard matches this shape at runtime.
      // Invariant: caller (use-agent-wallet.ts) only passes a WalletClient built from an
      // external Privy wallet's EIP-1193 provider — never a plain LocalAccount.
      return instrument('approveAgent', () =>
        approveAgent(
          { transport: httpTransport, wallet: masterWallet as AbstractWallet },
          { agentAddress, agentName },
        ),
      ).map(() => undefined)
    },

    signL1Action(agentWallet, action, nonce) {
      return instrument<Signature>('signL1Action', () =>
        signL1Action({ wallet: agentWallet, action, nonce, isTestnet: options.isTestnet }),
      ).map(({ r, s, v }) => ({ r, s, v }))
    },

    placeOrder(agentWallet, params) {
      return instrument<OrderSuccessResponse>('order', () =>
        order({ transport: httpTransport, wallet: agentWallet }, params),
      )
    },

    cancelOrder(agentWallet, params) {
      return instrument<CancelSuccessResponse>('cancel', () =>
        cancel({ transport: httpTransport, wallet: agentWallet }, params),
      )
    },

    cancelOrderByCloid(agentWallet, params) {
      return instrument<CancelSuccessResponse>('cancelByCloid', () =>
        cancelByCloid({ transport: httpTransport, wallet: agentWallet }, params),
      )
    },

    modifyOrder(agentWallet, params) {
      return instrument<ModifySuccessResponse>('modify', () =>
        modify({ transport: httpTransport, wallet: agentWallet }, params),
      )
    },

    placeTwapOrder(agentWallet, params) {
      return instrument<TwapOrderSuccessResponse>('twapOrder', () =>
        twapOrder({ transport: httpTransport, wallet: agentWallet }, params),
      )
    },

    cancelTwap(agentWallet, params) {
      return instrument<TwapCancelSuccessResponse>('twapCancel', () =>
        twapCancel({ transport: httpTransport, wallet: agentWallet }, params),
      )
    },

    updateLeverage(agentWallet, params) {
      return instrument<UpdateLeverageSuccessResponse>('updateLeverage', () =>
        updateLeverage({ transport: httpTransport, wallet: agentWallet }, params),
      )
    },

    formatPrice(price, szDecimals, marketType) {
      // SDK formatPrice throws (TypeError / RangeError) on a non-numeric or
      // zero result. Coerce that throw into a typed err at this boundary so the
      // trader adapter never needs a try/catch (error-handling.md).
      return Result.fromThrowable(
        () => formatPrice(price, szDecimals, marketType),
        (cause) =>
          new HyperliquidGatewayError('invalid-response', `formatPrice failed: ${String(cause)}`, cause),
      )()
    },

    formatSize(size, szDecimals) {
      return Result.fromThrowable(
        () => formatSize(size, szDecimals),
        (cause) =>
          new HyperliquidGatewayError('invalid-response', `formatSize failed: ${String(cause)}`, cause),
      )()
    },

    approveBuilderFee(masterWallet) {
      // Only {method} on entry — never the builder address or maxFeeRate as a
      // raw field. The constants are public but logging.md rule 1 forbids raw
      // addresses in any log payload, and instrument() observes that contract.
      const maxFeeRate = formatTenthsOfBpsAsPercentString(
        HYPERLIQUID_BUILDER_FEE_TENTHS_OF_BPS,
      )
      return instrument('approveBuilderFee', () =>
        approveBuilderFee(
          { transport: httpTransport, wallet: masterWallet as AbstractWallet },
          { maxFeeRate, builder: HYPERLIQUID_BUILDER_ADDRESS },
        ),
      ).map(() => undefined)
    },

    enableDexAbstraction(masterWallet, user) {
      // Only {method} on entry — never the user address in a log field
      // (instrument() keeps the SDK log surface to {method, durationMs} only,
      // and logging.md rule 1 forbids raw addresses). Same WalletClient-as-
      // AbstractWallet cast invariant as approveBuilderFee — the caller resolves
      // the master from getMasterViemAccount() (a viem WalletClient). WalletAddress
      // brand-strip on `user` matches queryMaxBuilderFee's cast invariant.
      return instrument('userDexAbstraction', () =>
        userDexAbstraction(
          { transport: httpTransport, wallet: masterWallet as AbstractWallet },
          { user: user as `0x${string}`, enabled: true },
        ),
      ).map(() => undefined)
    },

    usdClassTransfer(masterWallet, params) {
      // Only {method} on entry — never amount/direction in a log field (they are
      // not secrets, but instrument() keeps the SDK log surface to {method,
      // durationMs} only). Cast: WalletClient satisfies AbstractWallet at runtime
      // (signTypedData + getChainId), the same invariant as approveBuilderFee —
      // the caller resolves it from getMasterViemAccount() (a viem WalletClient).
      return instrument('usdClassTransfer', () =>
        usdClassTransfer(
          { transport: httpTransport, wallet: masterWallet as AbstractWallet },
          { amount: params.amount, toPerp: params.toPerp },
        ),
      ).map(() => undefined)
    },

    withdraw3(masterWallet, params) {
      // Only {method} on entry — never the destination/amount in a log field
      // (instrument() keeps the SDK log surface to {method, durationMs} only).
      // Cast: WalletClient satisfies AbstractWallet at runtime (signTypedData +
      // getChainId), the same invariant as usdClassTransfer — the caller
      // resolves it from getMasterViemAccount() (a viem WalletClient). The
      // branded WalletAddress destination is assignable to the SDK's plain
      // `string` destination input — no brand-strip cast needed.
      return instrument('withdraw3', () =>
        withdraw3(
          { transport: httpTransport, wallet: masterWallet as AbstractWallet },
          { destination: params.destination, amount: params.amount },
        ),
      ).map(() => undefined)
    },

    usdSend(masterWallet, params) {
      // Only {method} on entry — never the destination/amount in a log field
      // (instrument() keeps the SDK log surface to {method, durationMs} only).
      // Cast: WalletClient satisfies AbstractWallet at runtime (signTypedData +
      // getChainId), the same invariant as withdraw3 — the caller resolves it
      // from getMasterViemAccount() (a viem WalletClient). The branded
      // WalletAddress destination is assignable to the SDK's plain `string`
      // destination input — no brand-strip cast needed.
      return instrument('usdSend', () =>
        usdSend(
          { transport: httpTransport, wallet: masterWallet as AbstractWallet },
          { destination: params.destination, amount: params.amount },
        ),
      ).map(() => undefined)
    },

    spotSend(masterWallet, params) {
      // Only {method} on entry — never the destination/token/amount in a log
      // field (instrument() keeps the SDK log surface to {method, durationMs}
      // only). Same WalletClient-as-AbstractWallet cast invariant as usdSend.
      // The branded WalletAddress destination is assignable to the SDK's plain
      // `string` destination input — no brand-strip cast needed.
      return instrument('spotSend', () =>
        spotSend(
          { transport: httpTransport, wallet: masterWallet as AbstractWallet },
          { destination: params.destination, token: params.token, amount: params.amount },
        ),
      ).map(() => undefined)
    },

    queryMaxBuilderFee(user) {
      // Cast: WalletAddress is a branded `0x${string}` (see shared/domain).
      // The SDK accepts the raw template-literal type; the cast strips the
      // brand without changing the runtime value. Safe by construction.
      return instrument('maxBuilderFee', () =>
        maxBuilderFee(
          { transport: httpTransport },
          { user: user as `0x${string}`, builder: HYPERLIQUID_BUILDER_ADDRESS },
        ),
      )
    },

    queryAgents(user) {
      // Cast: WalletAddress brand-strip — see queryMaxBuilderFee above for the
      // same invariant (the SDK accepts raw `0x${string}`).
      return instrument('extraAgents', () =>
        extraAgents(
          { transport: httpTransport },
          { user: user as `0x${string}` },
        ),
      ).map((sdkAgents) =>
        // Project the SDK's `{ address, name, validUntil }[]` with the brand
        // applied to the address. `validUntil` is kept (ADR-0036): the
        // slots-full victim picker renders each agent's expiry so the user can
        // pick the least-valuable agent to replace.
        sdkAgents.map((agent) => ({
          address: brandSdkAddress(agent.address),
          name: agent.name,
          validUntil: agent.validUntil,
        })),
      )
    },

    queryApprovedBuilders(user) {
      // Cast: WalletAddress brand-strip — see queryMaxBuilderFee above for the
      // same invariant (the SDK accepts raw `0x${string}`).
      return instrument('approvedBuilders', () =>
        approvedBuilders(
          { transport: httpTransport },
          { user: user as `0x${string}` },
        ),
      ).map((builders) => builders.map(brandSdkAddress))
    },

    revokeBuilderFee(masterWallet, builder) {
      // A 0% approval is Hyperliquid's only slot-freeing mechanism for builder
      // approvals (ADR-0036 D-4) — there is no dedicated revoke action. Same
      // WalletClient-as-AbstractWallet cast invariant as approveBuilderFee.
      return instrument('revokeBuilderFee', () =>
        approveBuilderFee(
          { transport: httpTransport, wallet: masterWallet as AbstractWallet },
          { maxFeeRate: '0%', builder: builder as `0x${string}` },
        ),
      ).map(() => undefined)
    },

    queryHasEverFunded(user) {
      // Cast: WalletAddress brand-strip — see queryMaxBuilderFee above for the
      // same invariant (the SDK accepts raw `0x${string}`).
      // ADR-0027 (amended): First Deposit is chain-derived from the non-funding
      // ledger (deposits, withdrawals, transfers, vault ops) queried from the
      // epoch (`startTime: 0`). Any entry means the account has been funded /
      // used — we deliberately do NOT narrow to `delta.type === 'deposit'`,
      // because transfer-funded accounts are just as funded (the original bug:
      // a vault-funded account whose USDC arrived via spotTransfer had no
      // `deposit` row and wrongly re-nagged onboarding). A never-funded address
      // returns []. instrument() logs only {method, durationMs}; no ledger
      // amounts or addresses are logged.
      return instrument('userNonFundingLedgerUpdates', () =>
        userNonFundingLedgerUpdates(
          { transport: httpTransport },
          { user: user as `0x${string}`, startTime: 0 },
        ),
      ).map((updates) => updates.length > 0)
    },

    queryUserAbstraction(user) {
      // Cast: WalletAddress brand-strip — see queryMaxBuilderFee above for the
      // same invariant (the SDK accepts raw `0x${string}`). Address-only info
      // read; instrument() logs only {method, durationMs}.
      return instrument<UserAbstractionResponse>('userAbstraction', () =>
        userAbstraction(
          { transport: httpTransport },
          { user: user as `0x${string}` },
        ),
      )
    },
  }
}
