import { Button } from "@/components/design-system";
import { closeVerificationModal } from "@/lib/state/actions";

import { UidPreview } from "../uid-preview";

export function PendingStep() {
  return (
    <div>
      <div className="flex justify-between">
        <div className="w-6/12 space-y-5 text-center">
          <div className="rounded-xl bg-sand-200"></div>
          <div>Your identity verification review is in progress</div>
          <div className="text-xs">
            After it has been approved, you can claim your UID and begin
            participating in Goldfinch protocol activities. This should take
            less than 24-48 hrs
          </div>
        </div>
        <div className="w-5/12">
          <UidPreview />
        </div>
      </div>
      <div className="flex justify-end">
        <Button size="lg" onClick={closeVerificationModal}>
          Finish
        </Button>
      </div>
    </div>
  );
}
