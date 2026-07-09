import styles from './manage-funds-modal.module.css'
import { UNSUPPORTED_COPY } from './manage-funds-modal.constants'
import type {
  ApplicableGateProps,
  CapabilityView,
  ManageFundsPaneProps,
} from './manage-funds-modal.types'

/**
 * Dumb right pane: renders the body for the active tab only — a venue
 * provider/body is mounted ONLY while its tab is active, so we never eagerly
 * mount every venue state machine. Deposit/withdraw/send/evm-core mount
 * `<Provider><Body/>` when present; transfer additionally gates on
 * `useTransfer().isApplicable` inside the provider (mirrors `TransferSheet`'s
 * `ApplicableGate`). A tab whose capability is absent renders an unsupported note.
 */
export function ManageFundsPane({
  activeTab,
  deposit,
  transfer,
  withdraw,
  send,
  evmCore,
}: ManageFundsPaneProps) {
  if (activeTab === 'deposit') return <CapabilityPane capability={deposit} />
  if (activeTab === 'withdraw') return <CapabilityPane capability={withdraw} />
  if (activeTab === 'send') return <CapabilityPane capability={send} />
  if (activeTab === 'evm-core') return <CapabilityPane capability={evmCore} />
  if (activeTab === 'transfer') return <TransferPane capability={transfer} />

  return <UnsupportedPane />
}

/** Mounts an Option-A capability body inside its provider, or an unsupported note. */
function CapabilityPane({ capability }: { capability: CapabilityView | null }) {
  if (!capability) return <UnsupportedPane />
  const { Provider, Body } = capability
  return (
    <Provider>
      <Body />
    </Provider>
  )
}

function TransferPane({
  capability,
}: {
  capability: ManageFundsPaneProps['transfer']
}) {
  if (!capability) return <UnsupportedPane />
  const { Provider, Body, useTransfer } = capability
  return (
    <Provider>
      <ApplicableGate useTransfer={useTransfer} Body={Body} />
    </Provider>
  )
}

function ApplicableGate({ useTransfer, Body }: ApplicableGateProps) {
  const { isApplicable } = useTransfer()
  if (!isApplicable) return <UnsupportedPane />
  return <Body />
}

function UnsupportedPane() {
  return (
    <div className={styles.unsupported} role="status">
      <p className={styles.unsupportedBody}>{UNSUPPORTED_COPY}</p>
    </div>
  )
}
