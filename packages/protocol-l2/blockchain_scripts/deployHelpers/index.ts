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

import {
  asNonNullable,
  AssertionError,
  assertIsString,
  assertNonNullable,
  genExhaustiveTuple,
} from "@goldfinch-eng/utils"
import BN from "bn.js"
import {BaseContract, Contract, PopulatedTransaction, Signer} from "ethers"
import hre, {artifacts, ethers, getChainId, getNamedAccounts, web3} from "hardhat"
import {DeploymentsExtension} from "hardhat-deploy/types"
import {GoldfinchConfig} from "../../typechain/ethers"
import {CONFIG_KEYS} from "../configKeys"
import {MAINNET_GOVERNANCE_MULTISIG} from "../mainnetForkingHelpers"
import {getExistingContracts} from "./getExistingContracts"
const USDCDecimals = new BN(String(1e6))
const FIDU_DECIMALS = new BN(String(1e18))
const GFI_DECIMALS = new BN(String(1e18))
const STAKING_REWARDS_MULTIPLIER_DECIMALS = new BN(String(1e18))
const ETHDecimals = new BN(String(1e18))
const LEVERAGE_RATIO_DECIMALS = new BN(String(1e18))
const INTEREST_DECIMALS = new BN(String(1e18))

import {ContractDeployer} from "./contractDeployer"
import {ContractUpgrader} from "./contractUpgrader"
import {ProbablyValidContract} from "./contracts"

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

const MAINNET_USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
const MAINNET_ONE_SPLIT_ADDRESS = "0xC586BeF4a0992C495Cf22e1aeEE4E446CECDee0E"
const MAINNET_CUSDC_ADDRESS = "0x39aa39c021dfbae8fac545936693ac917d5e7563"
const MAINNET_COMP_ADDRESS = "0xc00e94cb662c3520282e6f5717214004a7f26888"
const MAINNET_FIDU_USDC_CURVE_LP_ADDRESS = "0x80aa1a80a30055DAA084E599836532F3e58c95E2"
const LOCAL = "localhost"
const MAINNET = "mainnet"

export type ChainName = typeof LOCAL | typeof MAINNET

export const MAX_UINT = new BN("115792089237316195423570985008687907853269984665640564039457584007913129639935")
export const GFI_MANTISSA = 1e18
export const USDC_MANTISSA = 1e6
export const USDC_TO_GFI_MANTISSA = GFI_MANTISSA / USDC_MANTISSA

const LOCAL_CHAIN_ID = "31337"
type LocalChainId = typeof LOCAL_CHAIN_ID
const MAINNET_CHAIN_ID = "1"
type MainnetChainId = typeof MAINNET_CHAIN_ID

export type ChainId = LocalChainId | MainnetChainId

const CHAIN_IDS = genExhaustiveTuple<ChainId>()(LOCAL_CHAIN_ID, MAINNET_CHAIN_ID)
export const assertIsChainId: (val: unknown) => asserts val is ChainId = (val: unknown): asserts val is ChainId => {
  if (!(CHAIN_IDS as unknown[]).includes(val)) {
    throw new AssertionError(`${val} is not in \`CHAIN_IDS\`.`)
  }
}

