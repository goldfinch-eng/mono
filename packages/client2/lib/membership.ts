import type { JsonRpcProvider } from "@ethersproject/providers";
import { BigNumber } from "ethers";

import { getContract } from "./contracts";
import { CryptoAmount, SupportedCrypto } from "./graphql/generated";

export const MEMBERSHIP_EPOCH_MS = 604800000;

export function epochFinalizedDate(
  currentTimestampMs: number,
  /**
   * 1 = "when the current epoch will finalize"
   */
  epochsFromNow = 1
): Date {
  return new Date(
    (Math.floor(currentTimestampMs / MEMBERSHIP_EPOCH_MS) + epochsFromNow) *
      MEMBERSHIP_EPOCH_MS
  );
}

export async function calculateNewMonthlyMembershipReward(
  account: string,
  provider: JsonRpcProvider,
  newGfi: BigNumber,
  newCapital: BigNumber,
  previousEpochRewardTotal = BigNumber.from("12500000000000000000000")
): Promise<{ newMonthlyReward: CryptoAmount; diff: CryptoAmount }> {
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
  const oldMonthlyReward =
    oldMembershipScore.isZero() || totalMemberScore.isZero()
      ? BigNumber.from(0)
      : oldMembershipScore
          .mul(previousEpochRewardTotal)
          .div(totalMemberScore)
          .mul("4");
  const newMonthlyReward = newMembershipScore
    .mul(previousEpochRewardTotal)
    .div(
      totalMemberScore.add(membershipScoreDiff).isZero()
        ? BigNumber.from(1)
        : totalMemberScore.add(membershipScoreDiff)
    )
    .mul("4");

  return {
    newMonthlyReward: {
      token: SupportedCrypto.Fidu,
      amount: newMonthlyReward,
    },
    diff: {
      token: SupportedCrypto.Fidu,
      amount: newMonthlyReward.sub(oldMonthlyReward),
    },
  };
}
