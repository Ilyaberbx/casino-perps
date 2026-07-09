import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSessionBootstrap } from '../use-session-bootstrap'

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
}

describe('useSessionBootstrap', () => {
  it('runs the bootstrap exactly once per connect session', async () => {
    const run = vi.fn()
    const { rerender } = renderHook(
      (props: { isConnected: boolean; canBootstrap: boolean }) =>
        useSessionBootstrap({ ...props, onReset: () => {}, run }),
      { initialProps: { isConnected: true, canBootstrap: true } },
    )
    await flush()
    rerender({ isConnected: true, canBootstrap: true })
    await flush()
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('resets and re-runs the bootstrap when the bootstrapKey changes mid-session (wallet re-key)', async () => {
    const run = vi.fn()
    const onReset = vi.fn()
    const { rerender } = renderHook(
      (props: { bootstrapKey: string | null }) =>
        useSessionBootstrap({
          isConnected: true,
          canBootstrap: true,
          bootstrapKey: props.bootstrapKey,
          onReset,
          run,
        }),
      { initialProps: { bootstrapKey: 'addr-a' } },
    )
    await flush()
    expect(run).toHaveBeenCalledTimes(1)

    // Switch the key (Selected Wallet changed) — reset fires, bootstrap re-runs.
    rerender({ bootstrapKey: 'addr-b' })
    await flush()
    expect(onReset).toHaveBeenCalled()
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('fires onDisconnect on a full disconnect but NOT on a mid-session re-key', async () => {
    const onDisconnect = vi.fn()
    const { rerender } = renderHook(
      (props: { isConnected: boolean; bootstrapKey: string | null }) =>
        useSessionBootstrap({
          isConnected: props.isConnected,
          canBootstrap: props.isConnected,
          bootstrapKey: props.bootstrapKey,
          onReset: () => {},
          onDisconnect,
          run: () => {},
        }),
      { initialProps: { isConnected: true, bootstrapKey: 'addr-a' } },
    )
    await flush()

    // Mid-session re-key (Selected Wallet switch) — onDisconnect must NOT fire.
    rerender({ isConnected: true, bootstrapKey: 'addr-b' })
    await flush()
    expect(onDisconnect).not.toHaveBeenCalled()

    // Full disconnect — onDisconnect fires exactly once.
    rerender({ isConnected: false, bootstrapKey: 'addr-b' })
    await flush()
    expect(onDisconnect).toHaveBeenCalledTimes(1)
  })

  it('does NOT re-run when the bootstrapKey is stable across renders', async () => {
    const run = vi.fn()
    const { rerender } = renderHook(
      (props: { bootstrapKey: string | null }) =>
        useSessionBootstrap({
          isConnected: true,
          canBootstrap: true,
          bootstrapKey: props.bootstrapKey,
          onReset: () => {},
          run,
        }),
      { initialProps: { bootstrapKey: 'addr-a' } },
    )
    await flush()
    rerender({ bootstrapKey: 'addr-a' })
    await flush()
    expect(run).toHaveBeenCalledTimes(1)
  })
})
