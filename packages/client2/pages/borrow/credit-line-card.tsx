import { gql } from "@apollo/client";
import NextLink from "next/link";
import { ReactNode } from "react";

import { InfoIconTooltip } from "@/components/design-system";
import { TranchedPoolBorrowCardFieldsFragment } from "@/lib/graphql/generated";
import { CreditLineStatus } from "@/pages/borrow/helpers";

interface CreditLineCardProps {
  className?: string;
  href: string;
  dealMetaData: TranchedPoolBorrowCardFieldsFragment;
  description: ReactNode;
  nextPayment: ReactNode;
  status: CreditLineStatus;
  dueDateLabel: ReactNode;
}

export const TRANCHED_POOL_BORROW_CARD_DEAL_FIELDS = gql`
  fragment TranchedPoolBorrowCardFields on Deal {
    id
    name
    category
  }
`;

const CreditLineStatusWithTooltip = ({
  status,
}: {
  status: CreditLineStatus;
}) => {
  let label: string;
  let tooltipContent: string;
  switch (status) {
    case CreditLineStatus.Open:
      label = "Open";
      tooltipContent =
        "Pool is either about to be, or currently open to receiving funds.";
      break;
    case CreditLineStatus.Repaid:
      label = "Repaid";
      tooltipContent =
        "100% of principal and accrued interest has been fully repaid.";
      break;
    case CreditLineStatus.PaymentLate:
      label = "Grace Period";
      tooltipContent =
        "Pool is past due on principal and or interest obligations.";
      break;
    default:
      label = "Current";
      tooltipContent =
        "Pool is up to date on principal and or interest obligations.";
      break;
  }

  return (
    <div className="flex items-center">
      <div>{label}</div>
      <InfoIconTooltip className="ml-0.5" content={tooltipContent} />
    </div>
  );
};

export function CreditLineCard({
  className,
  href,
  dealMetaData,
  description,
  nextPayment,
  status,
  dueDateLabel,
}: CreditLineCardProps) {
  return (
    <div className={className}>
      <div className="relative rounded-xl bg-sand-100 p-5 hover:bg-sand-200">
        <div className="grid grid-cols-12 items-center gap-7">
          <div className="col-span-6 flex flex-col break-words text-sand-700 md:col-span-5">
            <NextLink href={href} passHref>
              <a className="text-lg font-medium text-sand-700 before:absolute before:inset-0">
                {dealMetaData.name}
              </a>
            </NextLink>
            <div className="text-sand-700">{dealMetaData.category}</div>
          </div>
          <div className="col-span-3 hidden justify-self-end text-lg text-sand-700 md:block">
            {description}
          </div>
          <div className="hidden justify-self-end text-lg text-sand-700 md:col-span-2 md:block">
            {nextPayment}
          </div>
          <div className="col-span-6 hidden justify-self-end text-lg text-sand-700 md:col-span-1 md:block">
            <CreditLineStatusWithTooltip status={status} />
          </div>
          <div className="col-span-6 block justify-self-end text-lg text-sand-700 md:col-span-1">
            {dueDateLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
