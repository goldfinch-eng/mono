import {Fidu as FiduContract} from "@goldfinch-eng/protocol/typechain/web3/Fidu"
import {Pool as PoolContract} from "@goldfinch-eng/protocol/typechain/web3/Pool"
import {SeniorPool as SeniorPoolContract} from "@goldfinch-eng/protocol/typechain/web3/SeniorPool"
import {StakingRewards as StakingRewardsContract} from "@goldfinch-eng/protocol/typechain/web3/StakingRewards"
import {TranchedPool} from "@goldfinch-eng/protocol/typechain/web3/TranchedPool"
import {assertUnreachable, genExhaustiveTuple} from "@goldfinch-eng/utils/src/type"
import BigNumber from "bignumber.js"
import _ from "lodash"
import {BlockNumber} from "web3-core"
import {Contract, EventData, Filter} from "web3-eth-contract"
import {Loadable, Loaded, WithLoadedInfo} from "../types/loadable"
import {assertBigNumber, BlockInfo, defaultSum, displayNumber, roundDownPenny} from "../utils"
import {buildCreditLineReadOnly} from "./creditLine"
import {Tickers, usdcFromAtomic} from "./erc20"
import {
  DRAWDOWN_MADE_EVENT,
  INTEREST_COLLECTED_EVENT,
  KnownEventData,
  KnownEventName,
  PoolEventType,
  POOL_EVENT_TYPES,
  PRINCIPAL_COLLECTED_EVENT,
  PRINCIPAL_WRITTEN_DOWN_EVENT,
  RESERVE_FUNDS_COLLECTED_EVENT,
  StakingRewardsEventType,
  WITHDRAWAL_MADE_EVENT,
} from "../types/events"
import {fiduFromAtomic, fiduInDollars, fiduToDollarsAtomic, FIDU_DECIMALS} from "./fidu"
import {gfiInDollars, GFILoaded, gfiToDollarsAtomic, GFI_DECIMALS, gfiFromAtomic} from "./gfi"
import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {getMetadataStore} from "./tranchedPool"
import {
  AmountWithUnits,
  INTEREST_COLLECTED_TX_NAME,
  PRINCIPAL_COLLECTED_TX_NAME,
  RESERVE_FUNDS_COLLECTED_TX_NAME,
  HistoricalTx,
  TxName,
} from "../types/transactions"
import {UserLoaded, UserStakingRewardsLoaded} from "./user"
import {fetchDataFromAttributes, getPoolEvents, INTEREST_DECIMALS, ONE_YEAR_SECONDS, USDC_DECIMALS} from "./utils"
import {getBalanceAsOf, getPoolEventAmount, mapEventsToTx} from "./events"
import {Web3IO} from "../types/web3"

class Pool {
  goldfinchProtocol: GoldfinchProtocol
  contract: Web3IO<PoolContract>
  chain: string
  address: string

  constructor(goldfinchProtocol: GoldfinchProtocol) {
    this.goldfinchProtocol = goldfinchProtocol
    this.contract = goldfinchProtocol.getContract<PoolContract>("Pool")
    this.address = goldfinchProtocol.getAddress("Pool")
    this.chain = goldfinchProtocol.networkId
  }
}

type SeniorPoolLoadedInfo = {
  currentBlock: BlockInfo
  poolData: PoolData
  isPaused: boolean
}

class SeniorPool {
  goldfinchProtocol: GoldfinchProtocol
  contract: Web3IO<SeniorPoolContract>
  usdc: Web3IO<Contract>
  fidu: Web3IO<FiduContract>
  chain: string
  address: string
  v1Pool: Pool
  info: Loadable<SeniorPoolLoadedInfo>

  constructor(goldfinchProtocol: GoldfinchProtocol) {
    this.goldfinchProtocol = goldfinchProtocol
    this.contract = goldfinchProtocol.getContract<SeniorPoolContract>("SeniorPool")
    this.address = goldfinchProtocol.getAddress("SeniorPool")
    this.usdc = goldfinchProtocol.getERC20(Tickers.USDC).contract
    this.fidu = goldfinchProtocol.getContract<FiduContract>("Fidu")
    this.chain = goldfinchProtocol.networkId
    this.v1Pool = new Pool(this.goldfinchProtocol)
    this.info = {
      loaded: false,
      value: undefined,
    }
  }

  async initialize(stakingRewards: StakingRewardsLoaded, gfi: GFILoaded, currentBlock: BlockInfo): Promise<void> {
    const poolData = await fetchPoolData(this, this.usdc, stakingRewards, gfi, currentBlock)
    const isPaused = await this.contract.readOnly.methods.paused().call(undefined, currentBlock.number)
    this.info = {
      loaded: true,
      value: {
        currentBlock,
        poolData,
        isPaused,
      },
    }
  }

