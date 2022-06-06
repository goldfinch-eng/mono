// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../node_modules/hardhat-deploy/src/type-extensions.ts" />
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../node_modules/@nomiclabs/hardhat-ethers/src/internal/type-extensions.ts" />
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../node_modules/@nomiclabs/hardhat-web3/src/type-extensions.ts" />
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../node_modules/@nomiclabs/hardhat-truffle5/src/type-extensions.ts" />
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../typechain/truffle/types.d.ts" />

import {ethers, getChainId, getNamedAccounts} from "hardhat"
type Ethers = typeof ethers
import hre, {web3, artifacts} from "hardhat"
import BN from "bn.js"
const USDCDecimals = new BN(String(1e6))
const FIDU_DECIMALS = new BN(String(1e18))
const GFI_DECIMALS = new BN(String(1e18))
const STAKING_REWARDS_MULTIPLIER_DECIMALS = new BN(String(1e18))
const ETHDecimals = new BN(String(1e18))
const LEVERAGE_RATIO_DECIMALS = new BN(String(1e18))
const INTEREST_DECIMALS = new BN(String(1e18))
const DEFENDER_API_KEY = process.env.DEFENDER_API_KEY
const DEFENDER_API_SECRET = process.env.DEFENDER_API_SECRET
import {AdminClient} from "defender-admin-client"
import PROTOCOL_CONFIG from "../../protocol_config.json"
import {CONFIG_KEYS} from "../configKeys"
import {GoldfinchConfig} from "../../typechain/ethers"
import {DeploymentsExtension} from "hardhat-deploy/types"
import {Contract, BaseContract, Signer} from "ethers"
import {
  asNonNullable,
  AssertionError,
  assertIsString,
  assertNonNullable,
  assertUnreachable,
  genExhaustiveTuple,
} from "@goldfinch-eng/utils"
import {getExistingContracts, MAINNET_MULTISIG} from "../mainnetForkingHelpers"

import {ContractDeployer} from "./contractDeployer"
import {ContractUpgrader} from "./contractUpgrader"

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

const ROPSTEN_USDC_ADDRESS = "0x07865c6e87b9f70255377e024ace6630c1eaa37f"
const MAINNET_USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
const MAINNET_ONE_SPLIT_ADDRESS = "0xC586BeF4a0992C495Cf22e1aeEE4E446CECDee0E"
const MAINNET_CUSDC_ADDRESS = "0x39aa39c021dfbae8fac545936693ac917d5e7563"
const MAINNET_COMP_ADDRESS = "0xc00e94cb662c3520282e6f5717214004a7f26888"
const MAINNET_FIDU_USDC_CURVE_LP_ADDRESS = "0x80aa1a80a30055DAA084E599836532F3e58c95E2"
const LOCAL = "localhost"
const ROPSTEN = "ropsten"
const RINKEBY = "rinkeby"
const MAINNET = "mainnet"

export type ChainName = typeof LOCAL | typeof ROPSTEN | typeof RINKEBY | typeof MAINNET

const MAX_UINT = new BN("115792089237316195423570985008687907853269984665640564039457584007913129639935")

const LOCAL_CHAIN_ID = "31337"
type LocalChainId = typeof LOCAL_CHAIN_ID
const ROPSTEN_CHAIN_ID = "3"
type RopstenChainId = typeof ROPSTEN_CHAIN_ID
const MAINNET_CHAIN_ID = "1"
type MainnetChainId = typeof MAINNET_CHAIN_ID
const RINKEBY_CHAIN_ID = "4"
type RinkebyChainId = typeof RINKEBY_CHAIN_ID

export type ChainId = LocalChainId | RopstenChainId | MainnetChainId | RinkebyChainId

const CHAIN_IDS = genExhaustiveTuple<ChainId>()(LOCAL_CHAIN_ID, ROPSTEN_CHAIN_ID, MAINNET_CHAIN_ID, RINKEBY_CHAIN_ID)
export const assertIsChainId: (val: unknown) => asserts val is ChainId = (val: unknown): asserts val is ChainId => {
  if (!(CHAIN_IDS as unknown[]).includes(val)) {
    throw new AssertionError(`${val} is not in \`CHAIN_IDS\`.`)
  }
}

