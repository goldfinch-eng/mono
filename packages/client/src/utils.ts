import {AbstractProvider} from "web3-core"
import {isPlainObject, isStringOrUndefined} from "@goldfinch-eng/utils"
import {isNumber, isString} from "@goldfinch-eng/utils/src/type"
import BigNumber from "bignumber.js"
import _ from "lodash"
import {ChainInfoToAdd, isMainnetForking, SupportedChainId} from "./ethereum/utils"
import {NetworkConfig} from "./types/network"
import {AsyncReturnType} from "./types/util"
import web3 from "./web3"
import {UserLoaded} from "./ethereum/user"

export function eligibleForSeniorPool(user: UserLoaded | undefined): boolean {
  const goListed =
    user?.info.value.goListed ||
    user?.info.value.hasNonUSUID ||
    user?.info.value.hasUSAccreditedUID ||
    user?.info.value.hasUSEntityUID ||
    user?.info.value.hasNonUSEntityUID ||
    user?.info.value.hasUSNonAccreditedUID

  return !!goListed
}

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

export function displayDollarsTruncated(val: BigNumber | undefined | string | number, displayZero = true) {
  let valFloat: number
  let truncatedNumber = 0
  let symbol = ""
  let decimals = 0

  const NUMBER_SYMBOLS = {
    B: 1000000000,
    M: 1000000,
    k: 1000,
    "": 1,
  }

  if (val === undefined) return "$--.--"

  if (BigNumber.isBigNumber(val)) {
    valFloat = parseFloat(val.toString(10))
  } else if (isNumber(val)) {
    valFloat = val
  } else {
    valFloat = parseFloat(val)
  }

  if (valFloat === 0) return displayDollars(0, 0, displayZero)

  for (let key of Object.keys(NUMBER_SYMBOLS)) {
    if (Math.abs(valFloat) >= NUMBER_SYMBOLS[key]) {
      truncatedNumber = valFloat / NUMBER_SYMBOLS[key]
      symbol = key
      break
    }
  }

  // if not an integer, set to show 2 decimal places
  if (truncatedNumber % 1 !== 0) decimals = 2

  return `${displayDollars(truncatedNumber, decimals, displayZero)}${symbol}`
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

export function isError(val: unknown): val is Error {
  return val instanceof Error
}

export function assertError(val: unknown): asserts val is Error {
  if (!isError(val)) {
    throw new AssertionError(`Value ${val} is not an instance of Error.`)
  }
}

export type CodedErrorLike = {
  code: number
  message: string
  stack?: string
}

export function isCodedErrorLike(val: unknown): val is CodedErrorLike {
  return isPlainObject(val) && isNumber(val.code) && isString(val.message) && isStringOrUndefined(val.stack)
}

export type ErrorLike = Error | CodedErrorLike

export function isErrorLike(val: unknown): val is ErrorLike {
  return isError(val) || isCodedErrorLike(val)
}

export function assertErrorLike(val: unknown): asserts val is ErrorLike {
  if (!isErrorLike(val)) {
    throw new AssertionError(`Value ${val} is not error-like.`)
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

export function sameBlock(blockA: BlockInfo | undefined, blockB: BlockInfo | undefined): boolean {
  return !!blockA && !!blockB && blockA.number === blockB.number
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

export function getInjectedProvider(): any {
  if ((window as any).ethereum.overrideIsMetaMask) {
    const _provider = (window as any).ethereum.providers.find(
      (p) => p.hasOwnProperty("isMetaMask") && (p as {isMetaMask: boolean}).isMetaMask
    )
    if (_provider) {
      // When the user has multiple extensions installed on the browser, calling `window.ethereum.request`
      // results in pop-ups from all wallets at the same time. To support the default connection with metamask
      // one needs to select the metamask provider and call it to establish a connection
      return _provider
    }
  }
  return (window as any).ethereum
}

export function isProductionAndPrivateNetwork(network: NetworkConfig | undefined) {
  // Undetected networks are marked as private by the provider. On our config any private
  // network is marked as localhost, check `mapNetworkToID`, this function is useful to
  // check for scenarios when users are on undetected networks
  return network && network.name === "localhost" && process.env.NODE_ENV === "production"
}

export async function switchToNetwork(
  currentProvider: AbstractProvider,
  chainId: SupportedChainId
): Promise<null | void> {
  assertNonNullable(currentProvider.request)
  const chainIdHex = `0x${chainId.toString(16)}`

  try {
    await currentProvider.request({
      method: "wallet_switchEthereumChain",
      params: [{chainId: chainIdHex}],
    })
  } catch (err: unknown) {
    // This error code indicates the chain has not yet been added to Metamask.
    // In that case, prompt the user to add a new chain.
    // https://docs.metamask.io/guide/rpc-api.html#usage-with-wallet-switchethereumchain
    if (isCodedErrorLike(err) && err.code === 4902) {
      const info = ChainInfoToAdd[chainId]
      if (!info) {
        return
      }

      await currentProvider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chainIdHex,
            chainName: info.label,
            rpcUrls: [info.rpcUrl],
          },
        ],
      })

      // metamask (only known implementer) automatically switches after a network is added
      // the second call is done here because that behavior is not a part of the spec and cannot be relied upon in the future
      // metamask's behavior when switching to the current network is just to return null (a no-op)
      try {
        await currentProvider.request({
          method: "wallet_switchEthereumChain",
          params: [{chainId: chainIdHex}],
        })
      } catch (error) {
        console.log("Added network but could not switch chains", error)
      }
    }
  }
}

export async function switchNetworkIfRequired(networkConfig: NetworkConfig): Promise<void> {
  const currentNetwork: SupportedChainId = SupportedChainId[networkConfig.name]
  let idealNetworkId: SupportedChainId = SupportedChainId.MAINNET

  if (isProductionAndPrivateNetwork(networkConfig)) {
    idealNetworkId = SupportedChainId.MAINNET
  } else if (process.env.NODE_ENV === "production") {
    idealNetworkId = !networkConfig.supported ? SupportedChainId.MAINNET : currentNetwork
  } else if (process.env.REACT_APP_MURMURATION === "yes" || process.env.NODE_ENV === "development") {
    idealNetworkId = SupportedChainId.LOCAL
  }

  if (idealNetworkId && currentNetwork !== idealNetworkId) {
    await switchToNetwork(web3.userWallet.currentProvider as AbstractProvider, idealNetworkId)
  }
}
