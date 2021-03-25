const {deployContractUpgrade, SAFE_CONFIG, CHAIN_MAPPING, getDefenderClient} = require("./deployHelpers.js")
const {CONFIG_KEYS} = require("./configKeys")
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
  const network = CHAIN_MAPPING[chainId]

  if (!SAFE_CONFIG[chainId]) {
    throw new Error(`Unsupported chain id: ${chainId}`)
  }

  let contractsToUpgrade = process.env.CONTRACTS || "GoldfinchConfig, CreditLineFactory, CreditDesk, Pool, Fidu"
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

class DefenderUpgrader {
  constructor({hre, logger, chainId, network}) {
    this.hre = hre
    this.logger = logger
    this.chainId = chainId
    this.network = network
    this.client = getDefenderClient()
    const safe = SAFE_CONFIG[chainId]
    if (!safe) {
      throw new Error(`No safe address found for chain id: ${chainId}`)
    } else {
      this.safeAddress = safe.safeAddress
    }
  }

  defenderUrl(contractAddress) {
    return `https://defender.openzeppelin.com/#/admin/contracts/${this.network}-${contractAddress}`
  }

  async changeImplementation(contractName, contractInfo) {
    this.logger("Now attempting to create the proposal on Defender...")
    await this.client.createProposal({
      contract: {address: contractInfo.proxy.address, network: this.network}, // Target contract
      title: "Upgrade to latest version",
      description: `Upgrading ${contractName} to a new implementation at ${contractInfo.newImplementation}`,
      type: "custom",
      functionInterface: {
        name: "changeImplementation",
        inputs: [
          {internalType: "address", name: "newImplementation", type: "address"},
          {internalType: "bytes", name: "data", type: "bytes"},
        ],
      },
      functionInputs: [contractInfo.newImplementation, "0x"],
      via: this.safeAddress,
      viaType: "Gnosis Safe", // Either Gnosis Safe or Gnosis Multisig
    })
    this.logger("Defender URL: ", this.defenderUrl(contractInfo.proxy.address))
  }

  async setNewConfigAddress(oldConfigAddress, newConfigAddress) {
    this.logger(`Proposing new config address ${newConfigAddress} on config ${oldConfigAddress}`)
    await this.client.createProposal({
      contract: {address: oldConfigAddress, network: this.network}, // Target contract
      title: "Set new config address",
      description: `Set config address on ${oldConfigAddress} to a new address ${newConfigAddress}`,
      type: "custom",
      functionInterface: {
        name: "setAddress",
        inputs: [
          {internalType: "uint256", name: "addressIndex", type: "uint256"},
          {internalType: "address", name: "newAddress", type: "address"},
        ],
      },
      functionInputs: [CONFIG_KEYS.GoldfinchConfig.toString(), newConfigAddress],
      via: this.safeAddress,
      viaType: "Gnosis Safe", // Either Gnosis Safe or Gnosis Multisig
    })
    this.logger("Defender URL: ", this.defenderUrl(oldConfigAddress))
  }

  async updateGoldfinchConfig(contractName, contract) {
    this.logger(`Proposing new config on ${contractName} (${contract.address})`)
    await this.client.createProposal({
      contract: {address: contract.address, network: this.network}, // Target contract
      title: "Set new config",
      description: `Set new config on ${contractName}`,
      type: "custom",
      // Function ABI
      functionInterface: {
        name: "updateGoldfinchConfig",
        inputs: [],
      },
      functionInputs: [],
      via: this.safeAddress,
      viaType: "Gnosis Safe", // Either Gnosis Safe or Gnosis Multisig
    })
    this.logger("Defender URL: ", this.defenderUrl(contract.address))
  }
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

    if (contractInfo.currentImplementation.toLowerCase() === contractInfo.newImplementation.toLowerCase()) {
      logger(`${contractName} did not change, skipping`)
      continue
    }

    result[contractName] = contractInfo

    logger(
      `Deployed ${contractName} to ${contractInfo.newImplementation} (current ${contractInfo.currentImplementation})`
    )

    if (upgrader) {
      await upgrader.changeImplementation(contractName, contractInfo)
    }

    logger(`Writing out ABI for ${contractName}`)
    exportDeployment(deployments, contractName, dependencies, proxy_owner)
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
