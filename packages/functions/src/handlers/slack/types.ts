import {ChatPostMessageArguments} from "@slack/web-api"
import {BigNumber} from "ethers"

/**
 * A handler that, given an event, returns a ready-to-send slack message.
 *
 * @dev Require title so we always have notification text
 */
export type SlackHandler = (event: Event) => Promise<ChatPostMessageArguments & {title: string}>

/**
 * An event emitted from an Openzeppelin Sentinel.
 *
 * https://docs.openzeppelin.com/defender/sentinel#event_schema
 * Note: Linked schema is not fully accurate. It's better to add logging and
 * empirically test the schema
 */
export type Event = {
  type: "BLOCK"
  blockHash: string
  blockNumber: string
  hash: string
  timestamp: number
  /** The eth_getTransactionReceipt response body. See https://eips.ethereum.org/EIPS/eip-1474 */
  transaction: {
    /** Address of contract interacted with */
    contractAddress: string
    /** Who the transaction is from */
    from: string
    /** Target of the transaction */
    to: string
    blockHash: string
    blockNumber: string
    transactionHash: string
    transactionIndex: string
    cumulativeGasUsed: string
    gasUsed: string
    status: string
  }
  matchReasons: {
    /** Type is currently non-exhaustive, other options may exist */
    type: "function" | "transaction"
    address: string
    /** Signature of the target, for example: 'greet(name)' */
    signature: string
    condition: string
    args: string[]
    params: Record<string, string>
  }[]
  /** Addresses being monitored by the sentinel present in this transaction */
  matchedAddresses: string[]
  sentinel: {
    id: string
    name: string
    abi: string[]
    addresses: string[]
    confirmBlocks: number
    network: "mainnet" | "rinkeby"
    chainId: 1 | 4
  }
  /** The value of the transaction. If it's an ERC20 transfer, it is the amount of ERC20 transferred */
  value: BigNumber
}

export type ContractMetadata = {
  toLabel?: (amount: BigNumber) => string
}
