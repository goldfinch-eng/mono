import BigNumber from "bignumber.js"
import {useContext, useEffect, useState} from "react"
import {AppContext} from "../App"
import {MerkleDistributor, MerkleDistributorLoaded} from "../ethereum/communityRewards"
import {GFI} from "../ethereum/gfi"
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

export function useMerkleDistributor(): MerkleDistributorLoaded | undefined {
  const {goldfinchProtocol, user} = useContext(AppContext)

  const merkleDistributorResult = useAsync<MerkleDistributorLoaded>(() => {
    if (!user.loaded || !goldfinchProtocol) {
      return
    }

    const merkleDistributor = new MerkleDistributor(goldfinchProtocol)
    return merkleDistributor.initialize(user.address).then((): MerkleDistributorLoaded => {
      assertWithLoadedInfo(merkleDistributor)
      return merkleDistributor
    })
  }, [goldfinchProtocol, user])

  const merkleDistributor = useStaleWhileRevalidating(merkleDistributorResult)

  return merkleDistributor
}

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

export function useGFIBalance() {
  const {user, goldfinchProtocol} = useContext(AppContext)
  const [gfiBalance, setGfiBalance] = useState<BigNumber>()

  useEffect(() => {
    if (!goldfinchProtocol || !user || !user.address) return
    const getGFIBalance = async (goldfinchProtocol) => {
      const gfi = new GFI(goldfinchProtocol)
      await gfi.initialize()
      const balance = await gfi.contract.methods.balanceOf(user.address).call()
      setGfiBalance(new BigNumber(balance))
    }

    getGFIBalance(goldfinchProtocol)
  }, [goldfinchProtocol, user, user.address])

  return gfiBalance
}
