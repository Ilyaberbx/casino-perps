// ⚠️ SIMULATED SOCIAL PROOF. Every user, message, brag, tip, and win below is
// fabricated. These fixtures depict wins that DID NOT HAPPEN, rendered next to a
// real-money "Place Bet" button (PRD 0008 §13 R5). Nothing here is a real person,
// a real trade, or a real payout. There is no chat backend and no websocket — the
// reel plays entirely from this file on a local timer. The user-facing admission
// of this is DISCLOSURE_TEXT ("Chat and Live Wins are simulated.") in
// social.constants.ts, which a later phase renders as a visible disclosure.

import type { ChatUser, LiveWin, ScriptedChatMessage } from './social.types'

// Per-user name colors. Teal/cyan are the brand safe accents; the warmer hues add
// crowd variety. No color carries meaning here — it is purely per-user identity.
const CYAN = '#50D7E9'
const MAGENTA = '#CE37DC'
const GOLD = '#F5B740'
const ORANGE = '#FF8A4C'
const GREEN = '#24FF96'
const CORAL = '#FF4D6A'
const TEAL = '#248894'
const VIOLET = '#A98BFF'

const KOLAKINYL: ChatUser = { name: 'Kolakinyl', color: CORAL, avatar: '🪙' }
const CH0P: ChatUser = { name: 'Ch0p', color: GOLD, avatar: '🥇' }
const FORTHEGODS: ChatUser = { name: 'ForTheGods', color: GOLD, avatar: '🥇' }
const KEYBOARDMONKEY: ChatUser = { name: 'Keyboardmonkey', color: MAGENTA, avatar: '🐵' }
const BLACKWIDOW: ChatUser = { name: 'Blackwidow', color: CORAL, avatar: '🕷️' }
const SANTAJOSE: ChatUser = { name: 'SantaJose', color: ORANGE, avatar: '🎅' }
const AIBRA: ChatUser = { name: 'aibra', color: GOLD, avatar: '🐈' }
const DRPORNY: ChatUser = { name: 'drporny', color: GOLD, avatar: '🎲' }
const SPINFORGATES: ChatUser = { name: 'spinforgates', color: GREEN, avatar: '🚀' }
const RENGARO: ChatUser = { name: 'Rengaro', color: CORAL, avatar: '🔥' }
const TETHNILEY: ChatUser = { name: 'tethniley', color: TEAL, avatar: '💎' }
const CATO: ChatUser = { name: 'cato', color: VIOLET, avatar: '🐱' }
const WAAAD: ChatUser = { name: 'Waaad', color: GOLD, avatar: '👛' }
const DEGEN1: ChatUser = { name: 'degen1', color: CYAN, avatar: '🎰' }

/** The local-echo identity used when the punter types into the (fake) composer. */
export const LOCAL_ECHO_USER: ChatUser = { name: 'You', color: '#F8F8F8', avatar: '😎' }

/** Messages already on screen when the panel first mounts, oldest → newest. */
export const CHAT_SEED_MESSAGES: readonly ScriptedChatMessage[] = [
  { kind: 'text', user: BLACKWIDOW, text: 'any scope on how to keep winning on BTC' },
  { kind: 'text', user: KEYBOARDMONKEY, text: 'new market just listed, go go go' },
  { kind: 'text', user: KOLAKINYL, text: '@Blackwidow change bet size every time' },
  { kind: 'text', user: CATO, text: 'GL everyone!' },
  { kind: 'win-brag', user: DEGEN1, market: 'BTC', multiplier: 12.4 },
  { kind: 'text', user: FORTHEGODS, text: 'same chop' },
  { kind: 'text', user: CH0P, text: 'i wish more markets were tradeable in my timezone' },
] as const

/**
 * The looping scripted reel. The chat hook walks this in order, wrapping around,
 * minting a fresh id per append. Ordering is deliberate: bragging, then reactions,
 * then a tip, so the crowd reads as a conversation rather than a random shuffle.
 */
export const SCRIPTED_CHAT_REEL: readonly ScriptedChatMessage[] = [
  { kind: 'text', user: FORTHEGODS, text: 'gmmm' },
  { kind: 'text', user: KOLAKINYL, text: 'Good luck @ForTheGods' },
  { kind: 'text', user: SPINFORGATES, text: 'Hey @Keyboardmonkey are you in chat?' },
  { kind: 'win-brag', user: WAAAD, market: 'ETH', multiplier: 33.5 },
  { kind: 'text', user: TETHNILEY, text: 'Nice hit! Congrats' },
  { kind: 'text', user: CH0P, text: 'whats the daily leaderboard prize?' },
  { kind: 'win-brag', user: DRPORNY, market: 'SOL', multiplier: 78.7 },
  { kind: 'text', user: AIBRA, text: 'meow' },
  { kind: 'text', user: DRPORNY, text: 'gotchu' },
  { kind: 'tip', fromName: 'drporny', toName: 'aibra', amountUsd: 5 },
  { kind: 'text', user: SANTAJOSE, text: "how's it going today" },
  { kind: 'win-brag', user: DEGEN1, market: 'BTC', multiplier: 37.4 },
  { kind: 'text', user: WAAAD, text: 'lfg' },
  { kind: 'text', user: KOLAKINYL, text: '@aibra win?' },
  { kind: 'tip', fromName: 'Jerzy', toName: 'Skyzen', amountUsd: 31 },
  { kind: 'text', user: RENGARO, text: 'Yo boys' },
  { kind: 'text', user: TETHNILEY, text: 'gyeeeet' },
  { kind: 'text', user: KOLAKINYL, text: 'gg' },
] as const

/**
 * The LIVE WINS strip seed. The ticker hook rotates this window on a timer so a
 * fresh card scrolls in without the list length (or memory) changing.
 */
export const LIVE_WINS_SEED: readonly Omit<LiveWin, 'id'>[] = [
  { market: 'BTC', username: 'bj22', amountUsd: 26 },
  { market: 'ETH', username: 'Cypher', amountUsd: 1 },
  { market: 'SOL', username: 'maurinho', amountUsd: 4 },
  { market: 'BTC', username: 'bj22', amountUsd: 26 },
  { market: 'DOGE', username: 'softwarec', amountUsd: 72 },
  { market: 'ETH', username: 'Cypher', amountUsd: 1 },
  { market: 'BTC', username: 'bj22', amountUsd: 26 },
  { market: 'HYPE', username: 'Waaad', amountUsd: 18 },
  { market: 'SOL', username: 'Cypher', amountUsd: 9 },
  { market: 'BTC', username: 'RockieRockie', amountUsd: 44 },
  { market: 'AVAX', username: 'drporny', amountUsd: 5 },
  { market: 'ETH', username: 'Leo5868', amountUsd: 61 },
] as const
