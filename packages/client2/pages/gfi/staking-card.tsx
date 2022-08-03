import { gql } from "@apollo/client";
import { BigNumber } from "ethers";

import { formatCrypto } from "@/lib/format";
import {
  StakingCardPositionFieldsFragment,
  SupportedCrypto,
} from "@/lib/graphql/generated";

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
    amount
    totalRewardsClaimed
    rewardEarnRate @client
    claimable @client
    granted @client
    endTime @client
  }
`;

interface StakingCardProps {
  position: StakingCardPositionFieldsFragment;
}

export function StakingCard({ position }: StakingCardProps) {
  const unlocked = position.claimable.add(position.totalRewardsClaimed);
  const locked = position.granted.sub(unlocked);

  return (
    <RewardCardScaffold
      heading={`Staked ${formatCrypto(
        { token: SupportedCrypto.Fidu, amount: position.amount },
        { includeToken: true }
      )}`}
      subheading={`${formatCrypto(
        { token: SupportedCrypto.Gfi, amount: position.granted },
        { includeToken: true }
      )} to date`}
      fadedAmount={formatCrypto({ token: SupportedCrypto.Gfi, amount: locked })}
      boldedAmount={formatCrypto(
        { token: SupportedCrypto.Gfi, amount: position.claimable },
        { includeToken: true }
      )}
      action={null}
      expandedDetails={
        <>
          <Detail
            heading="Transaction details"
            body={`Staked ${formatCrypto(
              { token: SupportedCrypto.Fidu, amount: position.amount },
              { includeToken: true }
            )} on X date`}
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
