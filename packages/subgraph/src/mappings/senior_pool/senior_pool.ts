import {Address, BigInt} from "@graphprotocol/graph-ts"

import {
  SeniorPoolWithdrawalDisbursement,
  SeniorPoolWithdrawalDisbursementPostponement,
  SeniorPoolWithdrawalEpoch,
  SeniorPoolWithdrawalRequest,
} from "../../../generated/schema"
import {Fidu as FiduContract} from "../../../generated/SeniorPool/Fidu"
import {
  SeniorPool as SeniorPoolContract,
  DepositMade,
  InterestCollected,
  InvestmentMadeInSenior,
  PrincipalCollected,
  WithdrawalMade,
  InvestmentMadeInJunior,
  PrincipalWrittenDown,
  EpochEnded,
  EpochExtended,
  WithdrawalAddedTo,
  WithdrawalCanceled,
  WithdrawalRequested,
} from "../../../generated/SeniorPool/SeniorPool"
import {STAKING_REWARDS_ADDRESS} from "../../address-manifest"
import {CONFIG_KEYS_ADDRESSES, FIDU_DECIMALS, USDC_DECIMALS} from "../../constants"
import {createTransactionFromEvent, usdcWithFiduPrecision} from "../../entities/helpers"
import {updateTotalWriteDowns} from "../../entities/tranched_pool_roster"
import {getOrInitUser} from "../../entities/user"
import {getOrInitSeniorPoolWithdrawalRoster} from "../../entities/withdrawal_roster"
import {getAddressFromConfig} from "../../utils"
import {
  getOrInitSeniorPool,
  updateDefaultRate,
  updateEstimatedApyFromGfiRaw,
  updateEstimatedSeniorPoolApy,
} from "./helpers"

export function handleDepositMade(event: DepositMade): void {
  const seniorPool = getOrInitSeniorPool()
  const seniorPoolContract = SeniorPoolContract.bind(event.address)
  const fiduContract = FiduContract.bind(getAddressFromConfig(seniorPoolContract, CONFIG_KEYS_ADDRESSES.Fidu))

  seniorPool.totalShares = fiduContract.totalSupply()
  seniorPool.assets = seniorPoolContract.assets()

  updateEstimatedSeniorPoolApy(seniorPool)
  getOrInitUser(event.params.capitalProvider)

  seniorPool.save()

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
  const seniorPoolContract = SeniorPoolContract.bind(event.address)

  seniorPool.sharePrice = seniorPoolContract.sharePrice()

  updateEstimatedApyFromGfiRaw(seniorPool)

  seniorPool.save()
}

function handleInvestmentMadeInTranchedPool(
  seniorPoolAddress: Address,
  tranchedPoolAddress: Address,
  investedAmount: BigInt
): void {
  const seniorPool = getOrInitSeniorPool()
  const seniorPoolContract = SeniorPoolContract.bind(seniorPoolAddress)
  const tranchedPoolAddressString = tranchedPoolAddress.toHexString()

  seniorPool.totalLoansOutstanding = seniorPoolContract.totalLoansOutstanding()
  seniorPool.assets = seniorPoolContract.assets()

  if (!seniorPool.tranchedPools.includes(tranchedPoolAddressString)) {
    seniorPool.tranchedPools = seniorPool.tranchedPools.concat([tranchedPoolAddressString])
    seniorPool.totalInvested = seniorPool.totalInvested.plus(investedAmount)

    updateEstimatedSeniorPoolApy(seniorPool)
  }

  seniorPool.save()
}

// Handling this event seems confusing because InvestmentMadeInJunior is no longer emitted in our current codebase. But in the old pools (before tranched existed), the Senior Pool actually made junior investments.
// seniorPool.tranchedPools would not be complete if this event was not processed.
export function handleInvestmentMadeInJunior(event: InvestmentMadeInJunior): void {
  handleInvestmentMadeInTranchedPool(event.address, event.params.tranchedPool, event.params.amount)
}

export function handleInvestmentMadeInSenior(event: InvestmentMadeInSenior): void {
  handleInvestmentMadeInTranchedPool(event.address, event.params.tranchedPool, event.params.amount)
}

