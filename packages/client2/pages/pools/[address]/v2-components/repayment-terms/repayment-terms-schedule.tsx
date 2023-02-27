import clsx from "clsx";

import { RepaymentScheduleFieldsFragment } from "@/lib/graphql/generated";
import { generateRepaymentScheduleData } from "@/lib/pools";

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
  const repaymentScheduleData = generateRepaymentScheduleData(loan);

  return (
    <div className={clsx(className, "rounded-xl border border-sand-300")}>
      <div className="p-6">
        <RepaymentScheduleBarChart
          repaymentScheduleData={repaymentScheduleData}
        />
      </div>
      <RepaymentScheduleTable repaymentScheduleData={repaymentScheduleData} />
    </div>
  );
}

export function RepaymentTermsSchedulePlaceholder() {
  return <div className="h-96 rounded-xl border border-sand-300"></div>;
}
