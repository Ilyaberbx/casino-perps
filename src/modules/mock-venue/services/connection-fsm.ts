import type {
  ConnectionFsm,
  ConnectionFsmOptions,
  ConnectionFsmStatus,
} from '../mock-venue.types'

const MIN_DISCONNECT_INTERVAL_MILLISECONDS = 2 * 60 * 1000
const MAX_DISCONNECT_INTERVAL_MILLISECONDS = 5 * 60 * 1000
const MIN_RECONNECT_WINDOW_MILLISECONDS = 1_000
const MAX_RECONNECT_WINDOW_MILLISECONDS = 3_000

function sampleRange(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

export function createConnectionFsm(options: ConnectionFsmOptions): ConnectionFsm {
  const { rng, onChange } = options
  let currentStatus: ConnectionFsmStatus = 'connected'
  let disconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let isDisposed = false

  function scheduleNextDisconnect(): void {
    const delayMilliseconds = sampleRange(
      rng,
      MIN_DISCONNECT_INTERVAL_MILLISECONDS,
      MAX_DISCONNECT_INTERVAL_MILLISECONDS,
    )
    disconnectTimer = setTimeout(() => {
      const isAlreadyReconnecting = currentStatus === 'reconnecting'
      if (isDisposed || isAlreadyReconnecting) return
      transitionToReconnecting()
    }, delayMilliseconds)
  }

  function scheduleAutoReconnect(): void {
    const delayMilliseconds = sampleRange(
      rng,
      MIN_RECONNECT_WINDOW_MILLISECONDS,
      MAX_RECONNECT_WINDOW_MILLISECONDS,
    )
    reconnectTimer = setTimeout(() => {
      const isAlreadyConnected = currentStatus === 'connected'
      if (isDisposed || isAlreadyConnected) return
      transitionToConnected()
    }, delayMilliseconds)
  }

  function transitionToReconnecting(): void {
    currentStatus = 'reconnecting'
    onChange('reconnecting')
    scheduleAutoReconnect()
  }

  function transitionToConnected(): void {
    currentStatus = 'connected'
    onChange('connected')
    scheduleNextDisconnect()
  }

  scheduleNextDisconnect()

  return {
    status(): ConnectionFsmStatus {
      return currentStatus
    },

    simulateDisconnect(): void {
      const isAlreadyReconnecting = currentStatus === 'reconnecting'
      if (isAlreadyReconnecting) {
        throw new Error('invalid transition: reconnecting -> reconnecting')
      }
      if (disconnectTimer !== null) {
        clearTimeout(disconnectTimer)
        disconnectTimer = null
      }
      transitionToReconnecting()
    },

    simulateReconnect(): void {
      const isAlreadyConnected = currentStatus === 'connected'
      if (isAlreadyConnected) {
        throw new Error('invalid transition: connected -> connected')
      }
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
      transitionToConnected()
    },

    dispose(): void {
      isDisposed = true
      if (disconnectTimer !== null) clearTimeout(disconnectTimer)
      if (reconnectTimer !== null) clearTimeout(reconnectTimer)
      disconnectTimer = null
      reconnectTimer = null
    },
  }
}
