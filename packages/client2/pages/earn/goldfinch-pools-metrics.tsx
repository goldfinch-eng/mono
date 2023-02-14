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

  return (
    <StatGrid
      bgColor="mustard-50"
      borderColor="sand-300"
      className={className}
      size="lg"
    >
      <Stat
        label="Active Loans"
        tooltip="Total principal outstanding across all loans in the Goldfinch Protocol."
        value={formatForMetrics(activeLoans)}
      />
      <Stat
        label="Average Default Rate"
        tooltip="Average default rate across all loans in the Goldfinch Protocol."
        value={formatPercent(defaultRate)}
      />
      <Stat
        label="Total Loans Repaid"
        tooltip="Total amount of principal and interest repaid across all loans in the Goldfinch Protocol."
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
      <Stat label="Active Loans" />
      <Stat label="Average Default Rate" />
      <Stat label="Total Loans Repaid" />
    </StatGrid>
  );
}
