import web3 from "../web3"
import moment from "moment"
import BigNumber from "bignumber.js"
import {Tickers, usdcFromAtomic, usdcToAtomic} from "./erc20"
import {fetchDataFromAttributes, INTEREST_DECIMALS, SECONDS_PER_YEAR, SECONDS_PER_DAY} from "./utils"
import {BlockInfo, croppedAddress, roundUpPenny} from "../utils"
import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {CreditLine as CreditlineContract} from "@goldfinch-eng/protocol/typechain/web3/CreditLine"
import {Contract} from "web3-eth-contract"

const CreditLineAbi = require("../../abi/Creditline.json")

const zero = new BigNumber(0)

abstract class BaseCreditLine {
  address!: string | string[]

  abstract readonly currentLimit: BigNumber
  abstract readonly maxLimit: BigNumber
  abstract readonly remainingPeriodDueAmount: BigNumber
  abstract readonly remainingTotalDueAmount: BigNumber
  abstract readonly availableCredit: BigNumber

  balance!: BigNumber
  periodDueAmount!: BigNumber
  interestAprDecimal!: BigNumber
  collectedPaymentBalance!: BigNumber
  totalDueAmount!: BigNumber
  dueDate!: string
  isLate!: boolean
  loaded!: boolean
  creditLines!: CreditLine[]
  name!: string
  goldfinchProtocol!: GoldfinchProtocol

  async initialize(currentBlock: BlockInfo) {
    // no-op
  }

  get remainingPeriodDueAmountInDollars() {
    // We need to round up here to ensure the creditline is always fully paid,
    // this does mean the borrower may overpay by a penny max each time.
    return this.inDollars(this.remainingPeriodDueAmount, {roundUp: true})
  }

  get remainingTotalDueAmountInDollars() {
    // We need to round up here to ensure the creditline is always fully paid,
    // this does mean the borrower may overpay by a penny max each time.
    return this.inDollars(this.remainingTotalDueAmount, {roundUp: true})
  }

  get availableCreditInDollars() {
    return this.inDollars(this.availableCredit, {roundUp: false})
  }

  get isMultiple() {
    return this.creditLines.length > 1
  }

  get limit() {
    if (this.currentLimit.gt(0)) {
      return this.currentLimit
    } else {
      return this.maxLimit
    }
  }

  // Is next payment due
  get isPaymentDue() {
    return this.remainingPeriodDueAmount.gt(0)
  }

  // Has an open balance
  get isActive() {
    return this.limit.gt(0) && this.remainingTotalDueAmount.gt(0)
  }

  inDollars(amount, {roundUp}: {roundUp: boolean}): BigNumber {
    if (roundUp) {
      amount = roundUpPenny(usdcFromAtomic(amount))
    } else {
      amount = usdcFromAtomic(amount)
    }
    return new BigNumber(amount)
  }
}

class DefaultCreditLine extends BaseCreditLine {
  currentLimit: BigNumber
  maxLimit: BigNumber
  remainingPeriodDueAmount: BigNumber
  remainingTotalDueAmount: BigNumber
  availableCredit: BigNumber
  isDefaultObject: boolean

  constructor() {
    super()
    this.balance = zero
    this.currentLimit = zero
    this.maxLimit = zero
    this.periodDueAmount = zero
    this.remainingPeriodDueAmount = zero
    this.interestAprDecimal = zero
    this.availableCredit = zero
    this.collectedPaymentBalance = zero
    this.totalDueAmount = zero
    this.remainingTotalDueAmount = zero
    this.isLate = false
    this.loaded = true
    this.creditLines = []
    this.name = "No Credit Lines"
    this.isDefaultObject = true
  }
}

class CreditLine extends BaseCreditLine {
  address: string
  currentLimit!: BigNumber
  maxLimit!: BigNumber
  remainingPeriodDueAmount!: BigNumber
  remainingTotalDueAmount!: BigNumber
  availableCredit!: BigNumber
  creditLine: CreditlineContract
  balance!: BigNumber
  interestApr!: BigNumber
  interestAccruedAsOf!: BigNumber
  paymentPeriodInDays!: BigNumber
  termInDays!: BigNumber
  nextDueTime!: BigNumber
  interestOwed!: BigNumber
  termEndTime!: BigNumber
  lastFullPaymentTime!: BigNumber
  dueDate!: string
  termEndDate!: string
  usdc: Contract

  constructor(address, goldfinchProtocol: GoldfinchProtocol) {
    super()
    this.address = address
    this.goldfinchProtocol = goldfinchProtocol
    this.creditLine = goldfinchProtocol.getContract<CreditlineContract>("CreditLine", address)
    this.usdc = goldfinchProtocol.getERC20(Tickers.USDC).contract
    this.isLate = false
    this.loaded = false
    this.creditLines = [this]
    this.name = croppedAddress(this.address)
  }

