import { useWizard } from "react-use-wizard";

import { BigButton } from "../big-button";
import { VerificationFlowSteps } from "../step-manifest";
import { useVerificationFlowContext } from "../verification-flow-context";
import { AttributeStepTemplate } from "./attribute-step-template";

export function EntityStep() {
  const { entity, setEntity } = useVerificationFlowContext();
  const { goToStep } = useWizard();
  return (
    <AttributeStepTemplate
      heading="Who are you participating on behalf of?"
      buttons={
        <>
          <BigButton
            selected={entity === "individual"}
            onClick={() => {
              setEntity("individual");
              goToStep(VerificationFlowSteps.Residence);
            }}
          >
            An individual (myself)
          </BigButton>
          <BigButton
            selected={entity === "entity"}
            onClick={() => {
              setEntity("entity");
              goToStep(VerificationFlowSteps.ParallelMarkets);
            }}
          >
            A business or entity
          </BigButton>
        </>
      }
    />
  );
}
