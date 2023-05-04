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
        label={
          loan.termStartTime.isZero()
            ? "Est. term start date"
            : "Term start date"
        }
        tooltip="This marks the loan's start date."
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
      <Stat
        label="Repayment structure"
        tooltip="Repayment Structure refers to the way principal is repaid for a loan. “Amortizing” means principal is paid back consistently over time. “Bullet” means principal is paid back all at once at the end. And “Callable” means the investor has the right to ‘call back’ some or all of their capital at regular intervals (eg. every 3 months)."
        value={loan.__typename === "CallableLoan" ? "Callable" : "Bullet"}
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
    </StatGrid>
  );
}

export function RepaymentTermsStatsPlaceholder() {
  return (
    <StatGrid bgColor="mustard-50">
      <Stat label="Loan term" />
      <Stat label="Term start date" />
      <Stat label="Est. loan maturity date" />
      <Stat label="Repayment structure" />
      <Stat label="Payment frequency" />
      <Stat label="Total payments" />
    </StatGrid>
  );
}
