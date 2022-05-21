import { Button } from "@/components/design-system";
import { closeVerificationModal } from "@/lib/state/actions";

export function IneligibleStep() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div>
        <div className="text-2xl">
          Sorry, your identity verification has failed and you have been deemed
          ineligible.
        </div>
        <Button className="m-auto" size="lg" onClick={closeVerificationModal}>
          Close
        </Button>
      </div>
    </div>
  );
}
