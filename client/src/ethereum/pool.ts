import BigNumber from "bignumber.js"
import { fetchDataFromAttributes, USDC_DECIMALS } from "./utils"
import { Tickers, usdcFromAtomic } from "./erc20"
import { FIDU_DECIMALS, fiduFromAtomic } from "./fidu"
import { roundDownPenny } from "../utils"
import { getFromBlock } from "./utils"
import { getPoolEvents } from "./user"
import _ from "lodash"
import { mapEventsToTx } from "./events"
import { Contract } from "web3-eth-contract"
import { SeniorFund as SeniorFundContract } from "../typechain/web3/SeniorFund"
import { Fidu as FiduContract } from "../typechain/web3/Fidu"
import { GoldfinchProtocol } from "./GoldfinchProtocol"

class SeniorFund {
  contract: SeniorFundContract
  usdc: Contract
  fidu: FiduContract
  chain: string
  address: string
  loaded: boolean
  gf?: PoolData

  constructor(goldfinchProtocol: GoldfinchProtocol) {
    this.contract = goldfinchProtocol.getContract<SeniorFundContract>("SeniorFund")
    this.address = goldfinchProtocol.getAddress("SeniorFund")
    this.usdc = goldfinchProtocol.getERC20(Tickers.USDC).contract
    this.fidu = goldfinchProtocol.getContract<FiduContract>("Fidu")
    this.chain = goldfinchProtocol.networkId
    this.loaded = true
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
}

async function fetchCapitalProviderData(
  pool: SeniorFund,
  capitalProviderAddress: string | boolean,
): Promise<CapitalProvider | { loaded: boolean }> {
  if (!capitalProviderAddress && !pool.loaded) {
    return Promise.resolve({ loaded: false })
  }
  if (!capitalProviderAddress && pool.loaded) {
    return Promise.resolve({ loaded: true })
  }
  const attributes = [{ method: "sharePrice" }]
  let { sharePrice } = await fetchDataFromAttributes(pool.contract, attributes, { bigNumber: true })
  let numShares = new BigNumber(await pool.fidu.methods.balanceOf(capitalProviderAddress as string).call())
  let availableToWithdraw = new BigNumber(numShares)
    .multipliedBy(new BigNumber(sharePrice))
    .div(FIDU_DECIMALS.toString())
  let availableToWithdrawInDollars = new BigNumber(roundDownPenny(fiduFromAtomic(availableToWithdraw)))
  let address = capitalProviderAddress as string
  let allowance = new BigNumber(await pool.usdc.methods.allowance(capitalProviderAddress, pool.address).call())
  let weightedAverageSharePrice = await getWeightedAverageSharePrice(pool, { numShares, address })
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
  poolTXs: any[] //TODO
  assetsAsOf: any //TODO
  getRepaymentEvents: any //TODO
  loaded: boolean
  pool: SeniorFund
}

async function fetchPoolData(pool: SeniorFund, erc20: Contract) {
  const attributes = [{ method: "sharePrice" }, { method: "compoundBalance" }]
  let { sharePrice, compoundBalance: _compoundBalance } = await fetchDataFromAttributes(pool.contract, attributes)
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
  let totalLoansOutstanding = totalPoolAssets.minus(balance)
  let cumulativeWritedowns = await getCumulativeWritedowns(pool)
  let poolTXs = await getAllDepositAndWithdrawalTXs(pool)
  let loaded = true

  return {
    rawBalance,
    compoundBalance,
    balance,
    totalShares,
    totalPoolAssets,
    totalLoansOutstanding,
    cumulativeWritedowns,
    poolTXs,
    assetsAsOf,
    getRepaymentEvents,
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
async function getWeightedAverageSharePrice(pool, capitalProvider) {
  let poolEvents = await getPoolEvents(pool, capitalProvider.address, ["DepositMade"])
  poolEvents = _.reverse(_.sortBy(poolEvents, "blockNumber"))
  let zero = new BigNumber(0)
  let sharesLeftToAccountFor = capitalProvider.numShares
  let totalAmountPaid = zero
  poolEvents.forEach(event => {
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

async function getCumulativeWritedowns(pool: SeniorFund) {
  const from = getFromBlock(pool.chain)
  const events = await pool.contract.getPastEvents("PrincipalWrittenDown", { fromBlock: from })
  return new BigNumber(_.sumBy(events, event => parseInt(event.returnValues.amount, 10))).negated()
}

async function getRepaymentEvents(this: PoolData) {
  const fromBlock = getFromBlock(this.pool.chain)
  const events = await Promise.all(
    ["InterestCollected", "PrincipalCollected", "ReserveFundsCollected"].map(async eventName => {
      return this.pool.contract.getPastEvents(eventName, { fromBlock: fromBlock })
    }),
  )
  const eventTxs = await mapEventsToTx(_.flatten(events))
  const combinedEvents = _.map(_.groupBy(eventTxs, "id"), val => {
    const interestPayment = _.find(val, event => event.type === "InterestCollected")
    const principalPayment = _.find(val, event => event.type === "PrincipalCollected") || {
      amountBN: new BigNumber(0),
    }
    const reserveCollection = _.find(val, event => event.type === "ReserveFundsCollected") || {
      amountBN: new BigNumber(0),
    }
    if (!interestPayment) {
      // This usually  means it's just ReserveFundsCollected, from a withdraw, and not a repayment
      return null
    }
    const merged: any = { ...interestPayment, ...principalPayment, ...reserveCollection }
    merged.amountBN = interestPayment.amountBN.plus(principalPayment.amountBN).plus(reserveCollection.amountBN)
    merged.amount = usdcFromAtomic(merged.amountBN)
    merged.interestAmountBN = interestPayment.amountBN
    merged.type = "CombinedRepayment"
    merged.name = "CombinedRepayment"
    return merged
  })
  return _.compact(combinedEvents)
}

async function getAllDepositAndWithdrawalTXs(pool: SeniorFund) {
  const fromBlock = getFromBlock(pool.chain)
  const events = await Promise.all(
    ["DepositMade", "WithdrawalMade"].map(async eventName => {
      return pool.contract.getPastEvents(eventName, { fromBlock: fromBlock })
    }),
  )
  return await mapEventsToTx(_.flatten(events))
}

function assetsAsOf(this: PoolData, dt) {
  const filtered = _.filter(this.poolTXs, transfer => {
    return transfer.blockTime < dt
  })
  if (!filtered.length) {
    return new BigNumber(0)
  }
  return BigNumber.sum.apply(
    null,
    filtered.map(transfer => {
      if (transfer.type === "WithdrawalMade") {
        return transfer.amountBN.multipliedBy(new BigNumber(-1))
      } else {
        return transfer.amountBN
      }
    }),
  )
}

export { fetchCapitalProviderData, fetchPoolData, SeniorFund }
