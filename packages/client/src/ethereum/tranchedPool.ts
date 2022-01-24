import {CONFIG_KEYS} from "@goldfinch-eng/protocol/blockchain_scripts/configKeys"
import {IPoolTokens} from "@goldfinch-eng/protocol/typechain/web3/IPoolTokens"
import {SeniorPool as SeniorPoolContract} from "@goldfinch-eng/protocol/typechain/web3/SeniorPool"
import {TranchedPool as TranchedPoolContract} from "@goldfinch-eng/protocol/typechain/web3/TranchedPool"
import {ContractEventLog} from "@goldfinch-eng/protocol/typechain/web3/types"
import BigNumber from "bignumber.js"
import _ from "lodash"
import {
  DEPOSIT_MADE_EVENT,
  DRAWDOWN_MADE_EVENT,
  KnownEventData,
  PAYMENT_APPLIED_EVENT,
  SHARE_PRICE_UPDATED_EVENT,
} from "../types/events"
import {ScheduledRepayment} from "../types/tranchedPool"
import {DRAWDOWN_TX_NAME, INTEREST_PAYMENT_TX_NAME} from "../types/transactions"
import {Web3IO} from "../types/web3"
import {BlockInfo, croppedAddress, roundDownPenny} from "../utils"
import web3 from "../web3"
import {getCreditDeskReadOnly} from "./creditDesk"
import {CreditLine} from "./creditLine"
import {usdcFromAtomic} from "./erc20"
import {fiduFromAtomic} from "./fidu"
import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {INTEREST_DECIMALS, isMainnetForking, SECONDS_PER_DAY, SECONDS_PER_YEAR, USDC_DECIMALS} from "./utils"

const ZERO = new BigNumber(0)
const ONE = new BigNumber(1)
const ONE_HUNDRED = new BigNumber(100)

interface MetadataStore {
  [address: string]: TranchedPoolMetadata
}
let _metadataStore: MetadataStore
async function getMetadataStore(networkId: string): Promise<MetadataStore> {
  if (_metadataStore) {
    return Promise.resolve(_metadataStore)
  }
  try {
    let metadataStore: MetadataStore = {}

    let loadedStore = await import(`../../config/pool-metadata/${networkId}.json`)
    // If mainnet-forking, merge local metadata with mainnet
    if (isMainnetForking()) {
      let mainnetMetadata = await import("../../config/pool-metadata/mainnet.json")
      loadedStore = _.merge(loadedStore, mainnetMetadata)
    }

    Object.keys(loadedStore).forEach((addr) => {
      // JSON files are loaded as modules with "default" key, so just ignore that
      if (addr === "default") {
        return
      }
      let metadata: TranchedPoolMetadata = loadedStore[addr]
      if (metadata.icon && metadata.icon.startsWith("%PUBLIC_URL%")) {
        metadata.icon = metadata.icon.replace("%PUBLIC_URL%", process.env.PUBLIC_URL)
      }
      if (metadata.agreement && metadata.agreement.startsWith("%PUBLIC_URL%")) {
        metadata.agreement = metadata.agreement.replace("%PUBLIC_URL%", process.env.PUBLIC_URL)
      }

      metadataStore[addr.toLowerCase()] = metadata
    })

    _metadataStore = metadataStore
    return _metadataStore
  } catch (e) {
    console.log(e)
    return {}
  }
}

export interface TranchedPoolMetadata {
  name: string
  category: string
  icon: string
  description: string
  detailsUrl?: string
  disabled?: boolean
  backerLimit?: string
  agreement?: string
  v1StyleDeal?: boolean
  migrated?: boolean
  migratedFrom?: string
  NDAUrl?: string
}

enum PoolState {
  Open,
  JuniorLocked,
  SeniorLocked,
  WithdrawalsUnlocked,
}

// TODO: copied from deployHelpers
const TRANCHES = {
  Senior: 1,
  Junior: 2,
}

export type TrancheInfo = {
  id: number
  principalDeposited: BigNumber
  principalSharePrice: BigNumber
  interestSharePrice: BigNumber
  lockedUntil: number
}

