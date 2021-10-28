import {Fidu as FiduContract} from "@goldfinch-eng/protocol/typechain/web3/Fidu"
import {Pool as PoolContract} from "@goldfinch-eng/protocol/typechain/web3/Pool"
import {SeniorPool as SeniorPoolContract} from "@goldfinch-eng/protocol/typechain/web3/SeniorPool"
import {StakingRewards as StakingRewardsContract} from "@goldfinch-eng/protocol/typechain/web3/StakingRewards"
import {TranchedPool} from "@goldfinch-eng/protocol/typechain/web3/TranchedPool"
import BigNumber from "bignumber.js"
import _ from "lodash"
import {BlockNumber} from "web3-core"
import {Contract, EventData} from "web3-eth-contract"
import {assertWithLoadedInfo, Loadable, Loaded, WithLoadedInfo} from "../types/loadable"
import {assertBigNumber, BlockInfo, displayNumber, roundDownPenny} from "../utils"
import {buildCreditLine} from "./creditLine"
import {Tickers, usdcFromAtomic} from "./erc20"
import {getBalanceAsOf, mapEventsToTx} from "./events"
import {fiduFromAtomic, fiduInDollars, fiduToDollarsAtomic, FIDU_DECIMALS} from "./fidu"
import {gfiInDollars, gfiToDollarsAtomic, GFI_DECIMALS} from "./gfi"
import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {getMetadataStore} from "./tranchedPool"
import {fetchDataFromAttributes, getPoolEvents, INTEREST_DECIMALS, USDC_DECIMALS} from "./utils"

class Pool {
  goldfinchProtocol: GoldfinchProtocol
  contract: PoolContract
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
  contract: SeniorPoolContract
  usdc: Contract
  fidu: FiduContract
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

  async initialize(currentBlock: BlockInfo): Promise<void> {
    const poolData = await fetchPoolData(this, this.usdc, currentBlock)
    const isPaused = await this.contract.methods.paused().call()
    this.info = {
      loaded: true,
      value: {
        currentBlock,
        poolData,
        isPaused,
      },
    }
  }

