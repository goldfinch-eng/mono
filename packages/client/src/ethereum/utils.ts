import {
  isMerkleDirectDistributorInfo,
  MerkleDirectDistributorInfo,
} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDirectDistributor/types"
import {
  isMerkleDistributorInfo,
  MerkleDistributorInfo,
} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDistributor/types"
import {BaseContract} from "@goldfinch-eng/protocol/typechain/web3/types"
import BigNumber from "bignumber.js"
import BN from "bn.js"
import _ from "lodash"
import {Contract, EventData} from "web3-eth-contract"
import {KnownEventData, PoolEventType} from "../types/events"
import {NetworkConfig} from "../types/network"
import {reduceToKnown} from "./events"
import {Pool, SeniorPool} from "./pool"
import {getCachedPastEvents} from "./GoldfinchProtocol"

const V2_2_MIGRATION_TIME = new Date(2022, 1, 4).getTime() / 1000
export const getIsMultipleSlicesCompatible = (termStartTime: BigNumber) =>
  termStartTime.eq(0) || termStartTime.toNumber() >= V2_2_MIGRATION_TIME

const decimalPlaces = 6
const decimals = new BN(String(10 ** decimalPlaces))
const USDC_DECIMALS = decimals
const CONFIRMATION_THRESHOLD = 6
const ETHDecimals = new BN(String(1e18))
const INTEREST_DECIMALS = new BN(String(1e18))
const SECONDS_PER_DAY = 60 * 60 * 24
const DAYS_PER_YEAR = 365
const SECONDS_PER_YEAR = SECONDS_PER_DAY * DAYS_PER_YEAR
const MAX_UINT = new BN("115792089237316195423570985008687907853269984665640564039457584007913129639935")
const ONE_QUADRILLION_USDC = "1000000000000000000000"
const MAINNET = "mainnet"
const ROPSTEN = "ropsten"
export const RINKEBY = "rinkeby"
const LOCAL = "localhost"
const MAINNET_LAUNCH_BLOCK = "11370658"
const USDC_ADDRESSES = {
  [ROPSTEN]: "0x07865c6e87b9f70255377e024ace6630c1eaa37f",
  [MAINNET]: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
}

const USDT_ADDRESSES = {
  [MAINNET]: "0xdac17f958d2ee523a2206206994597c13d831ec7",
}

const BUSD_ADDRESSES = {
  [MAINNET]: "0x4Fabb145d64652a948d72533023f6E7A623C7C53",
}

const CURVE_LP_TOKEN_ADDRESSES = {
  [MAINNET]: "0x42ec68ca5c2c80036044f3eead675447ab3a8065",
}

const ONE_INCH_ADDRESSES = {
  [LOCAL]: "0xc586bef4a0992c495cf22e1aeee4e446cecdee0e",
  [MAINNET]: "0xc586bef4a0992c495cf22e1aeee4e446cecdee0e",
}

// Only keep entries for supported networks
// (ie. where we deployed the latest contracts)
const mapNetworkToID: Record<string, string> = {
  main: MAINNET,
  ropsten: ROPSTEN,
  private: "localhost",
  rinkeby: RINKEBY,
}

const chainIdToNetworkID = {
  1: MAINNET,
  4: RINKEBY,
  31337: "localhost",
}

const SUPPORTED_NETWORKS: Record<string, boolean> = {
  [MAINNET]: true,
  [LOCAL]: true,
  [RINKEBY]: true,
}

enum SupportedChainId {
  MAINNET = 1,
  ROPSTEN = 3,
  LOCAL = 31337,
  MURMURATION = 31337,
}

const MURMURATION_RPC_URL = "https://murmuration.goldfinch.finance/_chain"

// Defines the chain info to add in case it doesn't exist on the user's wallet,
// since all the supported networks are default ones, the only one we need to
// specify is the one for murmuration
const ChainInfoToAdd: Record<number, {label: string; rpcUrl: string}> = {
  [SupportedChainId.MURMURATION]: {
    label: "Murmuration",
    rpcUrl: MURMURATION_RPC_URL,
  },
}

