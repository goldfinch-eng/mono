import BigNumber from "bignumber.js"
import {fiduFromAtomic} from "./ethereum/fidu"
import {CapitalProvider, emptyCapitalProvider, PoolData} from "./ethereum/pool"
import {SeniorPool, User} from "./graphql/types"

function remainingCapacity(this: any, maxPoolCapacity: BigNumber): BigNumber {
  let cappedBalance = BigNumber.min(this.totalPoolAssets, maxPoolCapacity)
  return new BigNumber(maxPoolCapacity).minus(cappedBalance)
}

export function parseSeniorPool(seniorPool: SeniorPool): PoolData {
  const compoundBalance = new BigNumber(seniorPool.lastestPoolStatus.compoundBalance)
  const balance = compoundBalance.plus(seniorPool.lastestPoolStatus.rawBalance)
  const totalShares = new BigNumber(seniorPool.lastestPoolStatus.totalShares)
  const totalPoolAssets = new BigNumber(seniorPool.lastestPoolStatus.totalPoolAssets)
  const totalLoansOutstanding = new BigNumber(seniorPool.lastestPoolStatus.totalLoansOutstanding)
  const estimatedTotalInterest = new BigNumber(seniorPool.lastestPoolStatus.estimatedTotalInterest)
  const estimatedApy = new BigNumber(seniorPool.lastestPoolStatus.estimatedApy)
  const defaultRate = new BigNumber(seniorPool.lastestPoolStatus.defaultRate)
  const rawBalance = new BigNumber(seniorPool.lastestPoolStatus.rawBalance)
  const cumulativeDrawdowns = new BigNumber(seniorPool.lastestPoolStatus.cumulativeDrawdowns)
  const cumulativeWritedowns = new BigNumber(seniorPool.lastestPoolStatus.cumulativeWritedowns)
  return {
    compoundBalance,
    balance,
    totalShares,
    totalPoolAssets,
    totalLoansOutstanding,
    estimatedTotalInterest,
    estimatedApy,
    defaultRate,
    rawBalance,
    pool: {address: seniorPool.id},
    cumulativeDrawdowns,
    cumulativeWritedowns,
    remainingCapacity,
    loaded: true,
    poolEvents: [],
    assetsAsOf: totalPoolAssets,
  }
}

export function parseUser(user: User | undefined | null): CapitalProvider {
  if (!user) {
    return emptyCapitalProvider({loaded: true})
  }
  let numShares = user.capitalProviderStatus?.numShares
  let availableToWithdraw = user.capitalProviderStatus?.availableToWithdraw
  let availableToWithdrawInDollars = new BigNumber(fiduFromAtomic(availableToWithdraw))
  let address = user.id
  let allowance = new BigNumber(user.capitalProviderStatus?.allowance)
  let weightedAverageSharePrice = new BigNumber(user.capitalProviderStatus?.weightedAverageSharePrice)
  let unrealizedGains = new BigNumber(user.capitalProviderStatus?.unrealizedGains)
  let unrealizedGainsInDollars = new BigNumber(user.capitalProviderStatus?.unrealizedGainsInDollars)
  let unrealizedGainsPercentage = new BigNumber(user.capitalProviderStatus?.unrealizedGainsPercentage)

  return {
    numShares,
    availableToWithdraw,
    availableToWithdrawInDollars,
    address,
    allowance,
    weightedAverageSharePrice,
    unrealizedGains,
    unrealizedGainsInDollars,
    unrealizedGainsPercentage,
    loaded: true,
  }
}
