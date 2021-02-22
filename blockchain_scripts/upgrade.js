const {getDeployedContract, SAFE_CONFIG, CHAIN_MAPPING, getDefenderClient} = require("./deployHelpers.js")
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

  if (!SAFE_CONFIG[chainId]) {
    throw new Error(`Unsupported chain id: ${chainId}`)
  }

  let contractsToUpgrade = process.env.CONTRACTS || "CreditLineFactory, CreditDesk, Pool, Fidu"
  contractsToUpgrade = contractsToUpgrade.split(/[ ,]+/)
  const contracts = await deployUpgrades(contractsToUpgrade, proxy_owner, hre)

  logger(`Safe address: ${SAFE_CONFIG[chainId].safeAddress}`)
  for (let i = 0; i < contractsToUpgrade.length; i++) {
    let contract = contracts[contractsToUpgrade[i]]
    logger("-------------RESULT ------------------")
    logger(`${contract.name}. Proxy: ${contract.proxy.address} New Implementation: ${contract.newImplementation}`)
  }

  logger("Done.")
}

async function deployUpgrades(contractNames, proxy_owner, hre) {
  const {deployments, ethers, getChainId} = hre
  const {deploy} = deployments
  const chainId = await getChainId()
  const network = CHAIN_MAPPING[chainId]
  let client, safeAddress
  if (!process.env.NO_DEFENDER) {
    client = getDefenderClient()
  }
  const safe = SAFE_CONFIG[chainId]
  if (!safe) {
    throw new Error(`No safe address found for chain id: ${chainId}`)
  } else {
    safeAddress = safe.safeAddress
  }

  const result = {}
  const dependencies = {
    GoldfinchConfig: {["ConfigOptions"]: (await deployments.getOrNull("ConfigOptions")).address},
    CreditDesk: {["Accountant"]: (await deployments.getOrNull("Accountant")).address},
  }

  for (let i = 0; i < contractNames.length; i++) {
    let contractName = contractNames[i]
    let contract = await getDeployedContract(deployments, contractName)
    let contractProxy = await getDeployedContract(deployments, `${contractName}_Proxy`)
    // https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.2.0/contracts/proxy/TransparentUpgradeableProxy.sol#L81
    const implStorageLocation = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
    let currentImpl = await ethers.provider.getStorageAt(contractProxy.address, implStorageLocation)
    currentImpl = ethers.utils.hexStripZeros(currentImpl)

    let deployResult = await deploy(contractName, {
      from: proxy_owner,
      gas: 4000000,
      args: [],
      libraries: dependencies[contractName],
    })
    let contractInfo = {
      name: contractName,
      contract: contract,
      proxy: contractProxy,
      newImplementation: deployResult.address,
    }

    if (currentImpl.toLowerCase() === contractInfo.newImplementation.toLowerCase()) {
      logger(`${contractName} did not change, skipping`)
      continue
    }
    result[contractName] = contractInfo

    logger(`Deployed ${contractName} to ${contractInfo.newImplementation} (current ${currentImpl})`)

    if (client) {
      logger("Now attempting to create the proposal on Defender...")
      await client.createProposal({
        contract: {address: contractProxy.address, network: network}, // Target contract
        title: "Upgrade to latest version",
        description: `Upgrading ${contractName} to a new implementation at ${contractInfo.newImplementation}`,
        type: "custom", // Defender doesn't directly support upgrades via our Proxy type, so use a custom action until they do.
        // Function ABI
        functionInterface: {
          name: "changeImplementation",
          inputs: [
            {internalType: "address", name: "newImplementation", type: "address"},
            {internalType: "bytes", name: "data", type: "bytes"},
          ],
        },
        functionInputs: [contractInfo.newImplementation, "0x"],
        via: safeAddress,
        viaType: "Gnosis Safe", // Either Gnosis Safe or Gnosis Multisig
      })
    }
  }
  return result
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

module.exports = multisig