let config
async function getDeployments(networkId) {
  if (config) {
    return Promise.resolve(config[networkId])
  }
  const fileNameSuffix = process.env.NODE_ENV === "development" ? "_dev" : ""
  return import(`@goldfinch-eng/protocol/deployments/all${fileNameSuffix}.json`)
    .then((result) => {
      config = transformedConfig(result)

      if (networkId === "localhost" && isMainnetForking()) {
        // If we're on the fork, then need to use the mainnet proxy contract addresses instead of the
        // freshly deployed version
        const mainnetContracts = ["CreditDesk", "Pool", "Fidu", "GoldfinchFactory"]
        const mainnetConfig = config["mainnet"].contracts
        mainnetContracts.forEach((contract) => {
          let mainnetName = contract
          if (mainnetConfig[mainnetName]) {
            const networkContracts = config[networkId].contracts
            networkContracts[contract].address = mainnetConfig[mainnetName].address
            networkContracts[`${contract}_Proxy`] = networkContracts[`${contract}_Proxy`] || {}
            let mainnetProxy = mainnetConfig[`${mainnetName}_Proxy`] || networkContracts[contract]
            networkContracts[`${contract}_Proxy`].address = mainnetProxy.address
          }
        })
      }
      return config[networkId]
    })
    .catch(console.error)
}

let legacyConfig
async function getLegacyDeployments(networkId) {
  if (legacyConfig) {
    return Promise.resolve(legacyConfig[networkId])
  }
  return import("@goldfinch-eng/protocol/deployments/legacy-all.json")
    .then((result) => {
      legacyConfig = transformedConfig(result)
      return legacyConfig[networkId]
    })
    .catch(console.error)
}

export function isMainnetForking(): boolean {
  return process.env.REACT_APP_HARDHAT_FORK === MAINNET
}

async function getMerkleDistributorInfo(networkId: string): Promise<MerkleDistributorInfo | undefined> {
  const fileNameSuffix =
    process.env.NODE_ENV === "development" && networkId === LOCAL && !isMainnetForking() ? ".dev" : ""

  return import(
    `@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDistributor/merkleDistributorInfo${fileNameSuffix}.json`
  )
    .then((result: unknown): MerkleDistributorInfo => {
      const plain = _.toPlainObject(result)
      if (isMerkleDistributorInfo(plain)) {
        return plain
      } else {
        throw new Error("Merkle distributor info failed type guard.")
      }
    })
    .catch((err: unknown): undefined => {
      console.error(err)
      return
    })
}

async function getBackerMerkleDistributorInfo(networkId: string): Promise<MerkleDistributorInfo | undefined> {
  let fileNameSuffix = ""
  if (process.env.NODE_ENV === "development" && networkId === LOCAL && !isMainnetForking()) {
    fileNameSuffix = ".dev"
  }

  return import(
    `@goldfinch-eng/protocol/blockchain_scripts/merkle/backerMerkleDistributor/merkleDistributorInfo${fileNameSuffix}.json`
  )
    .then((result: unknown): MerkleDistributorInfo => {
      const plain = _.toPlainObject(result)
      if (isMerkleDistributorInfo(plain)) {
        return plain
      } else {
        throw new Error("Merkle distributor info failed type guard.")
      }
    })
    .catch((err: unknown): undefined => {
      console.error(err)
      return
    })
}

async function getMerkleDirectDistributorInfo(networkId: string): Promise<MerkleDirectDistributorInfo | undefined> {
  const fileNameSuffix =
    process.env.NODE_ENV === "development" && networkId === LOCAL && !isMainnetForking() ? ".dev" : ""

  return import(
    `@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDirectDistributor/merkleDirectDistributorInfo${fileNameSuffix}.json`
  )
    .then((result: unknown): MerkleDirectDistributorInfo => {
      const plain = _.toPlainObject(result)
      if (isMerkleDirectDistributorInfo(plain)) {
        return plain
      } else {
        throw new Error("Merkle direct distributor info failed type guard.")
      }
    })
    .catch((err: unknown): undefined => {
      console.error(err)
      return
    })
}

async function getBackerMerkleDirectDistributorInfo(
  networkId: string
): Promise<MerkleDirectDistributorInfo | undefined> {
  let fileNameSuffix = ""
  if (process.env.NODE_ENV === "development" && networkId === LOCAL && !isMainnetForking()) {
    fileNameSuffix = ".dev"
  }
  return import(
    `@goldfinch-eng/protocol/blockchain_scripts/merkle/backerMerkleDirectDistributor/merkleDirectDistributorInfo${fileNameSuffix}.json`
  )
    .then((result: unknown): MerkleDirectDistributorInfo => {
      const plain = _.toPlainObject(result)
      if (isMerkleDirectDistributorInfo(plain)) {
        return plain
      } else {
        throw new Error("Merkle direct distributor info failed type guard.")
      }
    })
    .catch((err: unknown): undefined => {
      console.error(err)
      return
    })
}

function transformedConfig(config) {
  return _.reduce(
    config,
    (result, item) => {
      _.toArray(item).forEach((networkConfig) => {
        return _.merge(result, networkConfig)
      })
      return result
    },
    {}
  )
}