  async initialize(currentBlock: BlockInfo) {
    const attributes = [
      {method: "balance"},
      {method: "interestApr"},
      {method: "interestAccruedAsOf"},
      {method: "paymentPeriodInDays"},
      {method: "termInDays"},
      {method: "nextDueTime"},
      {method: "limit", name: "currentLimit"},
      {method: "interestOwed"},
      {method: "termEndTime"},
      {method: "lastFullPaymentTime"},
    ]
    let data = await fetchDataFromAttributes(this.creditLine, attributes, {blockNumber: currentBlock.number})
    attributes.forEach((info) => {
      this[info.name || info.method] = new BigNumber(data[info.name || info.method])
    })

    await this.calculateFields(currentBlock)
    // Just for front-end usage.
    this.loaded = true
  }

  async calculateFields(currentBlock: BlockInfo) {
    // maxLimit is not available on older versions of the creditline, so fall back to limit in that case
    try {
      const data = await fetchDataFromAttributes(this.creditLine, [{method: "maxLimit"}])
      this["maxLimit"] = new BigNumber(data["maxLimit"])
    } catch (e) {
      console.log("maxLimit not available on old CreditLines, use currentLimit", {e})
      this["maxLimit"] = this["currentLimit"]
    }

    this.isLate = this._calculateIsLate(currentBlock)
    const interestOwed = this._calculateInterestOwed()
    const formattedNextDueDate = moment.unix(this.nextDueTime.toNumber()).format("MMM D")
    this.dueDate = this.nextDueTime.toNumber() === 0 ? "" : formattedNextDueDate
    this.termEndDate = moment.unix(this.termEndTime.toNumber()).format("MMM D, YYYY")
    this.collectedPaymentBalance = new BigNumber(
      await this.usdc.methods.balanceOf(this.address).call(undefined, currentBlock.number)
    )
    this.periodDueAmount = this._calculateNextDueAmount()
    this.remainingPeriodDueAmount = BigNumber.max(this.periodDueAmount.minus(this.collectedPaymentBalance), zero)
    this.interestAprDecimal = new BigNumber(this.interestApr).div(INTEREST_DECIMALS.toString())
    this.totalDueAmount = interestOwed.plus(this.balance)
    this.remainingTotalDueAmount = BigNumber.max(this.totalDueAmount.minus(this.collectedPaymentBalance), zero)
    const collectedForPrincipal = BigNumber.max(this.collectedPaymentBalance.minus(this.periodDueAmount), zero)
    this.availableCredit = BigNumber.min(this.limit, this.limit.minus(this.balance).plus(collectedForPrincipal))
  }

  _calculateIsLate(currentBlock: BlockInfo) {
    if (this.lastFullPaymentTime.isZero()) {
      // Brand new creditline
      return false
    }
    const secondsSinceLastFullPayment = currentBlock.timestamp - this.lastFullPaymentTime.toNumber()
    return secondsSinceLastFullPayment > this.paymentPeriodInDays.toNumber() * SECONDS_PER_DAY
  }

  _calculateInterestOwed() {
    const currentInterestOwed = this.interestOwed
    const annualRate = this.interestApr.dividedBy(new BigNumber(INTEREST_DECIMALS.toString()))
    const expectedElapsedSeconds = this.nextDueTime.minus(this.interestAccruedAsOf)
    const interestAccrualRate = annualRate.dividedBy(SECONDS_PER_YEAR)
    const balance = this.balance
    const expectedAdditionalInterest = balance.multipliedBy(interestAccrualRate).multipliedBy(expectedElapsedSeconds)
    if (this.isLate) {
      return currentInterestOwed
    } else {
      return currentInterestOwed.plus(expectedAdditionalInterest)
    }
  }

  _calculateNextDueAmount() {
    const interestOwed = this._calculateInterestOwed()
    const balance = this.balance
    if (this.nextDueTime.gte(this.termEndTime)) {
      return interestOwed.plus(balance)
    } else {
      return interestOwed
    }
  }
}

class MultipleCreditLines extends BaseCreditLine {
  address: string[]
  usdc: Contract

  constructor(addresses: string[], goldfinchProtocol: GoldfinchProtocol) {
    super()
    this.goldfinchProtocol = goldfinchProtocol
    this.address = addresses
    this.creditLines = []
    this.isLate = false
    this.loaded = false
    this.name = "All"
    this.usdc = goldfinchProtocol.getERC20(Tickers.USDC).contract
  }

