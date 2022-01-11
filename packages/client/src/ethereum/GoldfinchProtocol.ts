import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/web3/GoldfinchConfig"
import {BaseContract} from "@goldfinch-eng/protocol/typechain/web3/types"
import BigNumber from "bignumber.js"
import _ from "lodash"
import {BlockNumber} from "web3-core"
import {Contract, Filter} from "web3-eth-contract"
import {KnownEventData, KnownEventName} from "../types/events"
import {Web3IO} from "../types/web3"
import {BlockInfo} from "../utils"
import web3 from "../web3"
import {ERC20, getERC20, Ticker} from "./erc20"
import {reduceToKnown} from "./events"
import {getDeployments, getFromBlock} from "./utils"

class GoldfinchProtocol {
  networkId: string
  deployments: any

  constructor(networkConfig) {
    this.networkId = networkConfig.name
  }

  async initialize() {
    this.deployments = await getDeployments(this.networkId)
  }

  getERC20(ticker: Ticker): ERC20 {
    return getERC20(ticker, this)
  }

  getContract<T = Contract>(contractOrAbi: string | any, address?: string): Web3IO<T> {
    let abi = this.deployments.contracts[contractOrAbi]?.abi
    if (abi) {
      address = address || this.getAddress(contractOrAbi)
    } else {
      abi = contractOrAbi
    }
    const readOnly = new web3.readOnly.eth.Contract(abi, address) as unknown as T
    ;(readOnly as any).loaded = true
    const userWallet = new web3.userWallet.eth.Contract(abi, address) as unknown as T
    ;(userWallet as any).loaded = true
    return {readOnly, userWallet}
  }

  getAddress(contract: string): string {
    return this.deployments.contracts[contract].address
  }

  async getConfigNumber(key: number, currentBlock: BlockInfo): Promise<BigNumber> {
    let configContract = this.getContract<GoldfinchConfig>("GoldfinchConfig")
    const result = (
      await configContract.readOnly.methods.getNumber(key).call(undefined, currentBlock.number)
    ).toString()
    return new BigNumber(result)
  }

  async queryEvents<T extends KnownEventName>(
    contract: string | Contract | BaseContract,
    eventNames: T[],
    filter: Filter | undefined,
    toBlock: BlockNumber
  ): Promise<KnownEventData<T>[]> {
    let contractObj: Web3IO<Contract>
    if (typeof contract == "string") {
      contractObj = this.getContract<Contract>(contract)
    } else {
      contractObj = {readOnly: contract as Contract, userWallet: contract as Contract}
    }
    const eventArrays = await Promise.all(
      eventNames.map((eventName) => {
        return contractObj.readOnly.getPastEvents(eventName, {
          filter: filter,
          fromBlock: getFromBlock(this.networkId),
          toBlock,
        })
      })
    )
    const compacted = _.compact(_.concat(_.flatten(eventArrays)))
    return reduceToKnown(compacted, eventNames)
  }
}

export {GoldfinchProtocol}
