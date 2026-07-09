export type AccountAvatarTriggerView =
  | { kind: 'hidden' }
  | { kind: 'loading' }
  | {
      kind: 'ready'
      handle: string
      onOpen: () => void
    }
