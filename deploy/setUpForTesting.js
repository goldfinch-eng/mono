/* global ethers */
const BN = require("bn.js")
const hre = require("hardhat")
const {CONFIG_KEYS} = require("../blockchain_scripts/configKeys.js")
require("dotenv").config({path: ".env.local"})
const {
  MAINNET_CHAIN_ID,
  LOCAL,
  CHAIN_MAPPING,
  getUSDCAddress,
  getERC20Address,
  USDCDecimals,
  isTestEnv,
  interestAprAsBN,
  isMainnetForking,
  getSignerForAddress,
  updateConfig,
} = require("../blockchain_scripts/deployHelpers.js")
const {
  MAINNET_MULTISIG,
  upgradeContracts,
  getExistingContracts,
  impersonateAccount,
  fundWithWhales,
  getMainnetContracts,
  performPostUpgradeMigration,
} = require("../blockchain_scripts/mainnetForkingHelpers")

/*
This deployment deposits some funds to the pool, and creates an underwriter, and a credit line.
It is only really used for test purposes, and should never be used on Mainnet (which it automatically never does);
*/
let logger
async function main({getNamedAccounts, deployments, getChainId}) {
  const {getOrNull, log} = deployments
  logger = log
  let {protocol_owner} = await getNamedAccounts()
  let chainID = await getChainId()
  let underwriter = protocol_owner
  let borrower = protocol_owner
  let erc20 = await getDeployedAsEthersContract(getOrNull, "TestERC20")
  let seniorFund = await getDeployedAsEthersContract(getOrNull, "SeniorFund")
  // If you uncomment this, make sure to also uncomment the line in the MainnetForking section,
  // which sets this var to the upgraded version of fidu
  // let fidu = await getDeployedAsEthersContract(getOrNull, "Fidu")
  let config = await getDeployedAsEthersContract(getOrNull, "GoldfinchConfig")
  let goldfinchFactory = await getDeployedAsEthersContract(getOrNull, "GoldfinchFactory")
  await setupTestForwarder(deployments, config, getOrNull, protocol_owner)

  if (getUSDCAddress(chainID)) {
    logger("On a network with known USDC address, so firing up that contract...")
    erc20 = await ethers.getContractAt("TestERC20", getUSDCAddress(chainID))
  }

  let erc20s = [
    {
      ticker: "USDC",
      contract: erc20,
    },
  ]

  if (isMainnetForking()) {
    console.log("Funding protocol_owner with whales")
    underwriter = MAINNET_MULTISIG
    await impersonateAccount(hre, MAINNET_MULTISIG)
    let ownerAccount = await getSignerForAddress(protocol_owner)
    erc20s = erc20s.concat([
      {
        ticker: "USDT",
        contract: await ethers.getContractAt("IERC20withDec", getERC20Address("USDT", chainID)),
      },
      {
        ticker: "BUSD",
        contract: await ethers.getContractAt("IERC20withDec", getERC20Address("BUSD", chainID)),
      },
    ])

    await ownerAccount.sendTransaction({to: MAINNET_MULTISIG, value: ethers.utils.parseEther("5.0")})
    await fundWithWhales(erc20s, [protocol_owner])

    const mainnetConfig = getMainnetContracts()
    const contractsToUpgrade = ["CreditDesk", "Pool", "Fidu", "GoldfinchFactory", "GoldfinchConfig"]
    const upgradedContracts = await upgradeExistingContracts(
      contractsToUpgrade,
      mainnetConfig,
      MAINNET_MULTISIG,
      protocol_owner,
      deployments
    )

    goldfinchFactory = upgradedContracts.GoldfinchFactory.UpgradedContract
    // fidu = upgradedContracts.Fidu.UpgradedContract
    config = upgradedContracts.GoldfinchConfig.UpgradedContract

    await performPostUpgradeMigration(upgradedContracts, deployments)
  }

  const testUser = process.env.TEST_USER
  if (testUser) {
    borrower = testUser
    if (CHAIN_MAPPING[chainID] === LOCAL) {
      await giveMoneyToTestUser(testUser, erc20s)
    }
  }

  await addUsersToGoList(config, [borrower, underwriter])
  await depositToTheSeniorFund(seniorFund, erc20)

  const result = await (await goldfinchFactory.createBorrower(borrower)).wait()
  let bwrConAddr = result.events[result.events.length - 1].args[0]
  logger(`Created borrower contract: ${bwrConAddr} for ${borrower}`)

  await createPoolForBorrower(underwriter, goldfinchFactory, bwrConAddr)
  await createPoolForBorrower(underwriter, goldfinchFactory, bwrConAddr)
}