  async getPoolEvents<T extends PoolEventType>(
    address: string | undefined,
    eventNames: T[],
    includeV1Pool: boolean = true,
    toBlock: BlockNumber
  ): Promise<KnownEventData<T>[]> {
    if (includeV1Pool) {
      // In migrating from v1 to v2 (i.e. from the `Pool` contract as modeling the senior pool,
      // to the `SeniorPool` contract as modeling the senior pool), we transferred contract state
      // from Pool to SeniorPool (e.g. the capital supplied by a capital provider to Pool
      // became capital supplied by that provider to SeniorPool). But we did not do any sort of
      // migrating (e.g. re-emitting) with respect to events, from the Pool contract onto the
      // SeniorPool contract. So fully representing the SeniorPool's events here -- e.g. to be
      // able to accurately count all of a capital provider's supplier capital -- entails querying
      // for those events on both the SeniorPool and Pool contracts.

      const events = await Promise.all([
        getPoolEvents(this, address, eventNames, toBlock),
        getPoolEvents(this.v1Pool, address, eventNames, toBlock),
      ])
      const combined = _.flatten(events)
      return combined
    } else {
      return getPoolEvents(this, address, eventNames, toBlock)
    }
  }
}

export type SeniorPoolLoaded = WithLoadedInfo<SeniorPool, SeniorPoolLoadedInfo>

interface CapitalProvider {
  currentBlock: BlockInfo
  sharePrice: BigNumber
  gfiPrice: BigNumber | undefined
  shares: {
    parts: {
      notStaked: BigNumber
      stakedUnlocked: BigNumber
      stakedLocked: BigNumber
    }
    aggregates: {
      staked: BigNumber
      withdrawable: BigNumber
      total: BigNumber
    }
  }
  stakedSeniorPoolBalanceInDollars: BigNumber
  totalSeniorPoolBalanceInDollars: BigNumber
  availableToStakeInDollars: BigNumber
  availableToWithdraw: BigNumber
  availableToWithdrawInDollars: BigNumber
  unstakeablePositions: StakingRewardsPosition[]
  rewardsInfo: CapitalProviderStakingRewardsInfo
  address: string
  allowance: BigNumber
  weightedAverageSharePrice: BigNumber
  unrealizedGains: BigNumber
  unrealizedGainsInDollars: BigNumber
  unrealizedGainsPercentage: BigNumber
}

type CapitalProviderStakingRewardsInfo =
  | {
      hasUnvested: true
      unvested: BigNumber
      unvestedInDollars: BigNumber | undefined
      lastVestingEndTime: number
    }
  | {
      hasUnvested: false
      unvested: null
      unvestedInDollars: null | undefined
      lastVestingEndTime: null
    }

type CapitalProviderStakingInfo = {
  gfiPrice: BigNumber | undefined
  shares: {
    locked: BigNumber
    unlocked: BigNumber
  }
  unstakeablePositions: StakingRewardsPosition[]
  rewards: CapitalProviderStakingRewardsInfo
}

function getCapitalProviderStakingInfo(
  userStakingRewards: UserStakingRewardsLoaded,
  gfi: GFILoaded
): CapitalProviderStakingInfo {
  const gfiPrice = gfi.info.value.price
  const lockedPositions = userStakingRewards.lockedPositions
  const unlockedPositions = userStakingRewards.unlockedPositions

  let rewards: CapitalProviderStakingRewardsInfo
  const unvested = userStakingRewards.info.value.unvested
  if (unvested.gt(0)) {
    rewards = {
      hasUnvested: true,
      unvested,
      unvestedInDollars: gfiInDollars(gfiToDollarsAtomic(unvested, gfiPrice)),
      lastVestingEndTime: userStakingRewards.unvestedRewardsPositions.reduce(
        (acc, curr) => (curr.storedPosition.rewards.endTime > acc ? curr.storedPosition.rewards.endTime : acc),
        0
      ),
    }
  } else {
    rewards = {
      hasUnvested: false,
      unvested: null,
      unvestedInDollars: undefined,
      lastVestingEndTime: null,
    }
  }

  return {
    gfiPrice,
    shares: {
      locked: defaultSum(lockedPositions.map((val) => val.storedPosition.amount)),
      unlocked: defaultSum(unlockedPositions.map((val) => val.storedPosition.amount)),
    },
    // Any position that is not locked can be unstaked.
    unstakeablePositions: unlockedPositions,
    rewards,
  }
}

