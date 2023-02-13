import { gql } from "@apollo/client";
import { BigNumber } from "ethers/lib/ethers";

import { Stat, StatGrid } from "@/components/design-system";
import { cryptoToFloat, formatPercent } from "@/lib/format";
import { ProtocolMetricsFieldsFragment } from "@/lib/graphql/generated";

export const PROTOCOL_METRICS_FIELDS = gql`
  fragment ProtocolMetricsFields on Protocol {
    id
    totalDrawdowns
    totalWritedowns
    defaultRate
    totalReserveCollected
    totalInterestCollected
    totalPrincipalCollected
  }
`;

interface GoldfinchPoolsMetricsProps {
  className?: string;
  protocol: ProtocolMetricsFieldsFragment;
}

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  notation: "compact",
  style: "currency",
  currency: "USD",
});
// Expresses metric abbreviated in millions "M"
const formatForMetrics = (amount: BigNumber) => {
  const float = cryptoToFloat({ amount, token: "USDC" });
  return numberFormatter.format(float);
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
    defaultRate,
  } = protocol;

  const activeLoans = totalDrawdowns
    .sub(totalPrincipalCollected)
    .sub(totalWritedowns);

  const totalLoansRepaid = totalPrincipalCollected
    .add(totalInterestCollected)
    .sub(totalReserveCollected);

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
        value={formatPercent(defaultRate)}
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
