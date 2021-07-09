import BN from "bn.js"
import {
  getDeployedContract,
  isTestEnv,
  updateConfig,
  OWNER_ROLE,
  SAFE_CONFIG,
  setInitialConfigVals,
  MAINNET_CHAIN_ID,
  DepList,
  Ticker,
  AddressString,
} from "../blockchain_scripts/deployHelpers"
import {CONFIG_KEYS} from "./configKeys"
import hre from "hardhat"
import {Contract} from "@ethersproject/contracts"
import {DeploymentsExtension} from "hardhat-deploy/types"
import {HardhatRuntimeEnvironment} from "hardhat/types"
import {GoldfinchConfig} from "../typechain/ethers"
const {ethers} = hre

const MAINNET_MULTISIG = "0xBEb28978B2c755155f20fd3d09Cb37e300A6981f"
const MAINNET_UNDERWRITER = "0x79ea65C834EC137170E1aA40A42b9C80df9c0Bb4"

async function getProxyImplAddress(proxyContract: Contract) {
  if (!proxyContract) {
    return null
  }
  const implStorageLocation = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
  let currentImpl = await ethers.provider.getStorageAt(proxyContract.address, implStorageLocation)
  return ethers.utils.hexStripZeros(currentImpl)
}

async function upgradeContracts(
  contractNames: string[],
  contracts: any,
  mainnetSigner: any,
  deployFrom: any,
  deployments: DeploymentsExtension
) {
  const accountantDeployResult = await deployments.deploy("Accountant", {from: deployFrom, gasLimit: 4000000, args: []})
  // Ensure a test forwarder is available. Using the test forwarder instead of the real forwarder on mainnet
  // gives us the ability to debug the forwarded transactions.
  await deployments.deploy("TestForwarder", {from: deployFrom, gasLimit: 4000000, args: []})

  const dependencies: DepList = {
    CreditDesk: {["Accountant"]: accountantDeployResult.address},
    GoldfinchFactory: {
      ["Accountant"]: accountantDeployResult.address,
    },
  }

  for (const contractName of contractNames) {
    let contract = contracts[contractName]
    if (!contract && contractName === "GoldfinchFactory") {
      // For backwards compatability until we deploy V2
      contract = contracts["CreditLineFactory"]
    }
    let contractToDeploy = contractName
    if (isTestEnv() && ["Pool", "CreditDesk", "GoldfinchConfig"].includes(contractName)) {
      contractToDeploy = `Test${contractName}`
    }

    let deployResult = await deployments.deploy(contractToDeploy, {
      from: deployFrom,
      gasLimit: 4000000,
      args: [],
      libraries: dependencies[contractName],
    })
    let upgradedContract = await getDeployedContract(deployments, contractName, mainnetSigner)
    upgradedContract = upgradedContract.attach(deployResult.address)
    let upgradedImplAddress = deployResult.address

    if (contract.ProxyContract) {
      if (!isTestEnv()) {
        console.log(
          `Changing implementation of ${contractName} from ${contract.ExistingImplAddress} to ${deployResult.address}`
        )
      }
      await contract.ProxyContract.changeImplementation(deployResult.address, "0x")
      upgradedContract = upgradedContract.attach(contract.ProxyContract.address)
      upgradedImplAddress = (await getProxyImplAddress(contract.ProxyContract)) as string
    }
    // Get the new implmentation contract with the latest ABI, but attach it to the mainnet proxy address
    contract.UpgradedContract = upgradedContract.connect(mainnetSigner)
    contract.UpgradedImplAddress = upgradedImplAddress
  }
  return contracts
}

type ExistingContracts = {
  [contractName: string]: {ProxyContract: Contract; ExistingContract: Contract; ExistingImplAddress: string}
}

async function getExistingContracts(
  contractNames: string[],
  mainnetConfig: any,
  mainnetSigner: any
): Promise<ExistingContracts> {
  let contracts: ExistingContracts = {}
  if (!mainnetConfig) {
    mainnetConfig = getMainnetContracts()
  }
  for (let contractName of contractNames) {
    // For backwards compatability until we deploy V2
    if (contractName === "GoldfinchFactory") {
      contractName = "CreditLineFactory"
    }
    const contractConfig = mainnetConfig[contractName]
    const proxyConfig = mainnetConfig[`${contractName}_Proxy`]
    let contractProxy = proxyConfig && (await ethers.getContractAt(proxyConfig.abi, proxyConfig.address, mainnetSigner))
    let contract = await ethers.getContractAt(contractConfig.abi, contractConfig.address, mainnetSigner)
    contracts[contractName] = {
      ProxyContract: contractProxy,
      ExistingContract: contract,
      ExistingImplAddress: (await getProxyImplAddress(contractProxy)) as string,
    }
  }
  return contracts
}

async function fundWithWhales(erc20s: any, recipients: any, amount?: any) {
  const whales: Record<Ticker, AddressString> = {
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
  let signer = await ethers.provider.getSigner(whale)
  const contract = erc20.contract.connect(signer)

  let ten = new BN(10)
  let d = new BN((await contract.decimals()).toString())
  let decimals = ten.pow(new BN(d))

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
  const forwarder = await ethers.getContractAt(deployed!.abi, "0xa530F85085C6FE2f866E7FdB716849714a89f4CD")
  await forwarder.registerDomainSeparator("Defender", "1")
  await migrateToNewConfig(upgradedContracts)
}

async function migrateToNewConfig(upgradedContracts: any) {
  const newConfig = upgradedContracts.GoldfinchConfig.UpgradedContract
  const safeAddress = SAFE_CONFIG[MAINNET_CHAIN_ID].safeAddress
  if (!(await newConfig.hasRole(OWNER_ROLE, safeAddress))) {
    await (await newConfig.initialize(safeAddress)).wait()
  }
  await setInitialConfigVals(newConfig)
  await setCurrentAddressesOnConfig(newConfig, upgradedContracts.GoldfinchConfig.ExistingContract)
  await updateConfig(
    upgradedContracts.GoldfinchConfig.ExistingContract,
    "address",
    CONFIG_KEYS.GoldfinchConfig,
    newConfig.address
  )

  const contractsToUpgrade = ["Fidu", "Pool", "CreditDesk", "CreditLineFactory"]
  await Promise.all(
    contractsToUpgrade.map(async (contract) => {
      await (await upgradedContracts[contract].UpgradedContract.updateGoldfinchConfig()).wait()
    })
  )
}

async function setCurrentAddressesOnConfig(newConfig: GoldfinchConfig, existingConfig: GoldfinchConfig) {
  const addressesToSet = ["Pool", "GoldfinchFactory", "CreditDesk", "Fidu", "USDC", "CUSDCContract"]
  await Promise.all(
    Object.entries(CONFIG_KEYS).map(async ([key, val]) => {
      if (addressesToSet.includes(key)) {
        const currentVal = await existingConfig.getAddress(val)
        await updateConfig(newConfig, "address", val, currentVal)
      }
    })
  )
}

function getMainnetContracts() {
  let deploymentsFile = require("../client/config/deployments.json")
  return deploymentsFile[MAINNET_CHAIN_ID].mainnet.contracts
}

export {
  MAINNET_MULTISIG,
  MAINNET_UNDERWRITER,
  fundWithWhales,
  getExistingContracts,
  upgradeContracts,
  impersonateAccount,
  getMainnetContracts,
  performPostUpgradeMigration,
}
