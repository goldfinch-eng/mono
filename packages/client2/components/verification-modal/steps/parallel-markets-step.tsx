import Image from "next/future/image";
import { useWizard } from "react-use-wizard";

import { Button, Link } from "@/components/design-system";

import { VerificationFlowSteps } from "../step-manifest";
import { useVerificationFlowContext } from "../verification-flow-context";
import parallelMarketsLogo from "./parallel-logo.png";
import { StepTemplate } from "./step-template";

export function ParallelMarketsStep() {
  const { entity, accredited } = useVerificationFlowContext();
  const { goToStep } = useWizard();

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
            as="a"
            href="https://bridge.parallelmarkets.com/goldfinch"
            target="_blank"
            rel="noopener"
            className="w-full"
            iconRight="ArrowTopRight"
          >
            Verify my identity
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center">
        <Image
          src={parallelMarketsLogo}
          height={110}
          style={{ width: "auto" }}
          quality={100}
          alt="Parallel Markets"
        />

        <p className="mt-5 text-center text-sm">
          {entity === "entity" ? (
            <>
              Goldfinch uses Parallel Markets to complete verification for
              entities. After you have completed verification, we will reach out
              within 24-72 hours. Please check your junk or spam mail folder for
              this email. If you encounter any issues, please reach out to{" "}
              <Link rel="noopener" href="mailto:UID@warblerlabs.com">
                UID@warblerlabs.com
              </Link>
            </>
          ) : accredited === "accredited" ? (
            <>
              Goldfinch uses Parallel Markets to complete verification for
              accredited investors. After you have completed verification, we
              will reach out within 24-72 hours. Please check your junk or spam
              mail folder for this email. If you encounter any issues, please
              reach out to{" "}
              <Link rel="noopener" href="mailto:UID@warblerlabs.com">
                UID@warblerlabs.com
              </Link>
            </>
          ) : (
            "Goldfinch uses Parallel Markets to complete identity verification."
          )}
        </p>
      </div>
    </StepTemplate>
  );
}
