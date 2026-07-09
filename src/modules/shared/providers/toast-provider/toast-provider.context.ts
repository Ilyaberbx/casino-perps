import { createContext } from 'react'
import type { ToastContextValue } from './toast-provider.types'

export const ToastContext = createContext<ToastContextValue | null>(null)
