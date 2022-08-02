import { gql } from "@apollo/client";
import { BigNumber } from "ethers";

import { formatCrypto } from "@/lib/format";
import {
  BackerCardTokenFieldsFragment,
  SupportedCrypto,
} from "@/lib/graphql/generated";

import { RewardCardScaffold, Detail } from "./reward-card-scaffold";

export const BACKER_CARD_TOKEN_FIELDS = gql`
  fragment BackerCardTokenFields on TranchedPoolToken {
    id
    tranchedPool {
      id
      name @client
    }
    rewardsClaimable
    rewardsClaimed
    stakingRewardsClaimable
    stakingRewardsClaimed
    principalAmount
  }
`;

interface BackerCardProps {
  token: BackerCardTokenFieldsFragment;
}

export function BackerCard({ token }: BackerCardProps) {
  const totalAmount = token.rewardsClaimable
    .add(token.rewardsClaimed)
    .add(token.stakingRewardsClaimable)
    .add(token.stakingRewardsClaimed);

  return (
    <RewardCardScaffold
      heading={`Backer of ${token.tranchedPool.name}`}
      subheading={formatCrypto(
        { token: SupportedCrypto.Gfi, amount: totalAmount },
        { includeToken: true }
      )}
      fadedAmount={formatCrypto({
        token: SupportedCrypto.Gfi,
        amount: BigNumber.from(0),
      })}
      boldedAmount={formatCrypto({
        token: SupportedCrypto.Gfi,
        amount: token.rewardsClaimable.add(token.stakingRewardsClaimable),
      })}
      action={null}
      expandedDetails={
        <>
          <Detail
            heading="Transaction details"
            body={`Supplied ${formatCrypto({
              token: SupportedCrypto.Usdc,
              amount: token.principalAmount,
            })}`}
          />
        </>
      }
    />
  );
}
