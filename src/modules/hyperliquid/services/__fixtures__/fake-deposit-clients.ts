import type { PublicClient, WalletClient } from 'viem'
import type { Logger } from '@/modules/shared/logger'

/**
 * Minimal fakes for the viem boundary used by the HL deposit service tests. We
 * stub only the methods the service calls and cast through `unknown` to the
 * viem client types — the service never relies on the rest of the surface, and
 * mocking the full viem client is both impossible and pointless (testing.md:
 * fake at the boundary, not the whole SDK).
 */

export interface FakePublicClientOverrides {
  readContract?: (args: unknown) => Promise<bigint>
  getBalance?: (args: unknown) => Promise<bigint>
  waitForTransactionReceipt?: (args: unknown) => Promise<unknown>
}

export function buildFakePublicClient(
  overrides: FakePublicClientOverrides = {},
): PublicClient {
  const fake = {
    readContract:
      overrides.readContract ?? (() => Promise.resolve(0n)),
    getBalance: overrides.getBalance ?? (() => Promise.resolve(0n)),
    waitForTransactionReceipt:
      overrides.waitForTransactionReceipt ?? (() => Promise.resolve({ status: 'success' })),
  }
  return fake as unknown as PublicClient
}

export interface FakeWalletClientOverrides {
  account?: { address: `0x${string}` } | undefined
  getChainId?: () => Promise<number>
  switchChain?: (args: unknown) => Promise<void>
  writeContract?: (args: unknown) => Promise<`0x${string}`>
}

const DEFAULT_ACCOUNT = {
  address: '0x1111111111111111111111111111111111111111' as `0x${string}`,
}

export function buildFakeWalletClient(
  overrides: FakeWalletClientOverrides = {},
): WalletClient {
  const fake = {
    account: 'account' in overrides ? overrides.account : DEFAULT_ACCOUNT,
    getChainId: overrides.getChainId ?? (() => Promise.resolve(42161)),
    switchChain: overrides.switchChain ?? (() => Promise.resolve()),
    writeContract:
      overrides.writeContract ??
      (() => Promise.resolve('0xdeadbeef' as `0x${string}`)),
  }
  return fake as unknown as WalletClient
}

interface CapturedRecord {
  readonly level: string
  readonly fields: Record<string, unknown>
  readonly message: string
}

export function buildFakeLogger(): { logger: Logger; records: CapturedRecord[] } {
  const records: CapturedRecord[] = []
  const make = (level: string) => (fields: Record<string, unknown>, message: string) => {
    records.push({ level, fields, message })
  }
  const logger: Logger = {
    debug: make('debug'),
    info: make('info'),
    warn: make('warn'),
    error: make('error'),
    child: () => logger,
  }
  return { logger, records }
}
