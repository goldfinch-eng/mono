import {MerkleDistributorGrantInfo} from "@goldfinch-eng/protocol/blockchain_scripts/merkleDistributor/types"
import BigNumber from "bignumber.js"
import {useContext, useEffect, useState} from "react"
import {AppContext} from "../App"
import {CommunityRewardsVesting, MerkleDistributor} from "../ethereum/communityRewards"
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

function isGrantAccepted(acceptedGrants: CommunityRewardsVesting[], grant: MerkleDistributorGrantInfo) {
  return acceptedGrants.every(
    (acceptedGrant) =>
      grant.account === acceptedGrant.user &&
      new BigNumber(grant.grant.amount) === acceptedGrant.totalGranted &&
      new BigNumber(grant.grant.cliffLength) === acceptedGrant.cliffLength &&
      new BigNumber(grant.grant.vestingInterval) === acceptedGrant.vestingInterval &&
      Number(grant.grant.vestingLength) === Number(acceptedGrant.endTime) - Number(acceptedGrant.startTime)
  )
}

export function useRewards() {
  const {user} = useContext(AppContext)
  const stakingRewards = useStakingRewards()
  const merkleDistributor = useMerkleDistributor()

  if (!stakingRewards || !merkleDistributor) {
    return {}
  }

  const airdrops = merkleDistributor.getGrantsInfo(user.address)
  const acceptedGrants = merkleDistributor.communityRewards.grants
  const actionRequiredGrants = acceptedGrants
    ? airdrops.map((grantInfo) => !isGrantAccepted(acceptedGrants, grantInfo))
    : airdrops
  return {actionRequiredGrants, stakingRewards, merkleDistributor}
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
