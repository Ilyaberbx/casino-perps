const appId = import.meta.env.VITE_PRIVY_APP_ID
if (!appId) {
  throw new Error('VITE_PRIVY_APP_ID is required')
}

export const PRIVY_APP_ID: string = appId
