import { gql } from "@apollo/client";
import clsx from "clsx";

import { RepaymentTableLoanFieldsFragment } from "@/lib/graphql/generated";

import { RepaymentScheduleBarChart } from "./repayment-schedule-bar-chart";
import { RepaymentScheduleTable } from "./repayment-schedule-table";

gql`
  fragment RepaymentTableLoanFields on Loan {
    loanRepaymentSchedule: repaymentSchedule(
      orderBy: paymentPeriod
      first: 1000
    ) {
      paymentPeriod
      estimatedPaymentDate
      interest
      principal
    }
  }
`;

interface RepaymentTermsScheduleProps {
  loan: RepaymentTableLoanFieldsFragment;
  currentBlockTimestamp: number;
  className?: string;
}

export function RepaymentTermsSchedule({
  loan,
  currentBlockTimestamp,
  className,
}: RepaymentTermsScheduleProps) {
  const repaymentSchedule = loan.loanRepaymentSchedule.filter(
    (r) => r.estimatedPaymentDate >= currentBlockTimestamp
  );

  return (
    <div className={clsx(className, "rounded-xl border border-sand-300")}>
      <div className="p-6">
        <RepaymentScheduleBarChart repaymentSchedule={repaymentSchedule} />
      </div>
      <RepaymentScheduleTable repaymentSchedule={repaymentSchedule} />
    </div>
  );
}

export function RepaymentTermsSchedulePlaceholder() {
  return <div className="h-96 rounded-xl border border-sand-300"></div>;
}
