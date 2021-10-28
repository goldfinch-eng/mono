import {MerkleDistributorLoaded} from "../ethereum/communityRewards"
import {StakingRewardsLoaded} from "../ethereum/pool"
import {useMerkleDistributor} from "./useMerkleDistributor"
import {useStakingRewards} from "./useStakingRewards"

export function useRewards():
  | {
      stakingRewards: StakingRewardsLoaded
      merkleDistributor: MerkleDistributorLoaded
    }
  | undefined {
  const stakingRewards = useStakingRewards()
  const merkleDistributor = useMerkleDistributor()

  if (!stakingRewards || !merkleDistributor) {
    return
  }
  return {stakingRewards, merkleDistributor}
}
