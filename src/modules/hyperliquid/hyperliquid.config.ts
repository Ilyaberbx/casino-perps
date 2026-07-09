import { ok, err, type Result } from 'neverthrow'
import {
  HyperliquidConfigError,
  type HyperliquidConfig,
  type HyperliquidNetwork,
} from './hyperliquid.types'
import { HYPERLIQUID_DEFAULT_URLS } from './hyperliquid.constants'

export interface HyperliquidEnv {
  readonly VITE_HYPERLIQUID_NETWORK?: string
  readonly VITE_HYPERLIQUID_API_URL?: string
}

export function loadHyperliquidConfig(
  env: HyperliquidEnv,
): Result<HyperliquidConfig, HyperliquidConfigError> {
  const networkRaw = env.VITE_HYPERLIQUID_NETWORK
  const isMissing = networkRaw === undefined || networkRaw === ''
  if (isMissing) {
    return err(
      new HyperliquidConfigError(
        'missing-network',
        'VITE_HYPERLIQUID_NETWORK is required (mainnet | testnet)',
      ),
    )
  }
  const isValidNetwork = networkRaw === 'mainnet' || networkRaw === 'testnet'
  if (!isValidNetwork) {
    return err(
      new HyperliquidConfigError(
        'invalid-network',
        `VITE_HYPERLIQUID_NETWORK must be 'mainnet' or 'testnet', got: ${networkRaw}`,
      ),
    )
  }
  const network: HyperliquidNetwork = networkRaw
  const defaults = HYPERLIQUID_DEFAULT_URLS[network]
  const overrideHttp = env.VITE_HYPERLIQUID_API_URL
  const httpUrl = overrideHttp && overrideHttp !== '' ? overrideHttp : defaults.http
  const wsUrl = deriveWsUrl(httpUrl, defaults.ws)
  const httpValidation = validateHttpUrl(httpUrl)
  if (httpValidation.isErr()) return err(httpValidation.error)
  return ok({ network, apiHttpUrl: httpUrl, apiWsUrl: wsUrl })
}

function validateHttpUrl(url: string): Result<true, HyperliquidConfigError> {
  try {
    const parsed = new URL(url)
    const isHttpProtocol = parsed.protocol === 'http:' || parsed.protocol === 'https:'
    if (!isHttpProtocol) {
      return err(
        new HyperliquidConfigError(
          'invalid-url',
          `VITE_HYPERLIQUID_API_URL must be http(s), got: ${url}`,
        ),
      )
    }
    return ok(true)
  } catch {
    return err(
      new HyperliquidConfigError('invalid-url', `VITE_HYPERLIQUID_API_URL is not a valid URL: ${url}`),
    )
  }
}

function deriveWsUrl(httpUrl: string, fallback: string): string {
  try {
    const url = new URL(httpUrl)
    const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${wsProtocol}//${url.host}/ws`
  } catch {
    return fallback
  }
}
