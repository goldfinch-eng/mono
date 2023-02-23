import { formatDistanceStrict, format as formatDate } from "date-fns";
import { gql } from "graphql-request";

import { Stat, StatGrid } from "@/components/design-system";
import { RepaymentTermsStatsFieldsFragment } from "@/lib/graphql/generated";

export const REPAYMENT_TERMS_STATS_FIELDS = gql`
  fragment RepaymentTermsStatsFields on Loan {
    fundableAt
    termInDays
    paymentPeriodInDays
    termInDays
    termStartTime
    termEndTime
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
    : termStartTime + loan.termInDays * secondsPerDay;

  return (
    <StatGrid bgColor="mustard-50">
      <Stat
        label="Loan term"
        tooltip="TODO: Loan term tooltip"
        value={formatDistanceStrict(0, loan.termInDays * secondsPerDay * 1000, {
          unit: "month",
          roundingMethod: "ceil",
        })}
      />
      <Stat
        label="Payment frequency"
        tooltip="TODO: Payment frequency tooltip"
        value={`${loan.paymentPeriodInDays.toString()} days`}
      />
      <Stat
        label="Total payments"
        tooltip="TODO: Total payments tooltip"
        value={Math.ceil(loan.termInDays / loan.paymentPeriodInDays.toNumber())}
      />
      <Stat
        label="Repayment structure"
        tooltip="TODO: Repayment structure tooltip"
        value="Bullet"
      />
      <Stat
        label="Est. repayment start date"
        tooltip="TODO: Start date tooltip"
        value={formatDate(termStartTime * 1000, "MMM d, y")}
      />
      <Stat
        label="Est. loan maturity date"
        tooltip="TODO: Loan maturity tooltip"
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
