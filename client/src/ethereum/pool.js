import web3 from "../web3"
import BigNumber from "bignumber.js"
import { fetchDataFromAttributes, getDeployments, USDC_DECIMALS } from "./utils"
import { getUSDC, usdcFromAtomic } from "./erc20"
import { getFidu, FIDU_DECIMALS, fiduFromAtomic } from "./fidu"
import { roundDownPenny } from "../utils"
import { getFromBlock } from "./utils"
import { getPoolEvents } from "./user"
import _ from "lodash"
import { mapEventsToTx } from "./events"

let pool

async function getPool(networkId) {
  const config = await getDeployments(networkId)
  const poolAddress = config.contracts.Pool.address
  pool = new web3.eth.Contract(config.contracts.Pool.abi, poolAddress)
  pool.usdc = (await getUSDC(networkId)).contract
  pool.fidu = await getFidu(networkId)
  pool.chain = networkId
  pool.address = poolAddress
  pool.loaded = true
  return pool
}

async function fetchCapitalProviderData(pool, capitalProviderAddress) {
  var result = {}
  if (!capitalProviderAddress && !pool.loaded) {
    return Promise.resolve(result)
  }
  if (!capitalProviderAddress && pool.loaded) {
    return Promise.resolve({ loaded: true })
  }
  const attributes = [{ method: "sharePrice" }]
  result = await fetchDataFromAttributes(pool, attributes, { bigNumber: true })
  result.numShares = new BigNumber(await pool.fidu.methods.balanceOf(capitalProviderAddress).call())
  result.availableToWithdrawal = new BigNumber(result.numShares)
    .multipliedBy(new BigNumber(result.sharePrice))
    .div(FIDU_DECIMALS)
  result.availableToWithdrawalInDollars = new BigNumber(roundDownPenny(fiduFromAtomic(result.availableToWithdrawal)))
  result.address = capitalProviderAddress
  result.allowance = new BigNumber(await pool.usdc.methods.allowance(capitalProviderAddress, pool.address).call())
  result.weightedAverageSharePrice = await getWeightedAverageSharePrice(pool, result)
  const sharePriceDelta = result.sharePrice.dividedBy(FIDU_DECIMALS).minus(result.weightedAverageSharePrice)
  result.unrealizedGains = sharePriceDelta.multipliedBy(result.numShares)
  result.unrealizedGainsInDollars = roundDownPenny(result.unrealizedGains.div(FIDU_DECIMALS))
  result.unrealizedGainsPercentage = sharePriceDelta.dividedBy(result.weightedAverageSharePrice)
  result.loaded = true
  return result
}

async function fetchPoolData(pool, erc20) {
  var result = {}
  if (!erc20 || !pool.loaded) {
    return Promise.resolve(result)
  }
  const attributes = [{ method: "sharePrice" }, { method: "compoundBalance" }]
  result = await fetchDataFromAttributes(pool, attributes)
  result.rawBalance = new BigNumber(await erc20.methods.balanceOf(pool.address).call())
  result.compoundBalance = new BigNumber(result.compoundBalance)
  result.balance = result.compoundBalance.plus(result.rawBalance)
  result.totalShares = await pool.fidu.methods.totalSupply().call()

  // Do some slightly goofy multiplication and division here so that we have consistent units across
  // 'balance', 'totalPoolBalance', and 'totalLoansOutstanding', allowing us to do arithmetic between them
  // and display them using the same helpers.
  const totalPoolAssetsInDollars = new BigNumber(result.totalShares)
    .div(FIDU_DECIMALS)
    .multipliedBy(new BigNumber(result.sharePrice))
    .div(FIDU_DECIMALS)
  result.totalPoolAssets = totalPoolAssetsInDollars.multipliedBy(USDC_DECIMALS)
  result.totalLoansOutstanding = result.totalPoolAssets - result.balance
  result.cumulativeWritedowns = await getCumulativeWritedowns(pool)
  result.poolTXs = await getAllDepositAndWithdrawalTXs(pool)
  result.assetsAsOf = assetsAsOf
  result.getRepaymentEvents = getRepaymentEvents
  result.loaded = true
  result.pool = pool
  return result
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
      .dividedBy(USDC_DECIMALS)
      .dividedBy(new BigNumber(event.returnValues.shares).dividedBy(FIDU_DECIMALS))
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
    return ""
  } else {
    return totalAmountPaid.dividedBy(capitalProvider.numShares)
  }
}

async function getCumulativeWritedowns(pool) {
  const from = getFromBlock(pool.chain)
  const events = await pool.getPastEvents("PrincipalWrittendown", { fromBlock: from })
  return new BigNumber(_.sumBy(events, event => parseInt(event.returnValues.amount, 10))).negated()
}

async function getRepaymentEvents() {
  const fromBlock = getFromBlock(this.pool.chain)
  const events = await Promise.all(
    ["InterestCollected", "PrincipalCollected", "ReserveFundsCollected"].map(async eventName => {
      return this.pool.getPastEvents(eventName, { fromBlock: fromBlock })
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
    const merged = { ...interestPayment, ...principalPayment, ...reserveCollection }
    merged.amountBN = interestPayment.amountBN.plus(principalPayment.amountBN).plus(reserveCollection.amountBN)
    merged.amount = usdcFromAtomic(merged.amountBN)
    merged.interestAmountBN = interestPayment.amountBN
    merged.type = "CombinedRepayment"
    merged.name = "CombinedRepayment"
    return merged
  })
  return _.compact(combinedEvents)
}

async function getAllDepositAndWithdrawalTXs(pool) {
  const fromBlock = getFromBlock(pool.chain)
  const events = await Promise.all(
    ["DepositMade", "WithdrawalMade"].map(async eventName => {
      return pool.getPastEvents(eventName, { fromBlock: fromBlock })
    }),
  )
  return await mapEventsToTx(_.flatten(events))
}

function assetsAsOf(dt) {
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

export { getPool, fetchCapitalProviderData, fetchPoolData }
