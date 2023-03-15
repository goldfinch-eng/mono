import clsx from "clsx";
import { ReactNode } from "react";

import { InfoIconTooltip, Shimmer } from "@/components/design-system";

export interface InfoLineProps {
  className?: string;
  label: string;
  value?: ReactNode;
  tooltip?: ReactNode;
}

export function InfoLine({ className, label, value, tooltip }: InfoLineProps) {
  return (
    <div
      className={clsx(
        "flex items-center justify-between gap-4 border-t border-mustard-200 py-3",
        className
      )}
    >
      <div className="flex">
        <div className="mr-1 text-xs sm:text-sm">{label}</div>
        {tooltip ? <InfoIconTooltip content={tooltip} size="sm" /> : null}
      </div>
      <div className="text-right text-sm font-medium sm:text-base">
        {value ? value : <Shimmer style={{ width: "15ch" }} />}
      </div>
    </div>
  );
}
