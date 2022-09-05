import { gql } from "@apollo/client";
import { BigNumber } from "ethers";

import { Heading } from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import {
  SupportedCrypto,
  useDashboardPageQuery,
} from "@/lib/graphql/generated";
import { sharesToUsdc } from "@/lib/pools";
import { useWallet } from "@/lib/wallet";

import { ExpandableHoldings } from "./expandable-holdings";

gql`
  query DashboardPage($userId: String!) {
    seniorPools {
      id
      latestPoolStatus {
        id
        sharePrice
      }
    }
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
    seniorPoolStakedPositions(
      where: { user: $userId, amount_gt: 0, positionType: Fidu }
      orderBy: startTime
      orderDirection: desc
    ) {
      id
      amount
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
          <Heading level={2} className="mb-9 !font-sans !text-3xl !font-normal">
            Portfolio summary
          </Heading>
          <Heading level={3} className="mb-6 !font-sans !text-xl">
            Holdings
          </Heading>
          <div className="space-y-3">
            {data.tranchedPoolTokens.length > 0 ? (
              <ExpandableHoldings
                title="Borrower Pool Positions"
                tooltip="Your investment in Goldfinch borrower pools. Each investment position is represented by an NFT."
                color="#ff0000"
                holdings={data.tranchedPoolTokens.map((token) => ({
                  name: token.tranchedPool.name,
                  percentage: 0,
                  quantity: BigNumber.from(1),
                  usdcValue: {
                    token: SupportedCrypto.Usdc,
                    amount: token.principalAmount,
                  },
                  url: `/pools/${token.tranchedPool.id}`,
                }))}
                quantityFormatter={(n: BigNumber) =>
                  `${n.toString()} NFT${n.gt(BigNumber.from(1)) ? "s" : ""}`
                }
              />
            ) : null}
            <ExpandableHoldings
              title="FIDU"
              tooltip="Your investment in the Goldfinch Senior Pool. This is represented by a token called FIDU."
              color="#00ff00"
              holdings={[
                ...data.seniorPoolStakedPositions.map((stakedPosition) => ({
                  name: "Senior Pool Staked Position",
                  percentage: 0,
                  quantity: stakedPosition.amount,
                  usdcValue: sharesToUsdc(
                    stakedPosition.amount,
                    data.seniorPools[0].latestPoolStatus.sharePrice
                  ),
                })),
              ]}
              quantityFormatter={(n: BigNumber) =>
                formatCrypto(
                  { amount: n, token: SupportedCrypto.Fidu },
                  { includeToken: true }
                )
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
