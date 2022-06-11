import { useWizard } from "react-use-wizard";

import { BigButton } from "../big-button";
import { VerificationFlowSteps } from "../step-manifest";
import { useVerificationFlowContext } from "../verification-flow-context";
import { StepTemplate } from "./step-template";

export function IdIssuerStep() {
  const { idIssuer, setIdIssuer } = useVerificationFlowContext();
  const { goToStep } = useWizard();
  return (
    <StepTemplate
      heading="What country issued your government ID?"
      headingTooltip="You will need your government ID to complete identity verification."
      subheading="If you have both ID types, please select “a country other than the United States” and use your Non-U.S. ID for identity verification."
    >
      <div className="flex h-full flex-col gap-3">
        <BigButton
          selected={idIssuer === "non-us"}
          onClick={() => {
            setIdIssuer("non-us");
            goToStep(VerificationFlowSteps.Persona);
          }}
        >
          A country other than the United States
        </BigButton>
        <BigButton
          selected={idIssuer === "us"}
          onClick={() => {
            setIdIssuer("us");
            goToStep(VerificationFlowSteps.Accredited);
          }}
        >
          The United States
        </BigButton>
      </div>
    </StepTemplate>
  );
}
