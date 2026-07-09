/**
 * Prop shapes for the parameterised flow sub-components shared across the
 * send / withdraw / evm-core bodies. Each flow owns its own CSS module, copy
 * constants, and percent/token domain types; these components take the
 * per-flow differences as props (the `styles` object, the chip values, the
 * `idPrefix`, the resolved copy) so the DOM + class hooks stay identical to the
 * per-flow copies they replace.
 */

import type { FlowStyles } from '@/modules/shared/components/flow-percent-chips'

/**
 * The spot-metadata fetch status shared by the send / evm-core flows. `loading`
 * while the `getSpotMetaAndAssetCtxs` read is in flight; `error` when it failed
 * (offer a retry); `ready` once the token index is resolved. Owned by
 * `useFlowMetaFetch` and threaded into each flow's hook (where it folds into the
 * `FlowAssetsStatus` the picker renders, via `deriveFlowAssetsStatus`).
 */
export type FlowMetaStatus = 'loading' | 'error' | 'ready'

/**
 * The readiness of a flow's asset list — what the token picker shows instead of
 * a bare empty `<select>`. `loading` while the spot metadata fetch is in flight;
 * `error` when it failed (offer a retry); `empty` when the fetch succeeded but
 * the account legitimately holds no transferable assets; `ready` once there is at
 * least one token to pick. Surfaced out of each flow's hook so the dumb form can
 * branch on it. See `FlowTokenSelect`.
 */
export type FlowAssetsStatus = 'loading' | 'error' | 'empty' | 'ready'

/**
 * The minimal token shape the shared select renders — `SendableToken` and
 * `EvmCoreToken` both satisfy it structurally.
 */
export interface FlowSelectableToken {
  readonly key: string
  readonly symbol: string
  readonly available: number
}

export interface FlowErrorCalloutProps {
  readonly styles: FlowStyles
  readonly label: string
  readonly prose: string
  readonly retryCta: string
  onRetry(): void
}

/** Copy strings the token picker renders for its non-`ready` states. */
export interface FlowTokenSelectStateCopy {
  /** Shown while the asset list is loading. */
  readonly loading: string
  /** Shown when the asset-list fetch failed (above the retry button). */
  readonly error: string
  /** The retry button label in the `error` state. */
  readonly errorRetry: string
  /** Shown when the fetch succeeded but the account holds no transferable assets. */
  readonly empty: string
}

import type { KeyboardEvent } from 'react'

/** Inputs to the token-dropdown smart hook (`useFlowTokenSelect`). */
export interface UseFlowTokenSelectInput<T extends FlowSelectableToken> {
  readonly tokens: ReadonlyArray<T>
  readonly selectedTokenKey: string
  readonly idPrefix: string
  onSelect(key: string): void
}

/** The view-model the dumb dropdown component renders. */
export interface UseFlowTokenSelectReturn {
  readonly isOpen: boolean
  readonly activeIndex: number
  readonly selectedIndex: number
  readonly listboxId: string
  optionId(index: number): string
  readonly activeDescendantId: string | undefined
  // Callback refs (not ref objects) so the dumb component can attach DOM nodes
  // without reading a ref value during render — the React Compiler's
  // `react-hooks/refs` rule forbids passing a returned `RefObject` to `ref={}`.
  setTriggerRef(node: HTMLButtonElement | null): void
  setWrapRef(node: HTMLDivElement | null): void
  setListboxRef(node: HTMLUListElement | null): void
  toggle(): void
  onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>): void
  onListboxKeyDown(event: KeyboardEvent<HTMLUListElement>): void
  onOptionPointerEnter(index: number): void
  onOptionClick(index: number): void
}

export interface FlowTokenSelectProps<T extends FlowSelectableToken> {
  readonly styles: FlowStyles
  readonly idPrefix: string
  readonly label: string
  readonly tokens: ReadonlyArray<T>
  readonly selectedTokenKey: string
  /** The asset-list readiness — drives the loading / error / empty / ready render. */
  readonly status: FlowAssetsStatus
  /** Copy for the non-`ready` states. */
  readonly stateCopy: FlowTokenSelectStateCopy
  onSelect(key: string): void
  /** Re-run the asset-list fetch from the `error` state. */
  onRetry(): void
}
