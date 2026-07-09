export { OnboardingFlowProvider } from './OnboardingFlowProvider'
// Context is exported because app-level routing tests
// (`app/app-shell/__tests__/routing.test.tsx` via `@/modules/account`) mount
// it directly with a fixture state. The consumer
// hook `useOnboardingFlow` lives in `../../hooks/use-onboarding-flow.ts` (it
// is used both standalone and via this provider) — re-exported through the
// module barrel rather than re-exported here.
export { OnboardingFlowContext } from './onboarding-flow-provider.context'
