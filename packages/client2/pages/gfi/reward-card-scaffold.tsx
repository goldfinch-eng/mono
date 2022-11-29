import clsx from "clsx";
import { ReactNode, useState } from "react";

import { Icon, Link } from "@/components/design-system";

interface RewardCardScaffoldProps {
  heading: string;
  subheading: string;
  fadedAmount: string;
  boldedAmount: string;
  action: ReactNode;
  expandedDetails: ReactNode;
  warning?: string;
  includeVaultNotice?: boolean;
}

export function RewardCardScaffold({
  heading,
  subheading,
  fadedAmount,
  boldedAmount,
  action,
  expandedDetails,
  warning,
  includeVaultNotice = false,
}: RewardCardScaffoldProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="relative rounded-xl bg-sand-100 py-4 px-6 hover:bg-sand-200">
      <div className="grid grid-cols-1 items-center xs:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="mb-1.5 text-xl font-medium">{heading}</div>
          <div className="text-sand-700">{subheading}</div>
          {warning ? <div className="mt-2 text-clay-500">{warning}</div> : null}
        </div>
        <div className="hidden justify-self-end text-xl text-sand-500 lg:block">
          {fadedAmount}
        </div>
        <div className="hidden justify-self-end text-xl font-medium text-sand-700 lg:block">
          {boldedAmount}
        </div>
        <div className="flex items-center justify-self-end">
          <div className="relative z-10">{action}</div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="ml-6 before:absolute before:inset-0"
          >
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
      {includeVaultNotice ? (
        <div className="relative z-10 mt-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded bg-mustard-200 py-2 px-3 text-xs text-mustard-900">
          <div>
            You cannot claim GFI from a capital position while it is in the
            Vault.
          </div>
          <Link href="/membership" iconRight="ArrowSmRight">
            Go to Vault
          </Link>
        </div>
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