function trancheInfo(tuple: any): TrancheInfo {
  return {
    id: parseInt(tuple[0]),
    principalDeposited: new BigNumber(tuple[1]),
    principalSharePrice: new BigNumber(tuple[2]),
    interestSharePrice: new BigNumber(tuple[3]),
    lockedUntil: parseInt(tuple[4]),
  }
}

class TranchedPool {
  address: string
  goldfinchProtocol: GoldfinchProtocol
  contract: Web3IO<TranchedPoolContract>
  creditLine!: CreditLine
  creditLineAddress!: string
  poolState!: PoolState
  metadata?: TranchedPoolMetadata
  juniorFeePercent!: BigNumber
  reserveFeePercent!: BigNumber
  estimatedLeverageRatio!: BigNumber
  estimatedSeniorPoolContribution!: BigNumber

  juniorTranche!: TrancheInfo
  seniorTranche!: TrancheInfo
  totalDeposited!: BigNumber
  totalDeployed!: BigNumber
  fundableAt!: BigNumber

  isV1StyleDeal!: boolean
  isMigrated!: boolean
  isPaused!: boolean

  constructor(address: string, goldfinchProtocol: GoldfinchProtocol) {
    this.address = address
    this.goldfinchProtocol = goldfinchProtocol
    this.contract = this.goldfinchProtocol.getContract<TranchedPoolContract>("TranchedPool", address)
  }

  async initialize(currentBlock: BlockInfo) {
    this.creditLineAddress = await this.contract.readOnly.methods.creditLine().call(undefined, currentBlock.number)
    this.creditLine = new CreditLine(this.creditLineAddress, this.goldfinchProtocol)
    await this.creditLine.initialize(currentBlock)
    this.metadata = await this.loadPoolMetadata()

    let juniorTranche = await this.contract.readOnly.methods
      .getTranche(TRANCHES.Junior)
      .call(undefined, currentBlock.number)
      .then(trancheInfo)
    let seniorTranche = await this.contract.readOnly.methods
      .getTranche(TRANCHES.Senior)
      .call(undefined, currentBlock.number)
      .then(trancheInfo)
    this.juniorTranche = juniorTranche
    this.seniorTranche = seniorTranche

    this.totalDeposited = juniorTranche.principalDeposited.plus(seniorTranche.principalDeposited)
    this.juniorFeePercent = new BigNumber(
      await this.contract.readOnly.methods.juniorFeePercent().call(undefined, currentBlock.number)
    )
    this.reserveFeePercent = new BigNumber(100).div(
      await this.goldfinchProtocol.getConfigNumber(CONFIG_KEYS.ReserveDenominator, currentBlock)
    )
    let pool = this.goldfinchProtocol.getContract<SeniorPoolContract>("SeniorPool")
    this.estimatedSeniorPoolContribution = new BigNumber(
      await pool.readOnly.methods.estimateInvestment(this.address).call(undefined, currentBlock.number)
    )
    this.estimatedLeverageRatio = await this.estimateLeverageRatio(currentBlock)

    this.isV1StyleDeal = !!this.metadata?.v1StyleDeal
    this.isMigrated = !!this.metadata?.migrated
    this.isPaused = await this.contract.readOnly.methods.paused().call(undefined, currentBlock.number)

    this.poolState = this.getPoolState(currentBlock)

    this.totalDeployed = new BigNumber(
      await this.contract.readOnly.methods.totalDeployed().call(undefined, currentBlock.number)
    )
    this.fundableAt = new BigNumber(
      await this.contract.readOnly.methods.fundableAt().call(undefined, currentBlock.number)
    )
  }

  getPoolState(currentBlock: BlockInfo): PoolState {
    const now = currentBlock.timestamp
    if (now < this.seniorTranche.lockedUntil) {
      return PoolState.SeniorLocked
    } else if (this.juniorTranche.lockedUntil === 0) {
      return PoolState.Open
    } else if (now < this.juniorTranche.lockedUntil || this.seniorTranche.lockedUntil === 0) {
      return PoolState.JuniorLocked
    }
    return PoolState.WithdrawalsUnlocked
  }

  public async loadPoolMetadata(): Promise<TranchedPoolMetadata | undefined> {
    let store = await getMetadataStore(this.goldfinchProtocol.networkId)
    return store[this.address.toLowerCase()]
  }

