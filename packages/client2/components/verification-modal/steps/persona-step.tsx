import Image from "next/future/image";
import { useState } from "react";
import { useWizard } from "react-use-wizard";

import { Button } from "@/components/design-system";
import { PERSONA_CONFIG } from "@/constants";
import { postKYCDetails } from "@/lib/verify";
import { useWallet } from "@/lib/wallet";

import { VerificationFlowSteps } from "../step-manifest";
import { useVerificationFlowContext } from "../verification-flow-context";
import personaLogo from "./persona-logo.png";
import { StepTemplate } from "./step-template";

export function PersonaStep() {
  const { account } = useWallet();
  const [isPersonaLoading, setIsPersonaLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const { goToStep } = useWizard();
  const { entity, residency, signature } = useVerificationFlowContext();

  const beginPersonaInquiry = async () => {
    setIsPersonaLoading(true);

    // Send KYC details and continue opening Persona
    if (account && signature && entity && residency) {
      postKYCDetails(
        account,
        signature.signature,
        signature.signatureBlockNum,
        residency
      ).catch(() => {
        throw new Error("Could not save KYC details");
      });
    }

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
      footer={
        <>
          <Button
            size="lg"
            colorScheme="secondary"
            onClick={() => goToStep(VerificationFlowSteps.IndividualOrEntity)}
            className="w-full"
          >
            Back
          </Button>
          <Button
            size="lg"
            colorScheme="primary"
            onClick={beginPersonaInquiry}
            iconRight="ArrowSmRight"
            isLoading={isPersonaLoading}
            className="w-full"
          >
            Verify my identity
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center">
        <Image
          src={personaLogo}
          height={110}
          style={{ width: "auto" }}
          quality={100}
          alt="Persona"
        />

        <p className="mt-5 w-7/12 text-center">
          Goldfinch uses Persona to complete identity verification
        </p>

        {errorMessage ? <p className="text-clay-500">{errorMessage}</p> : null}
      </div>
    </StepTemplate>
  );
}
