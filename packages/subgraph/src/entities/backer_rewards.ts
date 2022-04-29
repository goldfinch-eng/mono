import {Address, BigDecimal} from "@graphprotocol/graph-ts"

import {BackerRewardsData} from "../../generated/schema"
import {BackerRewards_Implementation as BackerRewardsContract} from "../../generated/templates/BackerRewards/BackerRewards_Implementation"
import {GFI_DECIMALS} from "../constants"

const BACKER_REWARDS_ID = "1"

export function getBackerRewards(): BackerRewardsData {
  let backerRewards = BackerRewardsData.load(BACKER_REWARDS_ID)
  if (!backerRewards) {
    backerRewards = new BackerRewardsData(BACKER_REWARDS_ID)
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
    .toBigDecimal()
    .div(GFI_DECIMALS.toBigDecimal())
    .div(BigDecimal.fromString("100"))
  // Note that this is actually measured in GFI, not dollars
  backerRewards.maxInterestDollarsEligible = contract.maxInterestDollarsEligible()
  backerRewards.save()
}
