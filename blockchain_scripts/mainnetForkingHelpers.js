/* global ethers */
const BN = require("bn.js")
const {
  updateConfig,
  MAINNET_ONE_SPLIT_ADDRESS,
  MAINNET_CUSDC_ADDRESS,
  getDeployedContract,
  isTestEnv,
} = require("../blockchain_scripts/deployHelpers.js")
const {CONFIG_KEYS} = require("../blockchain_scripts/configKeys")
const hre = require("hardhat")

const MAINNET_MULTISIG = "0xBEb28978B2c755155f20fd3d09Cb37e300A6981f"

async function getProxyImplAddress(proxyContract) {
  const implStorageLocation = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
  let currentImpl = await ethers.provider.getStorageAt(proxyContract.address, implStorageLocation)
  return ethers.utils.hexStripZeros(currentImpl)
}

async function upgradeContracts(contractNames, contracts, mainnetSigner, deployFrom, deployments) {
  const configOptionsDeployResult = await deployments.deploy("ConfigOptions", {
    from: deployFrom,
    gas: 4000000,
    args: [],
  })
  const accountantDeployResult = await deployments.deploy("Accountant", {from: deployFrom, gas: 4000000, args: []})
  // Always deploy a fresh creditline for use as the new reference implementation
  await deployments.deploy("CreditLine", {from: deployFrom, gas: 4000000, args: []})
  await deployments.deploy("TestForwarder", {from: deployFrom, gas: 4000000, args: []})

  const dependencies = {
    GoldfinchConfig: {["ConfigOptions"]: configOptionsDeployResult.address},
    CreditDesk: {["Accountant"]: accountantDeployResult.address},
  }

  for (let i = 0; i < contractNames.length; i++) {
    const contractName = contractNames[i]
    let contract = contracts[contractName]

    let deployResult = await deployments.deploy(contractName, {
      from: deployFrom,
      gas: 4000000,
      args: [],
      libraries: dependencies[contractName],
    })
    if (!isTestEnv()) {
      console.log(
        `Changing implementation of ${contractName} from ${contract.ExistingImplAddress} to ${deployResult.address}`
      )
    }
    await contract.ProxyContract.changeImplementation(deployResult.address, "0x")
    // Get the new implmentation contract with the latest ABI, but attach it to the mainnet proxy address
    let upgradedContract = await getDeployedContract(deployments, contractName, mainnetSigner)
    upgradedContract = upgradedContract.attach(contract.ProxyContract.address)
    contract.UpgradedContract = upgradedContract.connect(mainnetSigner)
    contract.UpgradedImplAddress = await getProxyImplAddress(contract.ProxyContract)
  }
  return contracts
}

async function getExistingContracts(contractNames, mainnetConfig, mainnetSigner) {
  let contracts = {}
  for (let i = 0; i < contractNames.length; i++) {
    const contractName = contractNames[i]
    const contractConfig = mainnetConfig[contractName]
    const proxyConfig = mainnetConfig[`${contractName}_Proxy`]
    let contractProxy = await ethers.getContractAt(proxyConfig.abi, proxyConfig.address, mainnetSigner)
    let contract = await ethers.getContractAt(contractConfig.abi, contractConfig.address, mainnetSigner)
    contracts[contractName] = {
      ProxyContract: contractProxy,
      ExistingContract: contract,
      ExistingImplAddress: await getProxyImplAddress(contractProxy),
    }
  }
  return contracts
}

async function fundWithWhales(erc20s, recipients, amount) {
  const whales = {
    USDC: "0x46aBbc9fc9d8E749746B00865BC2Cf7C4d85C837",
    USDT: "0x1062a747393198f70f71ec65a582423dba7e5ab3",
    BUSD: "0xbe0eb53f46cd790cd13851d5eff43d12404d33e8",
  }

  for (let erc20 of erc20s) {
    if (!whales[erc20.ticker]) {
      throw new Error(`We don't have a whale mapping for ${erc20.ticker}`)
    }
    for (let recipient of recipients) {
      await fundWithWhale({
        erc20: erc20,
        whale: whales[erc20.ticker],
        recipient: recipient,
        amount: amount || new BN("100000"),
      })
    }
  }
}

async function fundWithWhale({whale, recipient, erc20, amount}) {
  await impersonateAccount(hre, whale)
  let signer = await ethers.provider.getSigner(whale)
  const contract = erc20.contract.connect(signer)

  let ten = new BN(10)
  let d = new BN((await contract.decimals()).toString())
  let decimals = ten.pow(new BN(d))

  await contract.transfer(recipient, new BN(amount).mul(decimals).toString())
}

async function impersonateAccount(hre, account) {
  return await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [account],
  })
}

async function performPostUpgradeMigration(upgradedContracts, deployments) {
  let config = upgradedContracts.GoldfinchConfig.UpgradedContract
  let creditLine = await deployments.getOrNull("CreditLine")
  let forwarder = await deployments.getOrNull("TestForwarder")

  // Migrates the config from the
  await updateConfig(config, "address", CONFIG_KEYS.ProtocolAdmin, MAINNET_MULTISIG)
  await updateConfig(config, "address", CONFIG_KEYS.OneInch, MAINNET_ONE_SPLIT_ADDRESS)
  await updateConfig(config, "address", CONFIG_KEYS.CUSDCContract, MAINNET_CUSDC_ADDRESS)
  await updateConfig(config, "address", CONFIG_KEYS.TrustedForwarder, forwarder.address)
  await updateConfig(config, "address", CONFIG_KEYS.CreditLineImplementation, creditLine.address)
}

function getMainnetContracts() {
  let deploymentsFile = require("../client/config/deployments.json")
  return deploymentsFile["1"].mainnet.contracts
}

module.exports = {
  MAINNET_MULTISIG: MAINNET_MULTISIG,
  fundWithWhales: fundWithWhales,
  getExistingContracts: getExistingContracts,
  upgradeContracts: upgradeContracts,
  impersonateAccount: impersonateAccount,
  getMainnetContracts: getMainnetContracts,
  performPostUpgradeMigration: performPostUpgradeMigration,
}
