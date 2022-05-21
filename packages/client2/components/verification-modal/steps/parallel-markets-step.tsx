import Image from "next/image";
import { useWizard } from "react-use-wizard";

import { Button, Link } from "@/components/design-system";

import { VerificationFlowSteps } from "../step-manifest";
import { UidPreview } from "../uid-preview";
import { useVerificationFlowContext } from "../verification-flow-context";
import parallelMarketsLogo from "./parallel-logo.png";

export function ParallelMarketsStep() {
  const { entity, accredited } = useVerificationFlowContext();
  const { goToStep } = useWizard();

  return (
    <div>
      <div className="flex justify-between">
        <div className="mt-10 flex w-6/12 flex-col items-center">
          <Image
            src={parallelMarketsLogo}
            width={120}
            height={120}
            alt="Persona"
          />

          <p className="my-5 text-center text-sm">
            {entity === "entity" ? (
              <>
                Goldfinch uses Parallel Markets to complete verification for
                entities. After you have completed verification, we will reach
                out within 24-72 hours. If you encounter any issues, please
                reach out to{" "}
                <Link
                  rel="noopener"
                  href="mailto:institutional@goldfinch.finance"
                >
                  institutional@goldfinch.finance
                </Link>
              </>
            ) : accredited === "accredited" ? (
              <>
                Goldfinch uses Parallel Markets to complete verification for
                accredited investors. After you have completed verification, we
                will reach out within 24-72 hours. If you encounter any issues,
                please reach out to{" "}
                <Link rel="noopener" href="mailto:accredited@goldfinch.finance">
                  accredited@goldfinch.finance
                </Link>
              </>
            ) : (
              "Goldfinch uses Parallel Markets to complete identity verification."
            )}
          </p>

          <p className="text-center text-xs text-sand-500">
            All information is kept secure and will not be used for any purpose
            beyond executing your supply request. The only information we store
            is your ETH address, country, and approval status. We take privacy
            seriously. Why does Goldfinch KYC?
          </p>
        </div>
        <div className="w-5/12">
          <UidPreview />
        </div>
      </div>
      <div className="flex justify-between">
        <Button
          size="lg"
          colorScheme="secondary"
          onClick={() => goToStep(VerificationFlowSteps.IndividualOrEntity)}
        >
          Back
        </Button>
        <Link
          href="https://bridge.parallelmarkets.com/goldfinch"
          target="_blank"
          rel="noopener"
        >
          Verify my identity
        </Link>
      </div>
    </div>
  );
}
