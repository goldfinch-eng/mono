import BigNumber from "bignumber.js"
import {fetchDataFromAttributes, getPoolEvents, INTEREST_DECIMALS, USDC_DECIMALS} from "./utils"
import {Tickers, usdcFromAtomic} from "./erc20"
import {FIDU_DECIMALS, fiduFromAtomic} from "./fidu"
import {roundDownPenny} from "../utils"
import _ from "lodash"
import {getBalanceAsOf, mapEventsToTx} from "./events"
import {Contract, EventData} from "web3-eth-contract"
import {Pool as PoolContract} from "@goldfinch-eng/protocol/typechain/web3/Pool"
import {SeniorPool as SeniorPoolContract} from "@goldfinch-eng/protocol/typechain/web3/SeniorPool"
import {StakingRewards as StakingRewardsContract} from "@goldfinch-eng/protocol/typechain/web3/StakingRewards"
import {Fidu as FiduContract} from "@goldfinch-eng/protocol/typechain/web3/Fidu"
import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {TranchedPool} from "@goldfinch-eng/protocol/typechain/web3/TranchedPool"
import {buildCreditLine} from "./creditLine"
import {getMetadataStore} from "./tranchedPool"

class Pool {
  goldfinchProtocol: GoldfinchProtocol
  contract: PoolContract
  chain: string
  address: string
  _loaded: boolean

  constructor(goldfinchProtocol: GoldfinchProtocol) {
    this.goldfinchProtocol = goldfinchProtocol
    this.contract = goldfinchProtocol.getContract<PoolContract>("Pool")
    this.address = goldfinchProtocol.getAddress("Pool")
    this.chain = goldfinchProtocol.networkId
    this._loaded = true
  }

  get loaded(): boolean {
    return this._loaded
  }
}

class SeniorPool {
  goldfinchProtocol: GoldfinchProtocol
  contract: SeniorPoolContract
  usdc: Contract
  fidu: FiduContract
  v1Pool: Pool
  chain: string
  address: string
  _loaded: boolean
  gf!: PoolData
  isPaused!: boolean

  constructor(goldfinchProtocol: GoldfinchProtocol) {
    this.goldfinchProtocol = goldfinchProtocol
    this.contract = goldfinchProtocol.getContract<SeniorPoolContract>("SeniorPool")
    this.address = goldfinchProtocol.getAddress("SeniorPool")
    this.usdc = goldfinchProtocol.getERC20(Tickers.USDC).contract
    this.fidu = goldfinchProtocol.getContract<FiduContract>("Fidu")
    this.v1Pool = new Pool(goldfinchProtocol)
    this.chain = goldfinchProtocol.networkId
    this._loaded = true
  }

  async initialize() {
    let poolData = await fetchPoolData(this, this.usdc)
    this.gf = poolData
    this.isPaused = await this.contract.methods.paused().call()
  }

  async getPoolEvents(
    address: string | undefined,
    eventNames: string[] = ["DepositMade", "WithdrawalMade"]
  ): Promise<EventData[]> {
    // In migrating from v1 to v2 (i.e. from the `Pool` contract as modeling the senior pool,
    // to the `SeniorPool` contract as modeling the senior pool), we transferred contract state
    // from Pool to SeniorPool (e.g. the deposits that a capital provider had made into Pool
    // became deposits in SeniorPool). But we did not do any sort of migrating (e.g. re-emitting)
    // with respect to events, from the Pool contract onto the SeniorPool contract. So accurately
    // representing the SeniorPool's events here -- e.g. to be able to accurately count all of a
    // capital provider's deposits -- requires querying for those events on both the SeniorPool
    // and Pool contracts.

    const events = await Promise.all([
      getPoolEvents(this, address, eventNames),
      getPoolEvents(this.v1Pool, address, eventNames),
    ])
    const combined = _.flatten(events)
    return combined
  }

