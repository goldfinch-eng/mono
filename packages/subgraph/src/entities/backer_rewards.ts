import {Address} from "@graphprotocol/graph-ts"

import {BackerRewards} from "../../generated/schema"
import {BackerRewards_Implementation as BackerRewardsContract} from "../../generated/templates/BackerRewards/BackerRewards_Implementation"
import {GFI_DECIMALS} from "../constants"

const BACKER_REWARDS_ID = "1"

export function getBackerRewards(): BackerRewards {
  let backerRewards = BackerRewards.load(BACKER_REWARDS_ID)
  if (!backerRewards) {
    backerRewards = new BackerRewards(BACKER_REWARDS_ID)
  }
  return backerRewards
}

export function updateBackerRewardsData(contractAddress: Address): void {
  const contract = BackerRewardsContract.bind(contractAddress)
  const backerRewards = getBackerRewards()
  backerRewards.contractAddress = contractAddress.toHexString()
  backerRewards.totalRewards = contract.totalRewards()
  backerRewards.totalRewardPercentOfTotalGFI = contract
    .totalRewardPercentOfTotalGFI()
    .divDecimal(GFI_DECIMALS.toBigDecimal())
  backerRewards.maxInterestDollarsEligible = contract.maxInterestDollarsEligible()
  backerRewards.save()
}