const CHAIN_NAME_BY_ID: Record<ChainId, ChainName> = {
  [LOCAL_CHAIN_ID]: LOCAL,
  [ROPSTEN_CHAIN_ID]: ROPSTEN,
  [MAINNET_CHAIN_ID]: MAINNET,
  [RINKEBY_CHAIN_ID]: RINKEBY,
}

export type AddressString = string

const USDC = "USDC"
type USDCTicker = typeof USDC
const USDT = "USDT"
type USDTTicker = typeof USDT
const BUSD = "BUSD"
type BUSDTicker = typeof BUSD
const ETH = "ETH"
type ETHTicker = typeof ETH
function assertIsTicker(val: string): asserts val is Ticker {
  if (!TICKERS.includes(val)) {
    throw new AssertionError(`${val} is not in the allowed Ticker list: ${TICKERS}`)
  }
}

const USDC_ADDRESSES: Record<typeof ROPSTEN | typeof MAINNET, AddressString> = {
  [ROPSTEN]: ROPSTEN_USDC_ADDRESS,
  [MAINNET]: MAINNET_USDC_ADDRESS,
}
const USDT_ADDRESSES: Record<typeof MAINNET, AddressString> = {
  [MAINNET]: "0xdac17f958d2ee523a2206206994597c13d831ec7",
}
const BUSD_ADDRESSES: Record<typeof MAINNET, AddressString> = {
  [MAINNET]: "0x4Fabb145d64652a948d72533023f6E7A623C7C53",
}
const ERC20_ADDRESSES = {
  [USDC]: USDC_ADDRESSES,
  [USDT]: USDT_ADDRESSES,
  [BUSD]: BUSD_ADDRESSES,
}

type SafeConfigChainId = MainnetChainId | RinkebyChainId
const SAFE_CONFIG_CHAIN_IDS = genExhaustiveTuple<SafeConfigChainId>()(MAINNET_CHAIN_ID, RINKEBY_CHAIN_ID)
export const isSafeConfigChainId = (val: unknown): val is SafeConfigChainId =>
  (SAFE_CONFIG_CHAIN_IDS as unknown[]).includes(val)

const SAFE_CONFIG: Record<SafeConfigChainId, {safeAddress: AddressString; executor: AddressString}> = {
  [MAINNET_CHAIN_ID]: {
    safeAddress: "0xBEb28978B2c755155f20fd3d09Cb37e300A6981f",
    executor: "0xf13eFa505444D09E176d83A4dfd50d10E399cFd5",
  },
  [RINKEBY_CHAIN_ID]: {
    safeAddress: "0xAA96CA940736e937A8571b132992418c7d220976",
    executor: "0xeF3fAA47e1b0515f640c588a0bc3D268d5aa29B9",
  },
}

export const ZAPPER_ROLE = web3.utils.keccak256("ZAPPER_ROLE")
export const OWNER_ROLE = web3.utils.keccak256("OWNER_ROLE")
export const PAUSER_ROLE = web3.utils.keccak256("PAUSER_ROLE")
export const GO_LISTER_ROLE = web3.utils.keccak256("GO_LISTER_ROLE")
export const MINTER_ROLE = web3.utils.keccak256("MINTER_ROLE")
export const LEVERAGE_RATIO_SETTER_ROLE = web3.utils.keccak256("LEVERAGE_RATIO_SETTER_ROLE")
export const REDEEMER_ROLE = web3.utils.keccak256("REDEEMER_ROLE")
export const DISTRIBUTOR_ROLE = web3.utils.keccak256("DISTRIBUTOR_ROLE")
export const SIGNER_ROLE = web3.utils.keccak256("SIGNER_ROLE")

export enum StakedPositionType {
  Fidu,
  CurveLP,
}

const TRANCHES = {
  Senior: 1,
  Junior: 2,
}

function isTestEnv() {
  return process.env.NODE_ENV === "test"
}

