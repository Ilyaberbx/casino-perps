import { ChatTextRow } from './ChatTextRow'
import { TipRow } from './TipRow'
import { WinBragCard } from './WinBragCard'
import type { ChatMessageRowProps } from './chat-panel.types'

export function ChatMessageRow({ message }: ChatMessageRowProps) {
  switch (message.kind) {
    case 'win-brag':
      return <WinBragCard message={message} />
    case 'tip':
      return <TipRow message={message} />
    case 'text':
      return <ChatTextRow message={message} />
  }
}
