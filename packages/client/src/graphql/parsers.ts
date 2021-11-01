import BigNumber from "bignumber.js"
import {fiduFromAtomic, FIDU_DECIMALS} from "../ethereum/fidu"
import {USDC_DECIMALS} from "../ethereum/utils"
import {getSeniorPoolAndProviders_seniorPools as SeniorPoolGQL, getSeniorPoolAndProviders_user as User} from "./types"
import {roundDownPenny} from "../utils"
import {
  getCumulativeDrawdowns,
  getCumulativeWritedowns,
  getEstimatedTotalInterest,
  getWeightedAverageSharePrice,
  remainingCapacity,
  SeniorPool,
} from "../ethereum/pool"
import {GraphSeniorPoolData, GraphUserData} from "./utils"
import {Fidu} from "@goldfinch-eng/protocol/typechain/web3/Fidu"

export async function parseSeniorPool(seniorPool: SeniorPoolGQL, pool?: SeniorPool): Promise<GraphSeniorPoolData> {
  const zero = new BigNumber("0")
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
  const estimatedTotalInterest = pool ? await getEstimatedTotalInterest(pool) : zero
  const cumulativeDrawdowns = pool ? await getCumulativeDrawdowns(pool) : zero
  const cumulativeWritedowns = pool ? await getCumulativeWritedowns(pool) : zero
  const defaultRate = cumulativeWritedowns.dividedBy(cumulativeDrawdowns)
  const rawBalance = new BigNumber(latestPoolStatus.rawBalance)
  const estimatedApy = estimatedTotalInterest.dividedBy(totalPoolAssets)
  const isPaused = pool?.isPaused

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
    isPaused,
  }
}

export async function parseUser(
  user: User | undefined | null,
  seniorPool: SeniorPoolGQL,
  fidu?: Fidu
): Promise<GraphUserData> {
  const userAddress = user?.id || ""
  const seniorPoolDeposits = user?.seniorPoolDeposits || []
  const capitalProviderStatus = user?.capitalProviderStatus
  const goListed = user?.goListed || false

  const sharePrice = new BigNumber(seniorPool.lastestPoolStatus.sharePrice)
  const numShares =
    userAddress && fidu ? new BigNumber(await fidu.methods.balanceOf(userAddress).call()) : new BigNumber("0")
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
