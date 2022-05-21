import { useWizard } from "react-use-wizard";

import { BigButton } from "../big-button";
import { VerificationFlowSteps } from "../step-manifest";
import { useVerificationFlowContext } from "../verification-flow-context";
import { AttributeStepTemplate } from "./attribute-step-template";

export function ResidencyStep() {
  const { residency, setResidency } = useVerificationFlowContext();
  const { goToStep } = useWizard();
  return (
    <AttributeStepTemplate
      heading="Where do you reside?"
      buttons={
        <>
          <BigButton
            selected={residency === "non-us"}
            onClick={() => {
              setResidency("non-us");
              goToStep(VerificationFlowSteps.Persona);
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
            United States
          </BigButton>
        </>
      }
    />
  );
}
