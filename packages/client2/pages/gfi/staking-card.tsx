import { gql, useApolloClient } from "@apollo/client";
import { format } from "date-fns";
import { BigNumber } from "ethers";
import { useForm } from "react-hook-form";

import { Button, Form } from "@/components/design-system";
import { useContract } from "@/lib/contracts";
import { formatCrypto } from "@/lib/format";
import {
  StakedPositionType,
  StakingCardPositionFieldsFragment,
  SupportedCrypto,
} from "@/lib/graphql/generated";
import { toastTransaction } from "@/lib/toast";
import { assertUnreachable } from "@/lib/utils";

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
}

export function StakingCard({ position }: StakingCardProps) {
  const stakedToken =
    position.positionType === StakedPositionType.Fidu
      ? SupportedCrypto.Fidu
      : position.positionType === StakedPositionType.CurveLp
      ? SupportedCrypto.CurveLp
      : assertUnreachable(position.positionType);
  const unlocked = position.claimable.add(position.totalRewardsClaimed);
  const locked = position.granted.sub(unlocked);
  const formattedDate = format(
    position.startTime.mul(1000).toNumber(),
    "MMM d, y"
  );

  const stakingRewardsContract = useContract("StakingRewards");
  const apolloClient = useApolloClient();

  const rhfMethods = useForm();
  const handleClaim = async () => {
    if (!stakingRewardsContract) {
      return;
    }
    const transaction = stakingRewardsContract.getReward(position.id);
    await toastTransaction({ transaction });
    await apolloClient.refetchQueries({ include: "active" });
  };

  return (
    <RewardCardScaffold
      heading={`Staked ${formatCrypto(
        { token: stakedToken, amount: position.initialAmount },
        { includeToken: true }
      )}`}
      subheading={`${formatCrypto(
        { token: SupportedCrypto.Gfi, amount: position.granted },
        { includeToken: true }
      )} to date - ${formattedDate}`}
      fadedAmount={formatCrypto({ token: SupportedCrypto.Gfi, amount: locked })}
      boldedAmount={formatCrypto(
        { token: SupportedCrypto.Gfi, amount: position.claimable },
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
                token: SupportedCrypto.Gfi,
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
