import { randomBytes } from "crypto";

import Image from "next/future/image";
import { useWizard } from "react-use-wizard";

import { Button, Link } from "@/components/design-system";
import { PARALLEL_MARKETS } from "@/constants";
import { buildURL } from "@/lib/urls";

import { VerificationFlowSteps } from "../step-manifest";
import { useVerificationFlowContext } from "../verification-flow-context";
import parallelMarketsLogo from "./parallel-logo.png";
import { StepTemplate } from "./step-template";

const url = buildURL(`${PARALLEL_MARKETS.API_URL}/oauth/authorize`, {
  client_id: PARALLEL_MARKETS.CLIENT_ID,
  redirect_uri: PARALLEL_MARKETS.REDIRECT_URI,
  scope: PARALLEL_MARKETS.SCOPE,
  state: "Z9hLvSULzTSdm" /* will change this soon to be randomly generated */,
  response_type: "code",
});

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
            href={url.toString()}
            onClick={() =>
              localStorage.setItem("parallel_markets_state", state)
            }
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
