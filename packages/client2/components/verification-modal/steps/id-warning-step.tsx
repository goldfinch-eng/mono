import Image from "next/image";
import { useWizard } from "react-use-wizard";

import { Button } from "@/components/design-system";

import { VerificationFlowSteps } from "../step-manifest";
import { StepTemplate } from "./step-template";
import warningImg from "./warning.png";

export function IdWarningStep() {
  const { goToStep } = useWizard();
  return (
    <StepTemplate
      includePrivacyStatement={false}
      footer={
        <>
          <Button
            colorScheme="secondary"
            size="lg"
            onClick={() => goToStep(VerificationFlowSteps.Persona)}
            className="w-full"
          >
            No, continue
          </Button>
          <Button
            colorScheme="primary"
            size="lg"
            onClick={() => goToStep(VerificationFlowSteps.Persona)}
            className="w-full"
          >
            I have a Non-U.S. ID
          </Button>
        </>
      }
    >
      <div className="flex h-full flex-col items-center">
        <div className="mx-auto mb-5">
          <Image src={warningImg} height={110} width={110} alt="Warning" />
        </div>
        <div className="mb-5">Do you have a Non-U.S. ID?</div>
        <div className="text-xs text-sand-400">
          If you have a U.S. ID, you may not be eligible to participate in
          certain Goldfinch protocol activities, including lending capital. If
          you have a Non-U.S. ID you can use for identity verification purposes,
          you may be eligible to participate.
        </div>
      </div>
    </StepTemplate>
  );
}
