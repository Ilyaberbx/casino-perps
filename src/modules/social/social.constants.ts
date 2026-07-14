// Timing, caps, and copy for the fake chat surface. Primitive data only — no
// imports (constants files are data leaves). Fixture DATA lives in
// social.fixtures.ts alongside the standing "this is simulated" disclosure.

/**
 * Standing disclosure rendered as a visible footer note beside the chat. The
 * reel is fabricated social proof shown next to a real-money button, so say so.
 * Keep this string honest and short.
 */
export const DISCLOSURE_TEXT = 'Chat is simulated.'

/** Lower bound of the jittered gap between scripted chat appends. */
export const CHAT_APPEND_MIN_DELAY_MS = 2000
/** Upper bound of the jittered gap between scripted chat appends. */
export const CHAT_APPEND_MAX_DELAY_MS = 5000
/** Hard cap on retained messages so the reel does not grow memory unbounded. */
export const CHAT_MAX_MESSAGES = 80
/** Decorative "online now" count shown in the chat footer. */
export const CHAT_ONLINE_COUNT = 200
