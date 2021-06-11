import { GoldfinchProtocol } from "./GoldfinchProtocol"
import { TranchedPool as TranchedPoolContract } from "../typechain/web3/TranchedPool"

class TranchedPool {
  address: string
  goldfinchProtocol: GoldfinchProtocol
  contract: TranchedPoolContract
  creditLineAddress!: string

  constructor(address: string, goldfinchProtocol: GoldfinchProtocol) {
    this.address = address
    this.goldfinchProtocol = goldfinchProtocol
    this.contract = this.goldfinchProtocol.getContract<TranchedPoolContract>("TranchedPool", address)
  }

  async initialize() {
    this.creditLineAddress = await this.contract.methods.creditLine().call()
  }
}

export { TranchedPool }
