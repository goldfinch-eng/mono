import {isTestEnv, ContractDeployer, getEthersContract, getProtocolOwner, fixProvider, isMainnetForking} from "./"
import hre, {ethers} from "hardhat"
import {Contract, Signer} from "ethers"
import {assertNonNullable} from "@goldfinch-eng/utils"
import {Logger} from "../types"
import {
  openzeppelin_assertIsValidImplementation,
  openzeppelin_assertIsValidUpgrade,
  openzeppelin_saveDeploymentManifest,
} from "./openzeppelin-upgrade-validation"
import {ExistingContracts} from "./getExistingContracts"
import {mergeABIs} from "hardhat-deploy/dist/src/utils"
import {ProbablyValidContract} from "./contracts"

export type DepList = {[contractName: string]: {[contractName: string]: string}}

export type ContractHolder = {
  ProxyContract: Contract
  ExistingContract: Contract
  ExistingImplAddress: string
  UpgradedContract: Contract
  UpgradedImplAddress: string
}

export type UpgradedContracts = {
  [contractName: string]: ContractHolder
}

export type ContractUpgradeData = ProbablyValidContract | {name: ProbablyValidContract; args?: any[]}
export const getName = (data: ContractUpgradeData) => (typeof data === "string" ? data : data.name)

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

export async function upgradeContracts({
  contractsToUpgrade = [],
  contracts,
  signer,
  deployFrom,
  deployer,
  proxyOwner,
  logger = console.log,
}: {
  contractsToUpgrade: ContractUpgradeData[]
  contracts: ExistingContracts
  signer: string | Signer
  deployFrom: any
  deployer: ContractDeployer
  proxyOwner?: string
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

  const upgrades: Exclude<ContractUpgradeData, string>[] = contractsToUpgrade.map((upgrade) =>
    typeof upgrade === "string" ? {name: upgrade, args: undefined} : upgrade
  )

  const upgradedContracts: UpgradedContracts = {}
  for (const {name: contractName, args} of upgrades) {
    const contract = contracts[contractName]
    assertNonNullable(contract)

    let contractToDeploy = contractName
    if (!isMainnetForking() && isTestEnv() && ["GoldfinchConfig"].includes(contractName)) {
      contractToDeploy = `Test${contractName}` as ProbablyValidContract
    }

    logger("📡 Trying to deploy", contractToDeploy)
    const ethersSigner = typeof signer === "string" ? await ethers.getSigner(signer) : signer
    await deployer.deploy(contractToDeploy, {
      from: deployFrom,
      args,
      proxy: {
        owner: proxyOwner || (await getProtocolOwner()),
      },
      libraries: dependencies[contractName],
    })

    logger("Assert valid implementation and upgrade", contractToDeploy)
    const proxyDeployment = await hre.deployments.get(`${contractToDeploy}`)
    const implDeployment = await hre.deployments.get(`${contractToDeploy}_Implementation`)
    await openzeppelin_assertIsValidImplementation(implDeployment, {hasArgs: !!args})
    // To upgrade the manifest:
    //  1. run `yarn generate-manifest` on main
    //  2. checkout your branch
    //  3. copy/paste it to .openzeppelin/unknown-*.json
    //  4. run `yarn generate-manifest` again
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
