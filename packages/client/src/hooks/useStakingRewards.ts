import {useContext} from "react"
import {AppContext} from "../App"
import {StakingRewards, StakingRewardsLoaded} from "../ethereum/pool"
import {assertWithLoadedInfo} from "../types/loadable"
import {useAsync, useStaleWhileRevalidating} from "./useAsync"

export function useStakingRewards(): StakingRewardsLoaded | undefined {
  const {goldfinchProtocol, user, currentBlock} = useContext(AppContext)

  const stakingRewardsResult = useAsync<StakingRewardsLoaded>(() => {
    if (!user.address || !goldfinchProtocol || !currentBlock) {
      return
    }

    const rewards = new StakingRewards(goldfinchProtocol)
    return rewards.initialize(user.address, currentBlock).then((): StakingRewardsLoaded => {
      assertWithLoadedInfo(rewards)
      return rewards
    })
  }, [goldfinchProtocol, user.address, currentBlock])

  const stakingRewards = useStaleWhileRevalidating(stakingRewardsResult)

  return stakingRewards
}
