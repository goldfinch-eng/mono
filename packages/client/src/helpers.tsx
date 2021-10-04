import BigNumber from "bignumber.js"
import {fiduFromAtomic, FIDU_DECIMALS} from "./ethereum/fidu"
import {CapitalProvider, emptyCapitalProvider, PoolData, SeniorPool} from "./ethereum/pool"
import {USDC_DECIMALS} from "./ethereum/utils"
import {SeniorPool as SeniorPoolGQL, User} from "./graphql/types"

function remainingCapacity(this: PoolData, maxPoolCapacity: BigNumber): BigNumber {
  let cappedBalance = BigNumber.min(this.totalPoolAssets, maxPoolCapacity)
  return new BigNumber(maxPoolCapacity).minus(cappedBalance)
}

export function parseSeniorPool(seniorPool: SeniorPoolGQL, pool: SeniorPool): PoolData {
  const compoundBalance = new BigNumber(seniorPool.lastestPoolStatus.compoundBalance)
  const balance = compoundBalance.plus(seniorPool.lastestPoolStatus.rawBalance)
  const totalShares = new BigNumber(seniorPool.lastestPoolStatus.totalShares)
  const sharePrice = new BigNumber(seniorPool.lastestPoolStatus.totalPoolAssets).dividedBy(totalShares)
  const totalPoolAssetsInDollars = totalShares
    .div(FIDU_DECIMALS.toString())
    .multipliedBy(new BigNumber(sharePrice))
    .div(FIDU_DECIMALS.toString())
  let totalPoolAssets = totalPoolAssetsInDollars.multipliedBy(USDC_DECIMALS.toString())
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
    pool: {...pool, address: seniorPool.id, loaded: true, initialize: async () => {}, getPoolEvents: async () => []},
    cumulativeDrawdowns,
    cumulativeWritedowns,
    remainingCapacity,
    loaded: true,
    poolEvents: [],
    assetsAsOf: () => new BigNumber(totalPoolAssets),
    getRepaymentEvents: async () => [],
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