  estimateJuniorAPY(leverageRatio: BigNumber): BigNumber {
    if (this.isV1StyleDeal) {
      return this.creditLine.interestAprDecimal
    }

    // If the balance is zero (not yet drawn down, then use the limit as an estimate)
    let balance = this.creditLine.balance.isZero() ? this.creditLine.limit : this.creditLine.balance

    let seniorFraction = leverageRatio.dividedBy(ONE.plus(leverageRatio))
    let juniorFraction = ONE.dividedBy(ONE.plus(leverageRatio))
    let interestRateFraction = this.creditLine.interestAprDecimal.dividedBy(ONE_HUNDRED)
    let juniorFeeFraction = this.juniorFeePercent.dividedBy(ONE_HUNDRED)
    let reserveFeeFraction = this.reserveFeePercent.dividedBy(ONE_HUNDRED)

    let grossSeniorInterest = balance.multipliedBy(interestRateFraction).multipliedBy(seniorFraction)
    let grossJuniorInterest = balance.multipliedBy(interestRateFraction).multipliedBy(juniorFraction)
    const juniorFee = grossSeniorInterest.multipliedBy(juniorFeeFraction)
    const juniorReserveFeeOwed = grossJuniorInterest.multipliedBy(reserveFeeFraction)

    let netJuniorInterest = grossJuniorInterest.plus(juniorFee).minus(juniorReserveFeeOwed)
    let juniorTranche = balance.multipliedBy(juniorFraction)
    return netJuniorInterest.dividedBy(juniorTranche).multipliedBy(ONE_HUNDRED)
  }

  estimateMonthlyInterest(interestRate: BigNumber, principalAmount: BigNumber): BigNumber {
    let monthsPerYear = new BigNumber(12)
    return principalAmount.multipliedBy(interestRate).dividedBy(monthsPerYear)
  }

  estimatedTotalAssets(): BigNumber {
    return this.juniorTranche.principalDeposited
      .plus(this.seniorTranche.principalDeposited)
      .plus(this.estimatedSeniorPoolContribution)
  }

  remainingCapacity(): BigNumber {
    return BigNumber.maximum(ZERO, this.creditLine.limit.minus(this.estimatedTotalAssets()))
  }

  remainingJuniorCapacity(): BigNumber {
    if (this.poolState >= PoolState.JuniorLocked) {
      return ZERO
    }
    return this.remainingCapacity().dividedBy(this.estimatedLeverageRatio.plus(1))
  }

  async estimateLeverageRatio(currentBlock: BlockInfo): Promise<BigNumber> {
    let juniorContribution = this.juniorTranche.principalDeposited

    if (juniorContribution.isZero()) {
      let rawLeverageRatio = await this.goldfinchProtocol.getConfigNumber(CONFIG_KEYS.LeverageRatio, currentBlock)
      return new BigNumber(fiduFromAtomic(rawLeverageRatio))
    } else {
      return this.estimatedTotalAssets().minus(juniorContribution).dividedBy(juniorContribution)
    }
  }

