import { Wizard } from "react-use-wizard";

import { Modal, ModalProps } from "@/components/design-system";

import { AccreditedStep } from "./steps/accredited-step";
import { EntityStep } from "./steps/entity-step";
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
      size="md"
      title="Verify your identity"
      isOpen={isOpen}
      onClose={onClose}
    >
      <div style={{ height: "500px" }}>
        <VerificationFlowContext>
          <Wizard>
            <StatusCheckStep />
            <IntroStep />
            <EntityStep />
            <ResidencyStep />
            <AccreditedStep />
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
