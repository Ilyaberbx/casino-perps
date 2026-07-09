import { IconSelect } from '@/modules/shared/components/icon-select'
import type { IconSelectOption } from '@/modules/shared/components/icon-select'
import { AgentIcon } from './AgentIcon'
import { SOON_BADGE } from './perp-suggestion-sheet.constants'
import styles from './perp-suggestion-sheet.module.css'
import type { AgentId } from './ai-agents.types'
import type { AgentPickerProps } from './perp-suggestion-sheet.types'

const AGENT_ICON_SIZE = 18

/**
 * The agent picker (slice 07): a shared `IconSelect` dropdown listing every AI
 * Agent, each backed by its mark (Minara's logo, the three-eye for Native).
 * Minara is enabled; the Native Agent is `disabled` with a "soon" suffix — listed
 * but never selectable (the hook also rejects a non-enabled agent). Dumb.
 */
export function AgentPicker({ agents, selectedAgentId, onSelect }: AgentPickerProps) {
  const options: IconSelectOption[] = agents.map((agent) => ({
    value: agent.id,
    label: agent.comingSoon ? `${agent.label} · ${SOON_BADGE}` : agent.label,
    disabled: !agent.enabled,
    icon: <AgentIcon kind={agent.iconKind} size={AGENT_ICON_SIZE} />,
  }))

  return (
    <IconSelect
      options={options}
      value={selectedAgentId}
      // IconSelect emits the option's `value`, always one of our `AgentId`s; the
      // hook re-validates against AI_AGENTS before applying.
      onChange={(value) => onSelect(value as AgentId)}
      ariaLabel="Select AI agent"
      className={styles.dexDropdown}
    />
  )
}