async function upgradeExistingContracts(contractsToUpgrade, mainnetConfig, mainnetMultisig, deployFrom, deployments) {
  // Ensure the multisig has funds for upgrades and other transactions
  console.log("On mainnet fork, upgrading existing contracts")
  let ownerAccount = await getSignerForAddress(deployFrom)
  await ownerAccount.sendTransaction({to: mainnetMultisig, value: ethers.utils.parseEther("5.0")})
  await impersonateAccount(hre, mainnetMultisig)
  let mainnetSigner = await ethers.provider.getSigner(mainnetMultisig)

  let contracts = await getExistingContracts(contractsToUpgrade, mainnetConfig, mainnetSigner)
  contracts = await upgradeContracts(contractsToUpgrade, contracts, mainnetSigner, deployFrom, deployments)
  return contracts
}

async function addUsersToGoList(goldfinchConfig, users) {
  logger("Adding", users, "to the go-list... on config with address", goldfinchConfig.address)
  await (await goldfinchConfig.bulkAddToGoList(users)).wait()
}

async function depositToTheSeniorFund(fund, erc20) {
  logger("Depositing funds into the fund...")
  const originalBalance = await erc20.balanceOf(fund.address)
  if (originalBalance.gt("0")) {
    logger(`Looks like the pool already has ${originalBalance} of funds...`)
    return
  }

  // Approve first
  logger("Approving the owner to deposit funds...")
  var txn = await erc20.approve(fund.address, String(new BN(1000000).mul(USDCDecimals)))
  await txn.wait()
  logger("Depositing funds...")
  let depositAmount
  depositAmount = new BN(10000).mul(USDCDecimals)

  txn = await fund.deposit(String(depositAmount))
  await txn.wait()
  const newBalance = await erc20.balanceOf(fund.address)
  if (String(newBalance) != String(depositAmount)) {
    throw new Error(`Expected to deposit ${depositAmount} but got ${newBalance}`)
  }
}

async function giveMoneyToTestUser(testUser, erc20s) {
  logger("Sending money to the test user", testUser)
  const [protocol_owner] = await ethers.getSigners()
  await protocol_owner.sendTransaction({
    to: testUser,
    value: ethers.utils.parseEther("10.0"),
  })

  let ten = new BN(10)
  for (let erc20 of erc20s) {
    const {contract} = erc20
    let decimals = ten.pow(new BN(await contract.decimals()))
    await contract.transfer(testUser, String(new BN(10000).mul(decimals)))
  }
}

async function getDeployedAsEthersContract(getter, name) {
  logger("Trying to get the deployed version of...", name)
  let deployed = await getter(name)
  if (!deployed && isTestEnv()) {
    deployed = await getter(`Test${name}`)
  }
  if (!deployed) {
    return null
  }
  return await ethers.getContractAt(deployed.abi, deployed.address)
}

async function createPoolForBorrower(underwriter, goldfinchFactory, borrower) {
  logger("Creating a Pool for the borrower", borrower)
  const juniorFeePercent = String(new BN(20))
  const limit = String(new BN(10000).mul(USDCDecimals))
  const interestApr = String(interestAprAsBN("5.00"))
  const paymentPeriodInDays = String(new BN(30))
  const termInDays = String(new BN(360))
  const lateFeeApr = String(new BN(0))
  await goldfinchFactory.createPool(
    borrower,
    juniorFeePercent,
    limit,
    interestApr,
    paymentPeriodInDays,
    termInDays,
    lateFeeApr,
    {from: underwriter}
  )
  logger("Created a Pool for the borrower", borrower)
}

async function setupTestForwarder(deployments, config, getOrNull, protocol_owner) {
  let deployResult = await deployments.deploy("TestForwarder", {
    from: protocol_owner,
    gas: 4000000,
  })
  logger(`Created Forwarder at ${deployResult.address}`)

  let forwarder = await getDeployedAsEthersContract(getOrNull, "TestForwarder")
  await forwarder.registerDomainSeparator("Defender", "1")

  await updateConfig(config, "address", CONFIG_KEYS.TrustedForwarder, deployResult.address, {logger})
}

module.exports = main
module.exports.dependencies = ["base_deploy"]
module.exports.tags = ["setup_for_testing"]
module.exports.skip = async ({getChainId}) => {
  const chainId = await getChainId()
  return String(chainId) === MAINNET_CHAIN_ID
}
