import { ReactNode } from "react";

import { InfoIconTooltip } from "@/components/design-system";

interface StatProps {
  label: string;
  value?: string;
  tooltip?: ReactNode;
}

export function Stat({ label, value, tooltip }: StatProps) {
  return (
    <div>
      <div className="items-middle mb-3 flex text-sm text-sand-600">
        {label}{" "}
        {tooltip && (
          <InfoIconTooltip
            size="sm"
            content={<div className="max-w-xs">{tooltip}</div>}
          />
        )}
      </div>
      <div className="text-2xl font-medium text-sand-700">{value}</div>
    </div>
  );
}
