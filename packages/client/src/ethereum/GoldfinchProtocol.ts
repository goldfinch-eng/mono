import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/web3/GoldfinchConfig"
import {BaseContract} from "@goldfinch-eng/protocol/typechain/web3/types"
import BigNumber from "bignumber.js"
import _, {isNumber} from "lodash"
import {BlockNumber} from "web3-core"
import {Contract, Filter, PastEventOptions} from "web3-eth-contract"
import {KnownEventData, KnownEventName} from "../types/events"
import {Web3IO} from "../types/web3"
import {BlockInfo} from "../utils"
import getWeb3 from "../web3"
import {ERC20, getERC20, Ticker} from "./erc20"
import {reduceToKnown} from "./events"
import {getDeployments, getFromBlock, getLegacyDeployments, MAINNET} from "./utils"
import {EventData} from "web3-eth-contract"
import {assertNonNullable} from "@goldfinch-eng/utils"
import {NetworkConfig} from "../types/network"

const pastEventsTempCache: {[key: string]: Promise<EventData[]>} = {}

// Some requests using the walletConnect provider that were made twice in a
// short amount of time were having structure problems when decoding, so we
// decided to use a simple cache for the requests.
// We can safely cache these requests because the results for a given query
// should be constant over time as long as the query is pinned to a particular
// block number.
function getCachedPastEvents(
  contract: Contract | BaseContract,
  eventName: KnownEventName,
  options: PastEventOptions
): Promise<EventData[]> {
  const queryParams = {eventName, options}
  const cacheKey = JSON.stringify({contractAddress: contract["_address"], ...queryParams})
  if (!isNumber(options.toBlock)) {
    throw new Error("The toBlock parameter must be a number so that the result can be safely cached as constant.")
  }
  if (!pastEventsTempCache[cacheKey]) {
    pastEventsTempCache[cacheKey] = contract.getPastEvents(queryParams.eventName, queryParams.options)
  }
  const result = pastEventsTempCache[cacheKey]
  assertNonNullable(result)
  return result
}

class GoldfinchProtocol {
  networkId: string
  deployments: any
  legacyDeployments: any

  constructor(networkConfig: NetworkConfig) {
    this.networkId = networkConfig.name
  }

  async initialize() {
    this.deployments = await getDeployments(this.networkId)
    this.legacyDeployments = await getLegacyDeployments(this.networkId)
  }

  getERC20(ticker: Ticker): ERC20 {
    return getERC20(ticker, this)
  }

  getContract<T = Contract>(contractOrAbi: string | any, address?: string, legacy: boolean = false): Web3IO<T> {
    const web3 = getWeb3()
    const deployments = legacy ? this.legacyDeployments : this.deployments
    let abi = deployments.contracts[contractOrAbi]?.abi
    if (abi) {
      address = address || this.getAddress(contractOrAbi, legacy)
    } else {
      abi = contractOrAbi
    }
    const readOnly = new web3.readOnly.eth.Contract(abi, address) as unknown as T
    ;(readOnly as any).loaded = true
    const userWallet = new web3.userWallet.eth.Contract(abi, address) as unknown as T
    ;(userWallet as any).loaded = true
    return {readOnly, userWallet}
  }

  getAddress(contract: string, legacy: boolean = false): string {
    const deployments = legacy ? this.legacyDeployments : this.deployments
    return deployments.contracts[contract].address
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
    toBlock: BlockNumber,
    fromBlock?: BlockNumber
  ): Promise<KnownEventData<T>[]> {
    let contractObj: Web3IO<Contract>
    if (typeof contract == "string") {
      contractObj = this.getContract<Contract>(contract)
    } else {
      contractObj = {readOnly: contract as Contract, userWallet: contract as Contract}
    }
    const eventArrays = await Promise.all(
      eventNames.map((eventName) =>
        getCachedPastEvents(contractObj.readOnly, eventName, {
          filter,
          fromBlock: fromBlock || getFromBlock(this.networkId),
          toBlock,
        })
      )
    )
    const compacted = _.compact(_.concat(_.flatten(eventArrays)))
    return reduceToKnown(compacted, eventNames)
  }

  get networkIsMainnet(): boolean {
    return this.networkId === MAINNET
  }
}

export {GoldfinchProtocol, getCachedPastEvents}
