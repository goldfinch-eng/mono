import { Button } from "@/components/design-system";
import { closeVerificationModal } from "@/lib/state/actions";

import { UidPreview } from "../uid-preview";
import { StepTemplate } from "./step-template";

export function PendingStep() {
  return (
    <StepTemplate
      leftContent={
        <div className="space-y-5 text-center">
          <div className="rounded-xl bg-sand-200"></div>
          <div>Your identity verification review is in progress</div>
          <div className="text-xs">
            After it has been approved, you can claim your UID and begin
            participating in Goldfinch protocol activities. This should take
            less than 24-48 hrs
          </div>
        </div>
      }
      rightContent={<UidPreview />}
      footer={
        <div className="flex w-full justify-end">
          <Button size="lg" onClick={closeVerificationModal}>
            Finish
          </Button>
        </div>
      }
    />
  );
}
