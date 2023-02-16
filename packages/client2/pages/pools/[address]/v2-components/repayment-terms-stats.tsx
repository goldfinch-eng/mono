import { format as formatDate } from "date-fns";
import { gql } from "graphql-request";

import { Shimmer, Stat, StatGrid } from "@/components/design-system";
import { RepaymentTermsStatsFieldsFragment } from "@/lib/graphql/generated";

export const REPAYMENT_TERMS_STATS_FIELDS = gql`
  fragment RepaymentTermsStatsFields on TranchedPool {
    id
    creditLine {
      id
      termInDays
      paymentPeriodInDays
      termStartTime
      termEndTime
    }
  }
`;

interface RepaymentTermsStatsProps {
  loan?: RepaymentTermsStatsFieldsFragment | null;
  className?: string;
}

export function RepaymentTermsStats({
  loan,
  className,
}: RepaymentTermsStatsProps) {
  const loading = !loan?.creditLine;

  return (
    <StatGrid className={className}>
      <Stat
        className="bg-mustard-50"
        label="Loan term"
        value={
          loading ? (
            <Shimmer />
          ) : (
            `${Math.floor(loan.creditLine.termInDays.toNumber() / 30)} months`
          )
        }
        tooltip="TODO: Loan term tooltip"
      />
      <Stat
        className="bg-mustard-50"
        label="Payment frequency"
        value={
          loading ? (
            <Shimmer />
          ) : (
            `${loan.creditLine.paymentPeriodInDays.toString()} days`
          )
        }
        tooltip="TODO: Payment frequency tooltip"
      />
      <Stat
        className="bg-mustard-50"
        label="Total payments"
        value={loading ? <Shimmer /> : "36"}
        tooltip="TODO: Total payments tooltip"
      />
      <Stat
        className="bg-mustard-50"
        label="Repayment structure"
        value={loading ? <Shimmer /> : "Bullet"}
        tooltip="TODO: Repayment structure tooltip"
      />
      <Stat
        className="bg-mustard-50"
        label="Est. repayment start date"
        value={
          loading ? (
            <Shimmer />
          ) : (
            formatDate(
              loan.creditLine.termStartTime.toNumber() * 1000,
              "MMM d, y"
            )
          )
        }
        tooltip="TODO: Est. repayment start date tooltip"
      />
      <Stat
        className="bg-mustard-50"
        label="Est. loan maturity date"
        value={
          loading ? (
            <Shimmer />
          ) : (
            formatDate(
              loan.creditLine.termEndTime.toNumber() * 1000,
              "MMM d, y"
            )
          )
        }
        tooltip="TODO: Est. loan maturity date tooltip"
      />
    </StatGrid>
  );
}
