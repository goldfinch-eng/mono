import { gql, useApolloClient } from "@apollo/client";
import { format } from "date-fns";
import { BigNumber } from "ethers";
import { useForm } from "react-hook-form";

import { Button, Form } from "@/components/design-system";
import { getContract } from "@/lib/contracts";
import { formatCrypto } from "@/lib/format";
import { BackerCardTokenFieldsFragment } from "@/lib/graphql/generated";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";

import { RewardCardScaffold, Detail } from "./reward-card-scaffold";

export const BACKER_CARD_TOKEN_FIELDS = gql`
  fragment BackerCardTokenFields on PoolToken {
    id
    loan {
      id
      name @client
      delinquency @client
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
  vaultedCapitalPositionId?: string;
}

export function BackerCard({
  token,
  vaultedCapitalPositionId,
}: BackerCardProps) {
  const vaulted = !!vaultedCapitalPositionId;
  const { signer } = useWallet();
  const totalAmount = token.rewardsClaimable
    .add(token.rewardsClaimed)
    .add(token.stakingRewardsClaimable)
    .add(token.stakingRewardsClaimed);
  const formattedDate = format(token.mintedAt.mul(1000).toNumber(), "MMM d, y");

  const rhfMethods = useForm();
  const apolloClient = useApolloClient();

  const canClaim =
    !token.rewardsClaimable.add(token.stakingRewardsClaimable).isZero() &&
    token.loan.delinquency === "CURRENT" &&
    !token.loan.isPaused;

  const handleClaim = async () => {
    if (!signer) {
      return;
    }
    if (vaulted) {
      const membershipOrchestratorContract = await getContract({
        name: "MembershipOrchestrator",
        signer,
      });
      const transaction = membershipOrchestratorContract.harvest([
        vaultedCapitalPositionId,
      ]);
      await toastTransaction({ transaction });
    } else {
      const backerRewardsContract = await getContract({
        name: "BackerRewards",
        signer,
      });
      const transaction = backerRewardsContract.withdraw(token.id);
      await toastTransaction({ transaction });
    }

    await apolloClient.refetchQueries({ include: "active" });
  };

  return (
    <RewardCardScaffold
      heading={`Backer of ${token.loan.name}`}
      subheading={`${formatCrypto(
        { token: "GFI", amount: totalAmount },
        { includeToken: true }
      )} - ${formattedDate}`}
      fadedAmount={formatCrypto({
        token: "GFI",
        amount: BigNumber.from(0),
      })}
      boldedAmount={formatCrypto({
        token: "GFI",
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
              token: "USDC",
              amount: token.principalAmount,
            })} on ${formattedDate}`}
          />
          <Detail heading="Unlock schedule" body="Immediate" />
          <Detail
            heading="Unlock status"
            body={`100% (${formatCrypto(
              {
                token: "GFI",
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
                token: "GFI",
                amount: token.rewardsClaimed.add(token.stakingRewardsClaimed),
              },
              { includeToken: true }
            )} claimed of your total unlocked ${formatCrypto(
              { token: "GFI", amount: totalAmount },
              { includeToken: true }
            )}`}
          />
        </>
      }
      warning={
        !(token.loan.delinquency === "CURRENT")
          ? "Claiming is disabled because a repayment is due"
          : token.loan.isPaused
          ? "Claiming is disabled because this pool is paused"
          : undefined
      }
      noticeText={
        vaulted
          ? "Since this position is in the vault, claiming rewards will result in you receiving both GFI rewards and USDC earned from interest and principal."
          : undefined
      }
    />
  );
}
