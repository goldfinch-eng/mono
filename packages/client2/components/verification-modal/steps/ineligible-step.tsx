import { ExitFlowButton } from "../exit-flow-button";
import { StepTemplate } from "./step-template";

export function IneligibleStep() {
  return (
    <StepTemplate footer={<ExitFlowButton>Close</ExitFlowButton>}>
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-2xl">
          Sorry, your identity verification has failed and you have been deemed
          ineligible.
        </div>
      </div>
    </StepTemplate>
  );
}
