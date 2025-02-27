// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../node_modules/hardhat-deploy/src/type-extensions.ts" />
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../../../node_modules/@nomiclabs/hardhat-ethers/internal/type-extensions.d.ts" />
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../../../node_modules/@nomiclabs/hardhat-web3/src/type-extensions.ts" />
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../../../node_modules/@nomiclabs/hardhat-truffle5/dist/src/type-extensions.d.ts" />
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../typechain/truffle/types.d.ts" />

import {CHAIN_CONFIG_BY_CHAIN_ID} from "@goldfinch-eng/goldfinch-prime/config/chainConfigs"
import {AssertionError, assertIsString, assertNonNullable, genExhaustiveTuple} from "@goldfinch-eng/utils"
import BN from "bn.js"
import {BaseContract, Contract, PopulatedTransaction, Signer} from "ethers"
import hre, {artifacts, ethers, getChainId, getNamedAccounts, web3} from "hardhat"
import {DeploymentsExtension} from "hardhat-deploy/types"

import hardhatConfigBase from "../../hardhat.config.base"
import {GoldfinchConfig} from "../../typechain/ethers"
import {CONFIG_KEYS} from "../configKeys"
import {MAINNET_GOVERNANCE_MULTISIG} from "../mainnetForkingHelpers"
import {ContractDeployer} from "./contractDeployer"
import {ProbablyValidContract} from "./contracts"
import {ContractUpgrader} from "./contractUpgrader"
import {getExistingContracts} from "./getExistingContracts"
import {getNetworkNameByChainId} from "./getNetworkNameByChainId"
import {getResourceAddressForNetwork} from "./getResourceForNetwork"
import {DeployEffects} from "../migrations/deployEffects"

const USDCDecimals = new BN(String(1e6))
const ETHDecimals = new BN(String(1e18))
const LEVERAGE_RATIO_DECIMALS = new BN(String(1e18))
const INTEREST_DECIMALS = new BN(String(1e18))

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

const MAINNET_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" // Base mainnet USDC
const BASESEPOLIA_USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" // Base Sepolia USDC
const LOCAL = "localhost"
const MAINNET = "base"
const BASESEPOLIA = "base-sepolia"

export type ChainName = typeof LOCAL | typeof MAINNET | typeof BASESEPOLIA

export const MAX_UINT = new BN("115792089237316195423570985008687907853269984665640564039457584007913129639935")
export const USDC_MANTISSA = 1e6

const LOCAL_CHAIN_ID = "31337"
type LocalChainId = typeof LOCAL_CHAIN_ID
const MAINNET_CHAIN_ID = "8453" // Base mainnet
const BASE_SEPOLIA_CHAIN_ID = "84532" // Base mainnet
type MainnetChainId = typeof MAINNET_CHAIN_ID

export type ChainId = LocalChainId | MainnetChainId | typeof BASE_SEPOLIA_CHAIN_ID

const CHAIN_IDS = genExhaustiveTuple<ChainId>()(LOCAL_CHAIN_ID, MAINNET_CHAIN_ID, BASE_SEPOLIA_CHAIN_ID)
export const assertIsChainId: (val: unknown) => asserts val is ChainId = (val: unknown): asserts val is ChainId => {
  if (!(CHAIN_IDS as unknown[]).includes(val)) {
    throw new AssertionError(`${val} is not in \`CHAIN_IDS\`.`)
  }
}

const CHAIN_NAME_BY_ID: Record<ChainId, ChainName> = {
  [LOCAL_CHAIN_ID]: LOCAL,
  [MAINNET_CHAIN_ID]: MAINNET,
  [BASE_SEPOLIA_CHAIN_ID]: BASESEPOLIA,
}

export type AddressString = string

const USDC = "USDC"
type USDCTicker = typeof USDC
const ETH = "ETH"
type ETHTicker = typeof ETH

function assertIsTicker(val: string): asserts val is Ticker {
  if (!TICKERS.includes(val)) {
    throw new AssertionError(`${val} is not in the allowed Ticker list: ${TICKERS}`)
  }
}

const USDC_ADDRESSES: Record<typeof MAINNET | typeof BASESEPOLIA, AddressString> = {
  [MAINNET]: MAINNET_USDC_ADDRESS,
  [BASESEPOLIA]: BASESEPOLIA_USDC_ADDRESS,
}
const ERC20_ADDRESSES = {
  [USDC]: USDC_ADDRESSES,
}

type SafeConfigChainId = MainnetChainId | typeof BASE_SEPOLIA_CHAIN_ID
const SAFE_CONFIG_CHAIN_IDS = genExhaustiveTuple<SafeConfigChainId>()(MAINNET_CHAIN_ID, BASE_SEPOLIA_CHAIN_ID)
export const isSafeConfigChainId = (val: unknown): val is SafeConfigChainId =>
  (SAFE_CONFIG_CHAIN_IDS as unknown[]).includes(val)

