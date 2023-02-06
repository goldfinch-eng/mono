import { gql } from "@apollo/client";
import clsx from "clsx";
import { FixedNumber } from "ethers/lib/ethers";

import { InfoIconTooltip } from "@/components/design-system";
import { formatCrypto, formatPercent } from "@/lib/format";
import { TranchedPoolRostersMetricsFieldsFragment } from "@/lib/graphql/generated";

export const TRANCHED_POOL_ROSTERS_METRICS_FIELDS = gql`
  fragment tranchedPoolRostersMetricsFields on TranchedPoolRoster {
    id
    totalDrawdowns
    totalWritedowns
    totalReserveCollected
    totalInterestCollected
    totalPrincipalCollected
  }
`;

interface GoldfinchPoolsMetricsProps {
  className?: string;
  tranchedPoolRoster: TranchedPoolRostersMetricsFieldsFragment;
}

export function GoldfinchPoolsMetrics({
  className,
  tranchedPoolRoster,
}: GoldfinchPoolsMetricsProps) {
  const {
    totalDrawdowns,
    totalPrincipalCollected,
    totalWritedowns,
    totalInterestCollected,
    totalReserveCollected,
  } = tranchedPoolRoster;

  const activeLoans = totalDrawdowns
    .sub(totalPrincipalCollected)
    .sub(totalWritedowns);

  const totalLoansRepaid = totalPrincipalCollected
    .add(totalInterestCollected)
    .sub(totalReserveCollected);

  const averageDefaultRate =
    totalWritedowns.isZero() || totalDrawdowns.isZero()
      ? FixedNumber.from(0)
      : FixedNumber.from(totalWritedowns).divUnsafe(
          FixedNumber.from(totalDrawdowns)
        );

  const poolsMetricsSummaryData = [
    {
      title: "Active Loans",
      tooltipContent: "[TODO] Active Loans tooltip",
      value: formatCrypto({ amount: activeLoans, token: "USDC" }),
    },
    {
      title: "Average Default Rate",
      tooltipContent: "[TODO] Average Default Rate tooltip",
      value: formatPercent(averageDefaultRate),
    },
    {
      title: "Total loans repaid",
      tooltipContent: "[TODO] Total loans repaid tooltip",
      value: formatCrypto({ amount: totalLoansRepaid, token: "USDC" }),
    },
  ];

  return (
    <div
      className={clsx(
        "grid grid-cols-3 rounded-xl bg-sand-700 p-6 text-white",
        className
      )}
    >
      {poolsMetricsSummaryData.map((item, i) => (
        <div key={i}>
          <div className="mb-3.5 flex items-center">
            <div className="mr-1">{item.title}</div>
            <InfoIconTooltip content={item.tooltipContent} size="sm" />
          </div>
          <div className="text-2xl">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
