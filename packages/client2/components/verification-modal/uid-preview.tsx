import Image from "next/image";

import { InfoIconTooltip } from "@/components/design-system";

import uidComplete from "./uid-complete.jpg";
import { useVerificationFlowContext } from "./verification-flow-context";

export function UidPreview({ minted }: { minted?: boolean }) {
  const { entity, residency, accredited } = useVerificationFlowContext();
  const description: string =
    !entity && !residency && !accredited
      ? "Mystery UID?"
      : `${
          residency === "us" ? "U.S." : residency === "non-us" ? "Non U.S." : ""
        } ${
          accredited === "accredited"
            ? "Accredited"
            : accredited === "non-accredited"
            ? "Non-accredited"
            : ""
        } ${
          entity === "individual"
            ? "Individual"
            : entity === "entity"
            ? "Entity"
            : ""
        }`;
  const limitedParticipation: boolean =
    residency === "us" &&
    accredited === "non-accredited" &&
    entity === "individual";
  return (
    <div>
      <div className="mb-5 flex justify-between">
        <h5 className="text-lg font-semibold">Your Goldfinch UID</h5>
        <InfoIconTooltip
          size="sm"
          content={
            <div className="max-w-xs">
              Lorem ipsum dolor sit amet, consectetur adipisicing elit. Officia
              culpa possimus accusantium cumque suscipit.
            </div>
          }
        />
      </div>
      {minted ? (
        <div className="h-full w-full">
          <Image
            src={uidComplete}
            width={300}
            height={300}
            quality={100}
            alt="UID Image"
            className="block"
          />
        </div>
      ) : (
        <div className="flex w-full flex-col items-center rounded-[10px] border border-dashed border-sand-300 py-20">
          <div className="mb-5 h-[95px] w-[95px] rounded-[10px] bg-sand-200"></div>

          <p className="text-center">{description}</p>

          {limitedParticipation ? (
            <div className="flex items-center justify-between">
              <span className="text-xs">Limited participation</span>
              <span className="opacity-60">
                <InfoIconTooltip
                  size="xs"
                  content={
                    <div className="max-w-xs">
                      Lorem ipsum dolor sit amet, consectetur adipisicing elit.
                      Officia culpa possimus accusantium cumque suscipit.
                    </div>
                  }
                />
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs">Full participation</span>
              <span className="opacity-60">
                <InfoIconTooltip
                  size="xs"
                  content={
                    <div className="max-w-xs">
                      Lorem ipsum dolor sit amet, consectetur adipisicing elit.
                      Officia culpa possimus accusantium cumque suscipit.
                    </div>
                  }
                />
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
