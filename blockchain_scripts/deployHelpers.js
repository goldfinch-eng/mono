/* global web3 ethers */
const BN = require("bn.js")
const USDCDecimals = new BN(String(1e6))
const ETHDecimals = new BN(String(1e18))
const INTEREST_DECIMALS = new BN(String(1e8))

const ROPSTEN_USDC_ADDRESS = "0x07865c6e87b9f70255377e024ace6630c1eaa37f"
const MAINNET_USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
const MAINNET_ONE_SPLIT_ADDRESS = "0xC586BeF4a0992C495Cf22e1aeEE4E446CECDee0E"
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
const USDC_MAPPING = {
  [ROPSTEN]: ROPSTEN_USDC_ADDRESS,
  [MAINNET]: MAINNET_USDC_ADDRESS,
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

const CONFIG_KEYS = {
  // Numbers
  TransactionLimit: 0,
  TotalFundsLimit: 1,
  MaxUnderwriterLimit: 2,
  ReserveDenominator: 3,
  WithdrawFeeDenominator: 4,
  LatenessGracePeriodInDays: 5,
  LatenessMaxDays: 6,
  // Addresses
  Pool: 0,
  CreditLineImplementation: 1,
  CreditLineFactory: 2,
  CreditDesk: 3,
  Fidu: 4,
  USDC: 5,
  TreasuryReserve: 6,
  ProtocolAdmin: 7,
  OneInch: 8,
  TrustedForwarder: 9,
  CUSDCContract: 10,
}

function isTestEnv() {
  return process.env.NODE_ENV === "test"
}

function isMainnetForking() {
  return process.env.HARDHAT_FORK === "mainnet"
}

function interestAprAsBN(interestPercentageString) {
  const interestPercentageFloat = parseFloat(interestPercentageString)
  return new BN((interestPercentageFloat / 100) * INTEREST_DECIMALS)
}

function getUSDCAddress(chainID) {
  if (isMainnetForking()) {
    return USDC_MAPPING[MAINNET]
  }
  return USDC_MAPPING[chainID] || USDC_MAPPING[CHAIN_MAPPING[chainID]]
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

async function upgrade(deploy, contractName, proxyOwner, options) {
  const deployOptions = Object.assign({from: proxyOwner, proxy: {owner: proxyOwner}}, options)
  return deploy(contractName, deployOptions)
}

async function updateConfig(config, type, key, newValue, opts) {
  opts = opts || {}
  let logger = opts.logger || function () {}
  let currentValue
  if (type === "address") {
    currentValue = await config.getAddress(key)
    if (currentValue !== newValue) {
      if (key == CONFIG_KEYS.CreditLineImplementation) {
        await (await config.setCreditLineImplementation(newValue)).wait()
      } else {
        await (await config.setAddress(key, newValue)).wait()
      }
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

module.exports = {
  CHAIN_MAPPING: CHAIN_MAPPING,
  ROPSTEN_USDC_ADDRESS: ROPSTEN_USDC_ADDRESS,
  MAINNET_ONE_SPLIT_ADDRESS: MAINNET_ONE_SPLIT_ADDRESS,
  LOCAL: LOCAL,
  MAINNET: MAINNET,
  USDCDecimals: USDCDecimals,
  MAX_UINT: MAX_UINT,
  ETHDecimals: ETHDecimals,
  INTEREST_DECIMALS: INTEREST_DECIMALS,
  getUSDCAddress: getUSDCAddress,
  getDeployedContract: getDeployedContract,
  fromAtomic: fromAtomic,
  toAtomic: toAtomic,
  upgrade: upgrade,
  updateConfig: updateConfig,
  getSignerForAddress: getSignerForAddress,
  MAINNET_CHAIN_ID: MAINNET_CHAIN_ID,
  OWNER_ROLE: OWNER_ROLE,
  PAUSER_ROLE: PAUSER_ROLE,
  MINTER_ROLE: MINTER_ROLE,
  CONFIG_KEYS: CONFIG_KEYS,
  SAFE_CONFIG: SAFE_CONFIG,
  TRUSTED_FORWARDER_CONFIG: TRUSTED_FORWARDER_CONFIG,
  isTestEnv: isTestEnv,
  isMainnetForking: isMainnetForking,
  interestAprAsBN: interestAprAsBN,
}
