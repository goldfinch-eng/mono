import clsx from "clsx";

import { RepaymentScheduleFieldsFragment } from "@/lib/graphql/generated";
import { generateRepaymentSchedule } from "@/lib/pools";

import { RepaymentScheduleBarChart } from "./repayment-schedule-bar-chart";
import { RepaymentScheduleTable } from "./repayment-schedule-table";

interface RepaymentTermsScheduleProps {
  loan: RepaymentScheduleFieldsFragment;
  className?: string;
}

export function RepaymentTermsSchedule({
  loan,
  className,
}: RepaymentTermsScheduleProps) {
  const repaymentSchedule = generateRepaymentSchedule(loan);

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
