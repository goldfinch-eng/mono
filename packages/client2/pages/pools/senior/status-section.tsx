import { gql } from "@apollo/client";

import { Stat, StatGrid } from "@/components/design-system";
import { formatCrypto, formatPercent } from "@/lib/format";
import { SeniorPoolStatusFieldsFragment } from "@/lib/graphql/generated";

export const SENIOR_POOL_STATUS_FIELDS = gql`
  fragment SeniorPoolStatusFields on SeniorPool {
    assets
    totalLoansOutstanding
    defaultRate
  }
`;

interface StatusSectionProps {
  /**
   * If this prop is left undefined, the component will render a loading state.
   */
  seniorPool?: SeniorPoolStatusFieldsFragment;
  className?: string;
}

export function StatusSection({ seniorPool, className }: StatusSectionProps) {
  return (
    <StatGrid className={className}>
      <Stat
        label="Total Pool Balance"
        value={
          seniorPool
            ? formatCrypto({
                token: "USDC",
                amount: seniorPool.assets,
              })
            : null
        }
        tooltip="The total value of USDC currently invested in the Senior Pool."
      />
      <Stat
        label="Loans Outstanding"
        value={
          seniorPool
            ? formatCrypto({
                token: "USDC",
                amount: seniorPool.totalLoansOutstanding,
              })
            : null
        }
        tooltip="The total value of Senior Pool capital currently deployed in active Borrower Pools across the protocol."
      />
      <Stat
        label="Default Rate"
        value={seniorPool ? formatPercent(seniorPool.defaultRate) : null}
        tooltip="The total default rate across all Borrower Pools on the Goldfinch protocol, calculated as the current total writedown value divided by the total loan value."
      />
    </StatGrid>
  );
}
