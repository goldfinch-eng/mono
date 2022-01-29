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
  ContractDeployer,
  getEthersContract,
  getProtocolOwner,
  fixProvider,
} from "../blockchain_scripts/deployHelpers"
import _ from "lodash"
import {CONFIG_KEYS} from "./configKeys"
import hre from "hardhat"
import {Contract} from "ethers"
import {DeploymentsExtension} from "hardhat-deploy/types"
import {HardhatRuntimeEnvironment} from "hardhat/types"
import {Signer} from "ethers"
import {assertIsString, assertNonNullable} from "@goldfinch-eng/utils"
const {ethers, artifacts} = hre
const MAINNET_MULTISIG = "0xBEb28978B2c755155f20fd3d09Cb37e300A6981f"
const MAINNET_UNDERWRITER = "0x79ea65C834EC137170E1aA40A42b9C80df9c0Bb4"

import {mergeABIs} from "hardhat-deploy/dist/src/utils"
import {FormatTypes} from "ethers/lib/utils"
import {Logger} from "./types"
import {
  openzeppelin_assertIsValidImplementation,
  openzeppelin_assertIsValidUpgrade,
  openzeppelin_saveDeploymentManifest,
} from "./deployHelpers/openzeppelin-upgrade-validation"

async function getProxyImplAddress(proxyContract: Contract) {
  if (!proxyContract) {
    return null
  }
  const implStorageLocation = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
  const currentImpl = await ethers.provider.getStorageAt(proxyContract.address, implStorageLocation)
  return ethers.utils.hexStripZeros(currentImpl)
}

async function upgradeContracts({
  contractsToUpgrade = [],
  contracts,
  signer,
  deployFrom,
  deployer,
  deployTestForwarder = false,
  logger = console.log,
}: {
  contractsToUpgrade: string[]
  contracts: ExistingContracts
  signer: string | Signer
  deployFrom: any
  deployer: ContractDeployer
  deployTestForwarder?: boolean
  logger: Logger
}): Promise<UpgradedContracts> {
  logger("Deploying accountant")
  const accountantDeployResult = await deployer.deployLibrary("Accountant", {
    from: deployFrom,
    gasLimit: 4000000,
    args: [],
  })

  if (deployTestForwarder) {
    logger("Deploying test forwarder")
    // Ensure a test forwarder is available. Using the test forwarder instead of the real forwarder on mainnet
    // gives us the ability to debug the forwarded transactions.
    await deployer.deploy("TestForwarder", {from: deployFrom, gasLimit: 4000000, args: []})
  }

  const dependencies: DepList = {
    CreditLine: {["Accountant"]: accountantDeployResult.address},
    SeniorPool: {["Accountant"]: accountantDeployResult.address},
    GoldfinchFactory: {["Accountant"]: accountantDeployResult.address},
  }

  const upgradedContracts: UpgradedContracts = {}
  for (const contractName of contractsToUpgrade) {
    const contract = contracts[contractName]
    assertNonNullable(contract)

    let contractToDeploy = contractName
    if (isTestEnv() && ["Pool", "CreditDesk", "GoldfinchConfig"].includes(contractName)) {
      contractToDeploy = `Test${contractName}`
    }

    logger("📡 Trying to deploy", contractToDeploy)
    const ethersSigner = typeof signer === "string" ? await ethers.getSigner(signer) : signer
    await deployer.deploy(contractToDeploy, {
      from: deployFrom,
      proxy: {
        owner: await getProtocolOwner(),
      },
      libraries: dependencies[contractName],
    })

    logger("Assert valid implementation and upgrade", contractToDeploy)
    const proxyDeployment = await hre.deployments.get(`${contractToDeploy}`)
    const implDeployment = await hre.deployments.get(`${contractToDeploy}_Implementation`)
    await openzeppelin_assertIsValidImplementation(implDeployment)
    // await openzeppelin_assertIsValidUpgrade(fixProvider(hre.network.provider), proxyDeployment.address, implDeployment)

    const upgradedContract = (await getEthersContract(contractToDeploy, {at: implDeployment.address})).connect(
      ethersSigner
    )
    // Get a contract object with the latest ABI, attached to the signer
    const upgradedImplAddress = upgradedContract.address

    upgradedContracts[contractName] = {
      ...contract,
      UpgradedContract: upgradedContract,
      UpgradedImplAddress: upgradedImplAddress,
    }

    await rewriteUpgradedDeployment(contractName)
    await openzeppelin_saveDeploymentManifest(fixProvider(hre.network.provider), proxyDeployment, implDeployment)
  }
  return upgradedContracts
}

/**
 * Rewrite a proxy upgrade in the deployments directory. hardhat-deploy creates 3 different deployment files for a proxied contract:
 *
 *   - Contract_Proxy.json. Proxy ABI.
 *   - Contract_Implementation.json. Implementation ABI.
 *   - Contract.json. Combined Proxy and Implementation ABI.
 *
 * When using `hre.deployments.deploy` with the `proxy` key, hardhat-deploy will write out the combined ABI. But since
 * we use a multisig to change the proxy's implementation, only the implementation ABI is written out by hardhat-deploy.
 * Work around this by rewriting the combined ABI ourselves.
 */
