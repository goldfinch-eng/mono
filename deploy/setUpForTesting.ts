import {HardhatRuntimeEnvironment} from "hardhat/types"
import {Logger} from "../blockchain_scripts/types"
import fs from "fs"

import BN from "bn.js"
import hre from "hardhat"
import {
  Borrower,
  GoldfinchConfig,
  GoldfinchFactory,
  SeniorFund,
  TestERC20,
  TestForwarder,
  TranchedPool,
} from "../typechain/ethers"
import {DeploymentsExtension} from "hardhat-deploy/dist/types"
import {Contract, ContractReceipt} from "ethers"
const {ethers} = hre
import {CONFIG_KEYS} from "../blockchain_scripts/configKeys"
require("dotenv").config({path: ".env.local"})
import {
  MAINNET_CHAIN_ID,
  LOCAL,
  CHAIN_NAME_BY_ID,
  getUSDCAddress,
  USDCDecimals,
  isTestEnv,
  interestAprAsBN,
  isMainnetForking,
  getSignerForAddress,
  updateConfig,
  getERC20Address,
  assertIsChainId,
  TRANCHES,
} from "../blockchain_scripts/deployHelpers"
import {
  MAINNET_MULTISIG,
  upgradeContracts,
  getExistingContracts,
  impersonateAccount,
  fundWithWhales,
  getMainnetContracts,
  performPostUpgradeMigration,
} from "../blockchain_scripts/mainnetForkingHelpers"
import _ from "lodash"
import {assertIsString, assertNonNullable} from "../utils/type"
import {Result} from "ethers/lib/utils"

/*
This deployment deposits some funds to the pool, and creates an underwriter, and a credit line.
It is only really used for test purposes, and should never be used on Mainnet (which it automatically never does);
*/
let logger: Logger
async function main({getNamedAccounts, deployments, getChainId}: HardhatRuntimeEnvironment) {
  const {getOrNull, log} = deployments
  logger = log
  let {protocol_owner} = await getNamedAccounts()
  assertIsString(protocol_owner)

  let chainId = await getChainId()
  assertIsChainId(chainId)

  let underwriter = protocol_owner
  let borrower = protocol_owner
  let erc20 = await getDeployedAsEthersContract<Contract>(getOrNull, "TestERC20")
  let seniorFund = await getDeployedAsEthersContract<SeniorFund>(getOrNull, "SeniorFund")
  // If you uncomment this, make sure to also uncomment the line in the MainnetForking section,
  // which sets this var to the upgraded version of fidu
  // let fidu = await getDeployedAsEthersContract(getOrNull, "Fidu")
  let config = await getDeployedAsEthersContract<GoldfinchConfig>(getOrNull, "GoldfinchConfig")!
  let goldfinchFactory = await getDeployedAsEthersContract<GoldfinchFactory>(getOrNull, "GoldfinchFactory")
  await setupTestForwarder(deployments, config, getOrNull, protocol_owner)

  const chainUsdcAddress = getUSDCAddress(chainId)
  if (chainUsdcAddress) {
    logger("On a network with known USDC address, so firing up that contract...")
    erc20 = await ethers.getContractAt("TestERC20", chainUsdcAddress)
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
    const usdtAddress = getERC20Address("USDT", chainId)
    assertIsString(usdtAddress)
    const busdAddress = getERC20Address("BUSD", chainId)
    assertIsString(busdAddress)
    erc20s = erc20s.concat([
      {
        ticker: "USDT",
        contract: await ethers.getContractAt("IERC20withDec", usdtAddress),
      },
      {
        ticker: "BUSD",
        contract: await ethers.getContractAt("IERC20withDec", busdAddress),
      },
    ])

    await ownerAccount!.sendTransaction({to: MAINNET_MULTISIG, value: ethers.utils.parseEther("5.0")})
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
    if (CHAIN_NAME_BY_ID[chainId] === LOCAL) {
      await giveMoneyToTestUser(testUser, erc20s)
    }

    // Have the test user deposit into the senior fund
    await impersonateAccount(hre, testUser)
    let signer = ethers.provider.getSigner(testUser)
    let depositAmount = new BN(100).mul(USDCDecimals)
    await (erc20 as TestERC20).connect(signer).approve(seniorFund.address, depositAmount.toString())
    await seniorFund.connect(signer).deposit(depositAmount.toString())
  }

  await addUsersToGoList(config, [borrower, underwriter])
  await depositToTheSeniorFund(seniorFund, erc20!)

  const result = await (await goldfinchFactory.createBorrower(borrower)).wait()
  const lastEventArgs = getLastEventArgs(result)
  let bwrConAddr = lastEventArgs[0]
  logger(`Created borrower contract: ${bwrConAddr} for ${borrower}`)

  let pool1 = await createPoolForBorrower({
    getOrNull,
    underwriter,
    goldfinchFactory,
    borrower: bwrConAddr,
    erc20,
    lockJuniorCapital: false,
  })
  await writePoolMetadata(pool1)
  let pool2 = await createPoolForBorrower({getOrNull, underwriter, goldfinchFactory, borrower: bwrConAddr, erc20})
  await writePoolMetadata(pool2)

  // Have the senior fund invest
  await seniorFund.invest(pool2.address)
  let filter = pool2.filters.DepositMade(seniorFund.address)
  let depositLog = (await ethers.provider.getLogs(filter))[0]
  assertNonNullable(depositLog)

  await pool2.lockPool()
  await pool2.drawdown(await pool2.limit())

  // Have the borrower repay a portion of their loan
  await impersonateAccount(hre, borrower)
  let borrowerSigner = ethers.provider.getSigner(borrower)
  let bwrCon = (await ethers.getContractAt("Borrower", bwrConAddr)).connect(borrowerSigner!) as Borrower
  let payAmount = new BN(10).mul(USDCDecimals)
  await (erc20 as TestERC20).connect(borrowerSigner).approve(bwrCon.address, payAmount.toString())
  await bwrCon.pay(pool2.address, payAmount.toString())
}

