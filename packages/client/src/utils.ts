import {isNumber, isString} from "@goldfinch-eng/utils/src/type"
import BigNumber from "bignumber.js"
import _ from "lodash"
import {isMainnetForking} from "./ethereum/utils"
import {AsyncReturnType} from "./types/util"
import web3 from "./web3"

export function croppedAddress(address) {
  if (!address) {
    return ""
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function displayNumber(val: number | string | BigNumber | undefined, decimals = 2, displayZero = true): string {
  if (
    val === undefined ||
    (isNumber(val) && isNaN(val)) ||
    (BigNumber.isBigNumber(val) && !val.isFinite()) ||
    (!displayZero &&
      (val === 0 || (BigNumber.isBigNumber(val) && val.eq(0)) || (isString(val) && parseFloat(val) === 0)))
  ) {
    return ""
  }

  const valFloat = BigNumber.isBigNumber(val) ? parseFloat(val.toString(10)) : isNumber(val) ? val : parseFloat(val)

  if (decimals === 2 && valFloat < 0.01 && valFloat > 0) {
    return "<0.01"
  }
  // Javascript's threshold at which it defaults to exponential notation is 1e21 (cf.
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toFixed#description).
  return valFloat >= 1e21 ? valFloat.toExponential(decimals) : commaFormat(valFloat.toFixed(decimals))
}

function commaFormat(numberString): string {
  if (isNaN(numberString)) {
    return numberString
  }
  const [beforeDecimal, afterDecimal] = numberString.split(".")
  let withCommas: string[] = []
  _.reverse(_.split(beforeDecimal, "")).forEach((letter, i) => {
    if (i % 3 === 0 && i > 0) {
      withCommas.push(",")
    }
    withCommas.push(letter)
  })

  const decimalString = afterDecimal ? "." + afterDecimal : ""

  return `${_.join(_.reverse(withCommas), "")}${decimalString}`
}

export function displayDollars(val: number | string | BigNumber | undefined, decimals = 2, displayZero = true) {
  let prefix = ""
  if (
    val === undefined ||
    (isNumber(val) && isNaN(val)) ||
    (BigNumber.isBigNumber(val) && !val.isFinite()) ||
    (!displayZero &&
      (val === 0 || (BigNumber.isBigNumber(val) && val.eq(0)) || (isString(val) && parseFloat(val) === 0)))
  ) {
    return "$--.--"
  }

  let valFloat = BigNumber.isBigNumber(val) ? parseFloat(val.toString(10)) : isNumber(val) ? val : parseFloat(val)
  if (valFloat < 0) {
    val = valFloat * -1
    prefix = "-"
  }

  if (decimals === 2 && valFloat < 0.01 && valFloat > 0) {
    return "<$0.01"
  }
  return `${prefix}$${displayNumber(val, decimals)}`
}

export function displayPercent(val: BigNumber | undefined, decimals = 2, displayZero = true) {
  let valDisplay: string
  if (val === undefined || !val.isFinite() || (!displayZero && val.eq(0))) {
    valDisplay = "--.--"
  } else {
    valDisplay = displayNumber(val.multipliedBy(100), decimals)
  }
  return `${valDisplay}%`
}

export function roundUpPenny(val) {
  return Math.ceil(val * 100) / 100
}

export function roundDownPenny(val) {
  return Math.floor(val * 100) / 100
}

export class AssertionError extends Error {}

export class CodedError extends Error {
  code: number

  constructor(message: string, code: number) {
    super(message)
    this.code = code
  }
}

export function assertNumber(val: unknown): asserts val is number {
  if (typeof val !== "number") {
    throw new AssertionError(`Value ${val} is not a number.`)
  }
}

export function assertError(val: unknown): asserts val is Error {
  if (!isError(val)) {
    throw new AssertionError(`Value ${val} is not an instance of Error.`)
  }
}

export function isError(val: unknown): val is Error {
  return val instanceof Error
}

export function isCodedError(val: unknown): val is CodedError {
  return val instanceof CodedError
}

export function assertCodedError(val: unknown): asserts val is CodedError {
  if (!isCodedError(val)) {
    throw new AssertionError(`Value ${val} failed CodedError type guard.`)
  }
}

export function assertNonNullable<T>(val: T | null | undefined): asserts val is NonNullable<T> {
  if (val === null || val === undefined) {
    throw new AssertionError(`Value ${val} is not non-nullable.`)
  }
}

export function assertBigNumber(val: unknown): asserts val is BigNumber {
  if (!BigNumber.isBigNumber(val)) {
    throw new AssertionError(`Value ${val} is not a BigNumber.`)
  }
}

export async function getCurrentBlock() {
  return await web3.readOnly.eth.getBlock("latest")
}

export type BlockInfo = {
  number: number
  timestamp: number
}

export function getBlockInfo(block: AsyncReturnType<typeof getCurrentBlock>): BlockInfo {
  if (typeof block.timestamp !== "number") {
    throw new Error(`Timestamp of block ${block.number} is not a number: ${block.timestamp}`)
  }
  return {
    number: block.number,
    timestamp: block.timestamp,
  }
}

export type WithCurrentBlock<T> = T & {currentBlock: BlockInfo}

export type ArrayItemType<T> = T extends Array<infer U> ? U : never

export function defaultSum(values: BigNumber[]): BigNumber {
  return values.length ? BigNumber.sum.apply(null, values) : new BigNumber(0)
}

export function shouldUseWeb3(): boolean {
  if (process.env.NODE_ENV !== "production" && isMainnetForking()) {
    console.warn("Cannot use subgraph locally with mainnet forking. Using web3 instead.")
    return true
  }
  return process.env.REACT_APP_TOGGLE_THE_GRAPH !== "true"
}