export function handlePrincipalCollected(event: PrincipalCollected): void {
  const seniorPool = getOrInitSeniorPool()
  const seniorPoolContract = SeniorPoolContract.bind(event.address)

  seniorPool.sharePrice = seniorPoolContract.sharePrice()
  seniorPool.totalLoansOutstanding = seniorPoolContract.totalLoansOutstanding()
  seniorPool.assets = seniorPoolContract.assets() // assets are updated when totalLoansOutstanding changes

  updateEstimatedApyFromGfiRaw(seniorPool)
  updateEstimatedSeniorPoolApy(seniorPool)

  seniorPool.save()
}

export function handlePrincipalWrittenDown(event: PrincipalWrittenDown): void {
  const seniorPool = getOrInitSeniorPool()
  const seniorPoolContract = SeniorPoolContract.bind(event.address)

  seniorPool.sharePrice = seniorPoolContract.sharePrice()
  seniorPool.assets = seniorPoolContract.assets()
  seniorPool.totalWrittenDown = seniorPool.totalWrittenDown.plus(event.params.amount)

  updateEstimatedApyFromGfiRaw(seniorPool)
  updateEstimatedSeniorPoolApy(seniorPool)
  updateDefaultRate(seniorPool)
  updateTotalWriteDowns(event.params.amount)

  seniorPool.save()
}

export function handleWithdrawalMade(event: WithdrawalMade): void {
  const seniorPool = getOrInitSeniorPool()
  const seniorPoolContract = SeniorPoolContract.bind(event.address)
  const fiduContract = FiduContract.bind(getAddressFromConfig(seniorPoolContract, CONFIG_KEYS_ADDRESSES.Fidu))

  seniorPool.assets = seniorPoolContract.assets()
  seniorPool.totalShares = fiduContract.totalSupply()

  updateEstimatedSeniorPoolApy(seniorPool)

  seniorPool.save()

  const stakingRewardsAddress = Address.fromString(STAKING_REWARDS_ADDRESS)

  // Purposefully ignore withdrawals made by StakingRewards contract because those will be captured as UnstakeAndWithdraw
  if (!event.params.capitalProvider.equals(stakingRewardsAddress)) {
    const transaction = createTransactionFromEvent(event, "SENIOR_POOL_WITHDRAWAL", event.params.capitalProvider)

    const seniorPoolContract = SeniorPoolContract.bind(event.address)
    const sharePrice = seniorPoolContract.sharePrice()

    updateEstimatedApyFromGfiRaw(seniorPool)

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

    const withdrawalRequest = SeniorPoolWithdrawalRequest.load(event.params.capitalProvider.toHexString())
    if (withdrawalRequest) {
      withdrawalRequest.usdcWithdrawable = BigInt.zero()
      withdrawalRequest.save()
    }
  }
}

export function handleWithdrawalRequest(event: WithdrawalRequested): void {
  const withdrawalRequest = new SeniorPoolWithdrawalRequest(event.params.operator.toHexString())

  withdrawalRequest.tokenId = event.params.tokenId
  withdrawalRequest.user = getOrInitUser(event.params.operator).id
  withdrawalRequest.usdcWithdrawable = BigInt.zero()
  withdrawalRequest.fiduRequested = event.params.fiduRequested
  withdrawalRequest.requestedAt = event.block.timestamp.toI32()

  withdrawalRequest.save()

  const roster = getOrInitSeniorPoolWithdrawalRoster()

  roster.requests = roster.requests.concat([withdrawalRequest.id])

  roster.save()

  const transaction = createTransactionFromEvent(event, "SENIOR_POOL_WITHDRAWAL_REQUEST", event.params.operator)

  transaction.sentAmount = event.params.fiduRequested
  transaction.sentToken = "FIDU"

  transaction.save()
}

export function handleAddToWithdrawalRequest(event: WithdrawalAddedTo): void {
  const withdrawalRequest = assert(SeniorPoolWithdrawalRequest.load(event.params.operator.toHexString()))

  withdrawalRequest.fiduRequested = withdrawalRequest.fiduRequested.plus(event.params.fiduRequested)
  withdrawalRequest.increasedAt = event.block.timestamp.toI32()

  withdrawalRequest.save()

  const transaction = createTransactionFromEvent(event, "SENIOR_POOL_ADD_TO_WITHDRAWAL_REQUEST", event.params.operator)

  transaction.sentAmount = event.params.fiduRequested
  transaction.sentToken = "FIDU"

  transaction.save()
}