  async initialize(currentBlock: BlockInfo) {
    this.creditLines = this.address.map((address) => new CreditLine(address, this.goldfinchProtocol))
    await Promise.all(this.creditLines.map((cl) => cl.initialize(currentBlock)))
    // Filter by active and sort by most recent
    this.creditLines = this.creditLines.filter((cl) => cl.limit.gt(0)).reverse()
    // Reset address to match creditlines
    this.address = this.creditLines.map((cl) => cl.address)

    // Picks the minimum due date
    const formattedNextDueDate = moment.unix(this.nextDueTime.toNumber()).format("MMM D")
    this.dueDate = this.nextDueTime.toNumber() === 0 ? "" : formattedNextDueDate
  }

  splitPayment(dollarAmount): [string[], BigNumber[]] {
    // Pay the minimum amounts for each creditline until there's no money left
    let amountRemaining = new BigNumber(usdcToAtomic(dollarAmount))
    let addresses: string[] = []
    let amounts: BigNumber[] = []
    const creditLinesByEarliestDue = this.creditLines
      .slice(0)
      .sort((cl1, cl2) => cl1.nextDueTime.minus(cl2.nextDueTime).toNumber())
    creditLinesByEarliestDue.forEach((cl) => {
      const dueAmount = new BigNumber(usdcToAtomic(cl.remainingPeriodDueAmountInDollars))
      if (amountRemaining.lte(0) || dueAmount.lte(0)) {
        // If we've run out of money, or this credit line has no payment due, skip
        return
      }
      let amountToPay = dueAmount
      if (amountRemaining.gt(amountToPay)) {
        // We have more money than what's due
        addresses.push(cl.address)
        amounts.push(amountToPay)
        amountRemaining = amountRemaining.minus(amountToPay)
      } else {
        // If the remaining amount is not sufficient to cover the minimumDue, just use whatever is left
        addresses.push(cl.address)
        amounts.push(amountRemaining)
        amountRemaining = zero
      }
    })
    return [addresses, amounts]
  }

  get availableCredit() {
    return this.creditLines.reduce((val, cl) => val.plus(cl.availableCredit), zero)
  }

  get limit() {
    return this.creditLines.reduce((val, cl) => val.plus(cl.limit), zero)
  }

  get currentLimit() {
    return this.creditLines.reduce((val, cl) => val.plus(cl.currentLimit), zero)
  }

  get maxLimit() {
    return this.creditLines.reduce((val, cl) => val.plus(cl.maxLimit), zero)
  }

  get remainingPeriodDueAmount() {
    return this.creditLines.reduce((val, cl) => val.plus(cl.remainingPeriodDueAmount), zero)
  }

  get remainingTotalDueAmount() {
    return this.creditLines.reduce((val, cl) => val.plus(cl.remainingTotalDueAmount), zero)
  }

  get nextDueTime() {
    const firstCreditLine = this.creditLines[0]
    if (firstCreditLine) {
      return this.creditLines.reduce((val, cl) => BigNumber.minimum(val, cl.nextDueTime), firstCreditLine.nextDueTime)
    } else {
      throw new Error("Failed to index into `this.creditLines`.")
    }
  }

  // These setters are just to make typescript happy
  set remainingTotalDueAmount(_) {}
  set limit(_) {}
  set availableCredit(_) {}
  set remainingPeriodDueAmount(_) {}
  set currentLimit(_) {}
  set maxLimit(_) {}
}

function buildCreditLine(address): CreditlineContract {
  return new web3.eth.Contract(CreditLineAbi, address) as unknown as CreditlineContract
}

async function fetchCreditLineData(
  creditLineAddresses: string | string[],
  goldfinchProtocol: GoldfinchProtocol,
  currentBlock: BlockInfo
) {
  let result
  // Provided address can be a nothing, a single address or an array of addresses. Normalize the single address to an array
  creditLineAddresses = typeof creditLineAddresses === "string" ? [creditLineAddresses] : creditLineAddresses

  if (!creditLineAddresses || creditLineAddresses.length === 0) {
    const defaultCreditLine = new DefaultCreditLine()
    defaultCreditLine.loaded = true
    return Promise.resolve(defaultCreditLine)
  }
  if (creditLineAddresses.length === 1) {
    result = new CreditLine(creditLineAddresses[0], goldfinchProtocol)
  } else {
    result = new MultipleCreditLines(creditLineAddresses, goldfinchProtocol)
  }
  await result.initialize(currentBlock)
  return result
}

const defaultCreditLine = new DefaultCreditLine()

export function displayDueDate(cl: CreditLine): string {
  if (cl.isLate) {
    return "now"
  }
  return cl.dueDate
}

export {buildCreditLine, fetchCreditLineData, defaultCreditLine, CreditLine, MultipleCreditLines}
