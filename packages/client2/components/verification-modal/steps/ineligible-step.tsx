import { Button } from "@/components/design-system";
import { closeVerificationModal } from "@/lib/state/actions";

import { StepTemplate } from "./step-template";

export function IneligibleStep() {
  return (
    <StepTemplate
      footer={
        <Button className="w-full" size="lg" onClick={closeVerificationModal}>
          Close
        </Button>
      }
    >
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-2xl">
          Sorry, your identity verification has failed and you have been deemed
          ineligible.
        </div>
      </div>
    </StepTemplate>
  );
}
