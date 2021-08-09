import {ethers} from "hardhat"
type Ethers = typeof ethers
import {web3} from "hardhat"
import BN from "bn.js"
const USDCDecimals = new BN(String(1e6))
const ETHDecimals = new BN(String(1e18))
const INTEREST_DECIMALS = new BN(String(1e18))
const DEFENDER_API_KEY = process.env.DEFENDER_API_KEY || "A2UgCPgn8jQbkSVuSCxEMhFmivdV9C6d"
const DEFENDER_API_SECRET = process.env.DEFENDER_API_SECRET
import {AdminClient} from "defender-admin-client"
import hre from "hardhat"
const {artifacts} = hre
import PROTOCOL_CONFIG from "../protocol_config.json"
import {CONFIG_KEYS} from "./configKeys"
import {GoldfinchConfig} from "../typechain/ethers"
import {DeploymentsExtension} from "hardhat-deploy/types"
import {Contract, Signer} from "ethers"
import {AssertionError, assertIsString, assertNonNullable, genExhaustiveTuple} from "../utils/type"

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

const ROPSTEN_USDC_ADDRESS = "0x07865c6e87b9f70255377e024ace6630c1eaa37f"
const MAINNET_USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
const MAINNET_ONE_SPLIT_ADDRESS = "0xC586BeF4a0992C495Cf22e1aeEE4E446CECDee0E"
const MAINNET_CUSDC_ADDRESS = "0x39aa39c021dfbae8fac545936693ac917d5e7563"
const MAINNET_COMP_ADDRESS = "0xc00e94cb662c3520282e6f5717214004a7f26888"
const LOCAL = "local"
type LOCAL = typeof LOCAL
const ROPSTEN = "ropsten"
type ROPSTEN = typeof ROPSTEN
const RINKEBY = "rinkeby"
type RINKEBY = typeof RINKEBY
const MAINNET = "mainnet"
type MAINNET = typeof MAINNET

type ChainName = LOCAL | ROPSTEN | RINKEBY | MAINNET

const MAX_UINT = new BN("115792089237316195423570985008687907853269984665640564039457584007913129639935")

const LOCAL_CHAIN_ID = "31337"
type LOCAL_CHAIN_ID = typeof LOCAL_CHAIN_ID
const ROPSTEN_CHAIN_ID = "3"
type ROPSTEN_CHAIN_ID = typeof ROPSTEN_CHAIN_ID
const MAINNET_CHAIN_ID = "1"
type MAINNET_CHAIN_ID = typeof MAINNET_CHAIN_ID
const RINKEBY_CHAIN_ID = "4"
type RINKEBY_CHAIN_ID = typeof RINKEBY_CHAIN_ID

type ChainId = LOCAL_CHAIN_ID | ROPSTEN_CHAIN_ID | MAINNET_CHAIN_ID | RINKEBY_CHAIN_ID

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

type AddressString = string

const USDC = "USDC"
type USDC = typeof USDC
const USDT = "USDT"
type USDT = typeof USDT
const BUSD = "BUSD"
type BUSD = typeof BUSD

const USDC_ADDRESSES: Record<ROPSTEN | MAINNET, AddressString> = {
  [ROPSTEN]: ROPSTEN_USDC_ADDRESS,
  [MAINNET]: MAINNET_USDC_ADDRESS,
}
const USDT_ADDRESSES: Record<MAINNET, AddressString> = {
  [MAINNET]: "0xdac17f958d2ee523a2206206994597c13d831ec7",
}
const BUSD_ADDRESSES: Record<MAINNET, AddressString> = {
  [MAINNET]: "0x4Fabb145d64652a948d72533023f6E7A623C7C53",
}
const ERC20_ADDRESSES = {
  [USDC]: USDC_ADDRESSES,
  [USDT]: USDT_ADDRESSES,
  [BUSD]: BUSD_ADDRESSES,
}

type SafeConfigChainId = MAINNET_CHAIN_ID | RINKEBY_CHAIN_ID
const SAFE_CONFIG_CHAIN_IDS = genExhaustiveTuple<SafeConfigChainId>()(MAINNET_CHAIN_ID, RINKEBY_CHAIN_ID)
export const isSafeConfigChainId = (val: unknown): val is SafeConfigChainId =>
  (SAFE_CONFIG_CHAIN_IDS as unknown[]).includes(val)

const SAFE_CONFIG: Record<SafeConfigChainId, {safeAddress: AddressString}> = {
  [MAINNET_CHAIN_ID]: {safeAddress: "0xBEb28978B2c755155f20fd3d09Cb37e300A6981f"},
  [RINKEBY_CHAIN_ID]: {safeAddress: "0xAA96CA940736e937A8571b132992418c7d220976"},
}

// WARNING: BE EXTREMELY CAREFUL WITH THESE ADDRESSES
// A malicious trusted forwarder means handling over full control of the contract (it can spoof msg.sender)
// https://docs.opengsn.org/contracts/addresses.html
const TRUSTED_FORWARDER_CONFIG: {[chainId: string]: string} = {
  1: "0xa530F85085C6FE2f866E7FdB716849714a89f4CD", // Mainnet
  4: "0x956868751Cc565507B3B58E53a6f9f41B56bed74", // Rinkeby
}

let OWNER_ROLE = web3.utils.keccak256("OWNER_ROLE")
let PAUSER_ROLE = web3.utils.keccak256("PAUSER_ROLE")
let GO_LISTER_ROLE = web3.utils.keccak256("GO_LISTER_ROLE")
let MINTER_ROLE = web3.utils.keccak256("MINTER_ROLE")

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

