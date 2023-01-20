import Image from "next/future/image";

import { InfoIconTooltip, useModalContext } from "@/components/design-system";
import { getUIDLabelFromType, UIDType } from "@/lib/verify";

import { ExitFlowButton } from "../exit-flow-button";
import { useVerificationFlowContext } from "../verification-flow-context";
import greenCheckmark from "./green-checkmark.png";
import { StepTemplate } from "./step-template";
import uidLogo2 from "./uid-logo2.png";

export function MintFinishedStep() {
  const { useModalTitle } = useModalContext();
  useModalTitle("Mint your UID");
  const { uidVersion } = useVerificationFlowContext();
  return (
    <StepTemplate
      includePrivacyStatement={false}
      heading="Success! You're all set."
      headingClassName="font-medium"
      footer={<ExitFlowButton>Finish</ExitFlowButton>}
    >
      <div className="flex h-full flex-col items-center justify-between">
        <div className="text-center">
          <div className="relative m-auto w-max">
            <Image
              src={uidLogo2}
              width={110}
              height={110}
              quality={100}
              alt="UID"
            />
            <Image
              src={greenCheckmark}
              width={40}
              height={40}
              alt="Minted"
              className="absolute -top-2 -right-2"
            />
          </div>
          <div>
            <div className="font-medium">
              {uidVersion ? getUIDLabelFromType(uidVersion) : null}
            </div>
            <div className="mb-5 text-sm text-sand-500">
              {uidVersion === UIDType.USNonAccreditedIndividual ? (
                <div className="flex items-center justify-center gap-1">
                  Limited participation{" "}
                  <InfoIconTooltip
                    placement="right"
                    content="Limited participation means that you may only participate in governance of the protocol, not lending or borrowing."
                  />
                </div>
              ) : (
                "Full participation"
              )}
            </div>
          </div>
        </div>
        <div className="text-center text-xs text-sand-400">
          With your newly minted UID, you can now participate in all the
          Goldfinch protocol activities you&rsquo;re eligible for. Get to it!
        </div>
      </div>
    </StepTemplate>
  );
}
