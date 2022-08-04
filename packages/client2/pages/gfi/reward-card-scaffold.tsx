import clsx from "clsx";
import { ReactNode, useState } from "react";

import { Icon } from "@/components/design-system";

interface RewardCardScaffoldProps {
  heading: string;
  subheading: string;
  fadedAmount: string;
  boldedAmount: string;
  action: ReactNode;
  expandedDetails: ReactNode;
  warning?: string;
}

export function RewardCardScaffold({
  heading,
  subheading,
  fadedAmount,
  boldedAmount,
  action,
  expandedDetails,
  warning,
}: RewardCardScaffoldProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-xl bg-sand-100 py-4 px-6">
      <div
        className="grid"
        style={{
          gridTemplateColumns: "1fr 20% 20% 25%",
          alignItems: "center",
        }}
      >
        <div>
          <div className="mb-1.5 text-xl font-medium">{heading}</div>
          <div className="text-sand-700">{subheading}</div>
          {warning ? <div className="mt-2 text-clay-500">{warning}</div> : null}
        </div>
        <div className="justify-self-end text-xl text-sand-500">
          {fadedAmount}
        </div>
        <div className="justify-self-end text-xl font-medium text-sand-700">
          {boldedAmount}
        </div>
        <div className="flex items-center justify-self-end">
          {action}
          <button onClick={() => setIsExpanded(!isExpanded)} className="mx-8">
            <Icon
              name="ChevronDown"
              size="lg"
              className={clsx(
                "transition-transform",
                isExpanded ? "rotate-180" : null
              )}
            />
          </button>
        </div>
      </div>
      {isExpanded ? (
        <>
          <hr className="my-6 border-t border-sand-300" />
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {expandedDetails}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function Detail({ heading, body }: { heading: string; body: string }) {
  return (
    <div>
      <div className="mb-1.5 text-sm text-sand-600">{heading}</div>
      <div className="text-lg font-medium text-sand-700">{body}</div>
    </div>
  );
}
