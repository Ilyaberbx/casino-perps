import type { FlowAssetsStatus, FlowMetaStatus } from './shared-flow.types'

/**
 * Derive the token-picker readiness from the asset-metadata fetch status and the
 * resolved token count. `loading`/`error` pass straight through (the list can't
 * be trusted yet); once the metadata is `ready`, a zero-length list is the
 * legitimate `empty` case (e.g. Core→EVM with no holdings) and a non-empty list
 * is `ready`. Shared by the send / evm-core flows so the empty-vs-loading
 * distinction is decided one way. Pure.
 */
export function deriveFlowAssetsStatus(
  metaStatus: FlowMetaStatus,
  tokenCount: number,
): FlowAssetsStatus {
  if (metaStatus === 'loading') return 'loading'
  if (metaStatus === 'error') return 'error'
  if (tokenCount === 0) return 'empty'
  return 'ready'
}
