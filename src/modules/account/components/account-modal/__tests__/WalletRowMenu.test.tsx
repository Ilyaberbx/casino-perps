import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const onExportMock = vi.fn<(address: string) => Promise<void>>()

vi.mock('../../../hooks/use-wallet-export', () => ({
  useWalletExport: () => ({ isExporting: false, onExport: onExportMock }),
}))

import { WalletRowMenu } from '../WalletRowMenu'
import { NON_EXPORTABLE_NOTE } from '../account-modal.constants'

const ADDRESS = '0xaaaa000000000000000000000000000000000001'

describe('<WalletRowMenu /> export affordance (ADR-0076 D-5)', () => {
  it('shows an Export private key item when the wallet is exportable', async () => {
    const user = userEvent.setup()
    render(
      <WalletRowMenu address={ADDRESS} isRemovable={false} isExportable onRemove={() => {}} />,
    )
    await user.click(screen.getByLabelText('Wallet actions'))
    expect(screen.getByRole('menuitem', { name: /export private key/i })).toBeInTheDocument()
    expect(screen.queryByText(NON_EXPORTABLE_NOTE)).not.toBeInTheDocument()
  })

  it('shows the non-export note (no Export item) when the wallet is link-only', async () => {
    const user = userEvent.setup()
    render(
      <WalletRowMenu
        address={ADDRESS}
        isRemovable
        isExportable={false}
        onRemove={() => {}}
      />,
    )
    await user.click(screen.getByLabelText('Wallet actions'))
    expect(screen.queryByRole('menuitem', { name: /export private key/i })).not.toBeInTheDocument()
    expect(screen.getByText(NON_EXPORTABLE_NOTE)).toBeInTheDocument()
  })

  it('runs the export hook with the row address when Export is clicked', async () => {
    const user = userEvent.setup()
    render(<WalletRowMenu address={ADDRESS} isRemovable={false} isExportable onRemove={() => {}} />)
    await user.click(screen.getByLabelText('Wallet actions'))
    await user.click(screen.getByRole('menuitem', { name: /export private key/i }))
    expect(onExportMock).toHaveBeenCalledWith(ADDRESS)
  })
})
