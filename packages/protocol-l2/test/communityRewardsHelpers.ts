import BN from "bn.js"
import _ from "lodash"
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
  expectedAccountGFIBalance: BN,
  expectedContractGFIBalance: BN
): Promise<void> {
  const grantState = await communityRewards.grants(tokenId)
  assertCommunityRewardsVestingRewards(grantState)
  expect(grantState.totalGranted).to.bignumber.equal(grantAmount)
  expect(grantState.totalClaimed).to.bignumber.equal(expectedTotalClaimed)

  const accountGfiBalance = await gfi.balanceOf(account)
  expect(accountGfiBalance).to.bignumber.equal(expectedAccountGFIBalance)

  const contractGfiBalance = await gfi.balanceOf(communityRewards.address)
  expect(contractGfiBalance).to.bignumber.equal(expectedContractGFIBalance)

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
  const plain = _.toPlainObject(obj)
  return (
    isPlainObject(plain) &&
    Object.keys(plain).length === 14 &&
    BN.isBN(plain["0"]) &&
    BN.isBN(plain["1"]) &&
    BN.isBN(plain["2"]) &&
    BN.isBN(plain["3"]) &&
    BN.isBN(plain["4"]) &&
    BN.isBN(plain["5"]) &&
    BN.isBN(plain["6"]) &&
    BN.isBN(plain.totalGranted) &&
    BN.isBN(plain.totalClaimed) &&
    BN.isBN(plain.startTime) &&
    BN.isBN(plain.endTime) &&
    BN.isBN(plain.cliffLength) &&
    BN.isBN(plain.vestingInterval) &&
    BN.isBN(plain.revokedAt)
  )
}
export const assertCommunityRewardsVestingRewards: (obj: unknown) => asserts obj is CommunityRewardsVestingRewards = (
  obj: unknown
): asserts obj is CommunityRewardsVestingRewards => {
  if (!isCommunityRewardsVestingRewards(obj)) {
    throw new AssertionError("Value is not a CommunityRewardsVesting.Rewards struct.")
  }
}
