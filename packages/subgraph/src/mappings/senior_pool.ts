import {Address, BigInt} from "@graphprotocol/graph-ts"
import {
  SeniorPool,
  DepositMade,
  InterestCollected,
  InvestmentMadeInJunior,
  InvestmentMadeInSenior,
  PrincipalCollected,
  PrincipalWrittenDown,
  ReserveFundsCollected,
  WithdrawalMade,
} from "../../generated/SeniorPool/SeniorPool"
import {GoldfinchConfig} from "../../generated/SeniorPool/GoldfinchConfig"
import {CONFIG_KEYS_ADDRESSES} from "../constants"
import {createTransactionFromEvent} from "../entities/helpers"
import {updatePoolInvestments, updatePoolStatus} from "../entities/senior_pool"
import {handleDeposit} from "../entities/user"

// Helper function to extract the StakingRewards address from the config on Senior Pool
function getStakingRewardsAddressFromSeniorPoolAddress(seniorPoolAddress: Address): Address {
  const seniorPoolContract = SeniorPool.bind(seniorPoolAddress)
  const configContract = GoldfinchConfig.bind(seniorPoolContract.config())
  const stakingRewardsAddress = configContract.getAddress(BigInt.fromI32(CONFIG_KEYS_ADDRESSES.StakingRewards))
  return stakingRewardsAddress
}

export function handleDepositMade(event: DepositMade): void {
  updatePoolStatus(event.address)
  handleDeposit(event)

  const stakingRewardsAddress = getStakingRewardsAddressFromSeniorPoolAddress(event.address)

  // Purposefully ignore deposits from StakingRewards contract because those will get captured as DepositAndStake events instead
  if (!event.params.capitalProvider.equals(stakingRewardsAddress)) {
    const transaction = createTransactionFromEvent(event, "SENIOR_POOL_DEPOSIT", event.params.capitalProvider)
    transaction.amount = event.params.amount
    transaction.amountToken = "USDC"
    transaction.save()
  }
}

export function handleInterestCollected(event: InterestCollected): void {
  updatePoolStatus(event.address)
}

export function handleInvestmentMadeInJunior(event: InvestmentMadeInJunior): void {
  updatePoolStatus(event.address)
  updatePoolInvestments(event.address, event.params.tranchedPool)
}

export function handleInvestmentMadeInSenior(event: InvestmentMadeInSenior): void {
  updatePoolStatus(event.address)
  updatePoolInvestments(event.address, event.params.tranchedPool)
}

export function handlePrincipalCollected(event: PrincipalCollected): void {
  updatePoolStatus(event.address)
}

export function handlePrincipalWrittenDown(event: PrincipalWrittenDown): void {
  updatePoolStatus(event.address)
}

export function handleReserveFundsCollected(event: ReserveFundsCollected): void {
  updatePoolStatus(event.address)
}

export function handleWithdrawalMade(event: WithdrawalMade): void {
  updatePoolStatus(event.address)

  const stakingRewardsAddress = getStakingRewardsAddressFromSeniorPoolAddress(event.address)

  // Purposefully ignore withdrawals made by StakingRewards contract because those will be captured as UnstakeAndWithdraw
  if (!event.params.capitalProvider.equals(stakingRewardsAddress)) {
    const transaction = createTransactionFromEvent(event, "SENIOR_POOL_WITHDRAWAL", event.params.capitalProvider)
    transaction.amount = event.params.userAmount
    transaction.amountToken = "USDC"
    transaction.save()
  }
}
