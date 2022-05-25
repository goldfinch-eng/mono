import { useEffect, useState } from "react";
import { useWizard } from "react-use-wizard";

import { Spinner } from "@/components/design-system";
import { fetchKycStatus, getSignatureForKyc } from "@/lib/verify";
import { useWallet } from "@/lib/wallet";

import { VerificationFlowSteps } from "../step-manifest";
import { useVerificationFlowContext } from "../verification-flow-context";

export function StatusCheckStep({}) {
  const { goToStep } = useWizard();
  const { setSignature } = useVerificationFlowContext();
  const { account, provider } = useWallet();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!account || !provider) {
      return;
    }
    const asyncEffect = async () => {
      try {
        const signature = await getSignatureForKyc(provider);
        setSignature(signature);
        const kycStatus = await fetchKycStatus(
          account,
          signature.signature,
          signature.signatureBlockNum
        );
        if (kycStatus.status === "failed") {
          goToStep(VerificationFlowSteps.Ineligible);
        } else if (kycStatus.status === "approved") {
          goToStep(VerificationFlowSteps.Mint);
        } else {
          goToStep(VerificationFlowSteps.Intro);
        }
      } catch (e) {
        setError((e as Error).message ?? "Something went wrong");
      }
    };
    asyncEffect();
  }, [account, provider, setSignature, goToStep]);

  return (
    <div className="flex h-full w-full grow items-center justify-center text-center">
      <div>
        <Spinner className="m-auto mb-8 block !h-16 !w-16" />
        <div>
          {error ? (
            <span className="text-clay-500">{error}</span>
          ) : !account || !provider ? (
            "You must connect your wallet to proceed"
          ) : (
            "Checking your verification status, this requires a signature"
          )}
        </div>
      </div>
    </div>
  );
}
