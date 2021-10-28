import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/web3/GoldfinchConfig"
import {BaseContract, ContractEventLog} from "@goldfinch-eng/protocol/typechain/web3/types"
import BigNumber from "bignumber.js"
import _ from "lodash"
import {BlockNumber} from "web3-core"
import {Contract, Filter} from "web3-eth-contract"
import {BlockInfo} from "../utils"
import web3 from "../web3"
import {ERC20, getERC20} from "./erc20"
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

  getERC20(ticker: string): ERC20 {
    return getERC20(ticker, this)
  }

  getContract<T = Contract>(contractOrAbi: string | any, address?: string) {
    let abi = this.deployments.contracts[contractOrAbi]?.abi
    if (abi) {
      address = address || this.getAddress(contractOrAbi)
    } else {
      abi = contractOrAbi
    }
    const contractObj = new web3.eth.Contract(abi, address) as any
    contractObj.loaded = true
    return contractObj as T
  }

  getAddress(contract: string): string {
    return this.deployments.contracts[contract].address
  }

  async getConfigNumber(key: number, currentBlock: BlockInfo): Promise<BigNumber> {
    let configContract = this.getContract<GoldfinchConfig>("GoldfinchConfig")
    const result = (await configContract.methods.getNumber(key).call(undefined, currentBlock.number)).toString()
    return new BigNumber(result)
  }

  async queryEvents(
    contract: string | Contract | BaseContract,
    events: string | string[],
    filter?: Filter,
    toBlock: BlockNumber = "latest"
  ) {
    let contractObj: Contract
    if (typeof contract == "string") {
      contractObj = this.getContract<Contract>(contract)
    } else {
      contractObj = contract as Contract
    }
    const eventArrays = await Promise.all(
      ([] as string[]).concat(events).map((eventName) => {
        return contractObj.getPastEvents(eventName, {
          filter: filter,
          fromBlock: getFromBlock(this.networkId),
          toBlock,
        })
      })
    )
    return _.compact(_.concat(_.flatten(eventArrays)))
  }

  async queryEvent<T extends ContractEventLog<any>>(
    contract: string | Contract | BaseContract,
    event: string,
    filter?: Filter,
    toBlock: BlockNumber = "latest"
  ) {
    return (await this.queryEvents(contract, event, filter, toBlock)) as any as T[]
  }
}

export {GoldfinchProtocol}
