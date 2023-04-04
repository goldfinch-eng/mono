import { gql, useApolloClient } from "@apollo/client";
import { format } from "date-fns";
import { BigNumber } from "ethers";
import { useForm } from "react-hook-form";

import { Button, Form } from "@/components/design-system";
import { getContract } from "@/lib/contracts";
import { formatCrypto } from "@/lib/format";
import { StakingCardPositionFieldsFragment } from "@/lib/graphql/generated";
import { toastTransaction } from "@/lib/toast";
import { assertUnreachable } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";

import {
  displayClaimedStatus,
  displayUnlockedProgress,
  displayUnlockSchedule,
} from "./grant-card";
import { Detail, RewardCardScaffold } from "./reward-card-scaffold";

const secondsPerWeek = BigNumber.from(604800);

export const STAKING_CARD_STAKED_POSITION_FIELDS = gql`
  fragment StakingCardPositionFields on SeniorPoolStakedPosition {
    id
    initialAmount
    amount
    totalRewardsClaimed
    positionType
    rewardEarnRate @client
    claimable @client
    granted @client
    startTime
    endTime @client
  }
`;

interface StakingCardProps {
  position: StakingCardPositionFieldsFragment;
  vaultedCapitalPositionId?: string;
}

export function StakingCard({
  position,
  vaultedCapitalPositionId,
}: StakingCardProps) {
  const vaulted = !!vaultedCapitalPositionId;
  const stakedToken =
    position.positionType === "Fidu"
      ? "FIDU"
      : position.positionType === "CurveLP"
      ? "CURVE_LP"
      : assertUnreachable(position.positionType);
  const unlocked = position.claimable.add(position.totalRewardsClaimed);
  const locked = position.granted.sub(unlocked);
  const formattedDate = format(
    position.startTime.mul(1000).toNumber(),
    "MMM d, y"
  );

  const { signer } = useWallet();
  const apolloClient = useApolloClient();

  const rhfMethods = useForm();
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
      const stakingRewardsContract = await getContract({
        name: "StakingRewards",
        signer,
      });
      const transaction = stakingRewardsContract.getReward(position.id);
      await toastTransaction({ transaction });
    }

    await apolloClient.refetchQueries({ include: "active" });
  };

  return (
    <RewardCardScaffold
      heading={`Staked ${formatCrypto(
        { token: stakedToken, amount: position.initialAmount },
        { includeToken: true }
      )}`}
      subheading={`${formatCrypto(
        { token: "GFI", amount: position.granted },
        { includeToken: true }
      )} to date - ${formattedDate}`}
      fadedAmount={formatCrypto({ token: "GFI", amount: locked })}
      boldedAmount={formatCrypto(
        { token: "GFI", amount: position.claimable },
        { includeToken: true }
      )}
      action={
        <Form rhfMethods={rhfMethods} onSubmit={handleClaim}>
          <Button
            size="lg"
            type="submit"
            disabled={position.claimable.isZero()}
          >
            {!position.claimable.isZero() ? "Claim GFI" : "Still Locked"}
          </Button>
        </Form>
      }
      expandedDetails={
        <>
          <Detail
            heading="Transaction details"
            body={`Staked ${formatCrypto(
              { token: stakedToken, amount: position.initialAmount },
              { includeToken: true }
            )} on ${formattedDate} (${formatCrypto(
              { token: stakedToken, amount: position.amount },
              { includeToken: true }
            )} remaining)`}
          />
          <Detail
            heading="Current earn rate"
            body={`+${formatCrypto(
              {
                token: "GFI",
                amount: position.rewardEarnRate.mul(secondsPerWeek),
              },
              { includeToken: true }
            )} granted per week`}
          />
          <Detail
            heading="Unlock schedule"
            body={
              position.endTime.isZero()
                ? "Immediate"
                : displayUnlockSchedule(BigNumber.from(0), position.endTime)
            }
          />
          <Detail
            heading="Unlock status"
            body={displayUnlockedProgress(position.granted, unlocked)}
          />
          <Detail
            heading="Claim status"
            body={displayClaimedStatus(position.totalRewardsClaimed, unlocked)}
          />
        </>
      }
    />
  );
}
