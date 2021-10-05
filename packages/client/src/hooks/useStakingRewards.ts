import {useContext} from "react"
import {AppContext} from "../App"
import {GoldfinchProtocol} from "../ethereum/GoldfinchProtocol"
import {StakingRewards} from "../ethereum/pool"
import {useAsync, useStaleWhileRevalidating} from "./useAsync"

export function useStakingRewards(): StakingRewards | undefined {
  const {goldfinchProtocol, user} = useContext(AppContext)
  let stakingRewardsResult = useAsync<StakingRewards>(() => {
    if (!user.loaded) {
      return
    }

    let rewards = new StakingRewards(goldfinchProtocol as GoldfinchProtocol)
    return rewards.initialize(user.address).then(() => rewards)
  }, [goldfinchProtocol, user])

  const rewards = useStaleWhileRevalidating(stakingRewardsResult)

  return rewards
}
