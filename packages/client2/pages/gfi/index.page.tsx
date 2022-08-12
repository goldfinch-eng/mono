import { gql } from "@apollo/client";
import { BigNumber } from "ethers";
import { useMemo } from "react";

import { Heading, Shimmer, Stat, StatGrid } from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import { SupportedCrypto, useGfiPageQuery } from "@/lib/graphql/generated";
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
    }
    communityRewardsTokens(where: { user: $userId }) {
      ...GrantCardTokenFields
    }
    tranchedPoolTokens(
      where: { user: $userId }
      orderBy: mintedAt
      orderDirection: asc
    ) {
      ...BackerCardTokenFields
    }
    seniorPoolStakedPositions(
      where: { user: $userId }
      orderBy: startTime
      orderDirection: asc
    ) {
      ...StakingCardPositionFields
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

  const grantsWithTokens = useMemo(() => {
    if (data?.viewer.gfiGrants && data?.communityRewardsTokens) {
      const gfiGrants = data.viewer.gfiGrants;
      const communityRewardsTokens = data.communityRewardsTokens;
      const grantsWithTokens = [];
      for (const grant of gfiGrants) {
        const correspondingToken = communityRewardsTokens.find(
          (token) =>
            grant.__typename === "IndirectGfiGrant" &&
            token.source.toString() === grant.indirectSource.toString() &&
            token.index === grant.index
        );
        grantsWithTokens.push({
          grant: grant,
          token: correspondingToken,
          locked:
            grant.__typename === "DirectGfiGrant"
              ? BigNumber.from(0)
              : grant.amount.sub(grant.vested),
          claimable:
            grant.__typename === "DirectGfiGrant"
              ? grant.isAccepted
                ? BigNumber.from(0)
                : grant.amount
              : grant.vested.sub(correspondingToken?.totalClaimed ?? 0),
        });
      }
      return grantsWithTokens;
    }
  }, [data]);

  const grantsTotalClaimable =
    grantsWithTokens?.reduce(
      (prev, current) => prev.add(current.claimable),
      BigNumber.from(0)
    ) ?? BigNumber.from(0);
  const grantsTotalLocked =
    grantsWithTokens?.reduce(
      (prev, current) => prev.add(current.locked),
      BigNumber.from(0)
    ) ?? BigNumber.from(0);

  const backerTotalClaimable =
    data?.tranchedPoolTokens.reduce(
      (prev, current) =>
        prev.add(current.rewardsClaimable.add(current.stakingRewardsClaimable)),
      BigNumber.from(0)
    ) ?? BigNumber.from(0);
  const backerTotalLocked = BigNumber.from(0);

  const stakingTotalClaimable =
    data?.seniorPoolStakedPositions.reduce(
      (prev, current) => prev.add(current.claimable),
      BigNumber.from(0)
    ) ?? BigNumber.from(0);
  const stakingTotalLocked =
    data?.seniorPoolStakedPositions.reduce(
      (prev, current) =>
        prev.add(
          current.granted
            .sub(current.claimable)
            .sub(current.totalRewardsClaimed)
        ),
      BigNumber.from(0)
    ) ?? BigNumber.from(0);

  const totalClaimable = grantsTotalClaimable
    .add(backerTotalClaimable)
    .add(stakingTotalClaimable);
  const totalLocked = grantsTotalLocked
    .add(backerTotalLocked)
    .add(stakingTotalLocked);

  const userHasRewards =
    (data?.seniorPoolStakedPositions.length ?? 0) +
      (data?.tranchedPoolTokens.length ?? 0) +
      (grantsWithTokens?.length ?? 0) >
    0;

  return (
    <div>
      <Heading level={1} className="mb-12 text-7xl">
        GFI
      </Heading>
      {!account ? (
        <div>You must connect your wallet to view GFI rewards</div>
      ) : error ? (
        <div className="text-clay-500">{error.message}</div>
      ) : (
        <div>
          <StatGrid className="mb-15">
            <Stat
              label="Total GFI (Claimable + Locked)"
              value={
                loading ? (
                  <Shimmer />
                ) : (
                  formatCrypto(
                    {
                      token: SupportedCrypto.Gfi,
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
                loading ? (
                  <Shimmer />
                ) : (
                  formatCrypto(
                    { token: SupportedCrypto.Gfi, amount: totalClaimable },
                    { includeToken: true }
                  )
                )
              }
            />
            <Stat
              label="Locked GFI"
              value={
                loading ? (
                  <Shimmer />
                ) : (
                  formatCrypto(
                    { token: SupportedCrypto.Gfi, amount: totalLocked },
                    { includeToken: true }
                  )
                )
              }
            />
          </StatGrid>
          {loading ? (
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
                {data?.seniorPoolStakedPositions.map((position) => (
                  <StakingCard key={position.id} position={position} />
                ))}
                {data?.tranchedPoolTokens.map((token) => (
                  <BackerCard key={token.id} token={token} />
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
