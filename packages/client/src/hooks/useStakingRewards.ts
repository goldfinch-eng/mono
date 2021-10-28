import {useContext} from "react"
import {AppContext} from "../App"
import {StakingRewards, StakingRewardsLoaded} from "../ethereum/pool"
import {assertWithLoadedInfo} from "../types/loadable"
import {useAsync, useStaleWhileRevalidating} from "./useAsync"

export function useStakingRewards(): StakingRewardsLoaded | undefined {
  const {goldfinchProtocol, user} = useContext(AppContext)

  const stakingRewardsResult = useAsync<StakingRewardsLoaded>(() => {
    if (!user.loaded || !goldfinchProtocol) {
      return
    }

    const rewards = new StakingRewards(goldfinchProtocol)
    return rewards.initialize(user.address).then((): StakingRewardsLoaded => {
      assertWithLoadedInfo(rewards)
      return rewards
    })
  }, [goldfinchProtocol, user])

  const stakingRewards = useStaleWhileRevalidating(stakingRewardsResult)

  return stakingRewards
}
