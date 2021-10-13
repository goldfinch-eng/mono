import BigNumber from "bignumber.js"
import {useContext, useEffect, useState} from "react"
import {AppContext} from "../App"
import {MerkleDistributor} from "../ethereum/communityRewards"
import {GFI} from "../ethereum/gfi"
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

export function useMerkleDistributor(): MerkleDistributor | undefined {
  const {goldfinchProtocol, user} = useContext(AppContext)

  const merkleDistributorResult = useAsync<MerkleDistributor>(() => {
    if (!user.loaded || !goldfinchProtocol) {
      return
    }

    const merkleDistributor = new MerkleDistributor(goldfinchProtocol)
    return merkleDistributor.initialize(user.address).then(() => merkleDistributor)
  }, [goldfinchProtocol, user])

  const merkleDistributor = useStaleWhileRevalidating(merkleDistributorResult)

  return merkleDistributor
}

export function useRewards() {
  const stakingRewards = useStakingRewards()
  const merkleDistributor = useMerkleDistributor()

  if (!stakingRewards || !merkleDistributor) {
    return {}
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
      gfi.initialize()
      const balance = await gfi.contract.methods.balanceOf(user.address).call()
      setGfiBalance(new BigNumber(balance))
    }

    getGFIBalance(goldfinchProtocol)
  }, [goldfinchProtocol, user, user.address])

  return gfiBalance
}
