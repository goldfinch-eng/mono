import { gql } from "@apollo/client";
import { BigNumber } from "ethers";

import { formatCrypto } from "@/lib/format";
import {
  StakingCardPositionFieldsFragment,
  SupportedCrypto,
} from "@/lib/graphql/generated";

import { Detail, RewardCardScaffold } from "./reward-card-scaffold";

const secondsPerWeek = BigNumber.from(604800);

export const STAKING_CARD_STAKED_POSITION_FIELDS = gql`
  fragment StakingCardPositionFields on SeniorPoolStakedPosition {
    id
    amount
    rewardEarnRate
  }
`;

interface StakingCardProps {
  position: StakingCardPositionFieldsFragment;
}

export function StakingCard({ position }: StakingCardProps) {
  return (
    <RewardCardScaffold
      heading={`Staked ${formatCrypto(
        { token: SupportedCrypto.Fidu, amount: position.amount },
        { includeToken: true }
      )}`}
      subheading="X GFI to date"
      fadedAmount="X"
      boldedAmount="X"
      action={null}
      expandedDetails={
        <>
          <Detail
            heading="Current earn rate"
            body={`${formatCrypto(
              {
                token: SupportedCrypto.Gfi,
                amount: position.rewardEarnRate.mul(secondsPerWeek),
              },
              { includeToken: true }
            )} granted per week`}
          />
        </>
      }
    />
  );
}
