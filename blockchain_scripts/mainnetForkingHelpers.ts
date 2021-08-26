import BN from "bn.js"
import {
  isTestEnv,
  updateConfig,
  OWNER_ROLE,
  SAFE_CONFIG,
  MAINNET_CHAIN_ID,
  DepList,
  Ticker,
  AddressString,
  getSignerForAddress,
  ChainId,
  CHAIN_NAME_BY_ID,
  getERC20Address,
  currentChainId,
  assertIsChainId,
  assertIsTicker,
} from "../blockchain_scripts/deployHelpers"
import _ from 'lodash'
import {CONFIG_KEYS} from "./configKeys"
import hre from "hardhat"
import {Contract} from "ethers"
import {DeploymentsExtension} from "hardhat-deploy/types"
import {HardhatRuntimeEnvironment} from "hardhat/types"
import {Signer} from "ethers"
import {assertIsString} from "../utils/type"
const {ethers, artifacts} = hre
const MAINNET_MULTISIG = "0xBEb28978B2c755155f20fd3d09Cb37e300A6981f"
const MAINNET_UNDERWRITER = "0x79ea65C834EC137170E1aA40A42b9C80df9c0Bb4"

async function getProxyImplAddress(proxyContract: Contract) {
  if (!proxyContract) {
    return null
  }
  const implStorageLocation = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
  let currentImpl = await ethers.provider.getStorageAt(proxyContract.address, implStorageLocation)
  return ethers.utils.hexStripZeros(currentImpl)
}

async function upgradeContracts(
  contractsToUpgrade: string[],
  contracts: any,
  signer: string | Signer,
  deployFrom: any,
  deployments: DeploymentsExtension,
  changeImplementation: boolean=true
) {
  console.log("Deploying the accountant")
  const accountantDeployResult = await deployments.deploy("Accountant", {from: deployFrom, gasLimit: 4000000, args: []})
  console.log("Deployed...")
  // Ensure a test forwarder is available. Using the test forwarder instead of the real forwarder on mainnet
  // gives us the ability to debug the forwarded transactions.
  console.log("Deploying test forwarder...")
  await deployments.deploy("TestForwarder", {from: deployFrom, gasLimit: 4000000, args: []})
  console.log("Deployed...")

  const dependencies: DepList = {
    CreditDesk: {["Accountant"]: accountantDeployResult.address},
  }

  for (const contractName of contractsToUpgrade) {
    let contract = contracts[contractName]
    if (!contract && contractName === "GoldfinchFactory") {
      // For backwards compatability until we deploy V2
      contract = contracts["CreditLineFactory"]
      contracts["GoldfinchFactory"] = contract
    }
    let contractToDeploy = contractName
    if (isTestEnv() && ["Pool", "CreditDesk", "GoldfinchConfig"].includes(contractName)) {
      contractToDeploy = `Test${contractName}`
    }

    console.log("Trying to deploy", contractToDeploy)
    let deployResult = await deployments.deploy(contractToDeploy, {
      from: deployFrom,
      args: [],
      libraries: dependencies[contractName],
    })
    console.log("Deployed...")
    // Get a contract object with the latest ABI, attached to the signer
    const ethersSigner = await getSignerForAddress(signer)
    let upgradedContract = await ethers.getContractAt(deployResult.abi, deployResult.address, ethersSigner)
    let upgradedImplAddress = deployResult.address

    if (contract.ProxyContract && changeImplementation) {
      if (!isTestEnv()) {
        console.log(
          `Changing implementation of ${contractName} from ${contract.ExistingImplAddress} to ${deployResult.address}`
        )
      }
      await contract.ProxyContract.changeImplementation(deployResult.address, "0x")
      upgradedContract = upgradedContract.attach(contract.ProxyContract.address)
    }
    contract.UpgradedContract = upgradedContract
    contract.UpgradedImplAddress = upgradedImplAddress
  }
  return contracts
}

type ExistingContracts = {
  [contractName: string]: {ProxyContract: Contract; ExistingContract: Contract; ExistingImplAddress: string}
}

async function getExistingContracts(
  contractNames: string[],
  signer: string | Signer,
  chainId: ChainId=MAINNET_CHAIN_ID,
): Promise<ExistingContracts> {
  let contracts: ExistingContracts = {}
  const onChainConfig = getCurrentlyDeployedContracts(chainId)
  for (let contractName of contractNames) {
    // For backwards compatability until we deploy V2
    if (contractName === "GoldfinchFactory") {
      contractName = "CreditLineFactory"
    }
    const contractConfig = onChainConfig[contractName] as any
    const proxyConfig = onChainConfig[`${contractName}_Proxy`] as any

    const ethersSigner = await getSignerForAddress(signer)
    let contractProxy = proxyConfig && (await ethers.getContractAt(proxyConfig.abi, proxyConfig.address, ethersSigner))
    let contract = await ethers.getContractAt(contractConfig.abi, contractConfig.address, ethersSigner)
    contracts[contractName] = {
      ProxyContract: contractProxy,
      ExistingContract: contract,
      ExistingImplAddress: (await getProxyImplAddress(contractProxy)) as string,
    }
  }
  return contracts
}

