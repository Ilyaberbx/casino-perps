import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { usePrefersReducedMotion } from '@/modules/shared/hooks/use-prefers-reduced-motion'
import { CHAT_ONLINE_COUNT } from '../../social.constants'
import {
  CHAT_SEED_MESSAGES,
  LOCAL_ECHO_USER,
  SCRIPTED_CHAT_REEL,
} from '../../social.fixtures'
import type { ChatMessage } from '../../social.types'
import {
  capMessages,
  createMessageId,
  nextJitterDelayMs,
  withMessageId,
} from '../../social.utils'
import type { ChatViewModel } from './chat-panel.types'

function seedMessages(): ChatMessage[] {
  return CHAT_SEED_MESSAGES.map((scripted, index) =>
    withMessageId(scripted, createMessageId(index)),
  )
}

/**
 * Smart hook for the fake live-chat panel. Owns the scripted reel timer, the
 * capped message list, the local-echo composer, and collapse state. There is no
 * network here (PRD 0008 D4) — appends come from the fixture reel, and the
 * composer echoes into the same local list without sending anything anywhere.
 */
export function useChat(): ChatViewModel {
  const prefersReducedMotion = usePrefersReducedMotion()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const sequenceRef = useRef(CHAT_SEED_MESSAGES.length)
  const reelIndexRef = useRef(0)

  const [messages, setMessages] = useState<ChatMessage[]>(seedMessages)
  const [draft, setDraft] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  const takeNextId = useCallback((): string => {
    const id = createMessageId(sequenceRef.current)
    sequenceRef.current += 1
    return id
  }, [])

  const appendScripted = useCallback(() => {
    const reelLength = SCRIPTED_CHAT_REEL.length
    const scripted = SCRIPTED_CHAT_REEL[reelIndexRef.current % reelLength]
    reelIndexRef.current += 1
    const message = withMessageId(scripted, takeNextId())
    setMessages((current) => capMessages([...current, message]))
  }, [takeNextId])

  // Scripted appends on a self-rescheduling jittered timeout (2–5s), so the crowd
  // does not tick in on a mechanical fixed beat. Cleared on unmount.
  useEffect(() => {
    let timeoutId = 0
    function schedule(): void {
      timeoutId = window.setTimeout(() => {
        appendScripted()
        schedule()
      }, nextJitterDelayMs())
    }
    schedule()
    return () => window.clearTimeout(timeoutId)
  }, [appendScripted])

  // Auto-scroll to the newest message. Under prefers-reduced-motion we jump
  // instantly (`auto`) instead of animating (`smooth`) — no autoscroll animation.
  useEffect(() => {
    const node = scrollRef.current
    if (node === null) return
    const behavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth'
    node.scrollTo({ top: node.scrollHeight, behavior })
  }, [messages, prefersReducedMotion])

  const handleDraftChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setDraft(event.target.value)
  }, [])

  const canSubmit = draft.trim().length > 0

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault()
      const trimmed = draft.trim()
      const isEmpty = trimmed.length === 0
      if (isEmpty) return
      // Local echo ONLY. No chat backend exists (PRD 0008 D4); this message is
      // appended to the local reel and never leaves the browser.
      const message: ChatMessage = {
        id: takeNextId(),
        kind: 'text',
        user: LOCAL_ECHO_USER,
        text: trimmed,
      }
      setMessages((current) => capMessages([...current, message]))
      setDraft('')
    },
    [draft, takeNextId],
  )

  const onToggleCollapse = useCallback(() => {
    setCollapsed((current) => !current)
  }, [])

  return {
    messages,
    scrollRef,
    draft,
    handleDraftChange,
    handleSubmit,
    canSubmit,
    collapsed,
    onToggleCollapse,
    onlineCount: CHAT_ONLINE_COUNT,
  }
}
