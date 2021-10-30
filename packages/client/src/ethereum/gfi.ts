import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {GFI as GFIContract} from "@goldfinch-eng/protocol/typechain/web3/GFI"
import BigNumber from "bignumber.js"
import {Loadable, WithLoadedInfo} from "../types/loadable"
import {BlockInfo} from "../utils"

type GFILoadedInfo = {
  currentBlock: BlockInfo
  price: BigNumber
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
        // // TODO Use a remote source for this price once there is one.
        price: new BigNumber(1).multipliedBy(GFI_DECIMALS),
      },
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

export function gfiToDollarsAtomic(gfi: BigNumber, gfiPrice: BigNumber): BigNumber {
  return gfi.multipliedBy(gfiPrice).div(
    // This might be better thought of as the GFI-price mantissa, which happens to
    // be the same as `GFI_DECIMALS`.
    GFI_DECIMALS
  )
}
export function gfiInDollars(gfiInDollarsAtomic: BigNumber): BigNumber {
  return new BigNumber(gfiFromAtomic(gfiInDollarsAtomic))
}

export {GFI, GFI_DECIMAL_PLACES, GFI_DECIMALS, gfiFromAtomic, gfiToAtomic}
