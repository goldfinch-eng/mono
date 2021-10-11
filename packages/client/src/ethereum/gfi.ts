import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {GFI as GFIContract} from "@goldfinch-eng/protocol/typechain/web3/GFI"

class GFI {
  goldfinchProtocol: GoldfinchProtocol
  contract: GFIContract
  address: string
  _loaded: boolean

  constructor(goldfinchProtocol: GoldfinchProtocol) {
    this.goldfinchProtocol = goldfinchProtocol
    this.contract = goldfinchProtocol.getContract<GFIContract>("GFI")
    this.address = goldfinchProtocol.getAddress("GFI")
    this._loaded = true
  }

  async initialize() {}
}

export {GFI}