async function fetchCapitalProviderData(
  pool: SeniorPoolLoaded,
  stakingRewards: StakingRewardsLoaded,
  gfi: GFILoaded,
  user: UserLoaded
): Promise<Loaded<CapitalProvider>> {
  const currentBlock = pool.info.value.currentBlock

  const attributes = [{method: "sharePrice"}]
  const {sharePrice} = await fetchDataFromAttributes(pool.contract.readOnly, attributes, {
    bigNumber: true,
    blockNumber: currentBlock.number,
  })
  assertBigNumber(sharePrice)

  const numSharesNotStaked = new BigNumber(
    await pool.fidu.readOnly.methods.balanceOf(user.address).call(undefined, currentBlock.number)
  )
  const stakingInfo = getCapitalProviderStakingInfo(user.info.value.stakingRewards, gfi)
  const numSharesStakedLocked = stakingInfo.shares.locked
  const numSharesStakedUnlocked = stakingInfo.shares.unlocked

  const numSharesStaked = numSharesStakedLocked.plus(numSharesStakedUnlocked)
  const numSharesWithdrawable = numSharesNotStaked.plus(numSharesStakedUnlocked)
  const numSharesTotal = numSharesNotStaked.plus(numSharesStakedLocked).plus(numSharesStakedUnlocked)

  const stakedSeniorPoolBalance = fiduToDollarsAtomic(numSharesStaked, sharePrice)
  const stakedSeniorPoolBalanceInDollars = fiduInDollars(stakedSeniorPoolBalance)

  const totalSeniorPoolBalance = fiduToDollarsAtomic(numSharesTotal, sharePrice)
  const totalSeniorPoolBalanceInDollars = fiduInDollars(totalSeniorPoolBalance)

  const availableToStake = fiduToDollarsAtomic(numSharesNotStaked, sharePrice)
  const availableToStakeInDollars = fiduInDollars(availableToStake)

  const availableToWithdraw = fiduToDollarsAtomic(numSharesWithdrawable, sharePrice)
  const availableToWithdrawInDollars = fiduInDollars(availableToWithdraw)

  const address = user.address
  const allowance = new BigNumber(
    await pool.usdc.readOnly.methods.allowance(address, pool.address).call(undefined, currentBlock.number)
  )
  const weightedAverageSharePrice = await getWeightedAverageSharePrice(
    pool,
    stakingRewards,
    address,
    numSharesTotal,
    currentBlock
  )
  const sharePriceDelta = sharePrice.dividedBy(FIDU_DECIMALS).minus(weightedAverageSharePrice)
  const unrealizedGains = sharePriceDelta.multipliedBy(numSharesTotal)
  const unrealizedGainsInDollars = new BigNumber(roundDownPenny(unrealizedGains.div(FIDU_DECIMALS)))
  const unrealizedGainsPercentage = sharePriceDelta.dividedBy(weightedAverageSharePrice)

  return {
    loaded: true,
    value: {
      currentBlock,
      sharePrice,
      gfiPrice: stakingInfo.gfiPrice,
      shares: {
        parts: {
          notStaked: numSharesNotStaked,
          stakedUnlocked: numSharesStakedUnlocked,
          stakedLocked: numSharesStakedLocked,
        },
        aggregates: {
          staked: numSharesStaked,
          withdrawable: numSharesWithdrawable,
          total: numSharesTotal,
        },
      },
      stakedSeniorPoolBalanceInDollars,
      totalSeniorPoolBalanceInDollars,
      availableToStakeInDollars,
      availableToWithdraw,
      availableToWithdrawInDollars,
      unstakeablePositions: stakingInfo.unstakeablePositions,
      rewardsInfo: stakingInfo.rewards,
      address,
      allowance,
      weightedAverageSharePrice,
      unrealizedGains,
      unrealizedGainsInDollars,
      unrealizedGainsPercentage,
    },
  }
}

type PoolData = {
  rawBalance: BigNumber
  compoundBalance: BigNumber
  balance: BigNumber
  totalShares: BigNumber
  totalPoolAssets: BigNumber
  totalLoansOutstanding: BigNumber
  cumulativeWritedowns: BigNumber
  cumulativeDrawdowns: BigNumber
  estimatedTotalInterest: BigNumber
  estimatedApy: BigNumber
  estimatedApyFromGfi: BigNumber | undefined
  defaultRate: BigNumber
  poolEvents: KnownEventData<PoolEventType>[]
  assetsAsOf: typeof assetsAsOf
  getRepaymentEvents: typeof getRepaymentEvents
  remainingCapacity: typeof remainingCapacity
}

