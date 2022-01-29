import BigNumber from "bignumber.js"
import {assertNonNullable} from "@goldfinch-eng/utils/src/type"
import {INTEREST_DECIMALS, USDC_DECIMALS} from "../ethereum/utils"
import {
  getSeniorPool as QueryResultSeniorPoolStatus,
  getTranchedPoolsData_tranchedPools as TranchedPoolGQL,
  getTranchedPoolsData_tranchedPools_backers_user_tokens as TokenInfoGQL,
  getTranchedPoolsData_tranchedPools_creditLine as CreditLineGQL,
  getTranchedPoolsData_tranchedPools_juniorTranches as JuniorTrancheGQL,
  getTranchedPoolsData_tranchedPools_seniorTranches as SeniorTrancheGQL,
} from "./types"
import {BlockInfo, roundDownPenny} from "../utils"
import {PoolBacker, TokenInfo, TranchedPool, TrancheInfo} from "../ethereum/tranchedPool"
import {GoldfinchProtocol} from "../ethereum/GoldfinchProtocol"
import {CreditLine} from "../ethereum/creditLine"
import {usdcFromAtomic} from "../ethereum/erc20"
import {NetworkConfig} from "../types/network"
import {FIDU_DECIMALS} from "../ethereum/fidu"

export function parseSeniorPoolStatus(data: QueryResultSeniorPoolStatus) {
  const seniorPool = data.seniorPool
  assertNonNullable(seniorPool)
  const latestPoolStatus = seniorPool.latestPoolStatus

  const totalShares = new BigNumber(latestPoolStatus.totalShares)
  const sharePrice = new BigNumber(latestPoolStatus.totalPoolAssets).dividedBy(totalShares)
  const totalPoolAssetsInDollars = totalShares
    .div(FIDU_DECIMALS.toString())
    .multipliedBy(sharePrice)
    .div(FIDU_DECIMALS.toString())
  const totalPoolAssets = totalPoolAssetsInDollars.multipliedBy(USDC_DECIMALS.toString())

  return {
    totalPoolAssets,
    totalLoansOutstanding: latestPoolStatus.totalLoansOutstanding,
  }
}

function trancheInfo(tranche: JuniorTrancheGQL | SeniorTrancheGQL): TrancheInfo {
  return {
    id: Number(tranche.trancheId),
    principalDeposited: new BigNumber(tranche.principalDeposited),
    principalSharePrice: new BigNumber(tranche.principalSharePrice),
    interestSharePrice: new BigNumber(tranche.interestSharePrice),
    lockedUntil: Number(tranche.lockedUntil),
  }
}

async function parseTranchedPool(
  pool: TranchedPoolGQL,
  goldfinchProtocol: GoldfinchProtocol,
  currentBlock?: BlockInfo
): Promise<TranchedPool> {
  const creditLine = await parseCreditLine(pool.creditLine, goldfinchProtocol, currentBlock)
  const tranchedPool = new TranchedPool(pool.id, goldfinchProtocol)
  tranchedPool.creditLineAddress = pool.creditLine.id
  tranchedPool.creditLine = creditLine
  tranchedPool.metadata = await tranchedPool.loadPoolMetadata()
  tranchedPool.juniorFeePercent = new BigNumber(pool.juniorFeePercent)
  tranchedPool.reserveFeePercent = new BigNumber(pool.reserveFeePercent)
  tranchedPool.estimatedLeverageRatio = new BigNumber(pool.estimatedLeverageRatio)
  tranchedPool.estimatedSeniorPoolContribution = new BigNumber(pool.estimatedSeniorPoolContribution)

  // TODO This needs to be updated to support version of tranched pool with multiples slices
  const juniorTranche = pool.juniorTranches[0]
  const seniorTranche = pool.seniorTranches[0]
  assertNonNullable(juniorTranche)
  assertNonNullable(seniorTranche)

  tranchedPool.juniorTranche = trancheInfo(juniorTranche)
  tranchedPool.seniorTranche = trancheInfo(seniorTranche)

  // This code addresses the case when the user doesn't have a web3 provider
  // since we need the current block timestamp to define the pool status.
  const _currentBlock: BlockInfo = currentBlock || {
    number: 0,
    timestamp: Math.floor(Date.now() / 1000),
  }
  tranchedPool.poolState = tranchedPool.getPoolState(_currentBlock)
  tranchedPool.isPaused = pool.isPaused
  tranchedPool.totalDeposited = new BigNumber(pool.totalDeposited)
  tranchedPool.isV1StyleDeal = !!tranchedPool.metadata?.v1StyleDeal
  tranchedPool.isMigrated = !!tranchedPool.metadata?.migrated
  return tranchedPool
}

