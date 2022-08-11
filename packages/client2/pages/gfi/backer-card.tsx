import { gql, useApolloClient } from "@apollo/client";
import { format } from "date-fns";
import { BigNumber } from "ethers";
import { useForm } from "react-hook-form";

import { Button, Form } from "@/components/design-system";
import { useContract } from "@/lib/contracts";
import { formatCrypto } from "@/lib/format";
import {
  BackerCardTokenFieldsFragment,
  SupportedCrypto,
} from "@/lib/graphql/generated";
import { toastTransaction } from "@/lib/toast";

import { RewardCardScaffold, Detail } from "./reward-card-scaffold";

export const BACKER_CARD_TOKEN_FIELDS = gql`
  fragment BackerCardTokenFields on TranchedPoolToken {
    id
    tranchedPool {
      id
      name @client
      creditLine {
        id
        isLate @client
      }
      isPaused
    }
    mintedAt
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
  const formattedDate = format(token.mintedAt.mul(1000).toNumber(), "MMM d, y");

  const rhfMethods = useForm();
  const apolloClient = useApolloClient();

  const backerRewardsContract = useContract("BackerRewards");

  const canClaim =
    !token.rewardsClaimable.add(token.stakingRewardsClaimable).isZero() &&
    !token.tranchedPool.creditLine.isLate &&
    !token.tranchedPool.isPaused;

  const handleClaim = async () => {
    if (!backerRewardsContract) {
      return;
    }
    const transaction = backerRewardsContract.withdraw(token.id);
    await toastTransaction({ transaction });
    await apolloClient.refetchQueries({ include: "active" });
  };

  return (
    <RewardCardScaffold
      heading={`Backer of ${token.tranchedPool.name}`}
      subheading={`${formatCrypto(
        { token: SupportedCrypto.Gfi, amount: totalAmount },
        { includeToken: true }
      )} - ${formattedDate}`}
      fadedAmount={formatCrypto({
        token: SupportedCrypto.Gfi,
        amount: BigNumber.from(0),
      })}
      boldedAmount={formatCrypto({
        token: SupportedCrypto.Gfi,
        amount: token.rewardsClaimable.add(token.stakingRewardsClaimable),
      })}
      action={
        <Form rhfMethods={rhfMethods} onSubmit={handleClaim}>
          <Button type="submit" size="lg" disabled={!canClaim}>
            {canClaim ? "Claim GFI" : "Still Locked"}
          </Button>
        </Form>
      }
      expandedDetails={
        <>
          <Detail
            heading="Transaction details"
            body={`Supplied ${formatCrypto({
              token: SupportedCrypto.Usdc,
              amount: token.principalAmount,
            })} on ${formattedDate}`}
          />
          <Detail heading="Unlock schedule" body="Immediate" />
          <Detail
            heading="Unlock status"
            body={`100% (${formatCrypto(
              {
                token: SupportedCrypto.Gfi,
                amount: token.rewardsClaimable.add(
                  token.stakingRewardsClaimable
                ),
              },
              { includeToken: true }
            )}) unlocked`}
          />
          <Detail
            heading="Claim status"
            body={`${formatCrypto(
              {
                token: SupportedCrypto.Gfi,
                amount: token.rewardsClaimed.add(token.stakingRewardsClaimed),
              },
              { includeToken: true }
            )} claimed of your total unlocked ${formatCrypto(
              { token: SupportedCrypto.Gfi, amount: totalAmount },
              { includeToken: true }
            )}`}
          />
        </>
      }
      warning={
        token.tranchedPool.creditLine.isLate
          ? "Claiming is disabled because a repayment is due"
          : token.tranchedPool.isPaused
          ? "Claiming is disabled because this pool is paused"
          : undefined
      }
    />
  );
}
