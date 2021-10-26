import BigNumber from "bignumber.js"
import _ from "lodash"
import {AsyncReturnType} from "./types/util"
import web3 from "./web3"

export function croppedAddress(address) {
  if (!address) {
    return ""
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function displayNumber(val, decimals): string {
  if (val === "" || isNaN(val)) {
    return ""
  }

  const valFloat = parseFloat(val)
  if (!decimals && Math.floor(valFloat) === valFloat) {
    decimals = 0
  } else if (!decimals) {
    decimals = valFloat.toString().split(".")[1]?.length || 0
  }

  if (decimals === 2 && valFloat < 0.01 && valFloat > 0) {
    return "<0.01"
  }
  return commaFormat(valFloat.toFixed(decimals))
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

export function displayDollars(val, decimals = 2) {
  let prefix = ""
  if (!isFinite(val) || val === null) {
    return " --.--"
  }

  const valFloat = parseFloat(val)
  if (valFloat < 0) {
    val = valFloat * -1
    prefix = "-"
  }

  if (decimals === 2 && valFloat < 0.01 && valFloat > 0) {
    return "<$0.01"
  }
  return `${prefix}$${displayNumber(val, decimals)}`
}

export function displayPercent(val: BigNumber | undefined, decimals = 2, displayZero = false) {
  let valDisplay: string
  if (!val || val.isNaN() || (val.eq(0) && !displayZero)) {
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

export function assertNumber(val: unknown): asserts val is number {
  if (typeof val !== "number") {
    throw new AssertionError(`Value ${val} is not a number.`)
  }
}

export function assertError(val: unknown): asserts val is Error {
  if (!(val instanceof Error)) {
    throw new AssertionError(`Value ${val} is not an instance of Error.`)
  }
}

export function assertNonNullable<T>(val: T | null | undefined): asserts val is NonNullable<T> {
  if (val === null || val === undefined) {
    throw new AssertionError(`Value ${val} is not non-nullable.`)
  }
}

export async function getCurrentBlock() {
  return await web3.eth.getBlock("latest")
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
