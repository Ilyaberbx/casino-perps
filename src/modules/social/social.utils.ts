// Pure display + scheduling helpers for the `social` module. No React, no IO, no
// module state — anything stateful lives in the smart hooks next to each component.

import {
  CHAT_APPEND_MAX_DELAY_MS,
  CHAT_APPEND_MIN_DELAY_MS,
  CHAT_MAX_MESSAGES,
} from './social.constants'
import type { ChatMessage, ChatTextToken, ScriptedChatMessage } from './social.types'

const MENTION_PATTERN = /(@\w+)/g

/** Stable, unique-per-session message id from a monotonic sequence number. */
export function createMessageId(sequence: number): string {
  return `chat-${sequence}`
}

/** Attach a runtime id to a scripted reel entry, preserving its discriminant. */
export function withMessageId(scripted: ScriptedChatMessage, id: string): ChatMessage {
  return { ...scripted, id }
}

/** Drop the oldest messages so the reel never exceeds the retention cap. */
export function capMessages(messages: readonly ChatMessage[]): ChatMessage[] {
  const overflow = messages.length - CHAT_MAX_MESSAGES
  const isWithinCap = overflow <= 0
  if (isWithinCap) return [...messages]
  return messages.slice(overflow)
}

/**
 * A jittered delay in `[MIN, MAX]` for the next scripted append. `random` is
 * injectable so tests can pin the timing deterministically.
 */
export function nextJitterDelayMs(random: () => number = Math.random): number {
  const span = CHAT_APPEND_MAX_DELAY_MS - CHAT_APPEND_MIN_DELAY_MS
  return CHAT_APPEND_MIN_DELAY_MS + Math.floor(random() * (span + 1))
}

/** Rotate the window left by one so a fresh card scrolls in, length unchanged. */
export function rotateLeft<T>(items: readonly T[]): T[] {
  const isTooShortToRotate = items.length < 2
  if (isTooShortToRotate) return [...items]
  const [head, ...rest] = items
  return [...rest, head]
}

/** Split a body into plain / `@mention` spans for per-token coloring. */
export function splitTextTokens(text: string): ChatTextToken[] {
  return text
    .split(MENTION_PATTERN)
    .filter((part) => part.length > 0)
    .map((part) => ({ text: part, isMention: part.startsWith('@') }))
}

/** `12.4` → `12.4x`, `335` → `335x`. */
export function formatMultiplier(multiplier: number): string {
  return `${multiplier}x`
}

/** `26` → `$26`, `5` → `$5.00` when `fractionDigits` is 2. */
export function formatUsd(amount: number, fractionDigits = 0): string {
  const body = amount.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
  return `$${body}`
}

/** Short monogram for a market symbol, e.g. `BTC` → `BTC`, `HYPE` → `HYP`. */
export function symbolMonogram(symbol: string): string {
  return symbol.slice(0, 3).toUpperCase()
}

function hashString(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash)
}

/** Deterministic 2-stop gradient for a market chip, derived from its symbol. */
export function symbolGradient(symbol: string): string {
  const hue = hashString(symbol) % 360
  const partnerHue = (hue + 40) % 360
  return `linear-gradient(135deg, hsl(${hue} 62% 34%), hsl(${partnerHue} 58% 22%))`
}
