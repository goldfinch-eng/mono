import BN from "bn.js"

import {GFIInstance, TestCommunityRewardsInstance} from "../typechain/truffle"

export async function mintAndLoadRewards(
  gfi: GFIInstance,
  communityRewards: TestCommunityRewardsInstance,
  owner: string,
  amount: BN
): Promise<void> {
  await gfi.mint(owner, amount)
  await gfi.approve(communityRewards.address, amount)
  await communityRewards.loadRewards(amount)
}

export async function expectStateAfterGetReward(
  gfi: GFIInstance,
  communityRewards: TestCommunityRewardsInstance,
  account: string,
  tokenId: BN,
  grantAmount: BN,
  expectedTotalClaimed: BN,
  expectedGFIBalance: BN
): Promise<void> {
  const grantState = await communityRewards.getGrant(tokenId)
  expect(grantState.totalGranted).to.bignumber.equal(grantAmount)
  expect(grantState.totalClaimed).to.bignumber.equal(expectedTotalClaimed)

  const gfiBalance = await gfi.balanceOf(account)
  expect(gfiBalance).to.bignumber.equal(expectedGFIBalance)

  const claimable = await communityRewards.getClaimable(tokenId)
  expect(claimable).to.bignumber.equal(new BN(0))
}
