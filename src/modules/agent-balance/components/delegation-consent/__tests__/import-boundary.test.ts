import { describe, it, expect } from 'vitest'
import { readFileSync, globSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Every Privy call the Agent Wallet needs — wallet creation and scoped-signer
 * attach/remove — MUST be reached through injected seams (`createAgentWallet` /
 * `attachAgentSigner` / `removeAgentSigner` from `useAuth()`), never by importing
 * `@privy-io/react-auth` inside this module. Per `apps/client/CLAUDE.md`, only
 * `account/` imports Privy directly; the rest of the app goes through `useAuth()`
 * / injected seams. This scan keeps the agent-balance module on the right side of
 * that boundary.
 */
describe('delegation import boundary', () => {
  it('never imports @privy-io/react-auth directly', () => {
    const moduleRoot = resolve(process.cwd(), 'src/modules/agent-balance')
    const files = globSync('**/*.{ts,tsx}', { cwd: moduleRoot })
    const sources = files
      .filter((f) => !f.includes('__tests__') && !f.includes('__fixtures__'))
      .map((f) => readFileSync(`${moduleRoot}/${f}`, 'utf8'))

    const importsPrivy = sources.some((src) => src.includes('@privy-io/react-auth'))
    expect(importsPrivy).toBe(false)
  })
})
