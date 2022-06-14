import {
  isTestEnv,
  updateConfig,
  OWNER_ROLE,
  SAFE_CONFIG,
  MAINNET_CHAIN_ID,
  DepList,
  getSignerForAddress,
  ChainId,
  CHAIN_NAME_BY_ID,
  getERC20Address,
  assertIsChainId,
  ContractDeployer,
  getEthersContract,
  getProtocolOwner,
  fixProvider,
  isMainnetForking,
} from "../blockchain_scripts/deployHelpers"
import _ from "lodash"
import {CONFIG_KEYS} from "./configKeys"
import hre from "hardhat"
import {Contract} from "ethers"
import {DeploymentsExtension} from "hardhat-deploy/types"
import {Signer} from "ethers"
import {assertNonNullable} from "@goldfinch-eng/utils"
const {ethers, artifacts} = hre
const MAINNET_MULTISIG = "0xBEb28978B2c755155f20fd3d09Cb37e300A6981f"
const MAINNET_UNDERWRITER = "0x79ea65C834EC137170E1aA40A42b9C80df9c0Bb4"

import {mergeABIs} from "hardhat-deploy/dist/src/utils"
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
  logger = console.log,
}: {
  contractsToUpgrade: string[]
  contracts: ExistingContracts
  signer: string | Signer
  deployFrom: any
  deployer: ContractDeployer
  logger: Logger
}): Promise<UpgradedContracts> {
  logger("Deploying accountant")
  const accountantDeployResult = await deployer.deployLibrary("Accountant", {
    from: deployFrom,
    gasLimit: 4000000,
    args: [],
  })

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
    // To upgrade the manifest:
    //  1. run `npm run generate-manifest` on main
    //  2. checkout your branch
    //  3. copy/paste it to .openzeppelin/unknown-*.json
    //  4. run `npm run generate-manifest` again
    await openzeppelin_assertIsValidUpgrade(fixProvider(hre.network.provider), proxyDeployment.address, implDeployment)

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

    // We don't want to re-write the upgrade manifest and deployments manifest
    // when we deploy during a mainnet forking test. If we did, we would be
    // checking if the upgrade was safe with the last thing that we deployed,
    // not what's currently on mainnet
    if (!isMainnetForking()) {
      await rewriteUpgradedDeployment(contractName)
      await openzeppelin_saveDeploymentManifest(fixProvider(hre.network.provider), proxyDeployment, implDeployment)
    }
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

/**
 * Override the USDC DOMAIN_SEPARATOR to use the local chain ID of 31337. This makes permit work when
 * using mainnet forking.
 */
export async function overrideUsdcDomainSeparator() {
  const chainId = await hre.getChainId()
  assertIsChainId(chainId)
  const usdcAddress = getERC20Address("USDC", chainId)
  // DOMAIN_SEPARATOR storage slot is 15.
  // This can be confirmed by running the following:
  //
  //   await web3.eth.getStorageAt("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", 15)
  //
  // And comparing with the output of calling usdc.DOMAIN_SEPARATOR()
  const DOMAIN_SEPARATOR_STORAGE_SLOT_INDEX = "0xf"
  const value = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "bytes32", "bytes32", "uint256", "address"],
      [
        ethers.utils.keccak256(
          ethers.utils.toUtf8Bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
        ),
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("USD Coin")),
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("2")),
        chainId,
        usdcAddress,
      ]
    )
  )
  ethers.utils.solidityKeccak256([], [])
  await ethers.provider.send("hardhat_setStorageAt", [usdcAddress, DOMAIN_SEPARATOR_STORAGE_SLOT_INDEX, value])
  await ethers.provider.send("evm_mine", [])
}

export {
  MAINNET_MULTISIG,
  MAINNET_UNDERWRITER,
  getExistingContracts,
  upgradeContracts,
  getCurrentlyDeployedContracts,
  getAllExistingContracts,
}