export function handleWithdrawalRequestCanceled(event: WithdrawalCanceled): void {
  const withdrawalRequest = SeniorPoolWithdrawalRequest.load(event.params.operator.toHexString())

  if (withdrawalRequest) {
    withdrawalRequest.fiduRequested = BigInt.zero()
    withdrawalRequest.canceledAt = event.block.timestamp.toI32()

    withdrawalRequest.save()
  }

  const transaction = createTransactionFromEvent(event, "SENIOR_POOL_CANCEL_WITHDRAWAL_REQUEST", event.params.operator)

  transaction.receivedAmount = event.params.fiduCanceled
  transaction.receivedToken = "FIDU"

  transaction.save()
}

const fiduZeroingThreshold = BigInt.fromString("10").pow(12)

export function handleEpochEnded(event: EpochEnded): void {
  const epoch = new SeniorPoolWithdrawalEpoch(event.params.epochId.toString())

  epoch.epoch = event.params.epochId
  epoch.endsAt = event.params.endTime.toI32()
  epoch.fiduRequested = event.params.fiduRequested
  epoch.fiduLiquidated = event.params.fiduLiquidated
  epoch.usdcAllocated = event.params.usdcAllocated

  epoch.save()

  const transaction = createTransactionFromEvent(event, "SENIOR_POOL_DISTRIBUTION", event.address)

  transaction.sentAmount = epoch.usdcAllocated
  transaction.sentToken = "USDC"

  transaction.save()

  const roster = getOrInitSeniorPoolWithdrawalRoster()

  for (let i = 0; i < roster.requests.length; i++) {
    const withdrawalRequest = SeniorPoolWithdrawalRequest.load(roster.requests[i])
    if (!withdrawalRequest || withdrawalRequest.fiduRequested.isZero()) {
      continue
    }

    const proRataUsdc = epoch.usdcAllocated.times(withdrawalRequest.fiduRequested).div(epoch.fiduRequested)
    let fiduLiquidated = epoch.fiduLiquidated.times(withdrawalRequest.fiduRequested).div(epoch.fiduRequested)
    withdrawalRequest.usdcWithdrawable = withdrawalRequest.usdcWithdrawable.plus(proRataUsdc)
    const newFiduRequested = withdrawalRequest.fiduRequested.minus(fiduLiquidated)
    // Similar to the "zeroing out" logic on the smart contract, which zeroes out requests with fiduRequested too low
    if (newFiduRequested.le(fiduZeroingThreshold)) {
      fiduLiquidated = withdrawalRequest.fiduRequested
      withdrawalRequest.fiduRequested = BigInt.zero()
    } else {
      withdrawalRequest.fiduRequested = newFiduRequested
    }

    withdrawalRequest.save()

    const disbursement = new SeniorPoolWithdrawalDisbursement(`${epoch.id}-${withdrawalRequest.id}`)

    disbursement.user = withdrawalRequest.user
    disbursement.tokenId = withdrawalRequest.tokenId
    disbursement.epoch = event.params.epochId
    disbursement.allocatedAt = epoch.endsAt
    disbursement.usdcAllocated = proRataUsdc
    disbursement.fiduLiquidated = fiduLiquidated

    disbursement.save()
  }
}

export function handleEpochExtended(event: EpochExtended): void {
  const roster = getOrInitSeniorPoolWithdrawalRoster()

  for (let i = 0; i < roster.requests.length; i++) {
    const withdrawalRequest = SeniorPoolWithdrawalRequest.load(roster.requests[i])
    if (!withdrawalRequest || withdrawalRequest.fiduRequested.isZero()) {
      continue
    }

    const postponement = new SeniorPoolWithdrawalDisbursementPostponement(
      `${event.params.epochId}-${withdrawalRequest.id}-${event.params.newEndTime}`
    )

    postponement.user = withdrawalRequest.user
    postponement.tokenId = withdrawalRequest.tokenId
    postponement.extendedEpoch = event.params.epochId
    postponement.oldEndsAt = event.params.oldEndTime.toI32()
    postponement.newEndsAt = event.params.newEndTime.toI32()

    postponement.save()
  }
}