function interestAprAsBN(interestPercentageString: string) {
  const interestPercentageFloat = parseFloat(interestPercentageString)
  return new BN(String(interestPercentageFloat * 100000)).mul(INTEREST_DECIMALS).div(new BN(10000000))
}

function getUSDCAddress(chainId: ChainId): AddressString | undefined {
  return getERC20Address("USDC", chainId)
}

type Ticker = USDC | USDT | BUSD
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

async function getDeployedContract(deployments: DeploymentsExtension, contractName: string, signerAddress?: string) {
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
  let signer = await getSignerForAddress(signerAddress)
  return await ethers.getContractAt(abi, deployment!.address, signer)
}

type DepList = {[contractName: string]: {[contractName: string]: string}}
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
  let contract = await getDeployedContract(deployments, contractNameToLookUp)
  let contractProxy = await getDeployedContract(deployments, `${contractNameToLookUp}_Proxy`)
  // https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.2.0/contracts/proxy/TransparentUpgradeableProxy.sol#L81
  const implStorageLocation = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
  let currentImpl = await ethers.provider.getStorageAt(contractProxy.address, implStorageLocation)
  currentImpl = ethers.utils.hexStripZeros(currentImpl)

  let implName = `${contractName}_Implementation`

  let deployResult = await deploy(implName, {
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

  logger("Updating the config vals...")
  await updateConfig(config, "number", CONFIG_KEYS.TotalFundsLimit, String(totalFundsLimit), {logger})
  await updateConfig(config, "number", CONFIG_KEYS.TransactionLimit, String(transactionLimit), {logger})
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
  // If we have a multisig safe, set that as the protocol admin, otherwise use the named account (local and test envs)
  const multisigAddress: AddressString = isSafeConfigChainId(chainId)
    ? SAFE_CONFIG[chainId].safeAddress
    : protocol_owner
  await updateConfig(config, "address", CONFIG_KEYS.ProtocolAdmin, multisigAddress, {logger})
  await updateConfig(config, "address", CONFIG_KEYS.OneInch, MAINNET_ONE_SPLIT_ADDRESS, {logger})
  await updateConfig(config, "address", CONFIG_KEYS.CUSDCContract, MAINNET_CUSDC_ADDRESS, {logger})
  if (TRUSTED_FORWARDER_CONFIG[chainId]) {
    await updateConfig(config, "address", CONFIG_KEYS.TrustedForwarder, TRUSTED_FORWARDER_CONFIG[chainId], {logger})
  }
  await config.setTreasuryReserve(multisigAddress)
}

async function updateConfig(config: GoldfinchConfig, type: any, key: any, newValue: any, opts?: any) {
  opts = opts || {}
  let logger = opts.logger || function () {}
  let currentValue
  if (type === "address") {
    currentValue = await config.getAddress(key)
    if (currentValue.toLowerCase() !== newValue.toLowerCase()) {
      await (await config.setAddress(key, newValue)).wait()
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

function fromAtomic(amount: BN, decimals = USDCDecimals) {
  return new BN(String(amount)).div(decimals).toString(10)
}

function toAtomic(amount: BN, decimals = USDCDecimals) {
  return new BN(String(amount)).mul(decimals).toString(10)
}

function getDefenderClient() {
  if (DEFENDER_API_SECRET == null) {
    throw new Error("DEFENDER_API_SECRET is null. It must be set as an envvar")
  }
  return new AdminClient({apiKey: DEFENDER_API_KEY, apiSecret: DEFENDER_API_SECRET})
}

type ContractProviders = "ethers" | "truffle"
type GetContractOptions = {
  as?: ContractProviders,
  at?: string,
  from?: string,
}
async function getContract(contractName: AddressString, opts: GetContractOptions={as: "truffle"}) {
  let deployment = await hre.deployments.getOrNull(contractName)
  if (!deployment && isTestEnv()) {
    deployment = await hre.deployments.get(`Test${contractName}`)
  }
  assertNonNullable(deployment)
  const at = opts.at || deployment.address
  if (opts.as === "ethers") {
    let contract = await ethers.getContractAt(deployment.abi, at)
    if (opts.from) {
      let signer = await ethers.getSigner(opts.from)
      return contract.connect(signer)
    } else {
      return contract
    }
  } else {
    let contract = await artifacts.require(contractName)
    if (opts.from) {
      contract.defaults({from: opts.from})
    }
    return contract.at(at)
  }
}

export {
  CHAIN_NAME_BY_ID,
  ZERO_ADDRESS,
  ROPSTEN_USDC_ADDRESS,
  MAINNET_ONE_SPLIT_ADDRESS,
  MAINNET_CUSDC_ADDRESS,
  MAINNET_COMP_ADDRESS,
  LOCAL,
  MAINNET,
  USDCDecimals,
  MAX_UINT,
  ETHDecimals,
  INTEREST_DECIMALS,
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
  OWNER_ROLE,
  PAUSER_ROLE,
  GO_LISTER_ROLE,
  MINTER_ROLE,
  SAFE_CONFIG,
  TRUSTED_FORWARDER_CONFIG,
  isTestEnv,
  isMainnetForking,
  isMainnet,
  interestAprAsBN,
  getDefenderClient,
  deployContractUpgrade,
  setInitialConfigVals,
  TRANCHES,
  DepList,
  Ticker,
  AddressString,
  getContract,
}
