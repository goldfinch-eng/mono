import { InfoIconTooltip } from "@/components/design-system";

interface KYCModalUIDProps {
  text?: string;
  limited?: boolean;
}

export function KYCModalUID({ text, limited = false }: KYCModalUIDProps) {
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
      <div className="flex w-full flex-col items-center rounded-[10px] border border-dashed border-sand-300 py-20">
        <div className="mb-5 h-[95px] w-[95px] rounded-[10px] bg-sand-100"></div>
        <p className="text-center">{text ? text : "Mystery UID"}</p>

        {limited && (
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
      </div>
    </div>
  );
}