  async getPoolEvents(
    address: string | undefined,
    eventNames: string[] = ["DepositMade", "WithdrawalMade"],
    includeV1Pool: boolean = true,
    toBlock: BlockNumber = "latest"
  ): Promise<EventData[]> {
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
  gfiPrice: BigNumber
  shares: {
    parts: {
      notStaked: BigNumber
      stakedNotLocked: BigNumber
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
  stakingRewards: CapitalProviderStakingRewardsInfo
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
      unvestedInDollars: BigNumber
      lastVestingEndTime: number
    }
  | {
      hasUnvested: false
      unvested: null
      unvestedInDollars: null
      lastVestingEndTime: null
    }

type CapitalProviderStakingInfo = {
  gfiPrice: BigNumber
  shares: {
    locked: BigNumber
    notLocked: BigNumber
  }
  rewards: CapitalProviderStakingRewardsInfo
}

function getCapitalProviderStakingInfo(
  stakingRewards: StakingRewardsLoaded,
  currentBlock: BlockInfo
): CapitalProviderStakingInfo {
  const positions = stakingRewards.info.value.positions.map((position) => ({
    amount: new BigNumber(position.storedPosition.amount),
    locked: position.storedPosition.lockedUntil > currentBlock.timestamp,
    rewards: {
      unvested: position.unvested,
      endTime: position.storedPosition.rewards.endTime,
    },
  }))

  const sharesLockedPositions = positions.filter((val) => val.locked)
  const sharesNotLockedPositions = positions.filter((val) => !val.locked)

  const unvestedRewardsPositions = positions.filter((val) => val.rewards.endTime > currentBlock.timestamp)

  const gfiPrice = new BigNumber(1).multipliedBy(GFI_DECIMALS) // TODO[PR]

  let rewards: CapitalProviderStakingRewardsInfo
  const unvested = stakingRewards.info.value.unvested
  if (unvested.gt(0)) {
    rewards = {
      hasUnvested: true,
      unvested,
      unvestedInDollars: gfiInDollars(gfiToDollarsAtomic(unvested, gfiPrice)),
      lastVestingEndTime: unvestedRewardsPositions.reduce(
        (acc, curr) => (curr.rewards.endTime > acc ? curr.rewards.endTime : acc),
        0
      ),
    }
  } else {
    rewards = {
      hasUnvested: false,
      unvested: null,
      unvestedInDollars: null,
      lastVestingEndTime: null,
    }
  }

  return {
    gfiPrice,
    shares: {
      locked: sharesLockedPositions.length
        ? BigNumber.sum.apply(
            null,
            sharesLockedPositions.map((val) => val.amount)
          )
        : new BigNumber(0),
      notLocked: sharesNotLockedPositions.length
        ? BigNumber.sum.apply(
            null,
            sharesNotLockedPositions.map((val) => val.amount)
          )
        : new BigNumber(0),
    },
    rewards,
  }
}

async function fetchCapitalProviderData(
  pool: SeniorPoolLoaded,
  stakingRewards: StakingRewardsLoaded,
  capitalProviderAddress: string
): Promise<Loaded<CapitalProvider>> {
  if (pool.info.value.currentBlock.number !== stakingRewards.info.value.currentBlock.number) {
    throw new Error("`pool` and `stakingRewards` data are based on different blocks.")
  }
  const currentBlock = pool.info.value.currentBlock

  const attributes = [{method: "sharePrice"}]
  const {sharePrice} = await fetchDataFromAttributes(pool.contract, attributes, {
    bigNumber: true,
    blockNumber: currentBlock.number,
  })
  assertBigNumber(sharePrice)

  // TODO[PR] Could make this value a responsibility of `stakingRewards`, then `stakingRewards` would be sufficient
  // for withdrawal form.
  const numSharesNotStaked = new BigNumber(
    await pool.fidu.methods.balanceOf(capitalProviderAddress).call(undefined, currentBlock.number)
  )
  const stakingInfo = await getCapitalProviderStakingInfo(stakingRewards, currentBlock)
  const numSharesStakedLocked = stakingInfo.shares.locked
  const numSharesStakedNotLocked = stakingInfo.shares.notLocked

  const numSharesStaked = numSharesStakedLocked.plus(numSharesStakedNotLocked)
  const numSharesWithdrawable = numSharesNotStaked.plus(numSharesStakedNotLocked)
  const numSharesTotal = numSharesNotStaked.plus(numSharesStakedLocked).plus(numSharesStakedNotLocked)

  const stakedSeniorPoolBalance = fiduToDollarsAtomic(numSharesStaked, sharePrice)
  const stakedSeniorPoolBalanceInDollars = fiduInDollars(stakedSeniorPoolBalance)

  const totalSeniorPoolBalance = fiduToDollarsAtomic(numSharesTotal, sharePrice)
  const totalSeniorPoolBalanceInDollars = fiduInDollars(totalSeniorPoolBalance)

  const availableToStake = fiduToDollarsAtomic(numSharesNotStaked, sharePrice)
  const availableToStakeInDollars = fiduInDollars(availableToStake)

  const availableToWithdraw = fiduToDollarsAtomic(numSharesWithdrawable, sharePrice)
  const availableToWithdrawInDollars = fiduInDollars(availableToWithdraw)

  const address = capitalProviderAddress
  const allowance = new BigNumber(
    await pool.usdc.methods.allowance(capitalProviderAddress, pool.address).call(undefined, currentBlock.number)
  )
  const weightedAverageSharePrice = await getWeightedAverageSharePrice(
    pool,
    stakingRewards,
    capitalProviderAddress,
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
          stakedNotLocked: numSharesStakedNotLocked,
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
      stakingRewards: stakingInfo.rewards,
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
  poolEvents: EventData[]
  assetsAsOf: typeof assetsAsOf
  getRepaymentEvents: typeof getRepaymentEvents
  remainingCapacity: typeof remainingCapacity
}

async function fetchPoolData(pool: SeniorPool, erc20: Contract, currentBlock: BlockInfo): Promise<PoolData> {
  const attributes = [{method: "sharePrice"}, {method: "compoundBalance"}]
  let {sharePrice, compoundBalance: _compoundBalance} = await fetchDataFromAttributes(pool.contract, attributes, {
    blockNumber: currentBlock.number,
  })
  let rawBalance = new BigNumber(await erc20.methods.balanceOf(pool.address).call(undefined, currentBlock.number))
  let compoundBalance = new BigNumber(_compoundBalance)
  let balance = compoundBalance.plus(rawBalance)
  let totalShares = new BigNumber(await pool.fidu.methods.totalSupply().call(undefined, currentBlock.number))

  // Do some slightly goofy multiplication and division here so that we have consistent units across
  // 'balance', 'totalPoolBalance', and 'totalLoansOutstanding', allowing us to do arithmetic between them
  // and display them using the same helpers.
  const totalPoolAssetsInDollars = totalShares
    .div(FIDU_DECIMALS.toString())
    .multipliedBy(new BigNumber(sharePrice))
    .div(FIDU_DECIMALS.toString())
  let totalPoolAssets = totalPoolAssetsInDollars.multipliedBy(USDC_DECIMALS.toString())
  let totalLoansOutstanding = new BigNumber(
    await pool.contract.methods.totalLoansOutstanding().call(undefined, currentBlock.number)
  )
  let cumulativeWritedowns = await getCumulativeWritedowns(pool, currentBlock)
  let cumulativeDrawdowns = await getCumulativeDrawdowns(pool, currentBlock)
  let poolEvents = await getAllDepositAndWithdrawalEvents(pool, currentBlock)
  let estimatedTotalInterest = await getEstimatedTotalInterest(pool, currentBlock)
  let estimatedApy = estimatedTotalInterest.dividedBy(totalPoolAssets)
  // TODO Calculate this value using Uniswap price oracle for GFI, once that becomes available.
  const estimatedApyFromGfi = undefined
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
  stakingRewards: StakingRewards,
  capitalProviderAddress: string,
  currentBlock: BlockInfo
): Promise<EventData[]> {
  const depositMadeEventsByCapitalProvider: EventData[] = await pool.getPoolEvents(
    capitalProviderAddress,
    ["DepositMade"],
    true,
    currentBlock.number
  )
  const depositedAndStakedEventsByCapitalProvider: EventData[] = await stakingRewards.getStakingEvents(
    capitalProviderAddress,
    ["DepositedAndStaked"],
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
async function getWeightedAverageSharePrice(
  pool: SeniorPoolLoaded,
  stakingRewards: StakingRewardsLoaded,
  capitalProviderAddress: string,
  capitalProviderTotalShares: BigNumber,
  currentBlock: BlockInfo
) {
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

async function getCumulativeWritedowns(pool: SeniorPool, currentBlock: BlockInfo) {
  // In theory, we'd also want to include `PrincipalWrittendown` events emitted by `pool.v1Pool` here.
  // But in practice, we don't need to, because only one such was emitted, due to a bug which was
  // then fixed. So we include only `PrincipalWrittenDown` events emitted by `pool`.

  const events = await pool.goldfinchProtocol.queryEvents(
    pool.contract,
    "PrincipalWrittenDown",
    undefined,
    currentBlock.number
  )
  const sum: BigNumber = events.length
    ? BigNumber.sum.apply(
        null,
        events.map((eventData) => new BigNumber(eventData.returnValues.amount))
      )
    : new BigNumber(0)
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
      tranchedPools.map((pool) => protocol.queryEvents(pool, "DrawdownMade", undefined, currentBlock.number))
    )
  )
  const sum: BigNumber = allDrawdownEvents.length
    ? BigNumber.sum.apply(
        null,
        allDrawdownEvents.map((eventData) => new BigNumber(eventData.returnValues.amount))
      )
    : new BigNumber(0)
  return sum
}

async function getRepaymentEvents(pool: SeniorPoolLoaded, goldfinchProtocol: GoldfinchProtocol) {
  const eventNames = ["InterestCollected", "PrincipalCollected", "ReserveFundsCollected"]
  let events = await goldfinchProtocol.queryEvents(pool.contract, eventNames)
  const oldEvents = await goldfinchProtocol.queryEvents("Pool", eventNames)
  events = oldEvents.concat(events)
  const eventTxs = await mapEventsToTx(events)
  const combinedEvents = _.map(_.groupBy(eventTxs, "id"), (val) => {
    const interestPayment = _.find(val, (event) => event.type === "InterestCollected")
    const principalPayment = _.find(val, (event) => event.type === "PrincipalCollected") || {
      amountBN: new BigNumber(0),
    }
    const reserveCollection = _.find(val, (event) => event.type === "ReserveFundsCollected") || {
      amountBN: new BigNumber(0),
    }
    if (!interestPayment) {
      // This usually  means it's just ReserveFundsCollected, from a withdraw, and not a repayment
      return null
    }
    const merged: any = {...interestPayment, ...principalPayment, ...reserveCollection}
    merged.amountBN = interestPayment.amountBN.plus(principalPayment.amountBN).plus(reserveCollection.amountBN)
    merged.amount = usdcFromAtomic(merged.amountBN)
    merged.interestAmountBN = interestPayment.amountBN
    merged.type = "CombinedRepayment"
    merged.name = "CombinedRepayment"
    return merged
  })
  return _.compact(combinedEvents)
}

async function getAllDepositAndWithdrawalEvents(pool: SeniorPool, currentBlock: BlockInfo): Promise<EventData[]> {
  const eventNames = ["DepositMade", "WithdrawalMade"]
  const poolEvents = await pool.getPoolEvents(undefined, eventNames, true, currentBlock.number)
  return poolEvents
}

function assetsAsOf(this: PoolData, blockNumExclusive: number): BigNumber {
  return getBalanceAsOf(this.poolEvents, blockNumExclusive, "WithdrawalMade")
}

/**
 * Returns the remaining capacity in the pool, assuming a max capacity of `maxPoolCapacity`,
 * in atomic units.
 *
 * @param maxPoolCapacity - Maximum capacity of the pool
 * @returns Remaining capacity of pool in atomic units
 */
function remainingCapacity(this: PoolData, maxPoolCapacity: BigNumber): BigNumber {
  let cappedBalance = BigNumber.min(this.totalPoolAssets, maxPoolCapacity)
  return new BigNumber(maxPoolCapacity).minus(cappedBalance)
}

async function getEstimatedTotalInterest(pool: SeniorPool, currentBlock: BlockInfo): Promise<BigNumber> {
  const protocol = pool.goldfinchProtocol
  const tranchedPoolAddresses = await getTranchedPoolAddressesForSeniorPoolCalc(pool, currentBlock)
  const tranchedPools = tranchedPoolAddresses.map((address) =>
    protocol.getContract<TranchedPool>("TranchedPool", address)
  )
  const creditLineAddresses = await Promise.all(
    tranchedPools.map((p) => p.methods.creditLine().call(undefined, currentBlock.number))
  )
  const creditLines = creditLineAddresses.map((a) => buildCreditLine(a))
  const creditLineData = await Promise.all(
    creditLines.map(async (cl) => {
      let balance = new BigNumber(await cl.methods.balance().call(undefined, currentBlock.number))
      let interestApr = new BigNumber(await cl.methods.interestApr().call(undefined, currentBlock.number))
      return {balance, interestApr}
    })
  )
  return BigNumber.sum.apply(
    null,
    creditLineData.map((cl) => cl.balance.multipliedBy(cl.interestApr.dividedBy(INTEREST_DECIMALS.toString())))
  )
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
      pool.contract,
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
  storedPosition: StoredPosition
  optimisticIncrement: PositionOptimisticIncrement

  constructor(tokenId: string, storedPosition: StoredPosition, optimisticIncrement: PositionOptimisticIncrement) {
    this.tokenId = tokenId
    this.storedPosition = storedPosition
    this.optimisticIncrement = optimisticIncrement
  }

  get reason(): string {
    const date = new Date(this.storedPosition.rewards.startTime * 1000).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    return `Staked ${displayNumber(fiduFromAtomic(this.storedPosition.amount), 2)} FIDU on ${date}`
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
}

type StoredPosition = {
  amount: BigNumber
  rewards: StakingRewardsVesting
  leverageMultiplier: BigNumber
  lockedUntil: number
}

type PositionOptimisticIncrement = {
  vested: BigNumber
  unvested: BigNumber
}

const parseStoredPosition = (tuple: {
  0: string
  1: [string, string, string, string, string, string]
  2: string
  3: string
}): StoredPosition => ({
  amount: new BigNumber(tuple[0]),
  rewards: {
    totalUnvested: new BigNumber(tuple[1][0]),
    totalVested: new BigNumber(tuple[1][1]),
    totalPreviouslyVested: new BigNumber(tuple[1][2]),
    totalClaimed: new BigNumber(tuple[1][3]),
    startTime: parseInt(tuple[1][4], 10),
    endTime: parseInt(tuple[1][5], 10),
  },
  leverageMultiplier: new BigNumber(tuple[2]),
  lockedUntil: parseInt(tuple[3], 10),
})

type StakingRewardsLoadedInfo = {
  currentBlock: BlockInfo
  isPaused: boolean
  positions: StakingRewardsPosition[]
  claimable: BigNumber
  unvested: BigNumber
  granted: BigNumber
}

export type StakingRewardsLoaded = WithLoadedInfo<StakingRewards, StakingRewardsLoadedInfo>

class StakingRewards {
  goldfinchProtocol: GoldfinchProtocol
  contract: StakingRewardsContract
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

  async initialize(recipient: string, currentBlock: BlockInfo): Promise<void> {
    const isPaused = await this.contract.methods.paused().call(undefined, currentBlock.number)

    // NOTE: In defining `this.positions`, we want to use `balanceOf()` plus `tokenOfOwnerByIndex()`
    // to determine `tokenIds`, rather than using the set of Staked events for the `recipient`.
    // The former approach reflects any token transfers that may have occurred to or from the
    // `recipient`, whereas the latter does not.
    const numPositions = parseInt(
      await this.contract.methods.balanceOf(recipient).call(undefined, currentBlock.number),
      10
    )
    const tokenIds: string[] = await Promise.all(
      Array(numPositions)
        .fill("")
        .map((val, i) => this.contract.methods.tokenOfOwnerByIndex(recipient, i).call(undefined, currentBlock.number))
    )
    const positions = await Promise.all(
      tokenIds.map((tokenId) => {
        return this.contract.methods
          .positions(tokenId)
          .call(undefined, currentBlock.number)
          .then(async (rawPosition) => {
            // TODO[PR] Amount remaining on position does not necessarily equal amount originally staked, due to
            // the possibility of having partially unstaked. So to be able to display the original staked amount
            // in the UI, we need to query for the relevant event, and keep that value.

            const storedPosition = parseStoredPosition(rawPosition)
            const optimisticIncrement = await this.calculatePositionOptimisticIncrement(
              tokenId,
              storedPosition.rewards,
              currentBlock
            )
            return new StakingRewardsPosition(tokenId, storedPosition, optimisticIncrement)
          })
      })
    )
    const claimable = StakingRewards.calculateClaimable(positions)
    const unvested = StakingRewards.calculateUnvested(positions)
    const granted = StakingRewards.calculateGranted(positions)

    this.info = {
      loaded: true,
      value: {
        currentBlock,
        isPaused,
        positions,
        claimable,
        unvested,
        granted,
      },
    }
  }

  get unstakeablePositions(): StakingRewardsPosition[] {
    // We expect this getter to be used only once info has been loaded.
    assertWithLoadedInfo(this)

    const value = this.info.value
    const unlockedPositions = value.positions.filter(
      (position) => position.storedPosition.lockedUntil <= value.currentBlock.timestamp
    )
    // Any position that is not locked can be unstaked.
    return unlockedPositions
  }

  async calculatePositionOptimisticIncrement(
    tokenId: string,
    rewards: StakingRewardsVesting,
    currentBlock: BlockInfo
  ): Promise<PositionOptimisticIncrement> {
    const earnedSinceLastCheckpoint = new BigNumber(
      await this.contract.methods.earnedSinceLastCheckpoint(tokenId).call(undefined, currentBlock.number)
    )
    const optimisticCurrentGrant = rewards.totalUnvested.plus(rewards.totalVested).plus(earnedSinceLastCheckpoint)
    const optimisticTotalVested = new BigNumber(
      await this.contract.methods
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

  async getStakingEvents(
    recipient: string,
    eventNames: ["Staked"] | ["DepositedAndStaked"] | ["Staked", "DepositedAndStaked"],
    toBlock: BlockNumber = "latest"
  ): Promise<EventData[]> {
    const events = await this.goldfinchProtocol.queryEvents(this.contract, eventNames, {user: recipient}, toBlock)
    return events
  }

  static calculateClaimable(positions: StakingRewardsPosition[]): BigNumber {
    if (positions.length === 0) return new BigNumber(0)
    return BigNumber.sum.apply(
      null,
      positions.map((position) => position.claimable)
    )
  }

  static calculateUnvested(positions: StakingRewardsPosition[]): BigNumber {
    if (positions.length === 0) return new BigNumber(0)
    return BigNumber.sum.apply(
      null,
      positions.map((position) => position.unvested)
    )
  }

  static calculateGranted(positions: StakingRewardsPosition[]): BigNumber {
    if (positions.length === 0) return new BigNumber(0)
    return BigNumber.sum.apply(
      null,
      positions.map((position) => position.granted)
    )
  }
}

export {fetchCapitalProviderData, fetchPoolData, SeniorPool, Pool, StakingRewards, StakingRewardsPosition}
export type {PoolData, CapitalProvider}
