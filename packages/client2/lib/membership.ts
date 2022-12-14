import type { JsonRpcProvider } from "@ethersproject/providers";
import { BigNumber, BigNumberish } from "ethers";

import { getContract } from "./contracts";

export const MEMBERSHIP_EPOCH_MS = 604800000;

export function getEpochNumber(timestampMs: number) {
  return Math.floor(timestampMs / MEMBERSHIP_EPOCH_MS);
}

export function epochFinalizedDate(
  currentTimestampMs: number,
  /**
   * 1 = "when the current epoch will finalize"
   */
  epochsFromNow = 1
): Date {
  return new Date(
    (getEpochNumber(currentTimestampMs) + epochsFromNow) * MEMBERSHIP_EPOCH_MS
  );
}

export async function calculateNewMonthlyMembershipReward(
  account: string,
  provider: JsonRpcProvider,
  newGfi: BigNumberish,
  newCapital: BigNumberish,
  previousEpochRewardTotal = BigNumber.from("12500000000000000000000")
): Promise<{
  newMonthlyReward: CryptoAmount<"FIDU">;
  diff: CryptoAmount<"FIDU">;
}> {
  const membershipOrchestratorContract = await getContract({
    name: "MembershipOrchestrator",
    provider,
  });
  const [, oldMembershipScore] =
    await membershipOrchestratorContract.memberScoreOf(account);
  const newMembershipScore =
    await membershipOrchestratorContract.estimateMemberScore(
      account,
      newGfi,
      newCapital
    );
  const membershipScoreDiff = newMembershipScore.sub(oldMembershipScore);
  const [, totalMemberScore] =
    await membershipOrchestratorContract.totalMemberScores();
  const newTotalMemberScore = totalMemberScore.add(membershipScoreDiff);
  const oldMonthlyReward =
    oldMembershipScore.isZero() || totalMemberScore.isZero()
      ? BigNumber.from(0)
      : oldMembershipScore
          .mul(previousEpochRewardTotal)
          .div(totalMemberScore)
          .mul("4");
  const newMonthlyReward = newMembershipScore
    .mul(previousEpochRewardTotal)
    .div(newTotalMemberScore.isZero() ? BigNumber.from(1) : newTotalMemberScore)
    .mul("4");

  return {
    newMonthlyReward: {
      token: "FIDU",
      amount: newMonthlyReward,
    },
    diff: {
      token: "FIDU",
      amount: newMonthlyReward.sub(oldMonthlyReward),
    },
  };
}

export async function estimateForfeiture(
  account: string,
  provider: JsonRpcProvider,
  newGfi: BigNumberish,
  newCapital: BigNumberish
) {
  const membershipOrchestratorContract = await getContract({
    name: "MembershipOrchestrator",
    provider,
  });
  const { timestamp } = await provider.getBlock("latest");
  const epoch = getEpochNumber(timestamp * 1000);
  const epochRewardsThusFar =
    await membershipOrchestratorContract.estimateRewardsFor(epoch);

  const [, oldMemberScore] = await membershipOrchestratorContract.memberScoreOf(
    account
  );
  const newMemberScore =
    await membershipOrchestratorContract.estimateMemberScore(
      account,
      newGfi,
      newCapital
    );
  const memberScoreDiff = newMemberScore.sub(oldMemberScore);
  const [, oldTotalMemberScore] =
    await membershipOrchestratorContract.totalMemberScores();
  const newTotalMemberScore = oldTotalMemberScore.add(memberScoreDiff);

  const oldExpectedReward = oldTotalMemberScore.isZero()
    ? BigNumber.from(0)
    : epochRewardsThusFar.mul(oldMemberScore).div(oldTotalMemberScore);
  const newExpectedReward = newTotalMemberScore.isZero()
    ? BigNumber.from(0)
    : epochRewardsThusFar.mul(newMemberScore).div(newTotalMemberScore);

  return newExpectedReward.sub(oldExpectedReward).abs();
}