function getFromBlock(chain: string): string {
  if (chain === MAINNET) {
    return MAINNET_LAUNCH_BLOCK
  } else {
    return "earliest"
  }
}

type MethodInfo = {method: string; name?: string; args?: any}
async function fetchDataFromAttributes(
  web3Obj: Contract | BaseContract,
  attributes: MethodInfo[],
  {bigNumber, blockNumber}: {bigNumber?: boolean; blockNumber?: number} = {}
): Promise<any> {
  const result = {}
  if (!web3Obj) {
    return Promise.resolve(result)
  }
  var promises = attributes.map((methodInfo) => {
    return web3Obj.methods[methodInfo.method](...(methodInfo?.args || [])).call(undefined, blockNumber)
  })
  return Promise.all(promises)
    .then((results) => {
      attributes.forEach((methodInfo, index) => {
        if (bigNumber) {
          result[methodInfo?.name || methodInfo.method] = new BigNumber(results[index])
        } else {
          result[methodInfo?.name || methodInfo.method] = results[index]
        }
      })
      return result
    })
    .catch((e) => {
      throw new Error(e)
    })
}

const POOL_EVENTS_BLOCKS_CHUNK_SIZE = 2000000
type PoolEventsChunk = {fromBlock: string; toBlock: number}

function chunkPoolEvents(pool: SeniorPool | Pool, fromBlock: string, toBlock: number): PoolEventsChunk[] {
  if (pool.chain === MAINNET) {
    const start = parseInt(fromBlock, 10)
    if (!_.isInteger(start)) {
      throw new Error("Expected mainnet from-block to be an integer.")
    }
    const end = toBlock

    const chunks: PoolEventsChunk[] = []
    let working = start
    while (working < end) {
      chunks.push({
        fromBlock: working.toString(10),
        toBlock: Math.min(end, working + POOL_EVENTS_BLOCKS_CHUNK_SIZE),
      })
      working += POOL_EVENTS_BLOCKS_CHUNK_SIZE
    }
    return chunks
  } else {
    return [
      {
        fromBlock,
        toBlock,
      },
    ]
  }
}

async function getPoolEvents<T extends PoolEventType>(
  pool: SeniorPool | Pool,
  address: string | undefined,
  eventNames: T[],
  toBlock: number
): Promise<KnownEventData<T>[]> {
  const fromBlock = getFromBlock(pool.chain)
  const chunks = chunkPoolEvents(pool, fromBlock, toBlock)
  const events = await Promise.all(
    eventNames.map(
      async (eventName): Promise<EventData[]> =>
        _.flatten(
          await Promise.all(
            chunks.map(
              (chunk): Promise<EventData[]> =>
                getCachedPastEvents(pool.contract.readOnly, eventName, {
                  filter: address ? {capitalProvider: address} : undefined,
                  fromBlock: chunk.fromBlock,
                  toBlock: chunk.toBlock,
                })
            )
          )
        )
    )
  )
  const compacted = _.compact(_.flatten(events))
  return reduceToKnown(compacted, eventNames)
}

const getEtherscanSubdomain = (network: NetworkConfig | undefined): string | undefined =>
  network ? (network.name === "mainnet" ? "" : `${network.name}.`) : undefined

const ONE_YEAR_SECONDS = new BigNumber(60 * 60 * 24 * 365)

export {
  getDeployments,
  getLegacyDeployments,
  getMerkleDistributorInfo,
  getBackerMerkleDistributorInfo,
  getMerkleDirectDistributorInfo,
  getBackerMerkleDirectDistributorInfo,
  mapNetworkToID,
  SupportedChainId,
  ChainInfoToAdd,
  transformedConfig,
  fetchDataFromAttributes,
  decimalPlaces,
  decimals,
  ETHDecimals,
  USDC_ADDRESSES,
  USDT_ADDRESSES,
  BUSD_ADDRESSES,
  CURVE_LP_TOKEN_ADDRESSES,
  MAX_UINT,
  USDC_DECIMALS,
  INTEREST_DECIMALS,
  SECONDS_PER_DAY,
  DAYS_PER_YEAR,
  SECONDS_PER_YEAR,
  CONFIRMATION_THRESHOLD,
  SUPPORTED_NETWORKS,
  ONE_INCH_ADDRESSES,
  getFromBlock,
  chainIdToNetworkID,
  MAINNET,
  LOCAL,
  getPoolEvents,
  getEtherscanSubdomain,
  ONE_YEAR_SECONDS,
  ONE_QUADRILLION_USDC,
}
