import { Wizard } from "react-use-wizard";

import { AccreditedStep } from "./steps/accredited-step";
import { AlreadyMintedStep } from "./steps/already-minted-step";
import { EntityStep } from "./steps/entity-step";
import { IdIssuerStep } from "./steps/id-issuer-step";
import { IdWarningStep } from "./steps/id-warning-step";
import { IneligibleStep } from "./steps/ineligible-step";
import { IntroStep } from "./steps/intro-step";
import { MintFinishedStep } from "./steps/mint-finished-step";
import { MintStep } from "./steps/mint-step";
import { MintToAddressStep } from "./steps/mint-to-address-step";
import { ParallelMarketsStep } from "./steps/parallel-markets-step";
import { PendingStep } from "./steps/pending-step";
import { PersonaStep } from "./steps/persona-step";
import { ResidencyStep } from "./steps/residency-step";
import { StatusCheckStep } from "./steps/status-check-step";
import { VerificationFlowContext } from "./verification-flow-context";

export function Flow() {
  return (
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
        <MintToAddressStep />
        <MintFinishedStep />
        <IneligibleStep />
        <AlreadyMintedStep />
      </Wizard>
    </VerificationFlowContext>
  );
}
