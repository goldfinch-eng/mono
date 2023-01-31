import Image from "next/future/image";
import { useEffect } from "react";
import { useWizard } from "react-use-wizard";

import { Button } from "@/components/design-system";
import { dataLayerPushEvent } from "@/lib/analytics";

import greenCheckmark from "./green-checkmark.png";
import { StepTemplate } from "./step-template";
import uidLogo from "./uid-logo.png";

export function IntroStep() {
  const { nextStep } = useWizard();

  useEffect(() => {
    dataLayerPushEvent("UID_FLOW_INITIATED");
  }, []);

  return (
    <StepTemplate
      heading="Goldfinch requires identity verification"
      headingClassName="font-medium"
      footer={
        <Button size="lg" onClick={nextStep} className="w-full">
          Begin
        </Button>
      }
    >
      <div className="flex h-full items-center justify-evenly text-center text-sm">
        <div className="flex flex-col items-center">
          <Image src={greenCheckmark} width={70} height={70} alt="KYC" />
          <div className="mt-2">
            First, complete KYC using Persona or Parallel Markets
          </div>
        </div>
        <div className="flex flex-col items-center">
          <Image src={uidLogo} width={70} height={70} alt="KYC" />
          <div className="mt-2">
            Then claim your UID NFT for identity management
          </div>
        </div>
      </div>
    </StepTemplate>
  );
}
