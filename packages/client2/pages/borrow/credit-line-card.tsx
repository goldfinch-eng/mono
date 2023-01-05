import Link from "next/link";
import { ReactNode } from "react";

import { TranchedPoolBorrowCardFieldsFragment } from "../../lib/graphql/generated";
import { CreditLineStatus } from "./index.page";

interface CreditLineCardProps {
  className?: string;
  href: string;
  dealMetaData: TranchedPoolBorrowCardFieldsFragment;
  description: ReactNode;
  nextPayment: ReactNode;
  status: CreditLineStatus;
  dueDateLabel: ReactNode;
}

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
    <Link href={href} passHref>
      <a>
        <div className={className}>
          <div className="relative rounded-xl bg-sand-100 p-5 hover:bg-sand-200">
            <div className="grid grid-cols-12 items-center gap-6">
              <div className="col-span-6 block flex flex-col break-words text-sand-700 md:col-span-5">
                <div className="text-lg font-medium text-sand-700">
                  {dealMetaData.name}
                </div>
                <div className="text-sand-700">{dealMetaData.category}</div>
              </div>
              <div className="col-span-3 block hidden justify-self-end text-lg text-sand-700 md:block">
                {description}
              </div>
              <div className="hidden justify-self-end text-lg text-sand-700 md:col-span-2 md:block">
                {nextPayment}
              </div>
              <div className="col-span-6 block hidden justify-self-end text-lg text-sand-700 md:col-span-1 md:block">
                {[
                  CreditLineStatus.PaymentDue,
                  CreditLineStatus.PaymentLate,
                  CreditLineStatus.PeriodPaid,
                ].includes(status)
                  ? "Active"
                  : "Inactive"}
              </div>
              <div className="col-span-6 block justify-self-end text-lg text-sand-700 md:col-span-1">
                {dueDateLabel}
              </div>
            </div>
          </div>
        </div>
      </a>
    </Link>
  );
}
