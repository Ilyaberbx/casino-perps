import { AgentField } from './AgentField'
import styles from './perp-suggestion-sheet.module.css'
import type { AgentParamFormProps } from './perp-suggestion-sheet.types'

/**
 * Renders the selected agent's request form from its typed schema (slice 08).
 * One generic renderer over the closed `market | slider | select` field-kind
 * union — the form never knows an agent's specific fields. The Native (disabled)
 * agent declares no fields, so its form is a "coming soon" placeholder. Dumb.
 */
export function AgentParamForm({ agent, form }: AgentParamFormProps) {
  if (agent.fields.length === 0) {
    return (
      <p className={styles.hint} data-testid="agent-coming-soon">
        {agent.label} is coming soon.
      </p>
    )
  }

  return (
    <div className={styles.form} data-testid="agent-param-form">
      {agent.fields.map((field) => (
        <AgentField key={field.key} field={field} form={form} />
      ))}
    </div>
  )
}
