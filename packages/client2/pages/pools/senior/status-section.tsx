import { gql } from "@apollo/client";

import { Stat } from "@/components/design-system";
import { formatCrypto, formatPercent } from "@/lib/format";
import {
  SeniorPoolStatusFieldsFragment,
  SupportedCrypto,
} from "@/lib/graphql/generated";

export const SENIOR_POOL_STATUS_FIELDS = gql`
  fragment SeniorPoolStatusFields on SeniorPool {
    latestPoolStatus {
      id
      totalPoolAssetsUsdc
      totalLoansOutstanding
    }
  }
`;

interface StatusSectionProps {
  seniorPool: SeniorPoolStatusFieldsFragment;
}

export function StatusSection({ seniorPool }: StatusSectionProps) {
  return (
    <div>
      <h2 className="mb-8 font-sans text-3xl">Pool Status</h2>
      <div className="flex flex-wrap gap-14">
        <Stat
          label="Total Pool Balance"
          value={formatCrypto(
            {
              token: SupportedCrypto.Usdc,
              amount: seniorPool.latestPoolStatus.totalPoolAssetsUsdc,
            },
            { includeSymbol: true }
          )}
          tooltip="The total value of USDC currently invested in the Senior Pool."
        />
        <Stat
          label="Loans Outstanding"
          value={formatCrypto(
            {
              token: SupportedCrypto.Usdc,
              amount: seniorPool.latestPoolStatus.totalLoansOutstanding,
            },
            { includeSymbol: true }
          )}
          tooltip="The total value of Senior Pool capital currently deployed in outstanding Borrower Pools across the protocol."
        />
        {/* TODO use the real default rate. Needs to be properly calculated on subgraph */}
        <Stat
          label="Default Rate"
          value={formatPercent(0)}
          tooltip="The total default rate across all Borrower Pools on the Goldfinch protocol."
        />
      </div>
    </div>
  );
}
