import { format as formatDate } from "date-fns";
import { gql } from "graphql-request";
import { ReactNode } from "react";

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

  const stats: { label: string; value: ReactNode; tooltip: string }[] = [
    {
      label: "Loan term",
      value: loading ? (
        <Shimmer />
      ) : (
        `${Math.floor(loan.creditLine.termInDays.toNumber() / 30)} months`
      ),
      tooltip: "TODO: Loan term tooltip",
    },
    {
      label: "Payment frequency",
      value: loading ? (
        <Shimmer />
      ) : (
        `${loan.creditLine.paymentPeriodInDays.toString()} days`
      ),
      tooltip: "TODO: Payment frequency tooltip",
    },
    {
      label: "Total payments",
      value: loading ? (
        <Shimmer />
      ) : (
        Math.ceil(
          loan.creditLine.termInDays.toNumber() /
            loan.creditLine.paymentPeriodInDays.toNumber()
        )
      ),
      tooltip: "TODO: Total payments tooltip",
    },
    {
      label: "Repayment structure",
      value: loading ? <Shimmer /> : "Bullet",
      tooltip: "TODO: Repayment structure tooltip",
    },
    {
      label: "Est. repayment start date",
      value: loading ? (
        <Shimmer />
      ) : (
        formatDate(loan.creditLine.termStartTime.toNumber() * 1000, "MMM d, y")
      ),
      tooltip: "TODO: Est. repayment start date tooltip",
    },
    {
      label: "Est. loan maturity date",
      value: loading ? (
        <Shimmer />
      ) : (
        formatDate(loan.creditLine.termEndTime.toNumber() * 1000, "MMM d, y")
      ),
      tooltip: "TODO: Est. loan maturity date tooltip",
    },
  ];

  return (
    <StatGrid className={className}>
      {stats.map(({ label, value, tooltip }, i) => (
        <Stat
          key={i}
          className="bg-mustard-50"
          label={label}
          value={value}
          tooltip={tooltip}
        />
      ))}
    </StatGrid>
  );
}
