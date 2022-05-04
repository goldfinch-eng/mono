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
import {TranchedPoolBacker, TokenInfo, TranchedPool, TrancheInfo} from "../ethereum/tranchedPool"
import {GoldfinchProtocol} from "../ethereum/GoldfinchProtocol"
import {CreditLine} from "../ethereum/creditLine"
import {usdcFromAtomic} from "../ethereum/erc20"
import {NetworkConfig} from "../types/network"
import {FIDU_DECIMALS} from "../ethereum/fidu"
import {DEPOSIT_MADE_EVENT, KnownEventData} from "../types/events"

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

// Pools which should have a 4x rather than 3x leverage ratio
const LEVERAGE_RATIO_EXCEPTIONS = [
  "0xd09a57127bc40d680be7cb061c2a6629fe71abef",
  "0x00c27fc71b159a346e179b4a1608a0865e8a7470",
  "0x418749e294cabce5a714efccc22a8aade6f9db57",
  "0xb26b42dd5771689d0a7faeea32825ff9710b9c11",
  "0x89d7c618a4eef3065da8ad684859a547548e6169",
  "0x759f097f3153f5d62ff1c2d82ba78b6350f223e3",
  "0xd43a4f3041069c6178b99d55295b00d0db955bb5",
].map((a) => a.toLowerCase())

async function parseTranchedPool(
  pool: TranchedPoolGQL,
  goldfinchProtocol: GoldfinchProtocol,
  currentBlock: BlockInfo
): Promise<TranchedPool> {
  const creditLine = await parseCreditLine(pool.creditLine, goldfinchProtocol, currentBlock)
  const tranchedPool = new TranchedPool(pool.id, goldfinchProtocol)
  tranchedPool.creditLineAddress = pool.creditLine.id
  tranchedPool.creditLine = creditLine
  tranchedPool.metadata = await tranchedPool.loadPoolMetadata()

  // TODO This needs to be updated to support version of tranched pool with multiples slices
  const juniorTranche = pool.juniorTranches[0]
  const seniorTranche = pool.seniorTranches[0]
  assertNonNullable(juniorTranche)
  assertNonNullable(seniorTranche)

  tranchedPool.juniorTranche = trancheInfo(juniorTranche)
  tranchedPool.seniorTranche = trancheInfo(seniorTranche)

  tranchedPool.totalDeposited = new BigNumber(pool.totalDeposited)
  tranchedPool.juniorFeePercent = new BigNumber(pool.juniorFeePercent)
  tranchedPool.reserveFeePercent = new BigNumber(pool.reserveFeePercent)
  tranchedPool.estimatedSeniorPoolContribution = new BigNumber(pool.estimatedSeniorPoolContribution)
  tranchedPool.estimatedLeverageRatio = new BigNumber(pool.estimatedLeverageRatio)
  if (LEVERAGE_RATIO_EXCEPTIONS.includes(tranchedPool.address.toLowerCase())) {
    tranchedPool.estimatedLeverageRatio = new BigNumber(4)
  }

  tranchedPool.isV1StyleDeal = !!tranchedPool.metadata?.v1StyleDeal
  tranchedPool.isMigrated = !!tranchedPool.metadata?.migrated
  tranchedPool.isPaused = pool.isPaused
  tranchedPool.drawdownsPaused = await tranchedPool.contract.readOnly.methods
    .drawdownsPaused()
    .call(undefined, currentBlock?.number || "latest")

  // This code addresses the case when the user doesn't have a web3 provider
  // since we need the current block timestamp to define the pool status.
  const _currentBlock: BlockInfo = currentBlock || {
    number: 0,
    timestamp: Math.floor(Date.now() / 1000),
  }
  tranchedPool.poolState = tranchedPool.getPoolState(_currentBlock)

  // TODO Add these values to the subgraph, and then use them, and remove these web3 calls.
  const [totalDeployed, fundableAt, numTranchesPerSlice] = await Promise.all(
    tranchedPool.isMultipleDrawdownsCompatible
      ? [
          tranchedPool.contract.readOnly.methods.totalDeployed().call(undefined, currentBlock?.number || "latest"),
          tranchedPool.contract.readOnly.methods.fundableAt().call(undefined, currentBlock?.number || "latest"),
          tranchedPool.contract.readOnly.methods
            .NUM_TRANCHES_PER_SLICE()
            .call(undefined, currentBlock?.number || "latest"),
        ]
      : ["0", "0", "2"]
  )
  tranchedPool.totalDeployed = new BigNumber(totalDeployed)
  tranchedPool.fundableAt = new BigNumber(fundableAt)
  tranchedPool.numTranchesPerSlice = new BigNumber(numTranchesPerSlice)

  return tranchedPool
}

async function parseCreditLine(
  creditLineData: CreditLineGQL,
  goldfinchProtocol: GoldfinchProtocol,
  currentBlock: BlockInfo
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
  await creditLine.calculateFields(currentBlock)
  creditLine.loaded = true

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
  goldfinchProtocol: GoldfinchProtocol,
  currentBlock: BlockInfo,
  userAddress?: string
): Promise<TranchedPoolBacker[]> {
  const _goldfinchProtocol = await defaultGoldfinchProtocol(goldfinchProtocol)

  return Promise.all(
    tranchedPools.map(async (tranchedPoolData) => {
      const tranchedPool = await parseTranchedPool(tranchedPoolData, _goldfinchProtocol, currentBlock)

      if (userAddress) {
        const backerData = tranchedPoolData.backers?.find((b) => b.user.id.toLowerCase() === userAddress.toLowerCase())
        const backer = new TranchedPoolBacker(userAddress, tranchedPool, _goldfinchProtocol)
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
        const filteredTokens = (backerData?.user.tokens || []).filter(
          (token) => token.tranchedPool.id.toLowerCase() === tranchedPool.address.toLowerCase()
        )
        backer.tokenInfos = tokenInfo(filteredTokens)
        const events = await Promise.all(
          backer.tokenInfos.map(
            (tokenInfo): Promise<KnownEventData<typeof DEPOSIT_MADE_EVENT>[]> =>
              _goldfinchProtocol.queryEvents(
                tranchedPool.contract.readOnly,
                [DEPOSIT_MADE_EVENT],
                {tokenId: tokenInfo.id},
                currentBlock.number
              )
          )
        ).catch((error) => {
          console.error("Error fetching deposit_made events for backer tokenInfo", error)
          throw error
        })

        backer.firstDepositBlockNumber = events
          .flat()
          .reduce<number | undefined>(
            (acc, curr) => (acc ? Math.min(acc, curr.blockNumber) : curr.blockNumber),
            undefined
          )
        return backer
      } else {
        // HACK: In the absence of a user address, use the tranched pool's address, so that we can still
        // instantiate `PoolBacker` and show the list of pools.
        const backer = new TranchedPoolBacker(tranchedPool.address, tranchedPool, _goldfinchProtocol)
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
        backer.firstDepositBlockNumber = undefined
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
      tranche: new BigNumber(t.tranche),
      principalAmount: new BigNumber(t.principalAmount),
      principalRedeemed: new BigNumber(t.principalRedeemed),
      interestRedeemed: new BigNumber(t.interestRedeemed),
      principalRedeemable: new BigNumber(t.principalRedeemable),
      interestRedeemable: new BigNumber(t.interestRedeemable),
    }
  })
}
