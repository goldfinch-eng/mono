/* global web3 ethers */
const BN = require("bn.js")
const USDCDecimals = new BN(String(1e6))
const ETHDecimals = new BN(String(1e18))
const INTEREST_DECIMALS = new BN(String(1e8))
const API_KEY = process.env.DEFENDER_API_KEY || "A2UgCPgn8jQbkSVuSCxEMhFmivdV9C6d"
const API_SECRET = process.env.DEFENDER_API_SECRET
const {AdminClient} = require("defender-admin-client")
const hre = require("hardhat")
const PROTOCOL_CONFIG = require("../protocol_config.json")
const {CONFIG_KEYS} = require("./configKeys.js")

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

const ROPSTEN_USDC_ADDRESS = "0x07865c6e87b9f70255377e024ace6630c1eaa37f"
const MAINNET_USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
const MAINNET_ONE_SPLIT_ADDRESS = "0xC586BeF4a0992C495Cf22e1aeEE4E446CECDee0E"
const MAINNET_CUSDC_ADDRESS = "0x39aa39c021dfbae8fac545936693ac917d5e7563"
const MAINNET_COMP_ADDRESS = "0xc00e94cb662c3520282e6f5717214004a7f26888"
const MAINNET_CHAIN_ID = "1"
const LOCAL = "local"
const ROPSTEN = "ropsten"
const RINKEBY = "rinkeby"
const MAINNET = "mainnet"
const MAX_UINT = new BN("115792089237316195423570985008687907853269984665640564039457584007913129639935")
const CHAIN_MAPPING = {
  31337: LOCAL,
  3: ROPSTEN,
  1: MAINNET,
  4: RINKEBY,
}
const USDC_ADDRESSES = {
  [ROPSTEN]: ROPSTEN_USDC_ADDRESS,
  [MAINNET]: MAINNET_USDC_ADDRESS,
}
const USDT_ADDRESSES = {
  [MAINNET]: "0xdac17f958d2ee523a2206206994597c13d831ec7",
}
const BUSD_ADDRESSES = {
  [MAINNET]: "0x4Fabb145d64652a948d72533023f6E7A623C7C53",
}
const ERC20_ADDRESSES = {
  USDC: USDC_ADDRESSES,
  USDT: USDT_ADDRESSES,
  BUSD: BUSD_ADDRESSES,
}
const SAFE_CONFIG = {
  1: {safeAddress: "0xBEb28978B2c755155f20fd3d09Cb37e300A6981f"}, // Mainnet
  4: {safeAddress: "0xAA96CA940736e937A8571b132992418c7d220976"}, // Rinkeby
}

// WARNING: BE EXTREMELY CAREFUL WITH THESE ADDRESSES
// A malicious trusted forwarder means handling over full control of the contract (it can spoof msg.sender)
// https://docs.opengsn.org/contracts/addresses.html
const TRUSTED_FORWARDER_CONFIG = {
  1: "0xa530F85085C6FE2f866E7FdB716849714a89f4CD", // Mainnet
  4: "0x956868751Cc565507B3B58E53a6f9f41B56bed74", // Rinkeby
}

