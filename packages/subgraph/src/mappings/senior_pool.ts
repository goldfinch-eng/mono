import {Address} from "@graphprotocol/graph-ts"
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
import {CONFIG_KEYS_ADDRESSES, FIDU_DECIMALS, USDC_DECIMALS} from "../constants"
import {createTransactionFromEvent} from "../entities/helpers"
import {updatePoolInvestments, updatePoolStatus} from "../entities/senior_pool"
import {handleDeposit} from "../entities/user"
import {getAddressFromConfig} from "../utils"

// Helper function to extract the StakingRewards address from the config on Senior Pool
function getStakingRewardsAddressFromSeniorPoolAddress(seniorPoolAddress: Address): Address {
  const seniorPoolContract = SeniorPool.bind(seniorPoolAddress)
  return getAddressFromConfig(seniorPoolContract, CONFIG_KEYS_ADDRESSES.StakingRewards)
}

export function handleDepositMade(event: DepositMade): void {
  updatePoolStatus(event.address)
  handleDeposit(event)

  const stakingRewardsAddress = getStakingRewardsAddressFromSeniorPoolAddress(event.address)

  // Purposefully ignore deposits from StakingRewards contract because those will get captured as DepositAndStake events instead
  if (!event.params.capitalProvider.equals(stakingRewardsAddress)) {
    const transaction = createTransactionFromEvent(event, "SENIOR_POOL_DEPOSIT", event.params.capitalProvider)

    transaction.sentAmount = event.params.amount
    transaction.sentToken = "USDC"
    transaction.receivedAmount = event.params.shares
    transaction.receivedToken = "FIDU"

    // usdc / fidu
    transaction.fiduPrice = event.params.amount
      .times(FIDU_DECIMALS)
      .div(USDC_DECIMALS)
      .times(FIDU_DECIMALS)
      .div(event.params.shares)

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

    const seniorPoolContract = SeniorPool.bind(event.address)
    const sharePrice = seniorPoolContract.sharePrice()

    transaction.sentAmount = event.params.userAmount
      .plus(event.params.reserveAmount)
      .times(FIDU_DECIMALS)
      .div(USDC_DECIMALS)
      .times(FIDU_DECIMALS)
      .div(sharePrice)
    transaction.sentToken = "FIDU"
    transaction.receivedAmount = event.params.userAmount
    transaction.receivedToken = "USDC"
    transaction.fiduPrice = sharePrice

    transaction.save()
  }
}
