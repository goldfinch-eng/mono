import { gql } from "@apollo/client";
import clsx from "clsx";
import { BigNumber, FixedNumber } from "ethers/lib/ethers";
import millify from "millify";

import { InfoIconTooltip, ShimmerLines } from "@/components/design-system";
import {
  cryptoToFloat,
  formatCrypto,
  formatPercent,
  roundDownToPrecision,
} from "@/lib/format";
import { ProtocolMetricsFieldsFragment } from "@/lib/graphql/generated";

export const TRANCHED_POOL_ROSTERS_METRICS_FIELDS = gql`
  fragment protocolMetricsFields on Protocol {
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
  protocol: ProtocolMetricsFieldsFragment;
}

// Expresses metric abbreviated in millions "M", rounded down to the nearest 100,000th
const formatForMetrics = (amount: BigNumber) => {
  const rounded = roundDownToPrecision(amount, BigNumber.from(100000 * 1e6));

  // Format as normal when less than 100,000 - a metric this low would only occur in dev env
  if (rounded.eq(0)) {
    return formatCrypto({ amount: amount, token: "USDC" });
  }

  const float = cryptoToFloat({ amount: rounded, token: "USDC" });
  // TODO: ',' or '.' for metrics amount seperator?
  return `$ ${millify(float, { precision: 2, decimalSeparator: "," })}`;
};

export function GoldfinchPoolsMetrics({
  className,
  protocol,
}: GoldfinchPoolsMetricsProps) {
  const {
    totalDrawdowns,
    totalPrincipalCollected,
    totalWritedowns,
    totalInterestCollected,
    totalReserveCollected,
  } = protocol;

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

  // TODO: Pending tooltip content from Jake
  const poolsMetricsSummaryData = [
    {
      title: "Active Loans",
      tooltipContent: "[TODO] Active Loans tooltip",
      value: formatForMetrics(activeLoans),
    },
    {
      title: "Average Default Rate",
      tooltipContent: "[TODO] Average Default Rate tooltip",
      value: formatPercent(averageDefaultRate),
    },
    {
      title: "Total loans repaid",
      tooltipContent: "[TODO] Total loans repaid tooltip",
      value: formatForMetrics(totalLoansRepaid),
    },
  ];

  return (
    <div
      className={clsx(
        "grid grid-cols-1 divide-x-0 divide-y divide-sand-300 rounded-xl border border-sand-300 sm:grid-cols-3 sm:divide-x sm:divide-y-0",
        className
      )}
    >
      {poolsMetricsSummaryData.map((item, i) => (
        <div key={i} className="flex flex-col justify-between px-10 py-6">
          <div className="mb-3 flex items-center justify-center sm:justify-start">
            <div className="mr-1 text-sm">{item.title}</div>
            <InfoIconTooltip content={item.tooltipContent} size="sm" />
          </div>
          <div className="flex justify-center text-3xl sm:justify-start">
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export function GoldfinchPoolsMetricsPlaceholder({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "grid grid-cols-1 divide-x-0 divide-y divide-sand-300 rounded-b-xl border-b border-sand-300 sm:grid-cols-3 sm:divide-x sm:divide-y-0",
        className
      )}
    >
      {[0, 1, 2].map((item) => (
        <div key={item} className="px-10 py-6">
          <div className="mb-3 flex items-center justify-center sm:justify-start">
            <ShimmerLines lines={1} className="w-full" />
          </div>
          <div className="flex justify-center text-3xl sm:justify-start">
            <ShimmerLines lines={1} className="w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
