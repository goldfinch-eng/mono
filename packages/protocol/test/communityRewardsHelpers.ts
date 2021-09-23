import BN from "bn.js"
import {AssertionError, isPlainObject} from "../../utils/src"

import {GFIInstance, CommunityRewardsInstance} from "../typechain/truffle"

export async function mintAndLoadRewards(
  gfi: GFIInstance,
  communityRewards: CommunityRewardsInstance,
  owner: string,
  amount: BN
): Promise<void> {
  await gfi.mint(owner, amount)
  await gfi.approve(communityRewards.address, amount)
  await communityRewards.loadRewards(amount)
}

export async function expectStateAfterGetReward(
  gfi: GFIInstance,
  communityRewards: CommunityRewardsInstance,
  account: string,
  tokenId: BN,
  grantAmount: BN,
  expectedTotalClaimed: BN,
  expectedGFIBalance: BN
): Promise<void> {
  const grantState = await communityRewards.grants(tokenId)
  assertCommunityRewardsVestingRewards(grantState)
  expect(grantState.totalGranted).to.bignumber.equal(grantAmount)
  expect(grantState.totalClaimed).to.bignumber.equal(expectedTotalClaimed)

  const gfiBalance = await gfi.balanceOf(account)
  expect(gfiBalance).to.bignumber.equal(expectedGFIBalance)

  const claimable = await communityRewards.claimableRewards(tokenId)
  expect(claimable).to.bignumber.equal(new BN(0))
}

// HACK: Typechain fails to generate a human-readable type definition for the CommunityRewardsVesting.Rewards
// library struct, so we use a custom type definition plus assertion function, to tell the TS compiler
// about that struct.
type CommunityRewardsVestingRewards = {
  totalGranted: BN
  totalClaimed: BN
  startTime: BN
  endTime: BN
  cliffLength: BN
  vestingInterval: BN
  revokedAt: BN
}
export const isCommunityRewardsVestingRewards = (obj: unknown): obj is CommunityRewardsVestingRewards => {
  return (
    isPlainObject(obj) &&
    Object.keys(obj).length === 7 &&
    BN.isBN(obj.totalGranted) &&
    BN.isBN(obj.totalClaimed) &&
    BN.isBN(obj.startTime) &&
    BN.isBN(obj.endTime) &&
    BN.isBN(obj.cliffLength) &&
    BN.isBN(obj.vestingInterval) &&
    BN.isBN(obj.revokedAt)
  )
}
export const assertCommunityRewardsVestingRewards: (obj: unknown) => asserts obj is CommunityRewardsVestingRewards = (
  obj: unknown
): asserts obj is CommunityRewardsVestingRewards => {
  if (!isCommunityRewardsVestingRewards(obj)) {
    throw new AssertionError("Value is not a CommunityRewardsVesting.Rewards struct.")
  }
}
