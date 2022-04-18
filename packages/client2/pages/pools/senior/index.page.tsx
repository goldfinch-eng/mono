import { gql } from "@apollo/client";

import { Heading } from "@/components/design-system";
import { useSeniorPoolPageQuery } from "@/lib/graphql/generated";
import { useWallet } from "@/lib/wallet";

import {
  PortfolioSection,
  SENIOR_POOL_PORTFOLIO_USER_FIELDS,
  SENIOR_POOL_PORTFOLIO_POOL_FIELDS,
} from "./portfolio-section";
import { StatusSection, SENIOR_POOL_STATUS_FIELDS } from "./status-section";

gql`
  ${SENIOR_POOL_PORTFOLIO_USER_FIELDS}
  ${SENIOR_POOL_PORTFOLIO_POOL_FIELDS}

  ${SENIOR_POOL_STATUS_FIELDS}
  query SeniorPoolPage($userId: ID!) {
    user(id: $userId) {
      id
      ...SeniorPoolPortfolioUserFields
    }
    seniorPools(first: 1) {
      id
      ...SeniorPoolPortfolioPoolFields
      ...SeniorPoolStatusFields
    }
  }
`;

export default function SeniorPoolPage() {
  const { account } = useWallet();
  const { data } = useSeniorPoolPageQuery({
    variables: { userId: account?.toLowerCase() ?? "" },
  });

  const seniorPool = data?.seniorPools[0];

  return (
    <div className="space-y-6">
      <Heading level={1}>Senior Pool</Heading>
      <PortfolioSection user={data?.user} seniorPool={seniorPool} />
      <StatusSection seniorPool={seniorPool} />
    </div>
  );
}