export async function rewriteUpgradedDeployment(deploymentName: string) {
  const implDeployment = await hre.deployments.get(`${deploymentName}_Implementation`)
  const proxyDeployment = await hre.deployments.get(`${deploymentName}_Proxy`)

  const mergedABI = mergeABIs([implDeployment.abi, proxyDeployment.abi], {
    check: false,
    skipSupportsInterface: false,
  })

  const deployment = await hre.deployments.get(deploymentName)
  deployment.abi = mergedABI
  deployment.implementation = implDeployment.address
  await hre.deployments.save(deploymentName, deployment)
}

export type ContractHolder = {
  ProxyContract: Contract
  ExistingContract: Contract
  ExistingImplAddress: string
  UpgradedContract: Contract
  UpgradedImplAddress: string
}

export type ExistingContracts = {
  [contractName: string]: Omit<ContractHolder, "UpgradedContract" | "UpgradedImplAddress">
}

export type UpgradedContracts = {
  [contractName: string]: ContractHolder
}

async function getExistingContracts(
  contractNames: string[],
  signer: string | Signer,
  chainId: ChainId = MAINNET_CHAIN_ID
): Promise<ExistingContracts> {
  const contracts: ExistingContracts = {}
  const onChainConfig = getCurrentlyDeployedContracts(chainId)
  for (const contractName of contractNames) {
    const contractConfig = onChainConfig[contractName] as any
    const proxyConfig = onChainConfig[`${contractName}_Proxy`] as any

    const ethersSigner = await getSignerForAddress(signer)
    const contractProxy =
      proxyConfig && (await ethers.getContractAt(proxyConfig.abi, proxyConfig.address, ethersSigner))
    const contract = await ethers.getContractAt(contractConfig.abi, contractConfig.address, ethersSigner)
    contracts[contractName] = {
      ProxyContract: contractProxy,
      ExistingContract: contract,
      ExistingImplAddress: (await getProxyImplAddress(contractProxy)) as string,
    }
  }
  return contracts
}

async function performPostUpgradeMigration(upgradedContracts: any, deployments: DeploymentsExtension) {
  const deployed = await deployments.getOrNull("TestForwarder")
  assertNonNullable(deployed)
  const forwarder = await ethers.getContractAt(deployed.abi, "0xa530F85085C6FE2f866E7FdB716849714a89f4CD")
  await forwarder.registerDomainSeparator("Defender", "1")
  await migrateToNewConfig(upgradedContracts, [
    "CreditDesk",
    "CreditLine",
    "Fidu",
    "FixedLeverageRatioStrategy",
    "Go",
    "MigratedTranchedPool",
    "Pool",
    "PoolTokens",
    "SeniorPool",
  ])
}

export async function migrateToNewConfig(upgradedContracts: any, contractsToUpgrade: string[]) {
  const newConfig = upgradedContracts.GoldfinchConfig.UpgradedContract
  const existingConfig = upgradedContracts.GoldfinchConfig.ExistingContract
  const safeAddress = SAFE_CONFIG[MAINNET_CHAIN_ID].safeAddress
  if (!(await newConfig.hasRole(OWNER_ROLE, safeAddress))) {
    await (await newConfig.initialize(safeAddress)).wait()
  }
  await newConfig.initializeFromOtherConfig(existingConfig.address)
  await updateConfig(existingConfig, "address", CONFIG_KEYS.GoldfinchConfig, newConfig.address)

  await Promise.all(
    contractsToUpgrade.map(async (contract) => {
      await (await upgradedContracts[contract].UpgradedContract.updateGoldfinchConfig()).wait()
    })
  )
}

type ContractInfo = {
  address: string
  abi: {}[]
}
function getCurrentlyDeployedContracts(chainId: ChainId = MAINNET_CHAIN_ID): {[key: string]: ContractInfo} {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const deploymentsFile = require("../deployments/all.json")
  const chainName = CHAIN_NAME_BY_ID[chainId]
  return deploymentsFile[chainId][chainName].contracts
}

async function getAllExistingContracts(chainId: ChainId = MAINNET_CHAIN_ID): Promise<{[key: string]: any}> {
  const contracts = getCurrentlyDeployedContracts(chainId)
  const result = {}
  await Promise.all(
    Object.entries(contracts).map(async ([contractName, contractInfo]) => {
      if (contractName.includes("Proxy") || contractName.includes("Implementation")) {
        return null
      }
      if (contractName === "CreditLineFactory") {
        contractName = "GoldfinchFactory"
      }
      return (result[contractName] = await artifacts.require(contractName).at(contractInfo.address))
    })
  )
  return result
}

export {
  MAINNET_MULTISIG,
  MAINNET_UNDERWRITER,
  getExistingContracts,
  upgradeContracts,
  getCurrentlyDeployedContracts,
  performPostUpgradeMigration,
  getAllExistingContracts,
}
