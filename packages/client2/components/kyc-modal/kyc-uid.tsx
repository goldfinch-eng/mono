import Image from "next/image";

import { InfoIconTooltip } from "@/components/design-system";

interface KYCModalUIDProps {
  text?: string;
  participation?: "limited" | "full";
  minted?: boolean;
}

export function KYCModalUID({ text, participation, minted }: KYCModalUIDProps) {
  return (
    <div className="w-full">
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
      {minted && (
        <div className="h-full w-full">
          <Image
            src="/content/uid-complete.jpg"
            width={300}
            height={300}
            alt="UID Image"
            className="block"
          />
        </div>
      )}

      {!minted && (
        <div className="flex w-full flex-col items-center rounded-[10px] border border-dashed border-sand-300 py-20">
          <div className="mb-5 h-[95px] w-[95px] rounded-[10px] bg-sand-100"></div>

          <p className="text-center">{text ? text : "Mystery UID"}</p>

          {participation === "limited" && (
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
          )}

          {participation === "full" && (
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