async function fetchPoolData(
  pool: SeniorPool,
  erc20: Web3IO<Contract>,
  stakingRewards: StakingRewardsLoaded,
  gfi: GFILoaded,
  currentBlock: BlockInfo
): Promise<PoolData> {
  const attributes = [{method: "sharePrice"}, {method: "compoundBalance"}]
  let {sharePrice, compoundBalance: _compoundBalance} = await fetchDataFromAttributes(
    pool.contract.readOnly,
    attributes,
    {
      blockNumber: currentBlock.number,
    }
  )
  let rawBalance = new BigNumber(
    await erc20.readOnly.methods.balanceOf(pool.address).call(undefined, currentBlock.number)
  )
  let compoundBalance = new BigNumber(_compoundBalance)
  let balance = compoundBalance.plus(rawBalance)
  let totalShares = new BigNumber(await pool.fidu.readOnly.methods.totalSupply().call(undefined, currentBlock.number))

  // Do some slightly goofy multiplication and division here so that we have consistent units across
  // 'balance', 'totalPoolBalance', and 'totalLoansOutstanding', allowing us to do arithmetic between them
  // and display them using the same helpers.
  const totalPoolAssetsInDollars = totalShares
    .div(FIDU_DECIMALS.toString())
    .multipliedBy(new BigNumber(sharePrice))
    .div(FIDU_DECIMALS.toString())
  let totalPoolAssets = totalPoolAssetsInDollars.multipliedBy(USDC_DECIMALS.toString())
  let totalLoansOutstanding = new BigNumber(
    await pool.contract.readOnly.methods.totalLoansOutstanding().call(undefined, currentBlock.number)
  )
  let cumulativeWritedowns = await getCumulativeWritedowns(pool, currentBlock)
  let cumulativeDrawdowns = await getCumulativeDrawdowns(pool, currentBlock)
  let poolEvents = await getAllPoolEvents(pool, currentBlock)
  let estimatedTotalInterest = await getEstimatedTotalInterest(pool, currentBlock)
  let estimatedApy = estimatedTotalInterest.dividedBy(totalPoolAssets)
  const currentEarnRatePerYear = stakingRewards.info.value.currentEarnRate.multipliedBy(ONE_YEAR_SECONDS)
  const estimatedApyFromGfi = gfiToDollarsAtomic(currentEarnRatePerYear, gfi.info.value.price)
    ?.multipliedBy(
      // This might be better thought of as the share-price mantissa, which happens to be the
      // same as `FIDU_DECIMALS`.
      FIDU_DECIMALS
    )
    .dividedBy(
      // This might be better thought of as the GFI-price mantissa, which happens to be the
      // same as `GFI_DECIMALS`.
      GFI_DECIMALS
    )
    .dividedBy(sharePrice)
  let defaultRate = cumulativeWritedowns.dividedBy(cumulativeDrawdowns)

  return {
    rawBalance,
    compoundBalance,
    balance,
    totalShares,
    totalPoolAssets,
    totalLoansOutstanding,
    cumulativeWritedowns,
    cumulativeDrawdowns,
    poolEvents,
    assetsAsOf,
    getRepaymentEvents,
    remainingCapacity,
    estimatedTotalInterest,
    estimatedApy,
    estimatedApyFromGfi,
    defaultRate,
  }
}

async function getDepositEventsByCapitalProvider(
  pool: SeniorPoolLoaded,
  stakingRewards: StakingRewardsLoaded,
  capitalProviderAddress: string,
  currentBlock: BlockInfo
): Promise<EventData[]> {
  const depositMadeEventsByCapitalProvider: EventData[] = await pool.getPoolEvents(
    capitalProviderAddress,
    ["DepositMade"],
    true,
    currentBlock.number
  )
  const depositedAndStakedEventsByCapitalProvider: EventData[] = await stakingRewards.getEvents(
    capitalProviderAddress,
    ["DepositedAndStaked"],
    undefined,
    currentBlock.number
  )
  return depositMadeEventsByCapitalProvider.concat(depositedAndStakedEventsByCapitalProvider)
}