  async recentTransactions(currentBlock: BlockInfo) {
    let oldTransactions: any[] = []
    let transactions = await this.goldfinchProtocol.queryEvents(
      this.contract.readOnly,
      [DRAWDOWN_MADE_EVENT, PAYMENT_APPLIED_EVENT],
      undefined,
      currentBlock.number
    )

    if (this.isMigrated && transactions.length < 3) {
      oldTransactions = await this.getOldTransactions(currentBlock)
    }

    transactions = transactions.concat(oldTransactions)
    transactions = _.reverse(_.sortBy(transactions, ["blockNumber", "transactionIndex"])).slice(0, 3)
    let sharePriceUpdates = await this.sharePriceUpdatesByTx(TRANCHES.Junior, currentBlock)
    let blockTimestamps = await this.timestampsByBlockNumber(transactions)
    return transactions.map((e) => {
      let juniorInterest = new BigNumber(0)
      const sharePriceUpdate = sharePriceUpdates[e.transactionHash]?.[0]
      if (sharePriceUpdate) {
        juniorInterest = new BigNumber(sharePriceUpdate.returnValues.interestDelta)
      }

      let event = {
        txHash: e.transactionHash,
        event: e.event,
        juniorInterestDelta: juniorInterest,
        juniorPrincipalDelta: new BigNumber(sharePriceUpdate?.returnValues.principalDelta),
        timestamp: blockTimestamps[e.blockNumber],
      }
      if (e.event === DRAWDOWN_MADE_EVENT) {
        let amount = e.returnValues.amount || e.returnValues.drawdownAmount

        Object.assign(event, {
          name: DRAWDOWN_TX_NAME,
          amount: new BigNumber(amount),
        })
      } else if (e.event === PAYMENT_APPLIED_EVENT) {
        const interestAmount = new BigNumber(e.returnValues.interestAmount)
        const totalPrincipalAmount = new BigNumber(e.returnValues.principalAmount).plus(
          new BigNumber(e.returnValues.remainingAmount)
        )
        Object.assign(event, {
          name: INTEREST_PAYMENT_TX_NAME,
          amount: interestAmount.plus(totalPrincipalAmount),
          interestAmount: new BigNumber(interestAmount),
          principalAmount: new BigNumber(totalPrincipalAmount),
        })
      }
      return event
    })
  }

  async getOldTransactions(currentBlock: BlockInfo) {
    let oldCreditlineAddress = this.metadata?.migratedFrom
    if (!oldCreditlineAddress) {
      return []
    }
    const creditDesk = await getCreditDeskReadOnly(this.goldfinchProtocol.networkId)
    return await this.goldfinchProtocol.queryEvents(
      creditDesk,
      [DRAWDOWN_MADE_EVENT, PAYMENT_APPLIED_EVENT],
      {
        creditLine: oldCreditlineAddress,
      },
      currentBlock.number
    )
  }

  sharePriceToUSDC(sharePrice: BigNumber, amount: BigNumber): BigNumber {
    return new BigNumber(fiduFromAtomic(sharePrice.multipliedBy(amount)))
  }

  async sharePriceUpdatesByTx(tranche: number, currentBlock: BlockInfo) {
    let transactions = await this.goldfinchProtocol.queryEvents(
      this.contract.readOnly,
      [SHARE_PRICE_UPDATED_EVENT],
      {
        tranche: tranche,
      },
      currentBlock.number
    )
    return _.groupBy(transactions, (e) => e.transactionHash)
  }

  async timestampsByBlockNumber(transactions: ContractEventLog<any>[]) {
    const blockTimestamps = await Promise.all(
      transactions.map((tx) => {
        return web3.readOnly.eth.getBlock(tx.blockNumber).then((block) => {
          return {blockNumber: tx.blockNumber, timestamp: block.timestamp}
        })
      })
    )
    const result = {}
    blockTimestamps.map((t) => (result[t.blockNumber] = t.timestamp))
    return result
  }