let OWNER_ROLE, PAUSER_ROLE, MINTER_ROLE
if (typeof web3 !== "undefined" && web3.utils) {
  OWNER_ROLE = web3.utils.keccak256("OWNER_ROLE")
  PAUSER_ROLE = web3.utils.keccak256("PAUSER_ROLE")
  MINTER_ROLE = web3.utils.keccak256("MINTER_ROLE")
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

function interestAprAsBN(interestPercentageString) {
  const interestPercentageFloat = parseFloat(interestPercentageString)
  return new BN((interestPercentageFloat / 100) * INTEREST_DECIMALS)
}

function getUSDCAddress(chainID) {
  return getERC20Address("USDC", chainID)
}

function getERC20Address(ticker, chainID) {
  let mapping = ERC20_ADDRESSES[ticker]
  if (isMainnetForking()) {
    return mapping[MAINNET]
  }
  return mapping[chainID] || mapping[CHAIN_MAPPING[chainID]]
}

async function getSignerForAddress(signerAddress) {
  if (signerAddress && typeof signerAddress === "string") {
    const signers = await ethers.getSigners()
    return signers.find((signer) => signer.address === signerAddress)
  } else if (signerAddress && typeof signerAddres === "object") {
    return signerAddress
  }
}

async function getDeployedContract(deployments, contractName, signerAddress) {
  let deployment = await deployments.getOrNull(contractName)
  if (!deployment && isTestEnv()) {
    deployment = await deployments.getOrNull(`Test${contractName}`)
  }
  const implementation = await deployments.getOrNull(contractName + "_Implementation")
  if (!deployment && !implementation) {
    throw new Error(
      `No deployed version of ${contractName} found! All available deployments are: ${Object.keys(
        await deployments.all()
      )}`
    )
  }
  const abi = implementation ? implementation.abi : deployment.abi
  let signer = await getSignerForAddress(signerAddress)
  return await ethers.getContractAt(abi, deployment.address, signer)
}

async function deployContractUpgrade(contractName, dependencies, from, deployments, ethers) {
  const {deploy} = deployments

  let contract = await getDeployedContract(deployments, contractName)
  let contractProxy = await getDeployedContract(deployments, `${contractName}_Proxy`)
  // https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.2.0/contracts/proxy/TransparentUpgradeableProxy.sol#L81
  const implStorageLocation = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
  let currentImpl = await ethers.provider.getStorageAt(contractProxy.address, implStorageLocation)
  currentImpl = ethers.utils.hexStripZeros(currentImpl)

  let implName = `${contractName}_Implementation`

  let deployResult = await deploy(implName, {
    from: from,
    gas: 4000000,
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

async function setInitialConfigVals(config, logger = function () {}) {
  let chainID = await hre.getChainId()
  if (isMainnetForking()) {
    chainID = MAINNET_CHAIN_ID
  }
  const {protocol_owner} = await hre.getNamedAccounts()

  const transactionLimit = new BN(PROTOCOL_CONFIG.transactionLimit).mul(USDCDecimals)
  const totalFundsLimit = new BN(PROTOCOL_CONFIG.totalFundsLimit).mul(USDCDecimals)
  const maxUnderwriterLimit = new BN(PROTOCOL_CONFIG.maxUnderwriterLimit).mul(USDCDecimals)
  const reserveDenominator = new BN(PROTOCOL_CONFIG.reserveDenominator)
  const withdrawFeeDenominator = new BN(PROTOCOL_CONFIG.withdrawFeeDenominator)
  const latenessGracePeriodIndays = new BN(PROTOCOL_CONFIG.latenessGracePeriodInDays)
  const latenessMaxDays = new BN(PROTOCOL_CONFIG.latenessMaxDays)

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
  // If we have a multisig safe, set that as the protocol admin, otherwise use the named account (local and test envs)
  let multisigAddress
  if (SAFE_CONFIG[chainID]) {
    multisigAddress = SAFE_CONFIG[chainID].safeAddress
  } else {
    multisigAddress = protocol_owner
  }
  await updateConfig(config, "address", CONFIG_KEYS.ProtocolAdmin, multisigAddress, {logger})
  await updateConfig(config, "address", CONFIG_KEYS.OneInch, MAINNET_ONE_SPLIT_ADDRESS, {logger})
  await updateConfig(config, "address", CONFIG_KEYS.CUSDCContract, MAINNET_CUSDC_ADDRESS, {logger})
  if (TRUSTED_FORWARDER_CONFIG[chainID]) {
    await updateConfig(config, "address", CONFIG_KEYS.TrustedForwarder, TRUSTED_FORWARDER_CONFIG[chainID], {logger})
  }
  await config.setTreasuryReserve(multisigAddress)
}

async function updateConfig(config, type, key, newValue, opts) {
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

function fromAtomic(amount, decimals = USDCDecimals) {
  return new BN(String(amount)).div(decimals).toString(10)
}

function toAtomic(amount, decimals = USDCDecimals) {
  return new BN(String(amount)).mul(decimals).toString(10)
}

function getDefenderClient() {
  return new AdminClient({apiKey: API_KEY, apiSecret: API_SECRET})
}

module.exports = {
  CHAIN_MAPPING: CHAIN_MAPPING,
  ZERO_ADDRESS: ZERO_ADDRESS,
  ROPSTEN_USDC_ADDRESS: ROPSTEN_USDC_ADDRESS,
  MAINNET_ONE_SPLIT_ADDRESS: MAINNET_ONE_SPLIT_ADDRESS,
  MAINNET_CUSDC_ADDRESS: MAINNET_CUSDC_ADDRESS,
  MAINNET_COMP_ADDRESS: MAINNET_COMP_ADDRESS,
  LOCAL: LOCAL,
  MAINNET: MAINNET,
  USDCDecimals: USDCDecimals,
  MAX_UINT: MAX_UINT,
  ETHDecimals: ETHDecimals,
  INTEREST_DECIMALS: INTEREST_DECIMALS,
  getUSDCAddress: getUSDCAddress,
  getERC20Address: getERC20Address,
  getDeployedContract: getDeployedContract,
  fromAtomic: fromAtomic,
  toAtomic: toAtomic,
  updateConfig: updateConfig,
  getSignerForAddress: getSignerForAddress,
  MAINNET_CHAIN_ID: MAINNET_CHAIN_ID,
  OWNER_ROLE: OWNER_ROLE,
  PAUSER_ROLE: PAUSER_ROLE,
  MINTER_ROLE: MINTER_ROLE,
  SAFE_CONFIG: SAFE_CONFIG,
  TRUSTED_FORWARDER_CONFIG: TRUSTED_FORWARDER_CONFIG,
  isTestEnv: isTestEnv,
  isMainnetForking: isMainnetForking,
  isMainnet: isMainnet,
  interestAprAsBN: interestAprAsBN,
  getDefenderClient: getDefenderClient,
  deployContractUpgrade: deployContractUpgrade,
  setInitialConfigVals: setInitialConfigVals,
  TRANCHES,
}