  get loaded(): boolean {
    return this._loaded && this.v1Pool.loaded
  }
}

interface CapitalProvider {
  numShares: BigNumber
  availableToWithdraw: BigNumber
  availableToWithdrawInDollars: BigNumber
  address: string
  allowance: BigNumber
  weightedAverageSharePrice: BigNumber
  unrealizedGains: BigNumber
  unrealizedGainsInDollars: BigNumber
  unrealizedGainsPercentage: BigNumber
  loaded: boolean
  empty?: boolean
}

function emptyCapitalProvider({loaded = false} = {}): CapitalProvider {
  return {
    numShares: new BigNumber(0),
    availableToWithdraw: new BigNumber(0),
    availableToWithdrawInDollars: new BigNumber(0),
    address: "",
    allowance: new BigNumber(0),
    weightedAverageSharePrice: new BigNumber(0),
    unrealizedGains: new BigNumber(0),
    unrealizedGainsInDollars: new BigNumber(0),
    unrealizedGainsPercentage: new BigNumber(0),
    loaded,
    empty: true,
  }
}

async function fetchCapitalProviderData(
  pool: SeniorPool,
  capitalProviderAddress: string | boolean
): Promise<CapitalProvider> {
  if (!capitalProviderAddress) {
    return emptyCapitalProvider({loaded: pool.loaded})
  }

  const attributes = [{method: "sharePrice"}]
  let {sharePrice} = await fetchDataFromAttributes(pool.contract, attributes, {bigNumber: true})
  let numShares = new BigNumber(await pool.fidu.methods.balanceOf(capitalProviderAddress as string).call())
  let availableToWithdraw = new BigNumber(numShares)
    .multipliedBy(new BigNumber(sharePrice))
    .div(FIDU_DECIMALS.toString())
  let availableToWithdrawInDollars = new BigNumber(fiduFromAtomic(availableToWithdraw))
  let address = capitalProviderAddress as string
  let allowance = new BigNumber(await pool.usdc.methods.allowance(capitalProviderAddress, pool.address).call())
  let weightedAverageSharePrice = await getWeightedAverageSharePrice(pool, {numShares, address})
  const sharePriceDelta = sharePrice.dividedBy(FIDU_DECIMALS).minus(weightedAverageSharePrice)
  let unrealizedGains = sharePriceDelta.multipliedBy(numShares)
  let unrealizedGainsInDollars = new BigNumber(roundDownPenny(unrealizedGains.div(FIDU_DECIMALS)))
  let unrealizedGainsPercentage = sharePriceDelta.dividedBy(weightedAverageSharePrice)
  let loaded = true
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
    loaded,
  }
}

interface PoolData {
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
  loaded: boolean
  pool: SeniorPool
}

async function fetchPoolData(pool: SeniorPool, erc20: Contract): Promise<PoolData> {
  const attributes = [{method: "sharePrice"}, {method: "compoundBalance"}]
  let {sharePrice, compoundBalance: _compoundBalance} = await fetchDataFromAttributes(pool.contract, attributes)
  let rawBalance = new BigNumber(await erc20.methods.balanceOf(pool.address).call())
  let compoundBalance = new BigNumber(_compoundBalance)
  let balance = compoundBalance.plus(rawBalance)
  let totalShares = new BigNumber(await pool.fidu.methods.totalSupply().call())

  // Do some slightly goofy multiplication and division here so that we have consistent units across
  // 'balance', 'totalPoolBalance', and 'totalLoansOutstanding', allowing us to do arithmetic between them
  // and display them using the same helpers.
  const totalPoolAssetsInDollars = totalShares
    .div(FIDU_DECIMALS.toString())
    .multipliedBy(new BigNumber(sharePrice))
    .div(FIDU_DECIMALS.toString())
  let totalPoolAssets = totalPoolAssetsInDollars.multipliedBy(USDC_DECIMALS.toString())
  let totalLoansOutstanding = new BigNumber(await pool.contract.methods.totalLoansOutstanding().call())
  let cumulativeWritedowns = await getCumulativeWritedowns(pool)
  let cumulativeDrawdowns = await getCumulativeDrawdowns(pool)
  let poolEvents = await getAllDepositAndWithdrawalEvents(pool)
  let estimatedTotalInterest = await getEstimatedTotalInterest(pool)
  let estimatedApy = estimatedTotalInterest.dividedBy(totalPoolAssets)
  const estimatedApyFromGfi = undefined // TODO[PR]
  let defaultRate = cumulativeWritedowns.dividedBy(cumulativeDrawdowns)

  let loaded = true

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
    loaded,
    pool,
  }
}

