import { ExitFlowButton } from "../exit-flow-button";
import { StepTemplate } from "./step-template";

export function AlreadyMintedStep() {
  return (
    <StepTemplate footer={<ExitFlowButton>Close</ExitFlowButton>}>
      <div
        className="flex h-full w-full items-center justify-center"
        data-id="already-minted-step"
      >
        <div className="text-2xl">You have already minted a UID.</div>
      </div>
    </StepTemplate>
  );
}
