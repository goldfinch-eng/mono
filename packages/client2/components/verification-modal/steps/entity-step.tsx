import { useWizard } from "react-use-wizard";

import { dataLayerPushEvent } from "@/lib/analytics";

import { BigButton } from "../big-button";
import { VerificationFlowSteps } from "../step-manifest";
import { useVerificationFlowContext } from "../verification-flow-context";
import { StepTemplate } from "./step-template";

export function EntityStep() {
  const { entity, setEntity } = useVerificationFlowContext();
  const { goToStep } = useWizard();
  return (
    <StepTemplate
      heading="Who are you participating on behalf of?"
      headingClassName="w-full"
    >
      <div className="flex h-full flex-col gap-3">
        <BigButton
          selected={entity === "entity"}
          onClick={() => {
            setEntity("entity");
            goToStep(VerificationFlowSteps.ParallelMarkets);
            dataLayerPushEvent("INVESTOR_TYPE_SELECTED", {
              type: "institutional",
            });
          }}
        >
          A business or entity
        </BigButton>
        <BigButton
          selected={entity === "individual"}
          onClick={() => {
            setEntity("individual");
            goToStep(VerificationFlowSteps.Residence);
            dataLayerPushEvent("INVESTOR_TYPE_SELECTED", { type: "retail" });
          }}
        >
          An individual (myself)
        </BigButton>
      </div>
    </StepTemplate>
  );
}
