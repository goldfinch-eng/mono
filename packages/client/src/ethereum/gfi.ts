import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {GFI as GFIContract} from "@goldfinch-eng/protocol/typechain/web3/GFI"
import BigNumber from "bignumber.js"
import {Loadable, WithLoadedInfo} from "../types/loadable"
import {BlockInfo} from "../utils"

type GFILoadedInfo = {
  currentBlock: BlockInfo
  price: BigNumber | undefined
}

interface FetchGfiPriceResult {
  goldfinch: {usd: number | undefined}
}
class GFI {
  goldfinchProtocol: GoldfinchProtocol
  contract: GFIContract
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
  ) {
    if (process.env.REACT_APP_TOGGLE_REWARDS !== "true") {
      return new BigNumber(0)
    }
    if (portfolioBalanceInDollars.gt(0)) {
      const balancePortionEarningGfi = stakedBalanceInDollars.div(portfolioBalanceInDollars)
      // NOTE: Because our frontend does not currently support staking with lockup, we do not
      // worry here about adjusting for the portion of the user's balance that is not only earning
      // GFI from staking, but is earning that GFI at a boosted rate due to having staked-with-lockup
      // (which they could have achieved by interacting with the contract directly, rather than using
      // our frontend).
      const userEstimatedApyFromGfi = globalEstimatedApyFromGfi
        ? balancePortionEarningGfi.multipliedBy(globalEstimatedApyFromGfi)
        : undefined
      return userEstimatedApyFromGfi
    } else {
      return globalEstimatedApyFromGfi
    }
  }

  static async fetchGfiPrice() {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=goldfinch&vs_currencies=usd")
    const responseJson = await res.json()
    if (responseJson.goldfinch?.usd) {
      return await responseJson
    } else {
      console.error("[GFI Price] No USD price returned")
      return {goldfinch: {usd: undefined}}
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
  const toggleGFIPrice = process.env.REACT_APP_TOGGLE_GET_GFI_PRICE === "true"
  if (!toggleGFIPrice) {
    return undefined
  }

  const fetchResult: FetchGfiPriceResult = await GFI.fetchGfiPrice()
  if (fetchResult.goldfinch.usd === undefined) {
    return undefined
  }
  return new BigNumber(fetchResult.goldfinch.usd).multipliedBy(GFI_DECIMALS)
}

export {GFI, GFI_DECIMAL_PLACES, GFI_DECIMALS, gfiFromAtomic, gfiToAtomic}
