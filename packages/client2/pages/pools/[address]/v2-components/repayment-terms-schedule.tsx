import { BigNumber } from "ethers/lib/ethers";
import { gql } from "graphql-request";

import { formatCrypto } from "@/lib/format";
import { RepaymentTermsScheduleFragment } from "@/lib/graphql/generated";
import StackedBarChart from "@/pages/pools/[address]/v2-components/bar-chart";

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
      interestAprDecimal
      limit
    }
  }
`;

interface RepaymentTermsScheduleProps {
  loan?: RepaymentTermsScheduleFragment | null;
  className?: string;
}

export function RepaymentTermsSchedule({
  loan,
  className,
}: RepaymentTermsScheduleProps) {
  if (!loan || !loan.creditLine) {
    return null;
  }

  const numberOfPayments = Math.floor(
    loan.creditLine.termInDays.toNumber() /
      loan.creditLine.paymentPeriodInDays.toNumber()
  );

  const formattedInitialInterestOwed = formatCrypto({
    amount: loan.initialInterestOwed,
    token: "USDC",
  });

  const instalmentAmount = formatCrypto({
    amount: loan.initialInterestOwed.div(BigNumber.from(numberOfPayments)),
    token: "USDC",
  });

  const formattedLimit = formatCrypto({
    amount: loan.creditLine.limit,
    token: "USDC",
  });

  return (
    <div className={className}>
      <div>
        Interest Owed:
        {formattedInitialInterestOwed}
      </div>
      <div>Payment per instalment: {instalmentAmount}</div>
      <div>Number of payments: {numberOfPayments}</div>
      <div className="mb-10">Principal: {formattedLimit}</div>

      <StackedBarChart />
    </div>
  );
}