function isMainnetForking() {
  return process.env.HARDHAT_FORK === "mainnet"
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

export type Ticker = USDCTicker | USDTTicker | BUSDTicker | ETHTicker
const TICKERS = [USDC, USDT, BUSD, ETH]
function getERC20Address(ticker: Ticker, chainId: ChainId): AddressString | undefined {
  const mapping = ERC20_ADDRESSES[ticker]
  if (isMainnetForking()) {
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

export type DepList = {[contractName: string]: {[contractName: string]: string}}
async function deployContractUpgrade(
  contractName: string,
  dependencies: DepList,
  from: string,
  deployments: DeploymentsExtension,
  ethers: Ethers
) {
  const {deploy} = deployments

  let contractNameToLookUp = contractName
  if (contractName === "GoldfinchFactory") {
    contractNameToLookUp = "CreditLineFactory"
  }
  const contract = await getDeployedContract(deployments, contractNameToLookUp)
  const contractProxy = await getDeployedContract(deployments, `${contractNameToLookUp}_Proxy`)
  // https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.2.0/contracts/proxy/TransparentUpgradeableProxy.sol#L81
  const implStorageLocation = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
  let currentImpl = await ethers.provider.getStorageAt(contractProxy.address, implStorageLocation)
  currentImpl = ethers.utils.hexStripZeros(currentImpl)

  const implName = `${contractName}_Implementation`

  const deployResult = await deploy(implName, {
    from: from,
    gasLimit: 4000000,
    args: [],
    contract: contractName,
    libraries: dependencies[contractName],
  })
  return {
    name: contractName,
    implementationName: implName,
    contract: contract,
    proxy: contractProxy,
    currentImplementation: currentImpl,
    newImplementation: deployResult.address,
  }
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
async function setInitialConfigVals(config: GoldfinchConfig, logger = function (_: any) {}) {
  let chainId = await hre.getChainId()
  assertIsChainId(chainId)
  if (isMainnetForking()) {
    chainId = MAINNET_CHAIN_ID
  }
  const {protocol_owner} = await hre.getNamedAccounts()
  assertIsString(protocol_owner)

  const transactionLimit = new BN(PROTOCOL_CONFIG.transactionLimit).mul(USDCDecimals)
  const totalFundsLimit = new BN(PROTOCOL_CONFIG.totalFundsLimit).mul(USDCDecimals)
  const maxUnderwriterLimit = new BN(PROTOCOL_CONFIG.maxUnderwriterLimit).mul(USDCDecimals)
  const reserveDenominator = new BN(PROTOCOL_CONFIG.reserveDenominator)
  const withdrawFeeDenominator = new BN(PROTOCOL_CONFIG.withdrawFeeDenominator)
  const latenessGracePeriodIndays = new BN(PROTOCOL_CONFIG.latenessGracePeriodInDays)
  const latenessMaxDays = new BN(PROTOCOL_CONFIG.latenessMaxDays)
  const drawdownPeriodInSeconds = new BN(PROTOCOL_CONFIG.drawdownPeriodInSeconds)
  const transferPeriodRestrictionInDays = new BN(PROTOCOL_CONFIG.transferRestrictionPeriodInDays)
  const leverageRatio = new BN(PROTOCOL_CONFIG.leverageRatio)

  logger("Updating the config vals...")
  await updateConfig(config, "number", CONFIG_KEYS.TransactionLimit, String(transactionLimit), {logger})
  await updateConfig(config, "number", CONFIG_KEYS.TotalFundsLimit, String(totalFundsLimit), {logger})
  await updateConfig(config, "number", CONFIG_KEYS.MaxUnderwriterLimit, String(maxUnderwriterLimit), {logger})
  await updateConfig(config, "number", CONFIG_KEYS.ReserveDenominator, String(reserveDenominator), {logger})
  await updateConfig(config, "number", CONFIG_KEYS.WithdrawFeeDenominator, String(withdrawFeeDenominator), {logger})
  await updateConfig(config, "number", CONFIG_KEYS.LatenessGracePeriodInDays, String(latenessGracePeriodIndays), {
    logger,
  })
  await updateConfig(config, "number", CONFIG_KEYS.LatenessMaxDays, String(latenessMaxDays), {logger})
  await updateConfig(config, "number", CONFIG_KEYS.DrawdownPeriodInSeconds, String(drawdownPeriodInSeconds), {logger})
  await updateConfig(
    config,
    "number",
    CONFIG_KEYS.TransferPeriodRestrictionInDays,
    String(transferPeriodRestrictionInDays),
    {logger}
  )
  await updateConfig(config, "number", CONFIG_KEYS.LeverageRatio, String(leverageRatio), {logger})
  // If we have a multisig safe, set that as the protocol admin, otherwise use the named account (local and test envs)
  const multisigAddress: AddressString = isSafeConfigChainId(chainId)
    ? SAFE_CONFIG[chainId].safeAddress
    : protocol_owner
  await updateConfig(config, "address", CONFIG_KEYS.ProtocolAdmin, multisigAddress, {logger})
  await updateConfig(config, "address", CONFIG_KEYS.OneInch, MAINNET_ONE_SPLIT_ADDRESS, {logger})
  await updateConfig(config, "address", CONFIG_KEYS.CUSDCContract, MAINNET_CUSDC_ADDRESS, {logger})
  await (await config.setTreasuryReserve(multisigAddress)).wait()
}

async function updateConfig(config: GoldfinchConfig, type: any, key: any, newValue: any, opts?: any) {
  opts = opts || {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const logger = opts.logger || function () {}
  let currentValue
  if (type === "address") {
    currentValue = await config.getAddress(key)
    if (currentValue.toLowerCase() !== newValue.toLowerCase()) {
      await (await config.setAddress(key, newValue)).wait()
      logger(`Updated config ${type} ${key} from ${currentValue} to ${newValue}`)
    }
  } else if (type === "number") {
    currentValue = await config.getNumber(key)
    if (String(currentValue) !== newValue) {
      await (await config.setNumber(key, newValue)).wait()
      logger(`Updated config ${type} ${key} from ${currentValue} to ${newValue}`)
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

function getDefenderClient() {
  assertNonNullable(DEFENDER_API_KEY, "DEFENDER_API_KEY is null. It must be set as an envvar")
  assertNonNullable(DEFENDER_API_SECRET, "DEFENDER_API_SECRET is null. It must be set as an envvar")
  return new AdminClient({apiKey: DEFENDER_API_KEY, apiSecret: DEFENDER_API_SECRET})
}

const ETHERS_CONTRACT_PROVIDER = "ethers"
// eslint-disable-next-line @typescript-eslint/no-redeclare
type ETHERS_CONTRACT_PROVIDER = typeof ETHERS_CONTRACT_PROVIDER
const TRUFFLE_CONTRACT_PROVIDER = "truffle"
// eslint-disable-next-line @typescript-eslint/no-redeclare
type TRUFFLE_CONTRACT_PROVIDER = typeof TRUFFLE_CONTRACT_PROVIDER
type ContractProvider = ETHERS_CONTRACT_PROVIDER | TRUFFLE_CONTRACT_PROVIDER

type ProvidedContract<
  P extends ContractProvider,
  E,
  T extends Truffle.ContractInstance
> = P extends TRUFFLE_CONTRACT_PROVIDER ? T : P extends ETHERS_CONTRACT_PROVIDER ? E : never

type GetContractOptions = {
  at?: string
  from?: string
}

export async function getEthersContract<T extends BaseContract | Contract = Contract>(
  contractName: string,
  opts: GetContractOptions = {}
): Promise<T> {
  return await getContract<T, never, ETHERS_CONTRACT_PROVIDER>(contractName, ETHERS_CONTRACT_PROVIDER, opts)
}

export async function getTruffleContract<T extends Truffle.ContractInstance = Truffle.ContractInstance>(
  contractName: string,
  opts: GetContractOptions = {}
): Promise<T> {
  return await getContract<never, T, TRUFFLE_CONTRACT_PROVIDER>(contractName, TRUFFLE_CONTRACT_PROVIDER, opts)
}

async function getContract<
  E,
  T extends Truffle.ContractInstance,
  P extends ContractProvider = TRUFFLE_CONTRACT_PROVIDER
>(contractName: string, as: P, opts: GetContractOptions = {}): Promise<ProvidedContract<P, E, T>> {
  if (!opts.at) {
    opts.at = await getExistingAddress(contractName)
  }
  const at = opts.at
  const from = opts.from || (await getProtocolOwner())
  switch (as) {
    case ETHERS_CONTRACT_PROVIDER: {
      const abi = await artifacts.require(contractName).abi
      const contract = await ethers.getContractAt(abi, at)
      const signer = await ethers.getSigner(from)
      return contract.connect(signer) as unknown as ProvidedContract<P, E, T>
    }
    case TRUFFLE_CONTRACT_PROVIDER: {
      const contract = await artifacts.require(contractName)
      contract.defaults({from})
      return contract.at(at) as unknown as ProvidedContract<P, E, T>
    }
    default:
      assertUnreachable(as)
  }
}

async function getExistingAddress(contractName: string): Promise<string> {
  let deployment: any = await hre.deployments.getOrNull(contractName)
  let existingAddress: string | undefined = deployment?.address
  if (!existingAddress && isTestEnv()) {
    deployment = await hre.deployments.getOrNull(`Test${contractName}`)
    existingAddress = deployment?.address
  }
  if (!existingAddress && isMainnetForking()) {
    const mainnetContracts = await getExistingContracts([contractName], MAINNET_MULTISIG)
    existingAddress = mainnetContracts[contractName]?.ExistingContract?.address
  }
  if (!existingAddress) {
    throw new Error(`No address found for ${contractName}`)
  }
  assertIsString(existingAddress)
  return existingAddress
}

export async function getTempMultisig(): Promise<string> {
  const {temp_multisig} = await hre.getNamedAccounts()
  return asNonNullable(temp_multisig)
}

async function getProtocolOwner(): Promise<string> {
  const chainId = await getChainId()
  const {protocol_owner} = await getNamedAccounts()
  if (isMainnetForking()) {
    return SAFE_CONFIG[MAINNET_CHAIN_ID].safeAddress
  } else if (chainId === LOCAL_CHAIN_ID) {
    assertIsString(protocol_owner)
    return protocol_owner
  } else if (SAFE_CONFIG[chainId]) {
    return SAFE_CONFIG[chainId].safeAddress
  } else {
    throw new Error(`Unknown owner for chain id ${chainId}`)
  }
}

async function currentChainId(): Promise<ChainId> {
  const chainId = isMainnetForking() ? MAINNET_CHAIN_ID : await getChainId()
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

export {
  CHAIN_NAME_BY_ID,
  ZERO_ADDRESS,
  ROPSTEN_USDC_ADDRESS,
  MAINNET_ONE_SPLIT_ADDRESS,
  MAINNET_CUSDC_ADDRESS,
  MAINNET_COMP_ADDRESS,
  MAINNET_FIDU_USDC_CURVE_LP_ADDRESS,
  LOCAL,
  MAINNET,
  USDCDecimals,
  MAX_UINT,
  ETHDecimals,
  LEVERAGE_RATIO_DECIMALS,
  INTEREST_DECIMALS,
  FIDU_DECIMALS,
  GFI_DECIMALS,
  STAKING_REWARDS_MULTIPLIER_DECIMALS,
  getUSDCAddress,
  getERC20Address,
  getDeployedContract,
  fromAtomic,
  toAtomic,
  updateConfig,
  getSignerForAddress,
  MAINNET_CHAIN_ID,
  RINKEBY_CHAIN_ID,
  LOCAL_CHAIN_ID,
  SAFE_CONFIG,
  isTestEnv,
  isMainnetForking,
  isMainnet,
  interestAprAsBN,
  getDefenderClient,
  deployContractUpgrade,
  setInitialConfigVals,
  TRANCHES,
  getContract,
  GetContractOptions,
  ETHERS_CONTRACT_PROVIDER,
  TRUFFLE_CONTRACT_PROVIDER,
  getProtocolOwner,
  currentChainId,
  TICKERS,
  assertIsTicker,
  ContractDeployer,
  ContractUpgrader,
  fixProvider,
}