async function fundWithWhales(currencies: string[], recipients: string[], amount?: any) {
  const whales: Record<Ticker, AddressString> = {
    USDC: "0xf977814e90da44bfa03b6295a0616a897441acec",
    USDT: "0x28c6c06298d514db089934071355e5743bf21d60",
    BUSD: "0x28c6c06298d514db089934071355e5743bf21d60",
    ETH: "0xdee6238780f98c0ca2c2c28453149bea49a3abc9",
  }
  const chainId = await currentChainId()
  assertIsChainId(chainId)

  for (let currency of currencies) {
    if (!whales[currency]) {
      throw new Error(`We don't have a whale mapping for ${currency}`)
    }
    for (let recipient of _.compact(recipients)) {
      assertIsTicker(currency)
      if (currency === "ETH") {
        const whale = whales[currency]
        await impersonateAccount(hre, whale)
        let signer = await ethers.provider.getSigner(whale)
        await signer!.sendTransaction({to: recipient, value: ethers.utils.parseEther("5.0")})
      } else {
        const erc20Address = getERC20Address(currency, chainId)
        assertIsString(erc20Address)
        await fundWithWhale({
          erc20: await ethers.getContractAt("IERC20withDec", erc20Address),
          whale: whales[currency],
          recipient: recipient,
          amount: amount || new BN("200000"),
        })
      }
    }
  }
}

async function fundWithWhale({
  whale,
  recipient,
  erc20,
  amount,
}: {
  whale: string
  recipient: string
  erc20: any
  amount: BN
}) {
  await impersonateAccount(hre, whale)
  let signer = await ethers.provider.getSigner(whale)
  const contract = erc20.connect(signer)

  let ten = new BN(10)
  let d = new BN((await contract.decimals()).toString())
  let decimals = ten.pow(new BN(d))

  await contract.transfer(recipient, new BN(amount).mul(decimals).toString())
}

async function impersonateAccount(hre: HardhatRuntimeEnvironment, account: string) {
  return await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [account],
  })
}

async function performPostUpgradeMigration(upgradedContracts: any, deployments: DeploymentsExtension) {
  const deployed = await deployments.getOrNull("TestForwarder")
  const forwarder = await ethers.getContractAt(deployed!.abi, "0xa530F85085C6FE2f866E7FdB716849714a89f4CD")
  await forwarder.registerDomainSeparator("Defender", "1")
  await migrateToNewConfig(upgradedContracts)
}

async function migrateToNewConfig(upgradedContracts: any) {
  const newConfig = upgradedContracts.GoldfinchConfig.UpgradedContract
  const existingConfig = upgradedContracts.GoldfinchConfig.ExistingContract
  const safeAddress = SAFE_CONFIG[MAINNET_CHAIN_ID].safeAddress
  if (!(await newConfig.hasRole(OWNER_ROLE, safeAddress))) {
    await (await newConfig.initialize(safeAddress)).wait()
  }
  await newConfig.initializeFromOtherConfig(existingConfig.address)
  await updateConfig(
    existingConfig,
    "address",
    CONFIG_KEYS.GoldfinchConfig,
    newConfig.address
  )

  const contractsToUpgrade = ["Fidu", "Pool", "CreditDesk", "CreditLineFactory"]
  await Promise.all(
    contractsToUpgrade.map(async (contract) => {
      await (await upgradedContracts[contract].UpgradedContract.updateGoldfinchConfig()).wait()
    })
  )
}

type ContractInfo = {
  address: string,
  abi: {}[]
}
function getCurrentlyDeployedContracts(chainId: ChainId=MAINNET_CHAIN_ID) : {[key: string]: ContractInfo} {
  let deploymentsFile = require("../client/config/deployments.json")
  const chainName = CHAIN_NAME_BY_ID[chainId]
  return deploymentsFile[chainId][chainName].contracts
}

async function getAllExistingContracts(chainId: ChainId=MAINNET_CHAIN_ID) : Promise<{[key: string]: any }> {
  const contracts = getCurrentlyDeployedContracts(chainId)
  const result = {}
  await Promise.all(Object.entries(contracts).map(async ([contractName, contractInfo]) => {
    if (contractName.includes("Proxy") || contractName.includes("Implementation")) {
      return null
    }
    if (contractName === "CreditLineFactory") {
      contractName = "GoldfinchFactory"
    }
    return result[contractName] = await artifacts.require(contractName).at(contractInfo.address)
  }))
  return result
}

export {
  MAINNET_MULTISIG,
  MAINNET_UNDERWRITER,
  fundWithWhales,
  getExistingContracts,
  upgradeContracts,
  impersonateAccount,
  getCurrentlyDeployedContracts,
  performPostUpgradeMigration,
  getAllExistingContracts,
}
