const {deployContractUpgrade, SAFE_CONFIG, CHAIN_NAME_BY_ID} = require("./deployHelpers.js")
const DefenderUpgrader = require("./defender-upgrader.js")
const hre = require("hardhat")

/*
This script deploys the latest implementations of upgradeable contracts and requests an upgrade via the
gnosis multisig
*/
let logger

async function main() {
  await multisig(hre)
}

async function multisig(hre) {
  const {getNamedAccounts, getChainId} = hre
  const {proxy_owner} = await getNamedAccounts()

  // Since this is not a "real" deployment (just a script),
  //the deployments.log is not enabled. So, just use console.log instead
  logger = console.log
  const chainId = await getChainId()
  const network = CHAIN_NAME_BY_ID[chainId]

  if (!SAFE_CONFIG[chainId]) {
    throw new Error(`Unsupported chain id: ${chainId}`)
  }

  let contractsToUpgrade = process.env.CONTRACTS || "GoldfinchConfig, GoldfinchFactory, CreditDesk, Pool, Fidu"
  logger(`Deploying upgrades on chainId ${chainId} for: ${contractsToUpgrade}`)
  contractsToUpgrade = contractsToUpgrade.split(/[ ,]+/)

  let upgrader
  if (!process.env.NO_DEFENDER) {
    upgrader = new DefenderUpgrader({hre, logger, chainId, network})
  }

  const contracts = await deployUpgrades({contractNames: contractsToUpgrade, proxy_owner, hre, upgrader})

  logger(`Safe address: ${SAFE_CONFIG[chainId].safeAddress}`)
  for (let i = 0; i < contractsToUpgrade.length; i++) {
    let contract = contracts[contractsToUpgrade[i]]
    logger("-------------RESULT ------------------")
    logger(`${contract.name}. Proxy: ${contract.proxy.address} New Implementation: ${contract.newImplementation}`)
  }

  logger("Done.")
}

async function deployUpgrades({contractNames, proxy_owner, hre, upgrader}) {
  const {deployments, ethers} = hre
  const {deploy} = deployments

  let accountant = await deploy("Accountant", {
    from: proxy_owner,
    gas: 4000000,
    args: [],
  })
  const dependencies = {
    CreditDesk: {["Accountant"]: accountant.address},
  }
  const result = {}

  for (let i = 0; i < contractNames.length; i++) {
    let contractName = contractNames[i]
    let contractInfo = await deployContractUpgrade(contractName, dependencies, proxy_owner, deployments, ethers)

    result[contractName] = contractInfo

    logger(`Writing out ABI for ${contractName}`)
    await exportDeployment(deployments, contractName, dependencies, proxy_owner)

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

async function exportDeployment(deployments, contractName, dependencies, proxy_owner) {
  // As of hardhat-deploy ^0.7.0-beta.46, deploying a proxy where the implementation
  // has already been deployed "out of band" will do nothing but update the top level
  // contractName.json's ABIs and implementation address.
  await deployments.deploy(contractName, {
    from: proxy_owner,
    gas: 4000000,
    args: [],
    proxy: {owner: proxy_owner},
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

module.exports = {multisig, deployUpgrades, DefenderUpgrader}
