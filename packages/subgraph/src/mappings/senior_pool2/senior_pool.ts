import {Address} from "@graphprotocol/graph-ts"
import {DepositMade, InterestCollected, SeniorPool} from "../../../generated/SeniorPool/SeniorPool"
import {STAKING_REWARDS_ADDRESS} from "../../address-manifest"
import {createTransactionFromEvent, usdcWithFiduPrecision} from "../../entities/helpers"
import {getOrInitUser} from "../../entities/user"

import {getOrInitSeniorPool} from "./helpers"

export function handleDepositMade(event: DepositMade): void {
  getOrInitUser(event.params.capitalProvider)

  const stakingRewardsAddress = Address.fromString(STAKING_REWARDS_ADDRESS)

  // Purposefully ignore deposits from StakingRewards contract because those will get captured as DepositAndStake events instead
  if (!event.params.capitalProvider.equals(stakingRewardsAddress)) {
    const transaction = createTransactionFromEvent(event, "SENIOR_POOL_DEPOSIT", event.params.capitalProvider)

    transaction.sentAmount = event.params.amount
    transaction.sentToken = "USDC"
    transaction.receivedAmount = event.params.shares
    transaction.receivedToken = "FIDU"

    // usdc / fidu
    transaction.fiduPrice = usdcWithFiduPrecision(event.params.amount).div(event.params.shares)

    transaction.save()
  }
}

export function handleInterestCollected(event: InterestCollected): void {
  const seniorPool = getOrInitSeniorPool()
  const seniorPoolContract = SeniorPool.bind(event.address)
  seniorPool.sharePrice = seniorPoolContract.sharePrice()
  seniorPool.save()
}
