import { useWizard } from "react-use-wizard";

import { BigButton } from "../big-button";
import { VerificationFlowSteps } from "../step-manifest";
import { useVerificationFlowContext } from "../verification-flow-context";
import { AttributeStepTemplate } from "./attribute-step-template";

export function AccreditedStep() {
  const { accredited, setAccredited } = useVerificationFlowContext();
  const { goToStep } = useWizard();
  return (
    <AttributeStepTemplate
      heading="Are you a U.S. accredited investor?"
      buttons={
        <>
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
              goToStep(VerificationFlowSteps.Persona);
            }}
          >
            No, I am not U.S. accredited
          </BigButton>
        </>
      }
    />
  );
}