type SafeConfig = Record<SafeConfigChainId, {safeAddress: AddressString; executor: AddressString}>
const SAFE_CONFIG: SafeConfig = {
  [MAINNET_CHAIN_ID]: {
    safeAddress: CHAIN_CONFIG_BY_CHAIN_ID[MAINNET_CHAIN_ID]?.governanceAddress,
    executor: CHAIN_CONFIG_BY_CHAIN_ID[MAINNET_CHAIN_ID]?.governanceMultisigExecutor,
  },
  [BASE_SEPOLIA_CHAIN_ID]: {
    safeAddress: getResourceAddressForNetwork("Protocol Owner", "baseSepolia"),
    executor: "0x483e2BaF7F4e0Ac7D90c2C3Efc13c3AF5050F3c2",
  },
} as SafeConfig

const MAINNET_PAUSER_ADDRESS = "0x061e0b0087a01127554ffef8f9c4c6e9447ad9dd"

export const OWNER_ROLE = web3.utils.keccak256("OWNER_ROLE")
export const PAUSER_ROLE = web3.utils.keccak256("PAUSER_ROLE")
export const GO_LISTER_ROLE = web3.utils.keccak256("GO_LISTER_ROLE")
export const MINTER_ROLE = web3.utils.keccak256("MINTER_ROLE")
export const REDEEMER_ROLE = web3.utils.keccak256("REDEEMER_ROLE")
export const DISTRIBUTOR_ROLE = web3.utils.keccak256("DISTRIBUTOR_ROLE")
export const SIGNER_ROLE = web3.utils.keccak256("SIGNER_ROLE")
export const LOCKER_ROLE = web3.utils.keccak256("LOCKER_ROLE")

const TRANCHES = {
  Senior: 1,
  Junior: 2,
}

const HARDHAT_FORK_CHAIN_ID = process.env.HARDHAT_FORK_CHAIN_ID

function isTestEnv() {
  return process.env.NODE_ENV === "test"
}

function isMainnetForking() {
  return !!HARDHAT_FORK_CHAIN_ID
}

async function isMainnet() {
  return (await hre.getChainId()) === MAINNET_CHAIN_ID
}

function interestAprAsBN(interestPercentageString: string): BN {
  const interestPercentageFloat = parseFloat(interestPercentageString)
  return new BN(String(interestPercentageFloat * 100000)).mul(INTEREST_DECIMALS).div(new BN(10000000))
}

function getUSDCAddress(chainId: ChainId): AddressString | undefined {
  return getERC20Address("USDC", chainId)
}

export type Ticker = USDCTicker | ETHTicker
const TICKERS = [USDC, ETH]
function getERC20Address(ticker: Ticker, chainId: ChainId): AddressString | undefined {
  const mapping = ERC20_ADDRESSES[ticker]
  if (isMainnetForking()) {
    if (HARDHAT_FORK_CHAIN_ID !== "8453") {
      throw new Error(`Unexpected Mainnet fork chain id", ${HARDHAT_FORK_CHAIN_ID}`)
    }
    return mapping[MAINNET]
  } else {
    const chainName = CHAIN_NAME_BY_ID[chainId]
    return mapping[chainName]
  }
}

async function getSignerForAddress(signerAddress?: string | Signer): Promise<Signer | undefined> {
  if (signerAddress && typeof signerAddress === "string") {
    const signers = await ethers.getSigners()
    return signers.find((signer) => signer.address === signerAddress)
  } else if (signerAddress && typeof signerAddress === "object") {
    return signerAddress
  } else {
    return
  }
}

