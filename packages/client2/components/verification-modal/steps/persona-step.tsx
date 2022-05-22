import Image from "next/image";
import { useState } from "react";
import { useWizard } from "react-use-wizard";

import { Button } from "@/components/design-system";
import { PERSONA_CONFIG } from "@/constants";
import { useWallet } from "@/lib/wallet";

import { VerificationFlowSteps } from "../step-manifest";
import { UidPreview } from "../uid-preview";
import personaLogo from "./persona-logo.png";
import { StepTemplate } from "./step-template";

export function PersonaStep() {
  const { account } = useWallet();
  const [isPersonaLoading, setIsPersonaLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const { previousStep, goToStep } = useWizard();

  const beginPersonaInquiry = async () => {
    setIsPersonaLoading(true);
    const Persona = await import("persona");
    const client = new Persona.Client({
      templateId: PERSONA_CONFIG.templateId,
      environment: PERSONA_CONFIG.environment,
      referenceId: account,
      onReady: () => {
        client.open();
        setIsPersonaLoading(false);
      },
      onComplete: (props) => {
        if (props.status === "completed") {
          goToStep(VerificationFlowSteps.Mint);
        } else if (props.status === "failed") {
          goToStep(VerificationFlowSteps.Ineligible);
        } else {
          goToStep(VerificationFlowSteps.Pending);
        }
        client.destroy();
      },
      onError: (error) => {
        setErrorMessage(error.message);
      },
      onCancel: () => {
        client.destroy();
      },
    });
  };

  return (
    <StepTemplate
      leftContent={
        <div className="flex flex-col items-center px-4 pt-12">
          <Image src={personaLogo} width={120} height={120} alt="Persona" />

          <p className="my-5 text-center">
            Goldfinch uses Persona to complete identity verification
          </p>

          <p className="text-center text-xs text-sand-500">
            All information is kept secure and will not be used for any purpose
            beyond executing your supply request. The only information we store
            is your ETH address, country, and approval status. We take privacy
            seriously. Why does Goldfinch KYC?
          </p>

          {errorMessage ? (
            <p className="text-clay-500">{errorMessage}</p>
          ) : null}
        </div>
      }
      rightContent={<UidPreview />}
      footer={
        <>
          <Button size="lg" colorScheme="secondary" onClick={previousStep}>
            Back
          </Button>
          <Button
            size="lg"
            colorScheme="primary"
            onClick={beginPersonaInquiry}
            iconRight="ArrowSmRight"
            isLoading={isPersonaLoading}
          >
            Verify my identity
          </Button>
        </>
      }
    />
  );
}
