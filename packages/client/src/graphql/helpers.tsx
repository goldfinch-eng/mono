import BigNumber from "bignumber.js"
import _ from "lodash"
import {fiduFromAtomic, FIDU_DECIMALS} from "../ethereum/fidu"
import {USDC_DECIMALS} from "../ethereum/utils"
import {SeniorPool as SeniorPoolGQL, SeniorPoolDeposit, User} from "./types"
import {roundDownPenny} from "../utils"
import {SeniorPool} from "../ethereum/pool"

export interface SeniorPoolData {
  id: string
  compoundBalance: BigNumber
  balance: BigNumber
  totalShares: BigNumber
  totalPoolAssets: BigNumber
  totalLoansOutstanding: BigNumber
  estimatedTotalInterest: BigNumber
  estimatedApy: BigNumber
  defaultRate: BigNumber
  rawBalance: BigNumber
  cumulativeDrawdowns: BigNumber
  cumulativeWritedowns: BigNumber
  remainingCapacity: (this: SeniorPoolData, maxCapacity: BigNumber) => BigNumber
}

export interface UserData {
  id: string
  goListed: boolean
  numShares: BigNumber
  availableToWithdraw: BigNumber
  availableToWithdrawInDollars: BigNumber
  allowance: BigNumber
  weightedAverageSharePrice: BigNumber
  unrealizedGains: BigNumber
  unrealizedGainsInDollars: BigNumber
  unrealizedGainsPercentage: BigNumber
}

function getWeightedAverageSharePrice(seniorPoolDeposits: SeniorPoolDeposit[], numShares: BigNumber) {
  const preparedEvents = _.reverse(_.sortBy(seniorPoolDeposits, "blockNumber"))

  let zero = new BigNumber(0)
  let sharesLeftToAccountFor = numShares
  let totalAmountPaid = zero
  preparedEvents.forEach((event) => {
    if (sharesLeftToAccountFor.lte(zero)) {
      return
    }
    const sharePrice = new BigNumber(event.amount)
      .dividedBy(USDC_DECIMALS.toString())
      .dividedBy(new BigNumber(event.shares).dividedBy(FIDU_DECIMALS.toString()))
    const sharesToAccountFor = BigNumber.min(sharesLeftToAccountFor, new BigNumber(event.shares))
    totalAmountPaid = totalAmountPaid.plus(sharesToAccountFor.multipliedBy(sharePrice))
    sharesLeftToAccountFor = sharesLeftToAccountFor.minus(sharesToAccountFor)
  })
  if (sharesLeftToAccountFor.gt(zero)) {
    // This case means you must have received Fidu outside of depositing,
    // which we don't have price data for, and therefore can't calculate
    // a correct weighted average price. By returning empty string,
    // the result becomes NaN, and our display functions automatically handle
    // the case, and turn it into a '-' on the front-end
    return new BigNumber("")
  } else {
    return totalAmountPaid.dividedBy(numShares)
  }
}

function remainingCapacity(this: SeniorPoolData, maxPoolCapacity: BigNumber): BigNumber {
  let cappedBalance = BigNumber.min(this.totalPoolAssets, maxPoolCapacity)
  return new BigNumber(maxPoolCapacity).minus(cappedBalance)
}

export function parseSeniorPool(seniorPool: SeniorPoolGQL): SeniorPoolData {
  const latestPoolStatus = seniorPool.lastestPoolStatus
  const compoundBalance = new BigNumber(latestPoolStatus.compoundBalance)
  const balance = compoundBalance.plus(latestPoolStatus.rawBalance)
  const totalShares = new BigNumber(latestPoolStatus.totalShares)
  const sharePrice = new BigNumber(latestPoolStatus.totalPoolAssets).dividedBy(totalShares)
  const totalPoolAssetsInDollars = totalShares
    .div(FIDU_DECIMALS.toString())
    .multipliedBy(new BigNumber(sharePrice))
    .div(FIDU_DECIMALS.toString())
  let totalPoolAssets = totalPoolAssetsInDollars.multipliedBy(USDC_DECIMALS.toString())
  const totalLoansOutstanding = new BigNumber(latestPoolStatus.totalLoansOutstanding)
  const estimatedTotalInterest = new BigNumber(latestPoolStatus.estimatedTotalInterest)
  const cumulativeDrawdowns = new BigNumber(latestPoolStatus.cumulativeDrawdowns)
  const cumulativeWritedowns = new BigNumber(latestPoolStatus.cumulativeWritedowns)
  const defaultRate = new BigNumber(latestPoolStatus.defaultRate)
  const rawBalance = new BigNumber(latestPoolStatus.rawBalance)
  let estimatedApy = estimatedTotalInterest.dividedBy(totalPoolAssets)

  return {
    id: seniorPool.id,
    compoundBalance,
    balance,
    totalShares,
    totalPoolAssets,
    totalLoansOutstanding,
    estimatedTotalInterest,
    estimatedApy,
    defaultRate,
    rawBalance,
    cumulativeDrawdowns,
    cumulativeWritedowns,
    remainingCapacity,
  }
}

export async function parseUser(
  user: User | undefined | null,
  sharePriceStr: string,
  pool: SeniorPool
): Promise<UserData> {
  const userAddress = user?.id || ""
  const seniorPoolDeposits = user?.seniorPoolDeposits || []
  const capitalProviderStatus = user?.capitalProviderStatus
  const goListed = user?.goListed || false

  const sharePrice = new BigNumber(sharePriceStr) as any
  const numShares = userAddress
    ? new BigNumber(await pool.fidu.methods.balanceOf(userAddress).call())
    : new BigNumber("0")
  const availableToWithdraw = new BigNumber(numShares)
    .multipliedBy(new BigNumber(sharePrice))
    .div(FIDU_DECIMALS.toString())
  const availableToWithdrawInDollars = new BigNumber(fiduFromAtomic(availableToWithdraw))
  const allowance = new BigNumber(capitalProviderStatus?.allowance)
  const weightedAverageSharePrice = getWeightedAverageSharePrice(seniorPoolDeposits, numShares)
  const sharePriceDelta = sharePrice.dividedBy(FIDU_DECIMALS).minus(weightedAverageSharePrice)
  const unrealizedGains = sharePriceDelta.multipliedBy(numShares)
  const unrealizedGainsInDollars = new BigNumber(roundDownPenny(unrealizedGains.div(FIDU_DECIMALS)))
  const unrealizedGainsPercentage = sharePriceDelta.dividedBy(weightedAverageSharePrice)
  return {
    id: userAddress,
    goListed,
    numShares,
    availableToWithdraw,
    availableToWithdrawInDollars,
    allowance,
    weightedAverageSharePrice,
    unrealizedGains,
    unrealizedGainsInDollars,
    unrealizedGainsPercentage,
  }
}