  async getOptimisticRepaymentSchedule(currentBlock: BlockInfo): Promise<ScheduledRepayment[]> {
    // 1. How much interest do we expect to be repaid in the remaining term of the loan?
    // The answer consists of two parts: (i) the expected interest on funds that have
    // *already* been borrowed (i.e. the current balance of the pool); plus (ii) if the
    // pool is currently open, interest on the additional funds that would be borrowed
    // assuming the pool fills up.

    // (i)
    // Our approach to calculating this here follows `Accountant.calculateInterestAccruedOverPeriod()`.
    const lastAccrualTimestamp = new BigNumber(
      await this.creditLine.creditLine.readOnly.methods.interestAccruedAsOf().call(undefined, currentBlock.number)
    )
    const interestAccruingSecondsRemaining = this.creditLine.termEndTime.minus(lastAccrualTimestamp)
    const totalInterestPerYear = this.creditLine.balance
      .multipliedBy(this.creditLine.interestApr)
      .dividedBy(INTEREST_DECIMALS.toString())
    const interestToBeAccruedSinceLastAccrual = totalInterestPerYear
      .multipliedBy(interestAccruingSecondsRemaining)
      .dividedBy(SECONDS_PER_YEAR)
    const expectedRemainingInterestFromAlreadyBorrowed = this.creditLine.interestOwed.plus(
      interestToBeAccruedSinceLastAccrual
    )

    // (ii)
    // NOTE: For simplicity, we don't worry here about, if we're in the possible window
    // of time after the senior pool is locked but before the borrower has drawndown, trying
    // to infer that the borrower *will* drawdown.
    let expectedRemainingInterestFromToBeBorrowed = new BigNumber(0)
    if (this.poolState < PoolState.SeniorLocked) {
      const optimisticAdditionalBalance = this.creditLine.currentLimit.minus(this.totalDeployed)
      // When should we say that interest could start being earned on this additional balance?
      // We can't be sure exactly, because there's currently no notion of a deadline for funding
      // the pool, nor hard start time of the borrowing. So we'll make a reasonable supposition: one
      // week after the later of the current time and the pool's `fundableAt` timestamp.
      // TODO[PR] Confirm this behavior is desired.
      const interestAccrualStart = BigNumber.min(
        BigNumber.max(this.fundableAt, currentBlock.timestamp).plus(SECONDS_PER_DAY * 7),
        this.creditLine.termEndTime
      )
      const interestAccruingSecondsRemaining = this.creditLine.termEndTime.minus(interestAccrualStart)
      const totalInterestPerYear = optimisticAdditionalBalance
        .multipliedBy(this.creditLine.interestApr)
        .dividedBy(INTEREST_DECIMALS.toString())
      expectedRemainingInterestFromToBeBorrowed = totalInterestPerYear
        .multipliedBy(interestAccruingSecondsRemaining)
        .dividedBy(SECONDS_PER_YEAR)
    }

    const expectedRemainingInterest = expectedRemainingInterestFromAlreadyBorrowed.plus(
      expectedRemainingInterestFromToBeBorrowed
    )

    // 2. On what schedule do we expect the remaining repayments to occur?
    const secondsRemaining = this.creditLine.termEndTime.minus(currentBlock.timestamp)
    const secondsPerPaymentPeriod = this.creditLine.paymentPeriodInDays.multipliedBy(SECONDS_PER_DAY)
    const numRepaymentsRemaining = secondsRemaining.dividedToIntegerBy(secondsPerPaymentPeriod)
    const expectedRepaymentPerPeriod = expectedRemainingInterest.dividedBy(numRepaymentsRemaining)

    const scheduledRepayments: ScheduledRepayment[] = []
    let expectedRepaymentTimestamp = this.creditLine.termEndTime
    let workingRemainingInterest = expectedRemainingInterest
    for (let i = 0, ii = numRepaymentsRemaining.toNumber(); i < ii; i++) {
      scheduledRepayments.push({
        timestamp: expectedRepaymentTimestamp.toNumber(),
        usdcAmount: expectedRepaymentPerPeriod,
      })

      expectedRepaymentTimestamp = expectedRepaymentTimestamp.minus(secondsPerPaymentPeriod)
      workingRemainingInterest = workingRemainingInterest.minus(expectedRepaymentPerPeriod)
    }

    if (
      !(
        workingRemainingInterest.gte(0) &&
        workingRemainingInterest.lt(new BigNumber(1).dividedBy(USDC_DECIMALS.toString()))
      )
    ) {
      throw new Error("Failed to fully account for expected remaining interest.")
    }
    // TODO[PR] Seems desirable also to sanity-check the first expected repayment's timestamp against
    // the credit line's `nextDueTime`.

    scheduledRepayments.reverse()

    return scheduledRepayments
  }

  get isFull(): boolean {
    return this.remainingCapacity().isZero()
  }

  /**
   * The name to use for display / UI purposes.
   */
  get displayName(): string {
    return this.metadata?.name ?? croppedAddress(this.address)
  }
}

class TranchedPoolBacker {
  address: string
  tranchedPool: TranchedPool
  goldfinchProtocol: GoldfinchProtocol

  principalAmount!: BigNumber
  principalRedeemed!: BigNumber
  interestRedeemed!: BigNumber
  principalRedeemable!: BigNumber
  interestRedeemable!: BigNumber
  balance!: BigNumber
  principalAtRisk!: BigNumber
  balanceInDollars!: BigNumber
  availableToWithdraw!: BigNumber
  availableToWithdrawInDollars!: BigNumber
  unrealizedGainsInDollars!: BigNumber
  tokenInfos!: TokenInfo[]

