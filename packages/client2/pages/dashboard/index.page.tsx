import { gql } from "@apollo/client";
import { BigNumber } from "ethers";

import { Heading } from "@/components/design-system";
import {
  SupportedCrypto,
  useDashboardPageQuery,
} from "@/lib/graphql/generated";
import { useWallet } from "@/lib/wallet";

import { ExpandableHoldings } from "./expandable-holdings";

gql`
  query DashboardPage($userId: String!) {
    viewer @client {
      fiduBalance {
        token
        amount
      }
    }
    tranchedPoolTokens(
      where: { user: $userId, principalAmount_gt: 0 }
      orderBy: mintedAt
      orderDirection: desc
    ) {
      id
      principalAmount
      tranchedPool {
        id
        name @client
      }
    }
  }
`;

export default function DashboardPage() {
  const { account } = useWallet();
  const { data, loading, error } = useDashboardPageQuery({
    variables: { userId: account?.toLowerCase() ?? "" },
  });

  return (
    <div>
      <Heading level={1} className="mb-12">
        Dashboard
      </Heading>
      {!account && !loading ? (
        <div className="text-lg font-medium text-clay-500">
          You must connect your wallet to view your dashboard
        </div>
      ) : error ? (
        <div className="text-clay-500">Error: {error.message}</div>
      ) : !data || loading ? (
        <div>Loading</div>
      ) : (
        <div>
          <Heading level={2} className="font-sans !text-3xl !font-normal">
            Portfolio summary
          </Heading>
          <Heading level={3} className="font-sans !text-xl">
            Holdings
          </Heading>
          <div>
            <ExpandableHoldings
              title="Tony"
              color="#ff0000"
              holdings={data.tranchedPoolTokens.map((token) => ({
                name: token.tranchedPool.name,
                percentage: 0,
                quantity: BigNumber.from(1),
                usdcValue: {
                  token: SupportedCrypto.Usdc,
                  amount: token.principalAmount,
                },
              }))}
              quantityFormatter={(n: BigNumber) =>
                `${n.toString()} NFT${n.gt(BigNumber.from(1)) ? "s" : ""}`
              }
            />
          </div>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
