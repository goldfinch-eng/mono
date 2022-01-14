import {GFI as GFIContract} from "@goldfinch-eng/protocol/typechain/web3/GFI"
import {isNumberOrUndefined, isPlainObject, isStringOrUndefined, isUndefined} from "@goldfinch-eng/utils/src/type"
import BigNumber from "bignumber.js"
import {Loadable, WithLoadedInfo} from "../types/loadable"
import {Web3IO} from "../types/web3"
import {BlockInfo} from "../utils"
import {GoldfinchProtocol} from "./GoldfinchProtocol"

export const COINGECKO_API_GFI_PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=goldfinch&vs_currencies=usd"

type CoingeckoResponseJson = {
  goldfinch: {
    usd?: number
  }
}

function isCoingeckoResponseJson(obj: unknown): obj is CoingeckoResponseJson {
  return isPlainObject(obj) && isPlainObject(obj.goldfinch) && isNumberOrUndefined(obj.goldfinch.usd)
}

export const COINBASE_API_GFI_PRICE_URL = "https://api.coinbase.com/v2/prices/GFI-USD/spot"

type CoinbaseResponseJson = {
  data: {
    base: "GFI"
    currency: "USD"
    amount?: string
  }
}

function isCoinbaseResponseJson(obj: unknown): obj is CoinbaseResponseJson {
  return (
    isPlainObject(obj) &&
    isPlainObject(obj.data) &&
    isStringOrUndefined(obj.data.amount) &&
    obj.data.base === "GFI" &&
    obj.data.currency === "USD"
  )
}

type FetchGFIPriceResult = {
  usd: number
}

type GFILoadedInfo = {
  currentBlock: BlockInfo
  price: BigNumber | undefined
}

class GFI {
  goldfinchProtocol: GoldfinchProtocol
  contract: Web3IO<GFIContract>
  address: string
  info: Loadable<GFILoadedInfo>

  constructor(goldfinchProtocol: GoldfinchProtocol) {
    this.goldfinchProtocol = goldfinchProtocol
    this.contract = goldfinchProtocol.getContract<GFIContract>("GFI")
    this.address = goldfinchProtocol.getAddress("GFI")
    this.info = {loaded: false, value: undefined}
  }

  async initialize(currentBlock: BlockInfo) {
    this.info = {
      loaded: true,
      value: {
        currentBlock,
        price: await getGFIPrice(),
      },
    }
  }

  static estimateApyFromGfi(
    stakedBalanceInDollars: BigNumber,
    portfolioBalanceInDollars: BigNumber,
    globalEstimatedApyFromGfi: BigNumber | undefined
  ): BigNumber | undefined {
    if (globalEstimatedApyFromGfi) {
      if (portfolioBalanceInDollars.gt(0)) {
        const balancePortionEarningGfi = stakedBalanceInDollars.div(portfolioBalanceInDollars)
        // NOTE: Because our frontend does not currently support staking with lockup, we do not
        // worry here about adjusting for the portion of the user's balance that is not only earning
        // GFI from staking, but is earning that GFI at a boosted rate due to having staked-with-lockup
        // (which they could have achieved by interacting with the contract directly, rather than using
        // our frontend).
        const userEstimatedApyFromGfi = balancePortionEarningGfi.multipliedBy(globalEstimatedApyFromGfi)
        return userEstimatedApyFromGfi
      } else {
        return globalEstimatedApyFromGfi
      }
    } else {
      return undefined
    }
  }

  static async fetchCoingeckoPrice(): Promise<FetchGFIPriceResult> {
    const res = await fetch(COINGECKO_API_GFI_PRICE_URL)
    const responseJson: unknown = await res.json()
    if (isCoingeckoResponseJson(responseJson)) {
      if (isUndefined(responseJson.goldfinch.usd)) {
        throw new Error("Coingecko response lacks GFI price in USD.")
      } else {
        return {usd: responseJson.goldfinch.usd}
      }
    } else {
      throw new Error("Coingecko response JSON failed type guard.")
    }
  }

  static async fetchCoinbasePrice(): Promise<FetchGFIPriceResult> {
    const res = await fetch(COINBASE_API_GFI_PRICE_URL)
    const responseJson: unknown = await res.json()
    if (isCoinbaseResponseJson(responseJson)) {
      if (isUndefined(responseJson.data.amount)) {
        throw new Error("Coinbase response lacks GFI price in USD.")
      } else {
        return {usd: parseFloat(responseJson.data.amount)}
      }
    } else {
      throw new Error("Coinbase response JSON failed type guard.")
    }
  }

  static async fetchGfiPrice(): Promise<FetchGFIPriceResult> {
    try {
      return await this.fetchCoingeckoPrice()
    } catch (err: unknown) {
      console.log("Failed to retrieve Coingecko GFI price. Falling back to Coinbase.")
      return await this.fetchCoinbasePrice()
    }
  }
}

export type GFILoaded = WithLoadedInfo<GFI, GFILoadedInfo>

const GFI_DECIMAL_PLACES = 18
const GFI_DECIMALS = new BigNumber(String(10 ** GFI_DECIMAL_PLACES))

function gfiFromAtomic(amount: BigNumber): string {
  return amount.div(GFI_DECIMALS).toString(10)
}

function gfiToAtomic(amount: BigNumber): string {
  return amount.multipliedBy(GFI_DECIMALS).toString(10)
}

export function gfiToDollarsAtomic(gfi: BigNumber, gfiPrice: BigNumber | undefined): BigNumber | undefined {
  if (gfiPrice === undefined) {
    return undefined
  }

  return gfi.multipliedBy(gfiPrice).div(
    // This might be better thought of as the GFI-price mantissa, which happens to
    // be the same as `GFI_DECIMALS`.
    GFI_DECIMALS
  )
}
export function gfiInDollars(gfiInDollarsAtomic: BigNumber | undefined): BigNumber | undefined {
  if (gfiInDollarsAtomic === undefined) {
    return undefined
  }

  return new BigNumber(gfiFromAtomic(gfiInDollarsAtomic))
}

async function getGFIPrice(): Promise<BigNumber | undefined> {
  const toggleGetGFIPrice = process.env.REACT_APP_TOGGLE_GET_GFI_PRICE === "true"
  if (!toggleGetGFIPrice) {
    return undefined
  }

  try {
    const fetchResult = await GFI.fetchGfiPrice()
    if (fetchResult.usd === 0) {
      console.log("Retrieved GFI price of 0. Handling as `undefined`.")
      return undefined
    } else {
      return new BigNumber(fetchResult.usd).multipliedBy(GFI_DECIMALS)
    }
  } catch (err: unknown) {
    console.error("Failed to retrieve GFI price.")
    return undefined
  }
}

export {GFI, GFI_DECIMAL_PLACES, GFI_DECIMALS, gfiFromAtomic, gfiToAtomic}
