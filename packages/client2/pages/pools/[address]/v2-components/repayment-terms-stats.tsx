import { formatDistanceStrict, format as formatDate } from "date-fns";
import { gql } from "graphql-request";
import { ReactNode } from "react";

import { Shimmer, Stat, StatGrid } from "@/components/design-system";
import { RepaymentTermsStatsFieldsFragment } from "@/lib/graphql/generated";

export const REPAYMENT_TERMS_STATS_FIELDS = gql`
  fragment RepaymentTermsStatsFields on Loan {
    fundableAt
    termInDays
    paymentPeriodInDays
    termStartTime
    termEndTime
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
  const showLoadingState = !loan;

  const stats: { label: string; value: ReactNode; tooltip: string }[] = [
    {
      label: "Loan term",
      value: showLoadingState ? (
        <Shimmer />
      ) : (
        formatDistanceStrict(0, loan.termInDays * 86400 * 1000, {
          unit: "month",
          roundingMethod: "ceil",
        })
      ),
      tooltip: "TODO: Loan term tooltip",
    },
    {
      label: "Payment frequency",
      value: showLoadingState ? (
        <Shimmer />
      ) : (
        `${loan.paymentPeriodInDays.toString()} days`
      ),
      tooltip: "TODO: Payment frequency tooltip",
    },
    {
      label: "Total payments",
      value: showLoadingState ? (
        <Shimmer />
      ) : (
        Math.ceil(loan.termInDays / loan.paymentPeriodInDays.toNumber())
      ),
      tooltip: "TODO: Total payments tooltip",
    },
    {
      label: "Repayment structure",
      // Eventually we'll have more loan types than just 'Bullet'
      value: showLoadingState ? <Shimmer /> : "Bullet",
      tooltip: "TODO: Repayment structure tooltip",
    },
    {
      label: "Est. repayment start date",
      value: showLoadingState ? (
        <Shimmer />
      ) : (
        formatDate(
          !loan.termStartTime.isZero()
            ? loan.termStartTime.toNumber() * 1000
            : (loan.fundableAt + 86400 * 14) * 1000,
          "MMM d, y"
        )
      ),
      tooltip: "TODO: Est. repayment start date tooltip",
    },
    {
      label: "Est. loan maturity date",
      value: showLoadingState ? (
        <Shimmer />
      ) : (
        formatDate(loan.termEndTime.toNumber() * 1000, "MMM d, y")
      ),
      tooltip: "TODO: Est. loan maturity date tooltip",
    },
  ];

  return (
    <StatGrid className={className} borderColor="sand-300">
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
