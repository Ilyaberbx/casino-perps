import { describe, it, expect } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useWithdrawFlow } from '../use-withdraw-flow'
import {
  buildFailingWithdrawAuthorizer,
  buildInsufficientBalanceWithdrawAuthorizer,
  buildInsufficientGasWithdrawAuthorizer,
  buildReceiptTimeoutWithdrawAuthorizer,
  buildRejectedWithdrawAuthorizer,
  buildWithdrawDeps,
  buildWrongNetworkWithdrawAuthorizer,
  VALID_DESTINATION,
  type WithdrawSpy,
} from '../__fixtures__/fake-withdraw-flow-deps'

function freshSpy(): WithdrawSpy {
  return { authorized: [], usedDelegatedSigner: false }
}

describe('useWithdrawFlow', () => {
  it('gates submit until destination + amount validate AND the irreversible box is ticked', () => {
    const { result } = renderHook(() => useWithdrawFlow(buildWithdrawDeps()))

    expect(result.current.canSubmit).toBe(false)

    act(() => result.current.setDestination(VALID_DESTINATION))
    act(() => result.current.setAmount('10'))

    expect(result.current.isDestinationValid).toBe(true)
    expect(result.current.isAmountValid).toBe(true)
    // Still gated: the irreversible acknowledgement has not been ticked.
    expect(result.current.canSubmit).toBe(false)

    act(() => result.current.toggleConfirmIrreversible())
    expect(result.current.confirmedIrreversible).toBe(true)
    expect(result.current.canSubmit).toBe(true)
  })

  it('marks the destination as edited once anything is typed (drives the confirm gate)', () => {
    const { result } = renderHook(() => useWithdrawFlow(buildWithdrawDeps()))

    expect(result.current.isDestinationEdited).toBe(false)
    act(() => result.current.setDestination('0x1'))
    expect(result.current.isDestinationEdited).toBe(true)
  })

  it('fills the amount with the full withdrawable on Max', () => {
    const { result } = renderHook(() =>
      useWithdrawFlow(buildWithdrawDeps({ availableUsdc: 50 })),
    )

    act(() => result.current.setAmountToMax())
    expect(result.current.amount).toBe('50')
    expect(result.current.isAmountValid).toBe(true)
  })

  it('fills the amount with a percent of the withdrawable', () => {
    const { result } = renderHook(() =>
      useWithdrawFlow(buildWithdrawDeps({ availableUsdc: 80 })),
    )

    act(() => result.current.setPercent(25))
    expect(result.current.amount).toBe('20')
  })

  it('rejects a malformed destination address', () => {
    const { result } = renderHook(() => useWithdrawFlow(buildWithdrawDeps()))

    act(() => result.current.setDestination('not-an-address'))
    act(() => result.current.setAmount('10'))

    expect(result.current.isDestinationValid).toBe(false)
    expect(result.current.canSubmit).toBe(false)
  })

  it('does not authorize when the destination is invalid', () => {
    const spy = freshSpy()
    const { result } = renderHook(() =>
      useWithdrawFlow(buildWithdrawDeps({}, spy)),
    )

    act(() => result.current.setDestination('0x123'))
    act(() => result.current.setAmount('10'))
    act(() => result.current.toggleConfirmIrreversible())
    act(() => result.current.authorize())

    expect(spy.authorized).toHaveLength(0)
  })

  it('does not authorize until the irreversible box is ticked', () => {
    const spy = freshSpy()
    const { result } = renderHook(() =>
      useWithdrawFlow(buildWithdrawDeps({}, spy)),
    )

    act(() => result.current.setDestination(VALID_DESTINATION))
    act(() => result.current.setAmount('10'))
    // No toggle → authorize must be a no-op.
    act(() => result.current.authorize())

    expect(spy.authorized).toHaveLength(0)
    expect(result.current.phase).toBe('editing')
  })

  it('requires an explicit per-action authorization and sends USDC to the destination', async () => {
    const spy = freshSpy()
    const { result } = renderHook(() =>
      useWithdrawFlow(buildWithdrawDeps({}, spy)),
    )

    act(() => result.current.setDestination(VALID_DESTINATION))
    act(() => result.current.setAmount('15'))
    act(() => result.current.toggleConfirmIrreversible())

    await act(async () => {
      result.current.authorize()
    })

    await waitFor(() => expect(result.current.phase).toBe('sent'))
    expect(spy.authorized).toHaveLength(1)
    expect(spy.authorized[0].destination).toBe(VALID_DESTINATION)
    expect(spy.authorized[0].amount).toBe(15)
  })

  it('uses the explicit-authorization path, NOT the standing delegated signer', async () => {
    const spy = freshSpy()
    const { result } = renderHook(() =>
      useWithdrawFlow(buildWithdrawDeps({}, spy)),
    )

    act(() => result.current.setDestination(VALID_DESTINATION))
    act(() => result.current.setAmount('15'))
    act(() => result.current.toggleConfirmIrreversible())
    await act(async () => {
      result.current.authorize()
    })

    await waitFor(() => expect(result.current.phase).toBe('sent'))
    expect(spy.usedDelegatedSigner).toBe(false)
  })

  it('returns non-destructively on a user-rejected authorization', async () => {
    const { result } = renderHook(() =>
      useWithdrawFlow(
        buildWithdrawDeps({ authorizer: buildRejectedWithdrawAuthorizer() }),
      ),
    )

    act(() => result.current.setDestination(VALID_DESTINATION))
    act(() => result.current.setAmount('15'))
    act(() => result.current.toggleConfirmIrreversible())
    await act(async () => {
      result.current.authorize()
    })

    // A cancelled prompt returns to editing with the entered values preserved.
    await waitFor(() => expect(result.current.phase).toBe('editing'))
    expect(result.current.destination).toBe(VALID_DESTINATION)
    expect(result.current.amount).toBe('15')
  })

  it('surfaces a transfer-failed error with a retry', async () => {
    const { result } = renderHook(() =>
      useWithdrawFlow(
        buildWithdrawDeps({ authorizer: buildFailingWithdrawAuthorizer() }),
      ),
    )

    act(() => result.current.setDestination(VALID_DESTINATION))
    act(() => result.current.setAmount('15'))
    act(() => result.current.toggleConfirmIrreversible())
    await act(async () => {
      result.current.authorize()
    })

    await waitFor(() => expect(result.current.phase).toBe('error'))
    expect(result.current.errorReason).toBe('transfer-failed')

    act(() => result.current.retry())
    expect(result.current.phase).toBe('editing')
  })

  it('surfaces an insufficient-gas error', async () => {
    const { result } = renderHook(() =>
      useWithdrawFlow(
        buildWithdrawDeps({ authorizer: buildInsufficientGasWithdrawAuthorizer() }),
      ),
    )

    act(() => result.current.setDestination(VALID_DESTINATION))
    act(() => result.current.setAmount('15'))
    act(() => result.current.toggleConfirmIrreversible())
    await act(async () => {
      result.current.authorize()
    })

    await waitFor(() => expect(result.current.phase).toBe('error'))
    expect(result.current.errorReason).toBe('insufficient-gas')
  })

  it('surfaces an insufficient-balance error', async () => {
    const { result } = renderHook(() =>
      useWithdrawFlow(
        buildWithdrawDeps({ authorizer: buildInsufficientBalanceWithdrawAuthorizer() }),
      ),
    )

    act(() => result.current.setDestination(VALID_DESTINATION))
    act(() => result.current.setAmount('15'))
    act(() => result.current.toggleConfirmIrreversible())
    await act(async () => {
      result.current.authorize()
    })

    await waitFor(() => expect(result.current.phase).toBe('error'))
    expect(result.current.errorReason).toBe('insufficient-balance')
  })

  it('surfaces a receipt-timeout error', async () => {
    const { result } = renderHook(() =>
      useWithdrawFlow(
        buildWithdrawDeps({ authorizer: buildReceiptTimeoutWithdrawAuthorizer() }),
      ),
    )

    act(() => result.current.setDestination(VALID_DESTINATION))
    act(() => result.current.setAmount('15'))
    act(() => result.current.toggleConfirmIrreversible())
    await act(async () => {
      result.current.authorize()
    })

    await waitFor(() => expect(result.current.phase).toBe('error'))
    expect(result.current.errorReason).toBe('receipt-timeout')
  })

  it('clears a wrong-network error once retry switches the chain successfully', async () => {
    const { result } = renderHook(() =>
      useWithdrawFlow(
        buildWithdrawDeps({
          authorizer: buildWrongNetworkWithdrawAuthorizer(),
          switchToBase: () => Promise.resolve('switched'),
        }),
      ),
    )

    act(() => result.current.setDestination(VALID_DESTINATION))
    act(() => result.current.setAmount('15'))
    act(() => result.current.toggleConfirmIrreversible())
    await act(async () => {
      result.current.authorize()
    })
    await waitFor(() => expect(result.current.errorReason).toBe('wrong-network'))

    await act(async () => {
      result.current.retry()
    })
    await waitFor(() => expect(result.current.phase).toBe('editing'))
    expect(result.current.errorReason).toBe(null)
  })

  it('keeps the wrong-network error up when the chain switch is rejected', async () => {
    const { result } = renderHook(() =>
      useWithdrawFlow(
        buildWithdrawDeps({
          authorizer: buildWrongNetworkWithdrawAuthorizer(),
          switchToBase: () => Promise.resolve('rejected'),
        }),
      ),
    )

    act(() => result.current.setDestination(VALID_DESTINATION))
    act(() => result.current.setAmount('15'))
    act(() => result.current.toggleConfirmIrreversible())
    await act(async () => {
      result.current.authorize()
    })
    await waitFor(() => expect(result.current.errorReason).toBe('wrong-network'))

    await act(async () => {
      result.current.retry()
    })
    expect(result.current.phase).toBe('error')
    expect(result.current.errorReason).toBe('wrong-network')
  })
})
