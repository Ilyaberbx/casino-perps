// Provider-unit rule: index.ts exports Provider + consumer hook only.
// AgentWalletContext is private to the unit — never exported from here.
export { AgentWalletProvider } from './AgentWalletProvider'
export { useAgentWallet } from './use-agent-wallet'
