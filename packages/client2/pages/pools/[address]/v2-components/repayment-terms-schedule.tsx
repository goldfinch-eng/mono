import clsx from "clsx";
import { format as formatDate } from "date-fns";
import { BigNumber } from "ethers/lib/ethers";
import { gql } from "graphql-request";

import { RepaymentTermsScheduleFieldsFragment } from "@/lib/graphql/generated";
import { calculateInterestOwed } from "@/pages/borrow/helpers";
import { RepaymentScheduleTable } from "@/pages/pools/[address]/v2-components/repayment-schedule-table";

import RepaymentScheduleBarChart from "../v2-components/repayment-schedule-bar-chart";

export const REPAYMENT_TERMS_SCHEDULE_FIELDS = gql`
  fragment RepaymentTermsScheduleFields on Loan {
    termStartTime
    termEndTime
    paymentPeriodInDays
    interestRateBigInt
    principalAmount
  }
`;

interface RepaymentTermsScheduleProps {
  loan?: RepaymentTermsScheduleFieldsFragment | null;
  className?: string;
}

export interface RepaymentScheduleData {
  paymentPeriod: string;
  estimatedPaymentDate: string;
  principal: BigNumber;
  interest: BigNumber;
}

const generateRepaymentScheduleData = (
  loan: RepaymentTermsScheduleFieldsFragment
) => {
  const repaymentScheduleData: RepaymentScheduleData[] = [];

  const termStartTime = loan.termStartTime.toNumber();
  const termEndTime = loan.termEndTime.toNumber();

  // Number of seconds in 'paymentPeriodInDays'
  const paymentPeriodInSeconds =
    loan.paymentPeriodInDays.toNumber() * 24 * 60 * 60;

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
      interestApr: loan.interestRateBigInt,
      nextDueTime: BigNumber.from(periodEndTimestamp),
      interestAccruedAsOf: BigNumber.from(periodStartTimestamp),
      balance: loan.principalAmount,
    });
    repaymentScheduleData.push({
      paymentPeriod: paymentPeriod.toString(),
      estimatedPaymentDate: formatDate(periodEndTimestamp * 1000, "MMM d, Y"),
      principal: BigNumber.from(0),
      interest: expectedInterest,
    });

    paymentPeriod++;
    periodStartTimestamp = periodEndTimestamp;
  }

  // Catch the remainder of time when there's not a perfect diff of 'paymentPeriodInDays' on the last period
  // i.e startTime Dec 6th 2024, endTime Dec 16th 2024 and paymentPeriodInDays is 30 days
  if (periodStartTimestamp <= termEndTime) {
    const expectedInterest = calculateInterestOwed({
      isLate: false,
      interestOwed: BigNumber.from(0),
      interestApr: loan.interestRateBigInt,
      nextDueTime: BigNumber.from(termEndTime),
      interestAccruedAsOf: BigNumber.from(periodStartTimestamp),
      balance: loan.principalAmount,
    });
    repaymentScheduleData.push({
      paymentPeriod: paymentPeriod.toString(),
      estimatedPaymentDate: formatDate(termEndTime * 1000, "MMM d, Y"),
      principal: loan.principalAmount,
      interest: expectedInterest,
    });
  }

  return repaymentScheduleData;
};

export function RepaymentTermsSchedule({
  loan,
  className,
}: RepaymentTermsScheduleProps) {
  if (!loan) {
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
