// Env-derived runtime config for community / support links (NOT a constant —
// see frontend-architecture.md: env-derived values live in *.config.ts). The
// error-boundary "Report on Discord" CTA deep-links here so a User who hit a
// crash can hand us the log. Mirrors trading.config.ts's `termsUrl` precedence:
// an OPTIONAL `VITE_DISCORD_INVITE_URL` override wins; an unset value falls back
// to the public community invite so a bare build still wires up.

// Unlimited-use community invite. Overridable per environment via
// VITE_DISCORD_INVITE_URL.
const FALLBACK_DISCORD_INVITE_URL = 'https://discord.gg/sfZwXRruG8'
const FALLBACK_X_URL = 'https://x.com/invaderstrade'

const discordInviteUrl = (
  import.meta.env.VITE_DISCORD_INVITE_URL || FALLBACK_DISCORD_INVITE_URL
).replace(/\/+$/, '')

const xUrl = (import.meta.env.VITE_X_URL || FALLBACK_X_URL).replace(/\/+$/, '')

export const supportConfig = {
  discordInviteUrl,
  xUrl,
}
