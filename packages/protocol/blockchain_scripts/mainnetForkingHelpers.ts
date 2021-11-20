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

    logger("Trying to deploy", contractToDeploy)
    const ethersSigner = typeof signer === "string" ? await ethers.getSigner(signer) : signer
    const upgradedContract = (
      await deployer.deploy(contractToDeploy, {
        from: deployFrom,
        args: [],
        libraries: dependencies[contractName],
      })
    ).connect(ethersSigner)
    // Get a contract object with the latest ABI, attached to the signer
    const upgradedImplAddress = upgradedContract.address

    upgradedContracts[contractName] = {
      ...contract,
      UpgradedContract: upgradedContract,
      UpgradedImplAddress: upgradedImplAddress,
    }

    await rewriteUpgradedDeployment(contractName, upgradedContract, contract.ProxyContract)
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
 * we run our own deploy logic (without the `proxy` key, see `upgradeContracts`), only the implementation ABI is written out.
 * Work around this by rewriting the ABI ourselves.
 */
async function rewriteUpgradedDeployment(deploymentName: string, impl: Contract, proxy: Contract) {
  const implAbi = JSON.parse(String(impl.interface.format(FormatTypes.json)))
  const proxyAbi = JSON.parse(String(proxy.interface.format(FormatTypes.json)))

  const mergedABI = mergeABIs([implAbi, proxyAbi], {
    check: false,
    skipSupportsInterface: false,
  })

  const deployment = await hre.deployments.get(deploymentName)
  deployment.abi = mergedABI
  deployment.address = proxy.address
  await hre.deployments.save(deploymentName, deployment)

  const implDeploymentName = deploymentName + "_Implementation"
  const implDeployment = await hre.deployments.get(implDeploymentName)
  implDeployment.abi = implAbi
  implDeployment.address = impl.address
  await hre.deployments.save(implDeploymentName, implDeployment)
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

async function fundWithWhales(currencies: Ticker[], recipients: string[], amount?: any) {
  const whales: Record<Ticker, AddressString> = {
    USDC: "0xf977814e90da44bfa03b6295a0616a897441acec",
    USDT: "0x28c6c06298d514db089934071355e5743bf21d60",
    BUSD: "0x28c6c06298d514db089934071355e5743bf21d60",
    ETH: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  }
  const chainId = await currentChainId()
  assertIsChainId(chainId)

  for (const currency of currencies) {
    if (!whales[currency]) {
      throw new Error(`We don't have a whale mapping for ${currency}`)
    }
    for (const recipient of _.compact(recipients)) {
      assertIsTicker(currency)
      if (currency === "ETH") {
        const whale = whales[currency]
        await impersonateAccount(hre, whale)
        const signer = ethers.provider.getSigner(whale)
        assertNonNullable(signer)
        await signer.sendTransaction({to: recipient, value: ethers.utils.parseEther("10.0")})
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
  const signer = await ethers.provider.getSigner(whale)
  const contract = erc20.connect(signer)

  const ten = new BN(10)
  const d = new BN((await contract.decimals()).toString())
  const decimals = ten.pow(new BN(d))

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
  fundWithWhales,
  getExistingContracts,
  upgradeContracts,
  impersonateAccount,
  getCurrentlyDeployedContracts,
  performPostUpgradeMigration,
  getAllExistingContracts,
}
