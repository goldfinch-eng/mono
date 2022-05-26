import { gql } from "@apollo/client";

import { Heading } from "@/components/design-system";
import { formatUsdcAsDollars } from "@/lib/format";
import { SeniorPoolStatusFieldsFragment } from "@/lib/graphql/generated";

export const SENIOR_POOL_STATUS_FIELDS = gql`
  fragment SeniorPoolStatusFields on SeniorPool {
    latestPoolStatus {
      id
      totalPoolAssetsUsdc
    }
  }
`;

interface StatusSectionProps {
  seniorPool?: SeniorPoolStatusFieldsFragment;
}

export function StatusSection({ seniorPool }: StatusSectionProps) {
  return (
    <div className="rounded bg-sand-100 p-6">
      <Heading level={2} className="mb-4">
        Pool Status
      </Heading>
      <div className="flex flex-wrap">
        <div>
          <div className="text-2xl">
            {seniorPool
              ? formatUsdcAsDollars(
                  seniorPool.latestPoolStatus.totalPoolAssetsUsdc
                )
              : "-.--"}
          </div>
          <div className="text-lg text-purple-200">Total pool balance</div>
        </div>
      </div>
    </div>
  );
}
