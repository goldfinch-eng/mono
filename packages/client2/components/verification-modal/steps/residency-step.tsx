import { useWizard } from "react-use-wizard";

import { BigButton } from "../big-button";
import { VerificationFlowSteps } from "../step-manifest";
import { useVerificationFlowContext } from "../verification-flow-context";
import { StepTemplate } from "./step-template";

export function ResidencyStep() {
  const { residency, setResidency } = useVerificationFlowContext();
  const { goToStep } = useWizard();
  return (
    <StepTemplate
      heading="Where is your permanent residence?"
      headingTooltip="Your eligibility to participate in certain Goldfinch protocol activities depends on your country of permanent residence, not where you have citizenship or temporary residence."
    >
      <div className="flex h-full flex-col gap-3">
        <BigButton
          selected={residency === "non-us"}
          onClick={() => {
            setResidency("non-us");
            goToStep(VerificationFlowSteps.IdIssuer);
          }}
        >
          Outside the United States
        </BigButton>
        <BigButton
          selected={residency === "us"}
          onClick={() => {
            setResidency("us");
            goToStep(VerificationFlowSteps.Accredited);
          }}
        >
          Within the United States
        </BigButton>
      </div>
    </StepTemplate>
  );
}
