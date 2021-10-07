import {useContext} from "react"
import {AppContext} from "../App"
import {StakingRewards} from "../ethereum/pool"
import {useAsync, useStaleWhileRevalidating} from "./useAsync"

export function useStakingRewards(): StakingRewards | undefined {
  const {goldfinchProtocol, user} = useContext(AppContext)

  const stakingRewardsResult = useAsync<StakingRewards>(() => {
    if (!user.loaded || !goldfinchProtocol) {
      return
    }

    const rewards = new StakingRewards(goldfinchProtocol)
    return rewards.initialize(user.address).then(() => rewards)
  }, [goldfinchProtocol, user])

  const stakingRewards = useStaleWhileRevalidating(stakingRewardsResult)

  return stakingRewards
}
