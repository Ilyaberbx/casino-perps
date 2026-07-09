import { ok, err, type Result } from 'neverthrow'

declare const walletAddressBrand: unique symbol

export type WalletAddress = `0x${string}` & { readonly [walletAddressBrand]: true }

export type WalletAddressParseErrorKind = 'invalid-shape' | 'invalid-length'

export class WalletAddressParseError extends Error {
  readonly kind: WalletAddressParseErrorKind
  constructor(kind: WalletAddressParseErrorKind, message: string) {
    super(message)
    this.kind = kind
    this.name = 'WalletAddressParseError'
  }
}

const HEX_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/

export function parseWalletAddress(input: string): Result<WalletAddress, WalletAddressParseError> {
  const matches = HEX_ADDRESS_REGEX.test(input)
  if (!matches) {
    const isWrongLength = input.startsWith('0x') && input.length !== 42
    if (isWrongLength) {
      return err(new WalletAddressParseError('invalid-length', `wallet address must be 42 characters: ${input}`))
    }
    return err(new WalletAddressParseError('invalid-shape', `wallet address must match 0x + 40 hex chars: ${input}`))
  }
  const lowered = input.toLowerCase() as WalletAddress
  return ok(lowered)
}
