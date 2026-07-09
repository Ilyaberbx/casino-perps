import type { ReactNode } from "react";
import { OnboardingFlowContext } from "./onboarding-flow-provider.context";
import { useOwnOnboardingFlow } from "../../hooks/use-onboarding-flow";

export function OnboardingFlowProvider({ children }: { children: ReactNode }) {
    const state = useOwnOnboardingFlow(true);
    return (
        <OnboardingFlowContext.Provider value={state}>
            {children}
        </OnboardingFlowContext.Provider>
    );
}
