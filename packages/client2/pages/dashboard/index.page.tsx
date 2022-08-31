import { gql } from "@apollo/client";

import { Heading } from "@/components/design-system";
import { useDashboardPageQuery } from "@/lib/graphql/generated";
import { useWallet } from "@/lib/wallet";

gql`
  query DashboardPage($userId: ID!) {
    user(id: $userId) {
      id
      seniorPoolStakedPositions {
        id
        amount
      }
      tranchedPoolTokens {
        id
      }
    }
    viewer @client {
      fiduBalance {
        token
        amount
      }
    }
  }
`;

export default function DashboardPage() {
  const { account } = useWallet();
  const { data, loading, error } = useDashboardPageQuery({
    variables: { userId: account?.toLowerCase() ?? "" },
    skip: !account,
  });

  return (
    <div>
      <Heading level={1}>Dashboard</Heading>
      {!account ? (
        <div>You must connect your wallet to view your dashboard</div>
      ) : error ? (
        <div className="text-clay-500">Error: {error.message}</div>
      ) : !data || loading ? (
        <div>Loading</div>
      ) : (
        <pre>{JSON.stringify(data, null, 2)}</pre>
      )}
    </div>
  );
}
