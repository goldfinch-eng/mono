import Image from "next/image";

import { Button } from "@/components/design-system";
import { closeVerificationModal } from "@/lib/state/actions";

import clock from "./clock.png";
import { StepTemplate } from "./step-template";

export function PendingStep() {
  return (
    <StepTemplate
      includePrivacyStatement={false}
      footer={
        <Button className="w-full" size="lg" onClick={closeVerificationModal}>
          Finish
        </Button>
      }
    >
      <div className="flex flex-col items-center">
        <Image
          src={clock}
          width={110}
          height={110}
          quality={100}
          alt="Pending"
        />
        <div className="my-5">
          Your identity verification review is in progress
        </div>
        <div className="text-center text-xs text-sand-400">
          After it has been approved, you can claim your UID and begin
          participating in Goldfinch protocol activities. This should take less
          than 24-48 hrs
        </div>
      </div>
    </StepTemplate>
  );
}