// This uses the FIFO method of calculating cost-basis. Thus we
// add up the deposits *in reverse* to arrive at your current number of shares.
// We calculate the weighted average price based on that, which can then be used
// to calculate unrealized gains.
// Note: This does not take into account transfers of Fidu that happen outside
// the protocol. In such a case, you would necessarily end up with more Fidu
// than we have records of your deposits, so we would not be able to account
// for your shares, and we would fail out, and return a "-" on the front-end.
// Note: This also does not take into account realized gains, which we are also punting on.
async function getWeightedAverageSharePrice(pool: SeniorPool, capitalProvider) {
  const poolEvents = await pool.getPoolEvents(capitalProvider.address, ["DepositMade"])
  const preparedEvents = _.reverse(_.sortBy(poolEvents, "blockNumber"))

  let zero = new BigNumber(0)
  let sharesLeftToAccountFor = capitalProvider.numShares
  let totalAmountPaid = zero
  preparedEvents.forEach((event) => {
    if (sharesLeftToAccountFor.lte(zero)) {
      return
    }
    const sharePrice = new BigNumber(event.returnValues.amount)
      .dividedBy(USDC_DECIMALS.toString())
      .dividedBy(new BigNumber(event.returnValues.shares).dividedBy(FIDU_DECIMALS.toString()))
    const sharesToAccountFor = BigNumber.min(sharesLeftToAccountFor, new BigNumber(event.returnValues.shares))
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
    return totalAmountPaid.dividedBy(capitalProvider.numShares)
  }
}

async function getCumulativeWritedowns(pool: SeniorPool) {
  // In theory, we'd also want to include `PrincipalWrittendown` events emitted by `pool.v1Pool` here.
  // But in practice, we don't need to, because only one such was emitted, due to a bug which was
  // then fixed. So we include only `PrincipalWrittenDown` events emitted by `pool`.

  const events = await pool.goldfinchProtocol.queryEvents(pool.contract, "PrincipalWrittenDown")
  return new BigNumber(_.sumBy(events, (event) => parseInt(event.returnValues.amount, 10))).negated()
}

async function getCumulativeDrawdowns(pool: SeniorPool) {
  const protocol = pool.goldfinchProtocol
  const tranchedPoolAddresses = await getTranchedPoolAddressesForSeniorPoolCalc(pool)
  const tranchedPools = tranchedPoolAddresses.map((address) =>
    protocol.getContract<TranchedPool>("TranchedPool", address)
  )
  let allDrawdownEvents = _.flatten(
    await Promise.all(tranchedPools.map((pool) => protocol.queryEvents(pool, "DrawdownMade")))
  )
  return new BigNumber(_.sumBy(allDrawdownEvents, (event) => parseInt(event.returnValues.amount, 10)))
}

async function getRepaymentEvents(this: PoolData, goldfinchProtocol: GoldfinchProtocol) {
  const eventNames = ["InterestCollected", "PrincipalCollected", "ReserveFundsCollected"]
  let events = await goldfinchProtocol.queryEvents(this.pool.contract, eventNames)
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

async function getAllDepositAndWithdrawalEvents(pool: SeniorPool): Promise<EventData[]> {
  const eventNames = ["DepositMade", "WithdrawalMade"]
  const poolEvents = await pool.getPoolEvents(undefined, eventNames)
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

async function getEstimatedTotalInterest(pool: SeniorPool): Promise<BigNumber> {
  const protocol = pool.goldfinchProtocol
  const tranchedPoolAddresses = await getTranchedPoolAddressesForSeniorPoolCalc(pool)
  const tranchedPools = tranchedPoolAddresses.map((address) =>
    protocol.getContract<TranchedPool>("TranchedPool", address)
  )
  const creditLineAddresses = await Promise.all(tranchedPools.map((p) => p.methods.creditLine().call()))
  const creditLines = creditLineAddresses.map((a) => buildCreditLine(a))
  const creditLineData = await Promise.all(
    creditLines.map(async (cl) => {
      let balance = new BigNumber(await cl.methods.balance().call())
      let interestApr = new BigNumber(await cl.methods.interestApr().call())
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
async function getTranchedPoolAddressesForSeniorPoolCalc(pool: SeniorPool): Promise<string[]> {
  const protocol = pool.goldfinchProtocol
  const [metadataStore, investmentEvents] = await Promise.all([
    getMetadataStore(protocol.networkId),
    protocol.queryEvents(pool.contract, ["InvestmentMadeInSenior", "InvestmentMadeInJunior"]),
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

interface Rewards {
  totalUnvested: BigNumber
  totalVested: BigNumber
  totalPreviouslyVested: BigNumber
  totalClaimed: BigNumber
  startTime: string
  endTime: string
}

interface StakedPosition {
  id: string
  amount: BigNumber
  leverageMultiplier: BigNumber
  lockedUntil: BigNumber
  rewards: Rewards
}

function parseStakedPosition(
  tokenId: string,
  tuple: {0: string; 1: [string, string, string, string, string, string]; 2: string; 3: string}
): StakedPosition {
  return {
    id: tokenId,
    amount: new BigNumber(tuple[0]),
    leverageMultiplier: new BigNumber(tuple[2]),
    lockedUntil: new BigNumber(tuple[3]),
    rewards: {
      totalUnvested: new BigNumber(tuple[1][0]),
      totalVested: new BigNumber(tuple[1][1]),
      totalPreviouslyVested: new BigNumber(tuple[1][2]),
      totalClaimed: new BigNumber(tuple[1][3]),
      startTime: tuple[1][4],
      endTime: tuple[1][5],
    },
  }
}

class StakingRewards {
  goldfinchProtocol: GoldfinchProtocol
  contract: StakingRewardsContract
  address: string
  _loaded: boolean
  positions: StakedPosition[]

  constructor(goldfinchProtocol: GoldfinchProtocol) {
    this.goldfinchProtocol = goldfinchProtocol
    this.contract = goldfinchProtocol.getContract<StakingRewardsContract>("StakingRewards")
    this.address = goldfinchProtocol.getAddress("StakingRewards")
    this._loaded = false
    this.positions = []
  }

  async initialize(recipient: string) {
    const stakedEvents = await this.getStakedEvents(recipient)
    const tokenIds = stakedEvents.map((e) => e.returnValues.tokenId)
    this.positions = await Promise.all(
      tokenIds.map((tokenId) => {
        return this.contract.methods
          .positions(tokenId)
          .call()
          .then((res) => parseStakedPosition(tokenId, res))
      })
    )
    this._loaded = true
  }

  async getStakedEvents(recipient: string): Promise<EventData[]> {
    const eventNames = ["Staked"]
    const events = await this.goldfinchProtocol.queryEvents(this.contract, eventNames, {user: recipient})
    return events
  }
}

export {fetchCapitalProviderData, fetchPoolData, SeniorPool, Pool, emptyCapitalProvider, StakingRewards}
export type {PoolData, CapitalProvider, StakedPosition}
