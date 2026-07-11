// Env-derived runtime config for the support link (NOT a constant — see
// frontend-architecture.md: env-derived values live in *.config.ts). The
// error-boundary "Email support" CTA deep-links here so a User who hit a crash
// can hand us the log. The casino client's one real support channel is the
// brand inbox (same target as the rail's Live Support); an OPTIONAL
// VITE_SUPPORT_EMAIL override wins so a staging build can route elsewhere.

const FALLBACK_SUPPORT_EMAIL = 'support@yeet.bet'

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || FALLBACK_SUPPORT_EMAIL

export const supportConfig = {
  supportEmail,
  supportMailto: `mailto:${supportEmail}`,
}