async function getDeployedContract<T extends Contract = Contract>(
  deployments: DeploymentsExtension,
  contractName: string,
  signerAddress?: string
) {
  let deployment = await deployments.getOrNull(contractName)
  if (!deployment && isTestEnv()) {
    deployment = await deployments.getOrNull(`Test${contractName}`)
  }
  const implementation = await deployments.getOrNull(contractName + "_Implementation")
  const abi = implementation ? implementation.abi : deployment?.abi
  if (abi == null) {
    throw new Error(
      `No deployed version of ${contractName} found! All available deployments are: ${Object.keys(
        await deployments.all()
      )}`
    )
  }
  const signer = await getSignerForAddress(signerAddress)
  assertNonNullable(deployment)
  return (await ethers.getContractAt(abi, deployment.address, signer)) as T
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
async function setInitialConfigVals(config: GoldfinchConfig, deployEffects: DeployEffects, logger = console.log) {
  let chainId = await hre.getChainId()
  assertIsChainId(chainId)
  if (isMainnetForking()) {
    chainId = MAINNET_CHAIN_ID
  }
  const protocolOwner = await getProtocolOwner()

  const initialProtocolConfig = {
    reserveDenominator: 10,
    latenessGracePeriodInDays: 30,
    drawdownPeriodInSeconds: 86400,
  }

  const reserveDenominator = new BN(initialProtocolConfig.reserveDenominator)
  const latenessGracePeriodIndays = new BN(initialProtocolConfig.latenessGracePeriodInDays)
  const drawdownPeriodInSeconds = new BN(initialProtocolConfig.drawdownPeriodInSeconds)

  logger("Updating the config vals...")
  await updateConfig(config, deployEffects, "number", CONFIG_KEYS.ReserveDenominator, String(reserveDenominator), {
    logger,
  })
  await updateConfig(
    config,
    deployEffects,
    "number",
    CONFIG_KEYS.LatenessGracePeriodInDays,
    String(latenessGracePeriodIndays),
    {
      logger,
    }
  )
  await updateConfig(
    config,
    deployEffects,
    "number",
    CONFIG_KEYS.DrawdownPeriodInSeconds,
    String(drawdownPeriodInSeconds),
    {logger}
  )
  await updateConfig(config, deployEffects, "address", CONFIG_KEYS.ProtocolAdmin, protocolOwner, {logger})
  await deployEffects.add({
    deferred: [await config.populateTransaction.setTreasuryReserve(protocolOwner)],
  })
}

async function updateConfig(
  config: GoldfinchConfig,
  deployEffects: DeployEffects,
  type: any,
  key: any,
  newValue: any,
  opts?: any
) {
  opts = opts || {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const logger = opts.logger || function () {}
  let currentValue
  if (type === "address") {
    currentValue = await config.getAddress(key)
    if (currentValue.toLowerCase() !== newValue.toLowerCase()) {
      await deployEffects.add({
        deferred: [await config.populateTransaction.setAddress(key, newValue)],
      })
      logger(`Added deploy effect to update config ${type} ${key} from ${currentValue} to ${newValue}`)
    }
  } else if (type === "number") {
    currentValue = await config.getNumber(key)
    if (String(currentValue) !== newValue) {
      await deployEffects.add({
        deferred: [await config.populateTransaction.setNumber(key, newValue)],
      })
      logger(`Added deploy effect to update config ${type} ${key} from ${currentValue} to ${newValue}`)
    }
  } else {
    throw new Error(`Unknown config type ${type}`)
  }
}

function fromAtomic(amount: BN, decimals = USDCDecimals): string {
  return new BN(String(amount)).div(decimals).toString(10)
}

function toAtomic(amount: BN, decimals = USDCDecimals): string {
  return new BN(String(amount)).mul(decimals).toString(10)
}

type GetContractOptions = {
  at?: string
  from?: string
  // Path to the referenced contract if hardhat is unable to resolve by name
  // ex: "contracts/cake/Context.sol:Context"
  path?: string
}

export async function getEthersContract<T extends BaseContract | Contract = Contract>(
  contractName: ProbablyValidContract,
  opts: GetContractOptions = {}
): Promise<T> {
  if (!opts.at) {
    opts.at = await getExistingAddress(contractName)
  }
  const at = opts.at
  const from = opts.from || (await getProtocolOwner())
  const abi = await artifacts.require(opts.path || contractName).abi
  const contract = await ethers.getContractAt(abi, at)
  const signer = await ethers.getSigner(from)
  return contract.connect(signer) as unknown as T
}

export async function getTruffleContract<T extends Truffle.ContractInstance = Truffle.ContractInstance>(
  contractName: string,
  opts: GetContractOptions = {}
): Promise<T> {
  if (!opts.at) {
    const unqualifiedContractName = contractName.split(":").pop()
    assert(unqualifiedContractName)
    opts.at = await getExistingAddress(unqualifiedContractName)
  }
  const at = opts.at
  const from = opts.from || (await getProtocolOwner())
  // There may be two ERC20 artifacts:
  //
  // @openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20
  // openzeppelin-contracts-0-8-x/token/ERC20/ERC20.sol:ERC20
  //
  // If the contract is ERC20, specify which should be used
  const contract =
    contractName == "ERC20"
      ? await artifacts.require("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20")
      : await artifacts.require(contractName)
  contract.defaults({from})
  return contract.at(at) as unknown as T
}

async function getExistingAddress(contractName: string): Promise<string> {
  let deployment: any = await hre.deployments.getOrNull(contractName)
  let existingAddress: string | undefined = deployment?.address
  if (!existingAddress && isTestEnv()) {
    deployment = await hre.deployments.getOrNull(`Test${contractName}`)
    existingAddress = deployment?.address
  }
  if (!existingAddress && isMainnetForking()) {
    const mainnetContracts = await getExistingContracts([contractName], MAINNET_GOVERNANCE_MULTISIG)
    existingAddress = mainnetContracts[contractName]?.ExistingContract?.address
  }
  if (!existingAddress) {
    throw new Error(`No address found for ${contractName}`)
  }
  assertIsString(existingAddress)
  return existingAddress
}

async function getProtocolOwner(): Promise<string> {
  const {protocol_owner} = await getNamedAccounts()
  if (HARDHAT_FORK_CHAIN_ID) {
    const forkedChainConfig = CHAIN_CONFIG_BY_CHAIN_ID[HARDHAT_FORK_CHAIN_ID]
    assertNonNullable(forkedChainConfig)
    return forkedChainConfig.governanceAddress
  } else {
    assertIsString(protocol_owner)
    return protocol_owner
  }
}

type SupportedNetwork = "mainnet" | "base" | "baseGoerli" | "arbitrum" | "arbitrumGoerli" | "baseSepolia" | "localhost"

async function getWarblerAddress(): Promise<string> {
  const {warblerLabsAddress} = await getNamedAccounts()
  if (HARDHAT_FORK_CHAIN_ID) {
    const forkedChainConfig = CHAIN_CONFIG_BY_CHAIN_ID[HARDHAT_FORK_CHAIN_ID]
    assertNonNullable(forkedChainConfig)
    return forkedChainConfig.warblerLabsAddress
  } else {
    assertIsString(warblerLabsAddress)
    return warblerLabsAddress
  }
}

export async function getPauserAdmin(): Promise<string> {
  const chainId = await getChainId()
  if (isMainnetForking()) {
    return MAINNET_PAUSER_ADDRESS
  } else if (chainId === LOCAL_CHAIN_ID) {
    const {protocol_owner} = await getNamedAccounts()
    assertIsString(protocol_owner)
    return protocol_owner
  } else if (await isMainnet()) {
    return MAINNET_PAUSER_ADDRESS
  } else {
    throw new Error(`Unknown pauser admin for chain id ${chainId}`)
  }
}

async function currentChainId(): Promise<ChainId> {
  const chainId = isMainnetForking() ? HARDHAT_FORK_CHAIN_ID : await getChainId()
  assertIsChainId(chainId)
  return chainId
}

function fixProvider(providerGiven: any): any {
  // alow it to be used by ethers without any change
  if (providerGiven.sendAsync === undefined) {
    providerGiven.sendAsync = (
      req: {
        id: number
        jsonrpc: string
        method: string
        params: any[]
      },
      callback: (error: any, result: any) => void
    ) => {
      providerGiven
        .send(req.method, req.params)
        .then((result: any) => callback(null, {result, id: req.id, jsonrpc: req.jsonrpc}))
        .catch((error: any) => callback(error, null))
    }
  }
  return providerGiven
}

function getCurrentNetworkName(): SupportedNetwork {
  const chainId = hre.network.config.chainId
  assertNonNullable(chainId)
  return getNetworkNameByChainId(chainId)
}

const populateTxAndLog = (tx: Promise<PopulatedTransaction>, log: string): Promise<PopulatedTransaction> => {
  return tx.then((tx) => {
    console.log(log)
    return tx
  })
}

type NamedAccounts = Record<keyof typeof hardhatConfigBase.namedAccounts, string>
export const getAccounts = async (): Promise<NamedAccounts> => {
  const names = Object.keys(hardhatConfigBase.namedAccounts)

  const accounts = await getNamedAccounts()

  // if this is failing, then there is some invalid key in hardhat config's namedAccounts
  names.forEach((name) => assertIsString(accounts[name]))

  return accounts as NamedAccounts
}

export {
  CHAIN_NAME_BY_ID,
  ZERO_ADDRESS,
  LOCAL,
  MAINNET,
  USDCDecimals,
  ETHDecimals,
  LEVERAGE_RATIO_DECIMALS,
  INTEREST_DECIMALS,
  getUSDCAddress,
  getERC20Address,
  getDeployedContract,
  fromAtomic,
  toAtomic,
  updateConfig,
  getSignerForAddress,
  MAINNET_CHAIN_ID,
  LOCAL_CHAIN_ID,
  SAFE_CONFIG,
  isTestEnv,
  isMainnetForking,
  isMainnet,
  interestAprAsBN,
  setInitialConfigVals,
  TRANCHES,
  GetContractOptions,
  getProtocolOwner,
  currentChainId,
  TICKERS,
  assertIsTicker,
  ContractDeployer,
  ContractUpgrader,
  fixProvider,
  populateTxAndLog,
  getWarblerAddress,
  SupportedNetwork,
  getCurrentNetworkName,
}