async function parseCreditLine(
  creditLineData: CreditLineGQL,
  goldfinchProtocol: GoldfinchProtocol,
  currentBlock?: BlockInfo
): Promise<CreditLine> {
  const creditLine = new CreditLine(creditLineData.id, goldfinchProtocol)
  creditLine.balance = new BigNumber(creditLineData.balance)
  creditLine.interestApr = new BigNumber(creditLineData.interestApr)
  creditLine.interestOwed = new BigNumber(creditLineData.interestOwed)
  creditLine.nextDueTime = new BigNumber(creditLineData.nextDueTime)
  creditLine.creditLines = [creditLine]
  creditLine.interestAccruedAsOf = new BigNumber(creditLineData.interestAccruedAsOf)
  creditLine.currentLimit = new BigNumber(creditLineData.limit)
  creditLine.termEndTime = new BigNumber(creditLineData.termEndTime)
  creditLine.paymentPeriodInDays = new BigNumber(creditLineData.paymentPeriodInDays)
  creditLine.termInDays = new BigNumber(creditLineData.termInDays)
  creditLine.lastFullPaymentTime = new BigNumber(creditLineData.lastFullPaymentTime)
  creditLine.interestAprDecimal = new BigNumber(creditLine.interestApr).div(INTEREST_DECIMALS.toString())

  if (currentBlock) {
    await creditLine.calculateFields(currentBlock)
    creditLine.loaded = true
  }

  return creditLine
}

async function defaultGoldfinchProtocol(goldfinchProtocol: GoldfinchProtocol | undefined): Promise<GoldfinchProtocol> {
  /* This custom method allows us to create a default goldfinchProtocol for the occasion of no web3 provider available.
     The intention is to load the earn page with data from the subgraph. Be aware that any calls to contract methods
     will raise an error. */
  if (goldfinchProtocol) {
    return goldfinchProtocol
  }

  const networkConfig: NetworkConfig = {name: "mainnet", supported: true}
  const protocol = new GoldfinchProtocol(networkConfig)
  await protocol.initialize()
  return protocol
}

export async function parseBackers(
  tranchedPools: TranchedPoolGQL[],
  goldfinchProtocol?: GoldfinchProtocol,
  currentBlock?: BlockInfo,
  userAddress?: string
): Promise<PoolBacker[]> {
  const _goldfinchProtocol = await defaultGoldfinchProtocol(goldfinchProtocol)

  return Promise.all(
    tranchedPools.map(async (tranchedPoolData) => {
      const tranchedPool = await parseTranchedPool(tranchedPoolData, _goldfinchProtocol, currentBlock)

      if (userAddress) {
        const backerData = tranchedPoolData.backers?.find((b) => b.user.id.toLowerCase() === userAddress.toLowerCase())
        const backer = new PoolBacker(userAddress, tranchedPool, _goldfinchProtocol)
        backer.principalAmount = new BigNumber(backerData?.principalAmount || 0)
        backer.principalRedeemed = new BigNumber(backerData?.principalRedeemed || 0)
        backer.interestRedeemed = new BigNumber(backerData?.interestRedeemed || 0)
        backer.principalRedeemable = new BigNumber(backerData?.principalRedeemable || 0)
        backer.interestRedeemable = new BigNumber(backerData?.interestRedeemable || 0)
        backer.balance = new BigNumber(backerData?.balance || 0)
        backer.balanceInDollars = new BigNumber(roundDownPenny(usdcFromAtomic(backer.balance)))
        backer.principalAtRisk = new BigNumber(backerData?.principalAtRisk || 0)
        backer.availableToWithdraw = new BigNumber(backerData?.availableToWithdraw || 0)
        backer.availableToWithdrawInDollars = new BigNumber(usdcFromAtomic(backer.availableToWithdraw))
        backer.unrealizedGainsInDollars = new BigNumber(roundDownPenny(usdcFromAtomic(backer.interestRedeemable)))
        backer.tokenInfos = tokenInfo(backerData?.user.tokens || [])
        return backer
      } else {
        // HACK: In the absence of a user address, use the tranched pool's address, so that we can still
        // instantiate `PoolBacker` and show the list of pools.
        const backer = new PoolBacker(tranchedPool.address, tranchedPool, _goldfinchProtocol)
        backer.principalAmount = new BigNumber("")
        backer.principalRedeemed = new BigNumber("")
        backer.interestRedeemed = new BigNumber("")
        backer.principalRedeemable = new BigNumber("")
        backer.interestRedeemable = new BigNumber("")
        backer.balance = new BigNumber("")
        backer.balanceInDollars = new BigNumber("")
        backer.principalAtRisk = new BigNumber("")
        backer.availableToWithdraw = new BigNumber("")
        backer.availableToWithdrawInDollars = new BigNumber("")
        backer.unrealizedGainsInDollars = new BigNumber("")
        backer.tokenInfos = tokenInfo([])
        return backer
      }
    })
  )
}

function tokenInfo(tokens: TokenInfoGQL[]): TokenInfo[] {
  return tokens.map((t) => {
    return {
      id: t.id,
      pool: t.tranchedPool.id,
      tranche: t.tranche,
      principalAmount: t.principalAmount,
      principalRedeemed: t.principalRedeemed,
      interestRedeemed: t.interestRedeemed,
      principalRedeemable: t.principalRedeemable,
      interestRedeemable: t.interestRedeemable,
    }
  })
}
