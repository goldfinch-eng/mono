/* global web3 ethers */
const BN = require("bn.js")
// Using 1e6, because that's what USDC is.
const USDCDecimals = new BN(String(1e6))
const ETHDecimals = new BN(String(1e18))
const INTEREST_DECIMALS = new BN(String(1e18))

const ROPSTEN_USDC_ADDRESS = "0x07865c6e87b9f70255377e024ace6630c1eaa37f"
const MAINNET_USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
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
const MULTISIG_MAPPING = {
  [RINKEBY]: "0xcF0B329c04Fd92a7370de10458050Fc8124Cacbc",
}
const OWNER_ROLE = web3.utils && web3.utils.keccak256("OWNER_ROLE")
const PAUSER_ROLE = web3.utils && web3.utils.keccak256("PAUSER_ROLE")
const MINTER_ROLE = web3.utils && web3.utils.keccak256("MINTER_ROLE")

const CONFIG_KEYS = {
  // Numbers
  TransactionLimit: 0,
  TotalFundsLimit: 1,
  MaxUnderwriterLimit: 2,
  ReserveDenominator: 3,
  WithdrawFeeDenominator: 4,
  // Addresses
  Pool: 0,
  CreditLineImplementation: 1,
  CreditLineFactory: 2,
  CreditDesk: 3,
  Fidu: 4,
  USDC: 5,
  TreasuryReserve: 6,
  ProtocolAdmin: 7,
}

function isTestEnv() {
  return process.env.NODE_ENV === "test"
}

function interestAprAsBN(interestPercentageString) {
  const INTEREST_DECIMALS = 1e8
  const interestPercentageFloat = parseFloat(interestPercentageString)
  return new BN((interestPercentageFloat / 100) * INTEREST_DECIMALS)
}

function getUSDCAddress(chainID) {
  return USDC_MAPPING[chainID] || USDC_MAPPING[CHAIN_MAPPING[chainID]]
}

function getMultisigAddress(chainID) {
  return MULTISIG_MAPPING[chainID] || MULTISIG_MAPPING[CHAIN_MAPPING[chainID]]
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
  let signer = undefined
  if (signerAddress && typeof signerAddress === "string") {
    const signers = await ethers.getSigners()
    signer = signers.find((signer) => signer._address === signerAddress)
  } else if (signerAddress && typeof signerAddres === "object") {
    signer = signerAddress
  }
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
  LOCAL: LOCAL,
  MAINNET: MAINNET,
  USDCDecimals: USDCDecimals,
  MAX_UINT: MAX_UINT,
  ETHDecimals: ETHDecimals,
  INTEREST_DECIMALS: INTEREST_DECIMALS,
  getMultisigAddress: getMultisigAddress,
  getUSDCAddress: getUSDCAddress,
  getDeployedContract: getDeployedContract,
  fromAtomic: fromAtomic,
  toAtomic: toAtomic,
  upgrade: upgrade,
  updateConfig: updateConfig,
  MAINNET_CHAIN_ID: MAINNET_CHAIN_ID,
  OWNER_ROLE: OWNER_ROLE,
  PAUSER_ROLE: PAUSER_ROLE,
  MINTER_ROLE: MINTER_ROLE,
  CONFIG_KEYS: CONFIG_KEYS,
  isTestEnv: isTestEnv,
  interestAprAsBN: interestAprAsBN,
}
