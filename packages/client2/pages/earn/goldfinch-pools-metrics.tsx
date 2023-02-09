import { gql } from "@apollo/client";
import { BigNumber, FixedNumber } from "ethers/lib/ethers";
import millify from "millify";

import { Stat, StatGrid } from "@/components/design-system";
import { cryptoToFloat, formatPercent } from "@/lib/format";
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

// Expresses metric abbreviated in millions "M"
const formatForMetrics = (amount: BigNumber) => {
  const float = cryptoToFloat({ amount, token: "USDC" });
  return `$${millify(float, { precision: 2 })}`;
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
  return (
    <StatGrid
      bgColor="mustard-50"
      borderColor="sand-300"
      className={className}
      size="lg"
    >
      <Stat
        label="Active Loans"
        tooltip="[TODO] Active Loans tooltip"
        value={formatForMetrics(activeLoans)}
      />
      <Stat
        label="Average Default Rate"
        tooltip="[TODO] Average Default Rate tooltip"
        value={formatPercent(averageDefaultRate)}
      />
      <Stat
        label="Total Loans Repaid"
        tooltip="[TODO] Total loans repaid tooltip"
        value={formatForMetrics(totalLoansRepaid)}
      />
    </StatGrid>
  );
}

export function GoldfinchPoolsMetricsPlaceholder({
  className,
}: {
  className?: string;
}) {
  return (
    <StatGrid
      bgColor="mustard-50"
      borderColor="sand-300"
      className={className}
      size="lg"
    >
      <Stat label="Active Loans" tooltip="[TODO] Active Loans tooltip" />
      <Stat
        label="Average Default Rate"
        tooltip="[TODO] Average Default Rate tooltip"
      />
      <Stat
        label="Total Loans Repaid"
        tooltip="[TODO] Total loans repaid tooltip"
      />
    </StatGrid>
  );
}
