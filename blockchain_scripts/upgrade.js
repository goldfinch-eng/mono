const { getDeployedContract } = require("./deployHelpers.js")
const hre = require("hardhat")

/*
This script deploys the latest implementations of upgradeable contracts and requests an upgrade via the
gnosis multisig
*/
let logger

const SAFE_CONFIG = {
  1: { safeAddress: "TODO" }, // Mainnet
  4: { safeAddress: "0xAA96CA940736e937A8571b132992418c7d220976" }, // Rinkeby
}

async function main() {
  await multisig(hre)
}

async function multisig(hre) {
  const { getNamedAccounts, getChainId } = hre
  const { proxy_owner } = await getNamedAccounts()

  // Since this is not a "real" deployment (just a script),
  //the deployments.log is not enabled. So, just use console.log instead
  logger = console.log

  const chainId = await getChainId()

  if (!SAFE_CONFIG[chainId]) {
    throw new Error(`Unsupported chain id: ${chainId}`)
  }

  let contractsToUpgrade = process.env.CONTRACTS || "GoldfinchConfig, CreditLineFactory, CreditDesk, Pool"
  contractsToUpgrade = contractsToUpgrade.split(/[ ,]+/)
  const contracts = await deployUpgrades(contractsToUpgrade, proxy_owner, hre)

  logger(`Safe address: ${SAFE_CONFIG[chainId].safeAddress}`)
  for (let i = 0; i < contractsToUpgrade.length; i++) {
    let contract = contracts[contractsToUpgrade[i]]
    logger(`${contract.name}. Proxy: ${contract.proxy.address} New Implementation: ${contract.newImplementation}`)
  }

  logger("Done.")
}

async function deployUpgrades(contractNames, proxy_owner, hre) {
  const { deployments, ethers, getChainId } = hre
  const { deploy } = deployments
  const safeAddress = SAFE_CONFIG[await getChainId()].safeAddress

  const result = {}
  const dependencies = {
    GoldfinchConfig: { ["ConfigOptions"]: (await deployments.getOrNull("ConfigOptions")).address },
    CreditDesk: { ["Accountant"]: (await deployments.getOrNull("Accountant")).address },
  }

  for (let i = 0; i < contractNames.length; i++) {
    let contractName = contractNames[i]
    let contract = await getDeployedContract(deployments, contractName)
    let contractProxy = await getDeployedContract(deployments, `${contractName}_Proxy`)
    // https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.2.0/contracts/proxy/TransparentUpgradeableProxy.sol#L81
    const implStorageLocation = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
    let currentImpl = await ethers.provider.getStorageAt(contractProxy.address, implStorageLocation)
    currentImpl = ethers.utils.hexStripZeros(currentImpl)
    const admin = await contractProxy.owner()
    if (admin.toLowerCase() !== safeAddress.toLowerCase()) {
      logger(`Converting safe ${safeAddress} as the proxy owner for ${contractName}`)
      const contractAsAdmin = await getDeployedContract(deployments, `${contractName}_Proxy`, proxy_owner)
      const txn = await contractAsAdmin.transferOwnership(safeAddress)
      await txn.wait()
    }

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