/**
 * Write fake TranchedPool metadata for local development
 */
async function writePoolMetadata(pool: TranchedPool) {
  const names = ["Degen Pool", "CryptoPunks Fund"]
  const categories = ["NFT Loans", "Loans to degens"]
  const icons = [
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAdUlEQVR42mNgGAWjAAj+48GUG37i92+cmFJL/hMDKLHkv1TeVYKYIgvwBQ81gommFvxHtqB0797/6BbCxMixAGzA7AcPUFyJzEcWI9sHxAQP1YIIGWPzCVUjeehbQLN8gK2wG1o+oElpSiiIqFoXUKuCoboFAP+MJG7jSOWlAAAAAElFTkSuQmCC",
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAqElEQVR42mNgGAVDAfzHgyk33NTU9H9gYCBWTKkleA2nhiXYDKJqcKEYDvINPkyOJf/JwKRZcOL3b4KY7OAh1+U7d+5sIMrlyD6AGYTF5SgWgAyHYZKChyYW4IqD2Q8eUCUOGMi1gBjXU2QBzZMp2T7Aljxp5gOQXGugCHoqIjlnEwwaJEsYYHwYJtkCXLkY2ScZNhxgPogm1wKs6pBdTqzhpFjAgC/sASQcCwwmy7ugAAAAAElFTkSuQmCC",
  ]
  const description =
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc eget mi fringilla, maximus quam sodales, condimentum arcu. Vivamus arcu lorem, ultrices at ligula ut, tempor consectetur nibh. Vivamus commodo felis eu urna facilisis, feugiat gravida lectus egestas. Suspendisse consectetur urna at ornare lacinia. Etiam erat nunc, interdum sed gravida at, condimentum in metus. Mauris at sagittis libero."
  const detailsUrl = "https://example.com"

  let metadataPath = "client/config/pool-metadata/localhost.json"
  let metadata: any
  try {
    let data = await fs.promises.readFile(metadataPath)
    metadata = JSON.parse(data.toString())
  } catch (error) {
    metadata = {}
  }
  metadata[pool.address.toLowerCase()] = {
    name: _.sample(names),
    category: _.sample(categories),
    icon: _.sample(icons),
    description: description,
    detailsUrl: detailsUrl,
  }

  await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2))
}

function getLastEventArgs(result: ContractReceipt): Result {
  const events = result.events
  assertNonNullable(events)
  const lastEvent = events[events.length - 1]
  assertNonNullable(lastEvent)
  assertNonNullable(lastEvent.args)
  return lastEvent.args
}

async function upgradeExistingContracts(
  contractsToUpgrade: any,
  mainnetConfig: any,
  mainnetMultisig: any,
  deployFrom: any,
  deployments: DeploymentsExtension
): Promise<any> {
  // Ensure the multisig has funds for upgrades and other transactions
  console.log("On mainnet fork, upgrading existing contracts")
  let ownerAccount = await getSignerForAddress(deployFrom)
  await ownerAccount!.sendTransaction({to: mainnetMultisig, value: ethers.utils.parseEther("5.0")})
  await impersonateAccount(hre, mainnetMultisig)
  let mainnetSigner = await ethers.provider.getSigner(mainnetMultisig)

  let contracts = await getExistingContracts(contractsToUpgrade, mainnetConfig, mainnetSigner)
  contracts = await upgradeContracts(contractsToUpgrade, contracts, mainnetSigner, deployFrom, deployments)
  return contracts
}

async function addUsersToGoList(goldfinchConfig: GoldfinchConfig, users: string[]) {
  logger("Adding", users, "to the go-list... on config with address", goldfinchConfig.address)
  await (await goldfinchConfig.bulkAddToGoList(users)).wait()
}

