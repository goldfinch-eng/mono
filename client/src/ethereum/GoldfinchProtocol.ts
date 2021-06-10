import web3 from "../web3"
import { getDeployments, getFromBlock } from "./utils"
import { ERC20, getERC20 } from "./erc20"
import _ from "lodash"
import { Contract } from "web3-eth-contract"

class GoldfinchProtocol {
  networkId: string
  deployments: any

  constructor(netowrkConfig) {
    this.networkId = netowrkConfig.name
  }

  async initialize() {
    this.deployments = await getDeployments(this.networkId)
  }

  getERC20(ticker: string): ERC20 {
    return getERC20(ticker, this)
  }

  getContract<T>(contract: string, address?: string) {
    const abi = this.deployments.contracts[contract].abi
    address = address || this.getAddress(contract)
    const contractObj = new web3.eth.Contract(abi, address) as any
    contractObj.loaded = true
    return contractObj as T
  }

  getAddress(contract: string): string {
    return this.deployments.contracts[contract].address
  }

  async queryEvents(contract: string, events, filter) {
    const contractObj = this.getContract<Contract>(contract)
    const eventArrays = await Promise.all(
      events.map(eventName => {
        return contractObj.getPastEvents(eventName, {
          filter: filter,
          fromBlock: getFromBlock(this.networkId),
          toBlock: "latest",
        })
      }),
    )
    return _.compact(_.concat(_.flatten(eventArrays)))
  }
}

export { GoldfinchProtocol }
