import { useWizard } from "react-use-wizard";

import { BigButton } from "../big-button";
import { VerificationFlowSteps } from "../step-manifest";
import { useVerificationFlowContext } from "../verification-flow-context";
import { StepTemplate } from "./step-template";

export function AccreditedStep() {
  const { accredited, setAccredited, residency, idIssuer } =
    useVerificationFlowContext();
  const { goToStep } = useWizard();

  return (
    <StepTemplate
      heading="Are you a U.S. accredited investor?"
      headingTooltip="You are a U.S. accredited investor if EITHER you earned $200,000 or more each year for the last two years OR have a net worth of $1 million or more."
    >
      <div className="flex h-full flex-col gap-3">
        <BigButton
          selected={accredited === "accredited"}
          onClick={() => {
            setAccredited("accredited");
            goToStep(VerificationFlowSteps.ParallelMarkets);
          }}
        >
          Yes, I am U.S. accredited
        </BigButton>
        <BigButton
          selected={accredited === "non-accredited"}
          onClick={() => {
            setAccredited("non-accredited");
            if (residency === "non-us" && idIssuer === "us") {
              goToStep(VerificationFlowSteps.IdWarning);
            } else {
              goToStep(VerificationFlowSteps.Persona);
            }
          }}
        >
          No, I am not U.S. accredited
        </BigButton>
      </div>
    </StepTemplate>
  );
}
