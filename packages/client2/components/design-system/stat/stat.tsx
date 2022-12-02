import clsx from "clsx";
import { ReactNode } from "react";

import { InfoIconTooltip, Shimmer } from "@/components/design-system";

interface StatProps {
  /**
   * The label of the stat to display
   */
  label: string;

  /**
   * The content of the stat to display. If not provided, a <Shimmer /> component will be rendered to indicate it is loading.
   */
  value?: ReactNode;

  /**
   * Optional tooltip to display with an info icon
   */
  tooltip?: ReactNode;
}

export function Stat({ label, value, tooltip }: StatProps) {
  return (
    <div className="bg-white p-4">
      <div className="mb-3 flex items-center text-sm text-sand-600">
        <span className={clsx(tooltip ? "mr-2" : "")}>{label}</span>
        {tooltip && <InfoIconTooltip size="sm" content={tooltip} />}
      </div>
      <div className="text-xl font-medium text-sand-700 md:text-2xl">
        {value ?? <Shimmer style={{ width: "10ch" }} />}
      </div>
    </div>
  );
}
