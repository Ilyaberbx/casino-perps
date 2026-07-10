// Public and internal types for the `social` module: the fake chat reel and the
// LIVE WINS ticker. All of this is fixture-driven, non-networked social proof —
// see social.fixtures.ts for the standing disclosure.

export type ChatMessageKind = 'text' | 'win-brag' | 'tip'

export interface ChatUser {
  readonly name: string
  /** CSS color string used to tint this user's name (per-user coloring). */
  readonly color: string
  /** Emoji rendered as the avatar chip. */
  readonly avatar: string
}

export interface ChatTextMessage {
  readonly id: string
  readonly kind: 'text'
  readonly user: ChatUser
  readonly text: string
}

export interface ChatWinBragMessage {
  readonly id: string
  readonly kind: 'win-brag'
  readonly user: ChatUser
  /** The market the (simulated) win landed on, e.g. `BTC`. */
  readonly market: string
  /** Multiplier hit, e.g. `12.4` → rendered as `12.4x`. */
  readonly multiplier: number
}

export interface ChatTipMessage {
  readonly id: string
  readonly kind: 'tip'
  readonly fromName: string
  readonly toName: string
  readonly amountUsd: number
}

export type ChatMessage = ChatTextMessage | ChatWinBragMessage | ChatTipMessage

/**
 * A scripted reel entry — a message without a runtime `id`. Ids are minted when
 * the entry is appended so React keys stay stable and unique across the session.
 */
export type ScriptedChatMessage =
  | Omit<ChatTextMessage, 'id'>
  | Omit<ChatWinBragMessage, 'id'>
  | Omit<ChatTipMessage, 'id'>

/** A single plain-or-mention span of a text message body. */
export interface ChatTextToken {
  readonly text: string
  readonly isMention: boolean
}

export interface LiveWin {
  readonly id: string
  /** The market the (simulated) win landed on, e.g. `BTC`. */
  readonly market: string
  readonly username: string
  readonly amountUsd: number
}
