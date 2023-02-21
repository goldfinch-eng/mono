import clsx from "clsx";
import { format as formatDate } from "date-fns";
import { BigNumber } from "ethers/lib/ethers";
import { gql } from "graphql-request";

import { RepaymentTermsScheduleFragment } from "@/lib/graphql/generated";
import { calculateInterestOwed } from "@/pages/borrow/helpers";
import { RepaymentScheduleTable } from "@/pages/pools/[address]/v2-components/repayment-schedule-table";

import RepaymentScheduleBarChart from "../v2-components/repayment-schedule-bar-chart";

export const REPAYMENT_TERMS_SCHEDULE_FIELDS = gql`
  fragment RepaymentTermsSchedule on TranchedPool {
    id
    initialInterestOwed
    creditLine {
      id
      termInDays
      termStartTime
      termEndTime
      paymentPeriodInDays
      interestApr
      balance
      interestAprDecimal
      limit
    }
  }
`;

interface RepaymentTermsScheduleProps {
  loan?: RepaymentTermsScheduleFragment | null;
  className?: string;
}

export interface RepaymentScheduleData {
  paymentPeriod: string;
  estimatedPaymentDate: string;
  principal: BigNumber;
  interest: BigNumber;
}

const generateRepaymentScheduleData = (
  loan: RepaymentTermsScheduleFragment
) => {
  const repaymentScheduleData: RepaymentScheduleData[] = [];

  const termStartTime = loan.creditLine.termStartTime.toNumber();
  const termEndTime = loan.creditLine.termEndTime.toNumber();

  // Number of seconds in 'paymentPeriodInDays'
  const paymentPeriodInSeconds =
    loan.creditLine.paymentPeriodInDays.toNumber() * 24 * 60 * 60;

  // Keep track of period start & end and payment period number
  let periodStartTimestamp = termStartTime;
  let paymentPeriod = 1;

  for (
    let periodEndTimestamp = termStartTime + paymentPeriodInSeconds;
    periodEndTimestamp <= termEndTime;
    periodEndTimestamp += paymentPeriodInSeconds
  ) {
    const expectedInterest = calculateInterestOwed({
      isLate: false,
      interestOwed: BigNumber.from(0),
      interestApr: loan.creditLine.interestApr,
      nextDueTime: BigNumber.from(periodEndTimestamp),
      interestAccruedAsOf: BigNumber.from(periodStartTimestamp),
      balance: loan.creditLine.balance,
    });
    repaymentScheduleData.push({
      paymentPeriod: paymentPeriod.toString(),
      estimatedPaymentDate: formatDate(periodEndTimestamp * 1000, "MMM, d"),
      principal: BigNumber.from(0),
      interest: expectedInterest,
    });

    paymentPeriod++;
    periodStartTimestamp = periodEndTimestamp;
  }

  // Catch the remainder of time for the final period
  if (periodStartTimestamp <= termEndTime) {
    const expectedInterest = calculateInterestOwed({
      isLate: false,
      interestOwed: BigNumber.from(0),
      interestApr: loan.creditLine.interestApr,
      nextDueTime: BigNumber.from(termEndTime),
      interestAccruedAsOf: BigNumber.from(periodStartTimestamp),
      balance: loan.creditLine.limit,
    });
    repaymentScheduleData.push({
      paymentPeriod: paymentPeriod.toString(),
      estimatedPaymentDate: formatDate(termEndTime * 1000, "MMM, d"),
      principal: loan.creditLine.limit,
      interest: expectedInterest,
    });
  }

  return repaymentScheduleData;
};

export function RepaymentTermsSchedule({
  loan,
  className,
}: RepaymentTermsScheduleProps) {
  if (!loan || !loan.creditLine) {
    return null;
  }

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