  constructor(address: string, tranchedPool: TranchedPool, goldfinchProtocol: GoldfinchProtocol) {
    this.address = address
    this.tranchedPool = tranchedPool
    this.goldfinchProtocol = goldfinchProtocol
  }

  async initialize(currentBlock: BlockInfo) {
    let events: KnownEventData<typeof DEPOSIT_MADE_EVENT>[] = []
    if (this.address) {
      events = await this.goldfinchProtocol.queryEvents(
        this.tranchedPool.contract.readOnly,
        [DEPOSIT_MADE_EVENT],
        {
          owner: this.address,
        },
        currentBlock.number
      )
    }

    let tokenIds = events.map((e) => e.returnValues.tokenId)
    let poolTokens = this.goldfinchProtocol.getContract<IPoolTokens>("PoolTokens")
    this.tokenInfos = await Promise.all(
      tokenIds.map((tokenId) => {
        return poolTokens.readOnly.methods
          .getTokenInfo(tokenId)
          .call(undefined, currentBlock.number)
          .then((res) => tokenInfo(tokenId, res))
      })
    )

    let zero = new BigNumber(0)
    this.principalAmount = BigNumber.sum.apply(null, this.tokenInfos.map((t) => t.principalAmount).concat(zero))
    this.principalRedeemed = BigNumber.sum.apply(null, this.tokenInfos.map((t) => t.principalRedeemed).concat(zero))
    this.interestRedeemed = BigNumber.sum.apply(null, this.tokenInfos.map((t) => t.interestRedeemed).concat(zero))

    let availableToWithdrawAmounts = await Promise.all(
      tokenIds.map((tokenId) =>
        this.tranchedPool.contract.readOnly.methods.availableToWithdraw(tokenId).call(undefined, currentBlock.number)
      )
    )
    this.tokenInfos.forEach((tokenInfo, i) => {
      tokenInfo.interestRedeemable = new BigNumber(availableToWithdrawAmounts[i]!.interestRedeemable)
      tokenInfo.principalRedeemable = new BigNumber(availableToWithdrawAmounts[i]!.principalRedeemable)
    })
    this.interestRedeemable = BigNumber.sum.apply(null, this.tokenInfos.map((t) => t.interestRedeemable).concat(zero))
    this.principalRedeemable = BigNumber.sum.apply(null, this.tokenInfos.map((t) => t.principalRedeemable).concat(zero))

    const unusedPrincipal = this.principalRedeemed.plus(this.principalRedeemable)
    this.principalAtRisk = this.principalAmount.minus(unusedPrincipal)
    this.balance = this.principalAmount.minus(this.principalRedeemed).plus(this.interestRedeemable)
    this.balanceInDollars = new BigNumber(roundDownPenny(usdcFromAtomic(this.balance)))
    this.availableToWithdraw = this.interestRedeemable.plus(this.principalRedeemable)
    this.availableToWithdrawInDollars = new BigNumber(usdcFromAtomic(this.availableToWithdraw))
    this.unrealizedGainsInDollars = new BigNumber(roundDownPenny(usdcFromAtomic(this.interestRedeemable)))
  }
}

export interface TokenInfo {
  id: string
  pool: string
  tranche: BigNumber
  principalAmount: BigNumber
  principalRedeemed: BigNumber
  interestRedeemed: BigNumber
  principalRedeemable: BigNumber
  interestRedeemable: BigNumber
}

function tokenInfo(tokenId: string, tuple: any): TokenInfo {
  return {
    id: tokenId,
    pool: tuple[0],
    tranche: new BigNumber(tuple[1]),
    principalAmount: new BigNumber(tuple[2]),
    principalRedeemed: new BigNumber(tuple[3]),
    interestRedeemed: new BigNumber(tuple[4]),
    principalRedeemable: new BigNumber(0), // Set later
    interestRedeemable: new BigNumber(0), // Set later
  }
}

export {getMetadataStore, TranchedPool, TranchedPoolBacker, PoolState, TRANCHES}
