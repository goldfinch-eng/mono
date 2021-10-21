import BigNumber from "bignumber.js"
import {fiduFromAtomic, FIDU_DECIMALS} from "../ethereum/fidu"
import {USDC_DECIMALS} from "../ethereum/utils"
import {getSeniorPoolAndProviders_seniorPools as SeniorPoolGQL, getSeniorPoolAndProviders_user as User} from "./types"
import {roundDownPenny} from "../utils"
import {getWeightedAverageSharePrice} from "../ethereum/pool"
import {GraphSeniorPoolData, GraphUserData} from "./utils"
import {Fidu} from "@goldfinch-eng/protocol/typechain/web3/Fidu"

function remainingCapacity(this: any, maxPoolCapacity: BigNumber): BigNumber {
  let cappedBalance = BigNumber.min(this.totalPoolAssets, maxPoolCapacity)
  return new BigNumber(maxPoolCapacity).minus(cappedBalance)
}

export function parseSeniorPool(seniorPool: SeniorPoolGQL): GraphSeniorPoolData {
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
    type: "GraphSeniorPoolData",
    address: seniorPool.id,
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
  seniorPool: SeniorPoolGQL,
  fidu: Fidu
): Promise<GraphUserData> {
  const userAddress = user?.id || ""
  const seniorPoolDeposits = user?.seniorPoolDeposits || []
  const capitalProviderStatus = user?.capitalProviderStatus
  const goListed = user?.goListed || false

  const sharePrice = new BigNumber(seniorPool.lastestPoolStatus.sharePrice) as any
  const numShares = userAddress ? new BigNumber(await fidu.methods.balanceOf(userAddress).call()) : new BigNumber("0")
  const availableToWithdraw = new BigNumber(numShares)
    .multipliedBy(new BigNumber(sharePrice))
    .div(FIDU_DECIMALS.toString())
  const availableToWithdrawInDollars = new BigNumber(fiduFromAtomic(availableToWithdraw))
  const allowance = new BigNumber(capitalProviderStatus?.allowance)
  const weightedAverageSharePrice = await getWeightedAverageSharePrice({
    numShares,
    address: userAddress,
    seniorPoolDeposits,
  })
  const sharePriceDelta = sharePrice.dividedBy(FIDU_DECIMALS).minus(weightedAverageSharePrice)
  const unrealizedGains = sharePriceDelta.multipliedBy(numShares)
  const unrealizedGainsInDollars = new BigNumber(roundDownPenny(unrealizedGains.div(FIDU_DECIMALS)))
  const unrealizedGainsPercentage = sharePriceDelta.dividedBy(weightedAverageSharePrice)

  return {
    type: "GraphUserData",
    address: userAddress,
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