const CHAIN_NAME_BY_ID: Record<ChainId, ChainName> = {
  [LOCAL_CHAIN_ID]: LOCAL,
  [MAINNET_CHAIN_ID]: MAINNET,
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
const GFI = "GFI"
type GFITicker = typeof GFI

function assertIsTicker(val: string): asserts val is Ticker {
  if (!TICKERS.includes(val)) {
    throw new AssertionError(`${val} is not in the allowed Ticker list: ${TICKERS}`)
  }
}

const USDC_ADDRESSES: Record<typeof MAINNET, AddressString> = {
  [MAINNET]: MAINNET_USDC_ADDRESS,
}
const USDT_ADDRESSES: Record<typeof MAINNET, AddressString> = {
  [MAINNET]: "0xdac17f958d2ee523a2206206994597c13d831ec7",
}
const BUSD_ADDRESSES: Record<typeof MAINNET, AddressString> = {
  [MAINNET]: "0x4Fabb145d64652a948d72533023f6E7A623C7C53",
}

const GFI_ADDRESSES: Record<typeof MAINNET, AddressString> = {
  [MAINNET]: "0xdab396ccf3d84cf2d07c4454e10c8a6f5b008d2b",
}
const ERC20_ADDRESSES = {
  [USDC]: USDC_ADDRESSES,
  [USDT]: USDT_ADDRESSES,
  [BUSD]: BUSD_ADDRESSES,
  [GFI]: GFI_ADDRESSES,
}

type SafeConfigChainId = MainnetChainId
const SAFE_CONFIG_CHAIN_IDS = genExhaustiveTuple<SafeConfigChainId>()(MAINNET_CHAIN_ID)
export const isSafeConfigChainId = (val: unknown): val is SafeConfigChainId =>
  (SAFE_CONFIG_CHAIN_IDS as unknown[]).includes(val)

const SAFE_CONFIG: Record<SafeConfigChainId, {safeAddress: AddressString; executor: AddressString}> = {
  [MAINNET_CHAIN_ID]: {
    safeAddress: "0xBEb28978B2c755155f20fd3d09Cb37e300A6981f",
    executor: "0xf13eFa505444D09E176d83A4dfd50d10E399cFd5",
  },
}

const MAINNET_PAUSER_ADDRESS = "0x061e0b0087a01127554ffef8f9c4c6e9447ad9dd"

export const ZAPPER_ROLE = web3.utils.keccak256("ZAPPER_ROLE")
export const OWNER_ROLE = web3.utils.keccak256("OWNER_ROLE")
export const PAUSER_ROLE = web3.utils.keccak256("PAUSER_ROLE")
export const GO_LISTER_ROLE = web3.utils.keccak256("GO_LISTER_ROLE")
export const MINTER_ROLE = web3.utils.keccak256("MINTER_ROLE")
export const LEVERAGE_RATIO_SETTER_ROLE = web3.utils.keccak256("LEVERAGE_RATIO_SETTER_ROLE")
export const REDEEMER_ROLE = web3.utils.keccak256("REDEEMER_ROLE")
export const DISTRIBUTOR_ROLE = web3.utils.keccak256("DISTRIBUTOR_ROLE")
export const SIGNER_ROLE = web3.utils.keccak256("SIGNER_ROLE")
export const LOCKER_ROLE = web3.utils.keccak256("LOCKER_ROLE")

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

export type Ticker = USDCTicker | USDTTicker | BUSDTicker | ETHTicker | GFITicker
const TICKERS = [USDC, USDT, BUSD, ETH, GFI]
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

// eslint-disable-next-line @typescript-eslint/no-empty-function
async function setInitialConfigVals(config: GoldfinchConfig, logger = function (_: any) {}) {
  let chainId = await hre.getChainId()
  assertIsChainId(chainId)
  if (isMainnetForking()) {
    chainId = MAINNET_CHAIN_ID
  }
  const {protocol_owner} = await hre.getNamedAccounts()
  assertIsString(protocol_owner)

  const initialProtocolConfig = {
    totalFundsLimit: 2000000,
    transactionLimit: 500000,
    maxUnderwriterLimit: 2000000,
    reserveDenominator: 10,
    withdrawFeeDenominator: 200,
    latenessGracePeriodInDays: 30,
    latenessMaxDays: 120,
    drawdownPeriodInSeconds: 86400,
    transferRestrictionPeriodInDays: 365,
    leverageRatio: "4000000000000000000",
  }

  const transactionLimit = new BN(initialProtocolConfig.transactionLimit).mul(USDCDecimals)
  const totalFundsLimit = new BN(initialProtocolConfig.totalFundsLimit).mul(USDCDecimals)
  const maxUnderwriterLimit = new BN(initialProtocolConfig.maxUnderwriterLimit).mul(USDCDecimals)
  const reserveDenominator = new BN(initialProtocolConfig.reserveDenominator)
  const withdrawFeeDenominator = new BN(initialProtocolConfig.withdrawFeeDenominator)
  const latenessGracePeriodIndays = new BN(initialProtocolConfig.latenessGracePeriodInDays)
  const latenessMaxDays = new BN(initialProtocolConfig.latenessMaxDays)
  const drawdownPeriodInSeconds = new BN(initialProtocolConfig.drawdownPeriodInSeconds)
  const transferPeriodRestrictionInDays = new BN(initialProtocolConfig.transferRestrictionPeriodInDays)
  const leverageRatio = new BN(initialProtocolConfig.leverageRatio)

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

const populateTxAndLog = (tx: Promise<PopulatedTransaction>, log: string): Promise<PopulatedTransaction> => {
  return tx.then((tx) => {
    console.log(log)
    return tx
  })
}

export {
  CHAIN_NAME_BY_ID,
  ZERO_ADDRESS,
  MAINNET_ONE_SPLIT_ADDRESS,
  MAINNET_CUSDC_ADDRESS,
  MAINNET_COMP_ADDRESS,
  MAINNET_FIDU_USDC_CURVE_LP_ADDRESS,
  LOCAL,
  MAINNET,
  USDCDecimals,
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
}
