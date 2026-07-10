import type { ChangeEvent, FormEvent, RefObject } from 'react'
import type {
  ChatMessage,
  ChatTextMessage,
  ChatTipMessage,
  ChatWinBragMessage,
} from '../../social.types'

export interface ChatViewModel {
  readonly messages: ChatMessage[]
  readonly scrollRef: RefObject<HTMLDivElement | null>
  readonly draft: string
  readonly handleDraftChange: (event: ChangeEvent<HTMLInputElement>) => void
  readonly handleSubmit: (event: FormEvent) => void
  readonly canSubmit: boolean
  readonly collapsed: boolean
  readonly onToggleCollapse: () => void
  readonly onlineCount: number
}

export interface ChatHeaderProps {
  readonly collapsed: boolean
  readonly onToggleCollapse: () => void
}

export interface ChatMessageRowProps {
  readonly message: ChatMessage
}

export interface ChatTextRowProps {
  readonly message: ChatTextMessage
}

export interface WinBragCardProps {
  readonly message: ChatWinBragMessage
}

export interface TipRowProps {
  readonly message: ChatTipMessage
}

export interface ChatComposerProps {
  readonly draft: string
  readonly onChange: (event: ChangeEvent<HTMLInputElement>) => void
  readonly onSubmit: (event: FormEvent) => void
  readonly canSubmit: boolean
}
