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