// This uses the FIFO method of calculating cost-basis. Thus we
// add up the deposits *in reverse* to arrive at your current number of shares.
// We calculate the weighted average price based on that, which can then be used
// to calculate unrealized gains.
// NOTE: This does not take into account transfers of Fidu that happen outside
// the protocol. In such a case, you would necessarily end up with more Fidu (in
// the case of net inbound transfers; or less Fidu, in the case of net outbound transfers)
// than we have records of your deposits, so we would not be able to account
// for your shares, and we would fail out, and return a "-" on the front-end.
// NOTE: This also does not take into account realized gains, which we are also
// punting on.
const _getWeightedAverageSharePrice = async (
  pool: SeniorPoolLoaded,
  stakingRewards: StakingRewardsLoaded,
  capitalProviderAddress: string,
  capitalProviderTotalShares: BigNumber,
  currentBlock: BlockInfo
) => {
  const events = await getDepositEventsByCapitalProvider(pool, stakingRewards, capitalProviderAddress, currentBlock)
  const sorted = _.reverse(_.sortBy(events, ["blockNumber", "transactionIndex"]))
  const prepared = sorted.map((eventData) => {
    switch (eventData.event) {
      case "DepositMade":
        return {
          amount: eventData.returnValues.amount,
          shares: eventData.returnValues.shares,
        }
      case "DepositedAndStaked":
        return {
          amount: eventData.returnValues.depositedAmount,
          shares: eventData.returnValues.amount,
        }
      default:
        throw new Error(`Unexpected event name: ${eventData.event}`)
    }
  })

  let zero = new BigNumber(0)
  let sharesLeftToAccountFor = capitalProviderTotalShares
  let totalAmountPaid = zero
  prepared.forEach((info) => {
    if (sharesLeftToAccountFor.lte(zero)) {
      return
    }
    const sharePrice = new BigNumber(info.amount)
      .dividedBy(USDC_DECIMALS.toString())
      .dividedBy(new BigNumber(info.shares).dividedBy(FIDU_DECIMALS.toString()))
    const sharesToAccountFor = BigNumber.min(sharesLeftToAccountFor, new BigNumber(info.shares))
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
    return totalAmountPaid.dividedBy(capitalProviderTotalShares)
  }
}
export let getWeightedAverageSharePrice = _getWeightedAverageSharePrice

async function getCumulativeWritedowns(pool: SeniorPool, currentBlock: BlockInfo) {
  // In theory, we'd also want to include `PrincipalWrittendown` events emitted by `pool.v1Pool` here.
  // But in practice, we don't need to, because only one such was emitted, due to a bug which was
  // then fixed. So we include only `PrincipalWrittenDown` events emitted by `pool`.

  const events = await pool.goldfinchProtocol.queryEvents(
    pool.contract.readOnly,
    [PRINCIPAL_WRITTEN_DOWN_EVENT],
    undefined,
    currentBlock.number
  )
  const sum: BigNumber = defaultSum(events.map((eventData) => new BigNumber(eventData.returnValues.amount)))
  return sum.negated()
}

async function getCumulativeDrawdowns(pool: SeniorPool, currentBlock: BlockInfo) {
  const protocol = pool.goldfinchProtocol
  const tranchedPoolAddresses = await getTranchedPoolAddressesForSeniorPoolCalc(pool, currentBlock)
  const tranchedPools = tranchedPoolAddresses.map((address) =>
    protocol.getContract<TranchedPool>("TranchedPool", address)
  )
  let allDrawdownEvents = _.flatten(
    await Promise.all(
      tranchedPools.map((pool) =>
        protocol.queryEvents(pool.readOnly, [DRAWDOWN_MADE_EVENT], undefined, currentBlock.number)
      )
    )
  )
  const sum: BigNumber = defaultSum(allDrawdownEvents.map((eventData) => new BigNumber(eventData.returnValues.amount)))
  return sum
}

type RepaymentEventType =
  | typeof INTEREST_COLLECTED_EVENT
  | typeof PRINCIPAL_COLLECTED_EVENT
  | typeof RESERVE_FUNDS_COLLECTED_EVENT
const REPAYMENT_EVENT_TYPES = genExhaustiveTuple<RepaymentEventType>()(
  INTEREST_COLLECTED_EVENT,
  PRINCIPAL_COLLECTED_EVENT,
  RESERVE_FUNDS_COLLECTED_EVENT
)

export type CombinedRepaymentTx = {
  type: "CombinedRepayment"
  name: "CombinedRepayment"
  amount: string
  amountBN: BigNumber
  interestAmountBN: BigNumber
} & Omit<HistoricalTx<KnownEventName>, "type" | "name" | "amount">

const parseRepaymentEventName = (eventData: KnownEventData<RepaymentEventType>): TxName => {
  switch (eventData.event) {
    case INTEREST_COLLECTED_EVENT:
      return INTEREST_COLLECTED_TX_NAME
    case PRINCIPAL_COLLECTED_EVENT:
      return PRINCIPAL_COLLECTED_TX_NAME
    case RESERVE_FUNDS_COLLECTED_EVENT:
      return RESERVE_FUNDS_COLLECTED_TX_NAME
    default:
      return assertUnreachable(eventData.event)
  }
}
const parseOldPoolRepaymentEventAmount = (eventData: KnownEventData<RepaymentEventType>): AmountWithUnits => {
  switch (eventData.event) {
    case INTEREST_COLLECTED_EVENT:
      return {
        amount: eventData.returnValues.poolAmount,
        units: "usdc",
      }
    case PRINCIPAL_COLLECTED_EVENT:
    case RESERVE_FUNDS_COLLECTED_EVENT: {
      return {
        amount: eventData.returnValues.amount,
        units: "usdc",
      }
    }
    default:
      return assertUnreachable(eventData.event)
  }
}
const parsePoolRepaymentEventAmount = (eventData: KnownEventData<RepaymentEventType>): AmountWithUnits => {
  switch (eventData.event) {
    case INTEREST_COLLECTED_EVENT:
    case PRINCIPAL_COLLECTED_EVENT:
    case RESERVE_FUNDS_COLLECTED_EVENT: {
      return {
        amount: eventData.returnValues.amount,
        units: "usdc",
      }
    }
    default:
      return assertUnreachable(eventData.event)
  }
}

async function getRepaymentEvents(
  pool: SeniorPoolLoaded,
  goldfinchProtocol: GoldfinchProtocol,
  currentBlock: BlockInfo
): Promise<CombinedRepaymentTx[]> {
  const events = await goldfinchProtocol.queryEvents(
    pool.contract.readOnly,
    REPAYMENT_EVENT_TYPES,
    undefined,
    currentBlock.number
  )
  const oldEvents = await goldfinchProtocol.queryEvents("Pool", REPAYMENT_EVENT_TYPES, undefined, currentBlock.number)
  const [eventTxs, oldEventTxs] = await Promise.all([
    mapEventsToTx<RepaymentEventType>(events, REPAYMENT_EVENT_TYPES, {
      parseName: parseRepaymentEventName,
      parseAmount: parsePoolRepaymentEventAmount,
    }),
    mapEventsToTx<RepaymentEventType>(oldEvents, REPAYMENT_EVENT_TYPES, {
      parseName: parseRepaymentEventName,
      parseAmount: parseOldPoolRepaymentEventAmount,
    }),
  ])
  const combined = _.map(_.groupBy(eventTxs.concat(oldEventTxs), "id"), (val): CombinedRepaymentTx | null => {
    const interestPayment = _.find(val, (event) => event.type === "InterestCollected")
    const principalPayment = _.find(val, (event) => event.type === "PrincipalCollected")
    const reserveCollection = _.find(val, (event) => event.type === "ReserveFundsCollected")
    if (!interestPayment) {
      // This usually  means it's just ReserveFundsCollected, from a withdraw, and not a repayment
      return null
    }
    const amountBN = interestPayment.amount.atomic
      .plus(principalPayment ? principalPayment.amount.atomic : new BigNumber(0))
      .plus(reserveCollection ? reserveCollection.amount.atomic : new BigNumber(0))
    const combined: CombinedRepaymentTx = {
      ...interestPayment,
      ...principalPayment,
      ...reserveCollection,
      amountBN,
      amount: usdcFromAtomic(amountBN),
      interestAmountBN: interestPayment.amount.atomic,
      type: "CombinedRepayment",
      name: "CombinedRepayment",
    }

    return combined
  })
  return _.compact(combined)
}

async function getAllPoolEvents(pool: SeniorPool, currentBlock: BlockInfo): Promise<KnownEventData<PoolEventType>[]> {
  const poolEvents = await pool.getPoolEvents(undefined, POOL_EVENT_TYPES, true, currentBlock.number)
  return poolEvents
}

function assetsAsOf(this: PoolData, blockNumExclusive: number): BigNumber {
  return getBalanceAsOf(this.poolEvents, blockNumExclusive, WITHDRAWAL_MADE_EVENT, getPoolEventAmount)
}

/**
 * Returns the remaining capacity in the pool, assuming a max capacity of `maxPoolCapacity`,
 * in atomic units.
 *
 * @param maxPoolCapacity - Maximum capacity of the pool
 * @returns Remaining capacity of pool in atomic units
 */
export function remainingCapacity(this: PoolData, maxPoolCapacity: BigNumber): BigNumber {
  let cappedBalance = BigNumber.min(this.totalPoolAssets, maxPoolCapacity)
  return new BigNumber(maxPoolCapacity).minus(cappedBalance)
}

/**
 * Returns the amount of interest that the senior pool will accrue from tranched pools
 */
async function getEstimatedTotalInterest(pool: SeniorPool, currentBlock: BlockInfo): Promise<BigNumber> {
  const protocol = pool.goldfinchProtocol
  const tranchedPoolAddresses = await getTranchedPoolAddressesForSeniorPoolCalc(pool, currentBlock)
  const tranchedPools = tranchedPoolAddresses.map((address) =>
    protocol.getContract<TranchedPool>("TranchedPool", address)
  )
  const poolMetadata = await getMetadataStore(pool.chain)
  const protocolFee = new BigNumber("0.1")

  const getEstimatedInterestForPool = async (pool: Web3IO<TranchedPool>) => {
    const creditLineAddress = await pool.readOnly.methods.creditLine().call(undefined, currentBlock.number)
    const creditLine = await buildCreditLineReadOnly(creditLineAddress)

    const balance = new BigNumber(await creditLine.methods.balance().call(undefined, currentBlock.number))
    const interestApr = new BigNumber(
      await creditLine.methods.interestApr().call(undefined, currentBlock.number)
    ).dividedBy(INTEREST_DECIMALS.toString())
    const juniorFeePercentage = new BigNumber(
      await pool.readOnly.methods.juniorFeePercent().call(undefined, currentBlock.number)
    ).dividedBy("100")

    const address = pool.readOnly.options.address.toLowerCase()
    const isV1Pool = poolMetadata[address]?.v1StyleDeal === true
    const seniorPoolPercentageOfInterest = new BigNumber("1")
      // dont include the junior fee percentage in v1 pools
      .minus(isV1Pool ? new BigNumber("0") : juniorFeePercentage)
      .minus(protocolFee)

    return balance.multipliedBy(interestApr).multipliedBy(seniorPoolPercentageOfInterest)
  }

  const estimatedInterestPerPool = await Promise.all(tranchedPools.map((x) => getEstimatedInterestForPool(x)))

  return BigNumber.sum.apply(null, estimatedInterestPerPool)
}

/**
 * Helper that provides the addresses of the comprehensive set of tranched pools to compute
 * over when performing a calculation relating to the senior pool.
 *
 * @param pool - The senior pool.
 * @returns The set of tranched pool addresses.
 */
async function getTranchedPoolAddressesForSeniorPoolCalc(pool: SeniorPool, currentBlock: BlockInfo): Promise<string[]> {
  const protocol = pool.goldfinchProtocol
  const [metadataStore, investmentEvents] = await Promise.all([
    getMetadataStore(protocol.networkId),
    protocol.queryEvents(
      pool.contract.readOnly,
      ["InvestmentMadeInSenior", "InvestmentMadeInJunior"],
      undefined,
      currentBlock.number
    ),
  ])
  // In migrating to v2, we did not emit InvestmentMadeInJunior events for the tranched pools that we
  // migrated from v1 (we just minted them position tokens directly). So we need to supplement how we
  // identify the tranched pools to use in doing a calculation for the senior pool, by explicitly
  // including those that were migrated.
  const migratedTranchedPoolAddresses: string[] = Object.keys(metadataStore).filter(
    (address: string) => metadataStore[address]?.migrated
  )
  const eventsTranchedPoolAddresses: string[] = investmentEvents.map((e) => e.returnValues.tranchedPool)
  // De-duplicate the tranched pool addresses, in case investment events have subsequently been emitted
  // relating to tranched pools that were migrated, or in case there has been more than one investment
  // event for a tranched pool.
  const tranchedPoolAddresses = _.uniq(migratedTranchedPoolAddresses.concat(eventsTranchedPoolAddresses))
  return tranchedPoolAddresses
}

interface StakingRewardsVesting {
  totalUnvested: BigNumber
  totalVested: BigNumber
  totalPreviouslyVested: BigNumber
  totalClaimed: BigNumber
  startTime: number
  endTime: number
}

class StakingRewardsPosition {
  tokenId: string
  stakedEvent: EventData
  currentEarnRate: BigNumber
  storedPosition: StoredPosition
  optimisticIncrement: PositionOptimisticIncrement

  constructor(
    tokenId: string,
    stakedEvent: EventData,
    currentEarnRate: BigNumber,
    storedPosition: StoredPosition,
    optimisticIncrement: PositionOptimisticIncrement
  ) {
    this.tokenId = tokenId
    this.stakedEvent = stakedEvent
    this.currentEarnRate = currentEarnRate
    this.storedPosition = storedPosition
    this.optimisticIncrement = optimisticIncrement
  }

  get title(): string {
    const origStakedAmount = new Intl.NumberFormat(undefined, {
      notation: "compact",
      compactDisplay: "short",
    }).format(Number(fiduFromAtomic(this.stakedEvent.returnValues.amount)))

    return `Staked ${origStakedAmount} FIDU`
  }

  get description(): string {
    const date = new Date(this.storedPosition.rewards.startTime * 1000).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    const origStakedAmount = fiduFromAtomic(this.stakedEvent.returnValues.amount)
    const remainingAmount = fiduFromAtomic(this.storedPosition.amount)
    return `Staked ${displayNumber(origStakedAmount, 2)} FIDU on ${date}${
      origStakedAmount === remainingAmount ? "" : ` (${displayNumber(remainingAmount, 2)} FIDU remaining)`
    }`
  }

  get shortDescription(): string {
    const transactionDate = new Date(this.storedPosition.rewards.startTime * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    return `${displayNumber(gfiFromAtomic(this.granted))} GFI to date • ${transactionDate}`
  }

  get granted(): BigNumber {
    return this.storedPosition.rewards.totalUnvested
      .plus(this.storedPosition.rewards.totalVested)
      .plus(this.optimisticIncrement.unvested)
      .plus(this.optimisticIncrement.vested)
      .plus(this.storedPosition.rewards.totalPreviouslyVested)
  }

  get vested(): BigNumber {
    return this.storedPosition.rewards.totalVested
      .plus(this.optimisticIncrement.vested)
      .plus(this.storedPosition.rewards.totalPreviouslyVested)
  }

  get unvested(): BigNumber {
    return this.granted.minus(this.vested)
  }

  get claimed(): BigNumber {
    return this.storedPosition.rewards.totalClaimed
  }

  get claimable(): BigNumber {
    return this.vested.minus(this.claimed)
  }

  getLocked(currentBlock: BlockInfo): boolean {
    return this.storedPosition.lockedUntil > currentBlock.timestamp
  }
}

export type StoredPosition = {
  amount: BigNumber
  rewards: StakingRewardsVesting
  leverageMultiplier: BigNumber
  lockedUntil: number
}

type PositionOptimisticIncrement = {
  vested: BigNumber
  unvested: BigNumber
}

type StakingRewardsLoadedInfo = {
  currentBlock: BlockInfo
  isPaused: boolean
  currentEarnRate: BigNumber
}

export type StakingRewardsLoaded = WithLoadedInfo<StakingRewards, StakingRewardsLoadedInfo>

class StakingRewards {
  goldfinchProtocol: GoldfinchProtocol
  contract: Web3IO<StakingRewardsContract>
  address: string
  info: Loadable<StakingRewardsLoadedInfo>

  constructor(goldfinchProtocol: GoldfinchProtocol) {
    this.goldfinchProtocol = goldfinchProtocol
    this.contract = goldfinchProtocol.getContract<StakingRewardsContract>("StakingRewards")
    this.address = goldfinchProtocol.getAddress("StakingRewards")
    this.info = {
      loaded: false,
      value: undefined,
    }
  }

  async initialize(currentBlock: BlockInfo): Promise<void> {
    const [isPaused, currentEarnRate] = await Promise.all([
      this.contract.readOnly.methods.paused().call(undefined, currentBlock.number),
      this.contract.readOnly.methods
        .currentEarnRatePerToken()
        .call(undefined, currentBlock.number)
        .then((currentEarnRate: string) => new BigNumber(currentEarnRate)),
    ])

    this.info = {
      loaded: true,
      value: {
        currentBlock,
        isPaused,
        currentEarnRate,
      },
    }
  }

  async calculatePositionOptimisticIncrement(
    tokenId: string,
    rewards: StakingRewardsVesting,
    currentBlock: BlockInfo
  ): Promise<PositionOptimisticIncrement> {
    const earnedSinceLastCheckpoint = new BigNumber(
      await this.contract.readOnly.methods.earnedSinceLastCheckpoint(tokenId).call(undefined, currentBlock.number)
    )
    const optimisticCurrentGrant = rewards.totalUnvested.plus(rewards.totalVested).plus(earnedSinceLastCheckpoint)
    const optimisticTotalVested = new BigNumber(
      await this.contract.readOnly.methods
        .totalVestedAt(rewards.startTime, rewards.endTime, currentBlock.timestamp, optimisticCurrentGrant.toString(10))
        .call(undefined, currentBlock.number)
    )
    const optimisticTotalUnvested = optimisticCurrentGrant.minus(optimisticTotalVested)

    const optimisticVestedIncrement = optimisticTotalVested.minus(rewards.totalVested)
    const optimisticUnvestedIncrement = optimisticTotalUnvested.minus(rewards.totalUnvested)

    return {
      vested: optimisticVestedIncrement,
      unvested: optimisticUnvestedIncrement,
    }
  }

  async getEvents<T extends StakingRewardsEventType>(
    address: string,
    eventNames: T[],
    filter: Filter | undefined,
    toBlock: BlockNumber
  ): Promise<KnownEventData<T>[]> {
    const events = await this.goldfinchProtocol.queryEvents(
      this.contract.readOnly,
      eventNames,
      {
        ...(filter || {}),
        user: address,
      },
      toBlock
    )
    return events
  }
}

export function mockGetWeightedAverageSharePrice(mock: typeof getWeightedAverageSharePrice | undefined): void {
  getWeightedAverageSharePrice = mock || _getWeightedAverageSharePrice
}

export {fetchCapitalProviderData, fetchPoolData, SeniorPool, Pool, StakingRewards, StakingRewardsPosition}
export type {PoolData, CapitalProvider}
