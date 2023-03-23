import { gql } from "@apollo/client";
import { formatDistanceStrict, format as formatDate } from "date-fns";

import { Stat, StatGrid } from "@/components/design-system";
import { RepaymentTermsStatsFieldsFragment } from "@/lib/graphql/generated";
import { getRepaymentFrequencyLabel } from "@/lib/pools";

export const REPAYMENT_TERMS_STATS_FIELDS = gql`
  fragment RepaymentTermsStatsFields on Loan {
    __typename
    fundableAt
    termInSeconds
    termStartTime
    termEndTime
    numRepayments
    repaymentFrequency
  }
`;

interface RepaymentTermsStatsProps {
  loan: RepaymentTermsStatsFieldsFragment;
}

export function RepaymentTermsStats({ loan }: RepaymentTermsStatsProps) {
  const secondsPerDay = 24 * 60 * 60;
  const termStartTime = !loan.termStartTime.isZero()
    ? loan.termStartTime.toNumber()
    : loan.fundableAt + secondsPerDay * 14;
  const termEndTime = !loan.termEndTime.isZero()
    ? loan.termEndTime.toNumber()
    : termStartTime + loan.termInSeconds;

  return (
    <StatGrid bgColor="mustard-50">
      <Stat
        label="Loan term"
        tooltip="The duration of a loan and the period during which the borrower is expected to make payments to the lender."
        value={formatDistanceStrict(0, loan.termInSeconds * 1000, {
          unit: "month",
        })}
      />
      <Stat
        label="Payment frequency"
        tooltip="The frequency of interest payments."
        className="capitalize"
        value={getRepaymentFrequencyLabel(loan.repaymentFrequency)}
      />
      <Stat
        label="Total payments"
        tooltip="The expected total number of principal and interest payments."
        value={loan.numRepayments}
      />
      <Stat
        label="Repayment structure"
        tooltip="This refers to the schedule of repayments that the borrower is expected to make to the lender. An amortizing loan is one in which the borrower makes regular payments of principal and interest over the life of the loan, resulting in a zero balance at the end of the term. A bullet loan is one in which the borrower makes interest-only payments for a period of time, followed by a balloon payment of the remaining principal at the end of the term."
        value={loan.__typename === "CallableLoan" ? "Callable" : "Bullet"}
      />
      <Stat
        label="Est. repayment start date"
        tooltip="The estimated date by which the first interest payment is to be made by the borrower."
        value={formatDate(termStartTime * 1000, "MMM d, y")}
      />
      <Stat
        label={
          loan.termEndTime.isZero()
            ? "Est. loan maturity date"
            : "Loan maturity date"
        }
        tooltip="The estimated date that the Pool’s payment term will end, and by which the Borrower is scheduled to have repaid their total loan amount in full, according to the Pool’s deal terms."
        value={formatDate(termEndTime * 1000, "MMM d, y")}
      />
    </StatGrid>
  );
}

export function RepaymentTermsStatsPlaceholder() {
  return (
    <StatGrid bgColor="mustard-50">
      <Stat label="Loan term" />
      <Stat label="Payment frequency" />
      <Stat label="Total payments" />
      <Stat label="Repayment structure" />
      <Stat label="Est. repayment start date" />
      <Stat label="Est. loan maturity date" />
    </StatGrid>
  );
}
