import { Wizard } from "react-use-wizard";

import { Modal, ModalProps } from "@/components/design-system";

import { AccreditedStep } from "./steps/accredited-step";
import { EntityStep } from "./steps/entity-step";
import { IdIssuerStep } from "./steps/id-issuer-step";
import { IdWarningStep } from "./steps/id-warning-step";
import { IneligibleStep } from "./steps/ineligible-step";
import { IntroStep } from "./steps/intro-step";
import { MintStep } from "./steps/mint-step";
import { ParallelMarketsStep } from "./steps/parallel-markets-step";
import { PendingStep } from "./steps/pending-step";
import { PersonaStep } from "./steps/persona-step";
import { ResidencyStep } from "./steps/residency-step";
import { StatusCheckStep } from "./steps/status-check-step";
import { VerificationFlowContext } from "./verification-flow-context";

interface VerificationModalProps {
  isOpen: ModalProps["isOpen"];
  onClose: ModalProps["onClose"];
}

export function VerificationModal({ isOpen, onClose }: VerificationModalProps) {
  return (
    <Modal
      size="xs"
      title="Verify your identity"
      isOpen={isOpen}
      onClose={onClose}
    >
      <div
        style={{ minHeight: "400px", display: "flex", flexDirection: "column" }}
      >
        <VerificationFlowContext>
          <Wizard>
            <StatusCheckStep />
            <IntroStep />
            <EntityStep />
            <ResidencyStep />
            <IdIssuerStep />
            <AccreditedStep />
            <IdWarningStep />
            <PersonaStep />
            <ParallelMarketsStep />
            <PendingStep />
            <MintStep />
            <IneligibleStep />
          </Wizard>
        </VerificationFlowContext>
      </div>
    </Modal>
  );
}
