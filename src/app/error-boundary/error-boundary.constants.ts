// User-facing copy + tuning for the crash screen. Calm-terminal voice (ADR-0042):
// reassuring, plain, never blames the user. Static literals only.

export const ERROR_COPY = {
  eyebrow: 'System fault',
  title: 'Something broke',
  body: "This screen crashed — not your account, and not your funds. They're safe. Reloading usually clears it. If it keeps happening, send us the log and we'll dig in.",
  reload: 'Reload app',
  goHome: 'Back to trading',
  helpTitle: 'Caught a bug?',
  helpSubtitle: 'Copy the log and open a ticket in our Discord, or reach us on X.',
  discordCta: 'Report on Discord',
  xCta: 'Contact on X',
  detailsSummary: 'Technical details',
  copyIdle: 'Copy error log',
  copyDone: 'Copied — paste it in Discord',
  requestIdLabel: 'Request ID',
} as const

// How long the "Copied" confirmation stays before the button reverts to idle.
export const COPY_FEEDBACK_MS = 2400

// Bound the stack we render + report so a pathological deep stack can't blow up
// the clipboard payload or the details panel.
export const MAX_STACK_CHARS = 4000

export const ERROR_BOUNDARY_LOG_MODULE = 'error-boundary'
