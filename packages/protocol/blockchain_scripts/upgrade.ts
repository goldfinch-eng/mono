import {deployContractUpgrade, SAFE_CONFIG, CHAIN_NAME_BY_ID, assertIsChainId} from "./deployHelpers"
import {DefenderUpgrader} from "./adminActions/defenderUpgrader"
import hre from "hardhat"
import {asNonNullable} from "@goldfinch-eng/utils"

/*
This script deploys the latest implementations of upgradeable contracts and requests an upgrade via the
gnosis upgradeViaMultisig
*/
let logger

async function main() {
  await upgradeViaMultisig(hre)
}

async function upgradeViaMultisig(hre) {
  const {getNamedAccounts, getChainId} = hre
  const {gf_deployer} = await getNamedAccounts()

  // Since this is not a "real" deployment (just a script),
  //the deployments.log is not enabled. So, just use console.log instead
  logger = console.log
  const chainId = await getChainId()
  assertIsChainId(chainId)

  if (!SAFE_CONFIG[chainId]) {
    throw new Error(`Unsupported chain id: ${chainId}`)
  }

  const contractsToUpgradeString = process.env.CONTRACTS || "GoldfinchConfig, GoldfinchFactory, CreditDesk, Pool, Fidu"
  logger(`Deploying upgrades on chainId ${chainId} for: ${contractsToUpgradeString}`)
  const contractsToUpgrade = contractsToUpgradeString.split(/[ ,]+/)

  let upgrader
  if (!process.env.NO_DEFENDER) {
    upgrader = new DefenderUpgrader({hre, logger, chainId})
  }

  const contracts = await deployUpgrades({contractNames: contractsToUpgrade, gf_deployer, hre, upgrader})

  logger(`Safe address: ${SAFE_CONFIG[chainId].safeAddress}`)
  for (let i = 0; i < contractsToUpgrade.length; i++) {
    const contract = contracts[asNonNullable(contractsToUpgrade[i])]
    logger("-------------RESULT ------------------")
    logger(`${contract.name}. Proxy: ${contract.proxy.address} New Implementation: ${contract.newImplementation}`)
  }

  logger("Done.")
  return contracts
}

async function deployUpgrades({contractNames, gf_deployer, hre, upgrader}) {
  const {deployments, ethers} = hre
  const {deploy} = deployments

  const accountant = await deploy("Accountant", {
    from: gf_deployer,
    gas: 4000000,
    args: [],
  })
  const dependencies = {
    CreditDesk: {["Accountant"]: accountant.address},
  }
  const result = {}

  for (let i = 0; i < contractNames.length; i++) {
    const contractName = contractNames[i]
    const contractInfo = await deployContractUpgrade(contractName, dependencies, gf_deployer, deployments, ethers)

    result[contractName] = contractInfo

    logger(`Writing out ABI for ${contractName}`)
    await exportDeployment(deployments, contractName, dependencies, gf_deployer)

    if (contractInfo.currentImplementation.toLowerCase() === contractInfo.newImplementation.toLowerCase()) {
      logger(`${contractName} did not change, skipping`)
      continue
    }

    logger(
      `Deployed ${contractName} to ${contractInfo.newImplementation} (current ${contractInfo.currentImplementation})`
    )

    if (upgrader) {
      await upgrader.changeImplementation(contractName, contractInfo)
    }
  }
  return result
}

async function exportDeployment(deployments, contractName, dependencies, gf_deployer) {
  // As of hardhat-deploy ^0.7.0-beta.46, deploying a proxy where the implementation
  // has already been deployed "out of band" will do nothing but update the top level
  // contractName.json's ABIs and implementation address.
  await deployments.deploy(contractName, {
    from: gf_deployer,
    gas: 4000000,
    args: [],
    proxy: {owner: gf_deployer},
    libraries: dependencies[contractName],
  })
}

if (require.main === module) {
  // If this is run as a script, then call main. If it's imported (for tests), this block will not run
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

export {upgradeViaMultisig, deployUpgrades, DefenderUpgrader}
