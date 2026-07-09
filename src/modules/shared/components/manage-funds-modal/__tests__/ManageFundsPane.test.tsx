import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ManageFundsPane } from '../ManageFundsPane'
import {
  buildFakeDepositCapability,
  buildFakeEvmCoreCapability,
  buildFakeSendCapability,
  buildFakeTransferCapability,
  buildFakeWithdrawCapability,
  DEPOSIT_BODY_TEXT,
  EVM_CORE_BODY_TEXT,
  SEND_BODY_TEXT,
  TRANSFER_BODY_TEXT,
  WITHDRAW_BODY_TEXT,
} from '../__fixtures__/fake-manage-funds-venue'
import type {
  CapabilityView,
  TransferCapabilityView,
} from '../manage-funds-modal.types'

function depositView(): CapabilityView {
  const cap = buildFakeDepositCapability()
  return { Provider: cap.provider, Body: cap.body }
}

function withdrawView(): CapabilityView {
  const cap = buildFakeWithdrawCapability()
  return { Provider: cap.provider, Body: cap.body }
}

function sendView(): CapabilityView {
  const cap = buildFakeSendCapability()
  return { Provider: cap.provider, Body: cap.body }
}

function evmCoreView(): CapabilityView {
  const cap = buildFakeEvmCoreCapability()
  return { Provider: cap.provider, Body: cap.body }
}

function transferView(isApplicable = true): TransferCapabilityView {
  const cap = buildFakeTransferCapability(isApplicable)
  return { Provider: cap.provider, Body: cap.body, useTransfer: cap.useTransfer }
}

describe('ManageFundsPane', () => {
  it('renders the deposit body when the deposit capability is present', () => {
    render(
      <ManageFundsPane
        activeTab="deposit"
        deposit={depositView()}
        transfer={null}
        withdraw={null}
        send={null}
        evmCore={null}
      />,
    )
    expect(screen.getByText(DEPOSIT_BODY_TEXT)).toBeInTheDocument()
  })

  it('renders the withdraw body when the withdraw capability is present', () => {
    render(
      <ManageFundsPane
        activeTab="withdraw"
        deposit={null}
        transfer={null}
        withdraw={withdrawView()}
        send={null}
        evmCore={null}
      />,
    )
    expect(screen.getByText(WITHDRAW_BODY_TEXT)).toBeInTheDocument()
  })

  it('renders the transfer body when applicable', () => {
    render(
      <ManageFundsPane
        activeTab="transfer"
        deposit={null}
        transfer={transferView(true)}
        withdraw={null}
        send={null}
        evmCore={null}
      />,
    )
    expect(screen.getByText(TRANSFER_BODY_TEXT)).toBeInTheDocument()
  })

  it('hides the transfer body when the account is not applicable', () => {
    render(
      <ManageFundsPane
        activeTab="transfer"
        deposit={null}
        transfer={transferView(false)}
        withdraw={null}
        send={null}
        evmCore={null}
      />,
    )
    expect(screen.queryByText(TRANSFER_BODY_TEXT)).not.toBeInTheDocument()
  })

  it('renders an unsupported note when the capability is absent', () => {
    render(
      <ManageFundsPane
        activeTab="deposit"
        deposit={null}
        transfer={null}
        withdraw={null}
        send={null}
        evmCore={null}
      />,
    )
    expect(screen.getByText(/not available/i)).toBeInTheDocument()
  })

  it('renders the send body when the send capability is present', () => {
    render(
      <ManageFundsPane
        activeTab="send"
        deposit={null}
        transfer={null}
        withdraw={null}
        send={sendView()}
        evmCore={null}
      />,
    )
    expect(screen.getByText(SEND_BODY_TEXT)).toBeInTheDocument()
  })

  it('renders the evm-core body when the evm-core capability is present', () => {
    render(
      <ManageFundsPane
        activeTab="evm-core"
        deposit={null}
        transfer={null}
        withdraw={null}
        send={null}
        evmCore={evmCoreView()}
      />,
    )
    expect(screen.getByText(EVM_CORE_BODY_TEXT)).toBeInTheDocument()
  })

  it('renders an unsupported note when the evm-core capability is absent', () => {
    render(
      <ManageFundsPane
        activeTab="evm-core"
        deposit={null}
        transfer={null}
        withdraw={null}
        send={null}
        evmCore={null}
      />,
    )
    expect(screen.getByText(/not available/i)).toBeInTheDocument()
  })
})
