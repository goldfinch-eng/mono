import web3 from "../web3"
import { submitGaslessTransaction } from "./gasless"
import { getFromBlock } from "./utils"
import BigNumber from "bignumber.js"
import { getOneInchContract } from "./oneInch"
import { Contract } from "web3-eth-contract"
import { ERC20 } from "./erc20"
import { GoldfinchProtocol } from "./GoldfinchProtocol"
import { TranchedPool as TranchedPoolContract } from "../typechain/web3/TranchedPool"

const BorrowerAbi = require("../../abi/Borrower.json")

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
