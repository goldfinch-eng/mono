const { getDeployedContract } = require("./deployHelpers.js")
const hre = require("hardhat")
const cpkSDK = require("contract-proxy-kit")

/*
This script deploys the latest implementations of upgradeable contracts and requests an upgrade via the
gnosis multisig
*/
let logger

async function main() {
  await multisig(hre, cpkSDK)
}

async function multisig(hre, cpkSDK) {
  const { deployments, getNamedAccounts, ethers } = hre
  const { proxy_owner } = await getNamedAccounts()
  const CPK = cpkSDK.default
  const { EthersAdapter } = cpkSDK

  // Since this is not a "real" deployment (just a script),
  //the deployments.log is not enabled. So, just use console.log instead
  logger = console.log

  let contractsToUpgrade = ["GoldfinchConfig", "CreditLineFactory", "CreditDesk", "Pool"]
  let safeSDK = await getCPK(CPK, EthersAdapter, ethers)
  const contracts = await getContracts(contractsToUpgrade, safeSDK.address, proxy_owner, deployments, ethers)

  let upgradeTransactions = []
  for (let i = 0; i < contractsToUpgrade.length; i++) {
    let contractInfo = contracts[contractsToUpgrade[i]]
    let proxy = contractInfo.proxy
    upgradeTransactions.push({
      operation: CPK.Call,
      data: proxy.interface.encodeFunctionData("changeImplementation", [contractInfo.newImplementation, "0x"]),
      to: proxy.address,
    })
  }
  const result = await safeSDK.execTransactions(upgradeTransactions)
  logger(`Done. Upgrade transaction: ${result.hash}`)
}

async function getContracts(contractNames, safeAddress, proxy_owner, deployments, ethers) {
  const { deploy } = deployments
  const result = {}
  const dependencies = {
    GoldfinchConfig: { ["ConfigOptions"]: (await deployments.getOrNull("ConfigOptions")).address },
    CreditDesk: { ["Accountant"]: (await deployments.getOrNull("Accountant")).address },
  }

  for (let i = 0; i < contractNames.length; i++) {
    let contractName = contractNames[i]
    let contract = await getDeployedContract(deployments, contractName)
    let contractProxy = await getDeployedContract(deployments, `${contractName}_Proxy`)
    // https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.2.0/contracts/proxy/TransparentUpgradeableProxy.sol#L68
    const adminStorageLocation = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103"
    let admin = await ethers.provider.getStorageAt(contractProxy.address, adminStorageLocation)
    admin = ethers.utils.hexStripZeros(admin)
    admin = await contractProxy.owner()
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
    let contractInfo = { contract: contract, proxy: contractProxy, newImplementation: deployResult.address }
    result[contractName] = contractInfo
    logger(`${contractName}: Proxy: ${contractProxy.address}, newImpl: ${contractInfo.newImplementation}`)
  }
  return result
}

async function getCPK(CPK, EthersAdapter, ethers) {
  // Emulate browser for CPK
  const [protocol_owner] = await ethers.getSigners()
  const window = { addEventListener: () => {}, parent: { postMessage: () => {} }, performance: { now: () => {} } }
  // noinspection JSConstantReassignment
  global.window = window

  const ethLibAdapter = new EthersAdapter({ ethers, signer: protocol_owner })

  const cpk = await CPK.create({ ethLibAdapter })
  const proxyDeployed = await cpk.isProxyDeployed()
  const owner = await cpk.getOwnerAccount()
  const address = cpk.address
  logger(`Safe Deployed? ${proxyDeployed}, Safe address: ${address}, owner: ${owner}`)

  if (!proxyDeployed) {
    // Create the safe and seed it with some ETH for gas.
    const result = await cpk.execTransactions([
      {
        operation: CPK.Call,
        data: "0x",
        to: cpk.address,
        value: `${1e17}`,
      },
    ])
    logger(`Created safe at ${result.hash}`)
  }
  return cpk
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