async function depositToTheSeniorFund(fund: SeniorFund, erc20: Contract) {
  logger("Depositing funds into the fund...")
  const originalBalance = await erc20.balanceOf(fund.address)

  // Approve first
  logger("Approving the owner to deposit funds...")
  var txn = await erc20.approve(fund.address, String(new BN(100000000).mul(USDCDecimals)))
  await txn.wait()
  let depositAmount = new BN(100000).mul(USDCDecimals)
  logger(`Depositing ${depositAmount} into the senior fund...`)

  txn = await fund.deposit(String(depositAmount))
  await txn.wait()
  const newBalance = await erc20.balanceOf(fund.address)
  if (String(newBalance) != String(depositAmount.add(new BN(originalBalance.toString())))) {
    throw new Error(`Expected to deposit ${depositAmount} but got ${newBalance}`)
  }
}

async function giveMoneyToTestUser(testUser: string, erc20s: any) {
  logger("Sending money to the test user", testUser)
  const [protocol_owner] = await ethers.getSigners()
  if (protocol_owner) {
    await protocol_owner.sendTransaction({
      to: testUser,
      value: ethers.utils.parseEther("10.0"),
    })
  } else {
    throw new Error("Failed to obtain `protocol_owner`.")
  }

  let ten = new BN(10)
  for (let erc20 of erc20s) {
    const {contract} = erc20
    let decimals = ten.pow(new BN(await contract.decimals()))
    await contract.transfer(testUser, String(new BN(10000).mul(decimals)))
  }
}

// Ideally the type would be T extends BaseContract, but there appears to be some issue
// in the generated types that prevents that. See https://github.com/ethers-io/ethers.js/issues/1384 for relevant info
async function getDeployedAsEthersContract<T>(getter: any, name: string): Promise<T> {
  logger("Trying to get the deployed version of...", name)
  let deployed = await getter(name)
  if (!deployed && isTestEnv()) {
    deployed = await getter(`Test${name}`)
  }
  if (!deployed) {
    throw new Error("Contract is not deployed")
  }
  return (await ethers.getContractAt(deployed.abi, deployed.address)) as unknown as T
}

async function createPoolForBorrower({
  getOrNull,
  underwriter,
  goldfinchFactory,
  borrower,
  erc20,
  lockJuniorCapital = true,
}: {
  getOrNull: any
  underwriter: string
  goldfinchFactory: GoldfinchFactory
  borrower: string
  erc20: Contract
  lockJuniorCapital?: boolean
}): Promise<TranchedPool> {
  const juniorFeePercent = String(new BN(20))
  const limit = String(new BN(10000).mul(USDCDecimals))
  const interestApr = String(interestAprAsBN("5.00"))
  const paymentPeriodInDays = String(new BN(30))
  const termInDays = String(new BN(360))
  const lateFeeApr = String(new BN(0))
  const result = await (
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
  ).wait()
  const lastEventArgs = getLastEventArgs(result)
  let poolAddress = lastEventArgs[0]
  let owner = await getSignerForAddress(underwriter)
  let pool = (await getDeployedAsEthersContract<TranchedPool>(getOrNull, "TranchedPool"))!
    .attach(poolAddress)
    .connect(owner!)

  logger(`Created a Pool ${poolAddress} for the borrower ${borrower}`)
  var txn = await erc20.approve(pool.address, String(limit))
  await txn.wait()

  let depositAmount = String(new BN(limit).div(new BN(10)))
  txn = await pool.deposit(TRANCHES.Junior, depositAmount)
  await txn.wait()

  logger(`Deposited ${depositAmount} into the pool`)
  if (lockJuniorCapital) {
    txn = await pool.lockJuniorCapital()
    await txn.wait()
    logger(`Locked junior capital`)
  }
  return pool
}

async function setupTestForwarder(
  deployments: DeploymentsExtension,
  config: GoldfinchConfig,
  getOrNull: any,
  protocol_owner: string
) {
  let deployResult = await deployments.deploy("TestForwarder", {
    from: protocol_owner,
    gasLimit: 4000000,
  })
  logger(`Created Forwarder at ${deployResult.address}`)

  let forwarder = await getDeployedAsEthersContract<TestForwarder>(getOrNull, "TestForwarder")
  await forwarder!.registerDomainSeparator("Defender", "1")

  await updateConfig(config, "address", CONFIG_KEYS.TrustedForwarder, deployResult.address, {logger})
}

module.exports = main
module.exports.dependencies = ["base_deploy"]
module.exports.tags = ["setup_for_testing"]
module.exports.skip = async ({getChainId}: HardhatRuntimeEnvironment) => {
  const chainId = await getChainId()
  return String(chainId) === MAINNET_CHAIN_ID
}
