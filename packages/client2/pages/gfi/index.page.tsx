import { gql } from "@apollo/client";
import { useMemo } from "react";

import { Heading, Shimmer, Stat, StatGrid } from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import {
  stitchGrantsWithTokens,
  sumTotalClaimable,
  sumTotalLocked,
} from "@/lib/gfi-rewards";
import { useGfiPageQuery } from "@/lib/graphql/generated";
import { useWallet } from "@/lib/wallet";

import { BackerCard, BACKER_CARD_TOKEN_FIELDS } from "./backer-card";
import {
  GrantCard,
  GRANT_CARD_GRANT_FIELDS,
  GRANT_CARD_TOKEN_FIELDS,
} from "./grant-card";
import {
  STAKING_CARD_STAKED_POSITION_FIELDS,
  StakingCard,
} from "./staking-card";

gql`
  ${GRANT_CARD_GRANT_FIELDS}
  ${GRANT_CARD_TOKEN_FIELDS}
  ${BACKER_CARD_TOKEN_FIELDS}
  ${STAKING_CARD_STAKED_POSITION_FIELDS}

  query GfiPage($userId: String!) {
    viewer @client {
      gfiGrants {
        ...GrantCardGrantFields
      }

      # even if this isn't directly used on the UI on this page, it is helpful to have this refetched and recached along with the rest of the data on this page when apolloClient.refetch({include: "active"}) is run
      gfiBalance
    }
    communityRewardsTokens(where: { user: $userId }) {
      ...GrantCardTokenFields
    }
    poolTokens(
      where: { user: $userId }
      orderBy: mintedAt
      orderDirection: asc
    ) {
      ...BackerCardTokenFields
    }
    vaultedPoolTokens(where: { user: $userId }) {
      id
      poolToken {
        ...BackerCardTokenFields
      }
    }
    seniorPoolStakedPositions(
      where: { user: $userId }
      orderBy: startTime
      orderDirection: asc
    ) {
      ...StakingCardPositionFields
    }
    vaultedStakedPositions(where: { user: $userId }) {
      id
      seniorPoolStakedPosition {
        ...StakingCardPositionFields
      }
    }
  }
`;

export default function GfiPage() {
  const { account } = useWallet();
  const { data, error, loading } = useGfiPageQuery({
    variables: {
      userId: account ? account.toLowerCase() : "",
    },
    skip: !account,
  });
  const showLoadingState = loading || !data;

  const grantsWithTokens = useMemo(() => {
    if (data?.viewer.gfiGrants && data?.communityRewardsTokens) {
      const gfiGrants = data.viewer.gfiGrants;
      const communityRewardsTokens = data.communityRewardsTokens;
      return stitchGrantsWithTokens(gfiGrants, communityRewardsTokens);
    }
  }, [data]);

  const totalClaimable = sumTotalClaimable(
    grantsWithTokens,
    data?.poolTokens.concat(
      data?.vaultedPoolTokens.map((vpt) => vpt.poolToken)
    ),
    data?.seniorPoolStakedPositions.concat(
      data?.vaultedStakedPositions.map((vst) => vst.seniorPoolStakedPosition)
    )
  );
  const totalLocked = sumTotalLocked(
    grantsWithTokens,
    data?.seniorPoolStakedPositions.concat(
      data?.vaultedStakedPositions.map((vst) => vst.seniorPoolStakedPosition)
    )
  );

  const userHasRewards =
    (data?.seniorPoolStakedPositions.length ?? 0) +
      (data?.vaultedStakedPositions.length ?? 0) +
      (data?.poolTokens.length ?? 0) +
      (data?.vaultedPoolTokens.length ?? 0) +
      (grantsWithTokens?.length ?? 0) >
    0;

  return (
    <div>
      <Heading level={1} className="mb-12 text-7xl">
        GFI
      </Heading>
      {error ? (
        <div className="text-clay-500">{error.message}</div>
      ) : !account ? (
        <div>You must connect your wallet to view GFI rewards</div>
      ) : (
        <div>
          <StatGrid className="mb-15">
            <Stat
              label="Total GFI (Claimable + Locked)"
              value={
                showLoadingState ? (
                  <Shimmer />
                ) : (
                  formatCrypto(
                    {
                      token: "GFI",
                      amount: totalClaimable.add(totalLocked),
                    },
                    { includeToken: true }
                  )
                )
              }
            />
            <Stat
              label="Claimable GFI"
              value={
                showLoadingState ? (
                  <Shimmer />
                ) : (
                  formatCrypto(
                    { token: "GFI", amount: totalClaimable },
                    { includeToken: true }
                  )
                )
              }
            />
            <Stat
              label="Locked GFI"
              value={
                showLoadingState ? (
                  <Shimmer />
                ) : (
                  formatCrypto(
                    { token: "GFI", amount: totalLocked },
                    { includeToken: true }
                  )
                )
              }
            />
          </StatGrid>
          {showLoadingState ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((nonce) => (
                <Shimmer key={nonce} className="h-20" />
              ))}
            </div>
          ) : userHasRewards ? (
            <div>
              <div className="mb-3 hidden grid-cols-5 items-center px-6 text-sand-500 lg:grid">
                <div className="col-span-2">Type</div>
                <div className="justify-self-end">Locked GFI</div>
                <div className="justify-self-end">Claimable GFI</div>
              </div>
              <div className="space-y-3">
                {data.seniorPoolStakedPositions.map((position) => (
                  <StakingCard key={position.id} position={position} />
                ))}
                {data.vaultedStakedPositions.map((v) => (
                  <StakingCard
                    key={v.id}
                    position={v.seniorPoolStakedPosition}
                    vaultedCapitalPositionId={v.id}
                  />
                ))}
                {data.poolTokens.map((token) => (
                  <BackerCard key={token.id} token={token} />
                ))}
                {data.vaultedPoolTokens.map((v) => (
                  <BackerCard
                    key={v.id}
                    token={v.poolToken}
                    vaultedCapitalPositionId={v.id}
                  />
                ))}
                {grantsWithTokens?.map(
                  ({ grant, token, claimable, locked }, index) => (
                    <GrantCard
                      key={index}
                      grant={grant}
                      token={token}
                      claimable={claimable}
                      locked={locked}
                    />
                  )
                )}
              </div>
            </div>
          ) : (
            <div>
              You do not have any sources of GFI rewards. You can earn rewards
              by supplying to pools.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
