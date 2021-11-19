import {HardhatRuntimeEnvironment} from "hardhat/types"
import {Logger} from "../blockchain_scripts/types"
import fs from "fs"

import BN from "bn.js"
import hre from "hardhat"
import {
  Borrower,
  GoldfinchConfig,
  GoldfinchFactory,
  SeniorPool,
  TestERC20,
  TranchedPool,
  UniqueIdentity,
  CreditLine,
} from "../typechain/ethers"
import {Contract, ContractReceipt} from "ethers"
const {ethers} = hre
import {CONFIG_KEYS} from "../blockchain_scripts/configKeys"
import {findEnvLocal} from "@goldfinch-eng/utils"
import dotenv from "dotenv"
dotenv.config({path: findEnvLocal()})
import {
  MAINNET_CHAIN_ID,
  getUSDCAddress,
  USDCDecimals,
  isTestEnv,
  interestAprAsBN,
  isMainnetForking,
  updateConfig,
  assertIsChainId,
  TRANCHES,
  LOCAL_CHAIN_ID,
  getProtocolOwner,
  ContractDeployer,
  SIGNER_ROLE,
} from "../blockchain_scripts/deployHelpers"
import {impersonateAccount, fundWithWhales} from "../blockchain_scripts/mainnetForkingHelpers"
import _ from "lodash"
import {assertIsString, assertNonNullable} from "@goldfinch-eng/utils"
import {Result} from "ethers/lib/utils"
import {advanceTime, toEthers, usdcVal} from "../test/testHelpers"

import * as migratev22 from "../blockchain_scripts/migrations/v2.2/migrate"

/*
This deployment deposits some funds to the pool, and creates an underwriter, and a credit line.
It is only really used for test purposes, and should never be used on Mainnet (which it automatically never does);
*/
type OverrideOptions = {
  overrideAddress?: string
}

let logger: Logger
async function main(hre: HardhatRuntimeEnvironment, options: OverrideOptions) {
  const {getNamedAccounts, deployments, getChainId} = hre
  const {getOrNull, log} = deployments
  logger = log
  const {gf_deployer} = await getNamedAccounts()
  const protocol_owner = await getProtocolOwner()
  const deployer = new ContractDeployer(logger, hre)
  assertIsString(protocol_owner)
  assertIsString(gf_deployer)
  const protocolOwnerSigner = ethers.provider.getSigner(protocol_owner)

  const chainId = await getChainId()
  assertIsChainId(chainId)

  let underwriter = protocol_owner
  // If you uncomment this, make sure to also uncomment the line in the MainnetForking section,
  // which sets this var to the upgraded version of fidu
  // let fidu = await getDeployedAsEthersContract(getOrNull, "Fidu")
  let config = await getDeployedAsEthersContract<GoldfinchConfig>(getOrNull, "GoldfinchConfig")
  assertNonNullable(config)
  const goldfinchFactory = await getDeployedAsEthersContract<GoldfinchFactory>(getOrNull, "GoldfinchFactory")
  if (process.env.TEST_USERS) {
    throw new Error("`TEST_USERS` is deprecated. Use `TEST_USER` instead.")
  }
  const borrower = options?.overrideAddress || process.env.TEST_USER || protocol_owner
  const requestFromClient = !!options?.overrideAddress

  const {erc20, erc20s} = await getERC20s({getOrNull, chainId})

  if (chainId === LOCAL_CHAIN_ID && !isMainnetForking()) {
    await fundFromLocalWhale(gf_deployer, erc20s)
    await fundFromLocalWhale(borrower, erc20s)
  }

  if (isMainnetForking()) {
    const protocolOwner = await getProtocolOwner()
    await impersonateAccount(hre, protocolOwner)
    await fundWithWhales(["ETH"], [protocolOwner])
    await migratev22.main()

    logger("Funding protocol_owner with whales")
    underwriter = protocol_owner
    await fundWithWhales(["USDT", "BUSD", "ETH", "USDC"], [protocol_owner, gf_deployer, borrower], new BN("75000"))
    logger(`Finished funding with whales.`)

    // Grant local signer role
    await impersonateAccount(hre, protocol_owner)
    const uniqueIdentity = (await getDeployedAsEthersContract<UniqueIdentity>(getOrNull, "UniqueIdentity")).connect(
      protocolOwnerSigner
    )
    const {protocol_owner: trustedSigner} = await getNamedAccounts()
    assertNonNullable(trustedSigner)
    const tx = await uniqueIdentity.grantRole(SIGNER_ROLE, trustedSigner)
    await tx.wait()
  }
  await impersonateAccount(hre, protocol_owner)
  await setupTestForwarder(deployer, config, getOrNull, protocol_owner)

  let seniorPool: SeniorPool = await getDeployedAsEthersContract<SeniorPool>(getOrNull, "SeniorPool")

  config = config.connect(protocolOwnerSigner)

  await updateConfig(config, "number", CONFIG_KEYS.TotalFundsLimit, String(usdcVal(40000000)))

  await addUsersToGoList(config, [underwriter])

  await updateConfig(config, "number", CONFIG_KEYS.DrawdownPeriodInSeconds, 300, {logger})

  const result = await (await goldfinchFactory.createBorrower(protocol_owner)).wait()
  const lastEventArgs = getLastEventArgs(result)
  const protocolBorrowerCon = lastEventArgs[0]
  logger(`Created borrower contract: ${protocolBorrowerCon} for ${protocol_owner}`)

  const commonPool = await createPoolForBorrower({
    getOrNull,
    underwriter,
    goldfinchFactory,
    borrower: protocolBorrowerCon,
    erc20,
  })
  await writePoolMetadata({pool: commonPool, borrower: "GFI"})

  const empty = await createPoolForBorrower({
    getOrNull,
    underwriter,
    goldfinchFactory,
    borrower: protocolBorrowerCon,
    erc20,
  })
  await writePoolMetadata({pool: empty, borrower: "Empty"})

  await addUsersToGoList(config, [borrower])

  if (!requestFromClient) {
    await fundAddressAndDepositToCommonPool({erc20, address: borrower, commonPool, seniorPool})
  }
  if (requestFromClient) {
    await createBorrowerContractAndPool({
      erc20,
      address: borrower,
      getOrNull,
      seniorPool,
      goldfinchFactory,
    })
  }

  if (!requestFromClient) {
    // Have the senior fund invest
    seniorPool = seniorPool.connect(protocolOwnerSigner)
    const txn = await commonPool.lockJuniorCapital()
    await txn.wait()
    await seniorPool.invest(commonPool.address)
    const filter = commonPool.filters.DepositMade(seniorPool.address)
    const depositLog = (await ethers.provider.getLogs(filter))[0]
    assertNonNullable(depositLog)
    const depositEvent = commonPool.interface.parseLog(depositLog)
    const tokenId = depositEvent.args.tokenId

    await commonPool.lockPool()
    let creditLine = await getDeployedAsEthersContract<CreditLine>(getOrNull, "CreditLine")
    creditLine = creditLine.attach(await commonPool.creditLine())

    const amount = (await creditLine.limit()).div(2)
    await commonPool.drawdown(amount)

    await advanceTime({days: 32})

    // Have the borrower repay a portion of their loan
    await impersonateAccount(hre, protocol_owner)
    const borrowerSigner = ethers.provider.getSigner(protocol_owner)
    assertNonNullable(borrowerSigner)
    const bwrCon = (await ethers.getContractAt("Borrower", protocolBorrowerCon)).connect(borrowerSigner) as Borrower
    const payAmount = new BN(100).mul(USDCDecimals)
    await (erc20 as TestERC20).connect(borrowerSigner).approve(bwrCon.address, payAmount.mul(new BN(2)).toString())
    await bwrCon.pay(commonPool.address, payAmount.toString())

    await advanceTime({days: 32})

    await bwrCon.pay(commonPool.address, payAmount.toString())

    await seniorPool.redeem(tokenId)
  }
}

async function getERC20s({chainId, getOrNull}) {
  let erc20
  const chainUsdcAddress = getUSDCAddress(chainId)
  if (chainUsdcAddress) {
    logger("On a network with known USDC address, so firing up that contract...")
    erc20 = await ethers.getContractAt("TestERC20", chainUsdcAddress)
  } else {
    erc20 = await getDeployedAsEthersContract<Contract>(getOrNull, "TestERC20")
  }

  const erc20s = [
    {
      ticker: "USDC",
      contract: erc20,
    },
  ]
  return {erc20, erc20s}
}

// Fund Address to sr Fund, Deposit funds to common pool
async function fundAddressAndDepositToCommonPool({
  erc20,
  address,
  commonPool,
  seniorPool,
}: {
  erc20: Contract
  address: string
  commonPool: any
  seniorPool: SeniorPool
}): Promise<void> {
  logger(`Deposit into senior fund address:${address}`)
  // fund with address into sr fund
  await impersonateAccount(hre, address)
  const signer = ethers.provider.getSigner(address)
  const depositAmount = new BN(10000).mul(USDCDecimals)
  await (erc20 as TestERC20).connect(signer).approve(seniorPool.address, depositAmount.mul(new BN(5)).toString())
  await seniorPool.connect(signer).deposit(depositAmount.mul(new BN(5)).toString())

  // Deposit funds into Common Pool
  let txn = await erc20.connect(signer).approve(commonPool.address, String(depositAmount))
  await txn.wait()
  txn = await commonPool.connect(signer).deposit(TRANCHES.Junior, String(depositAmount))
  await txn.wait()
  logger(`Deposited ${depositAmount} into the common pool`)
}

// Create a borrower contract
async function createBorrowerContractAndPool({
  erc20,
  address,
  getOrNull,
  seniorPool,
  goldfinchFactory,
}: {
  erc20: Contract
  address: string
  getOrNull: any
  seniorPool: SeniorPool
  goldfinchFactory: GoldfinchFactory
}): Promise<void> {
  const protocol_owner = await getProtocolOwner()
  const underwriter = await getProtocolOwner()
  logger(`Setting up for borrower: ${address}`)

  // Create Borrower Contract
  const result = await (await goldfinchFactory.createBorrower(address)).wait()
  const lastEventArgs = getLastEventArgs(result)
  const bwrConAddr = lastEventArgs[0]
  logger(`Created borrower contract: ${bwrConAddr} for ${address}`)

  const filledPool = await createPoolForBorrower({
    getOrNull,
    underwriter,
    goldfinchFactory,
    borrower: bwrConAddr,
    erc20,
    depositor: protocol_owner,
  })
  let txn = await filledPool.lockJuniorCapital()
  await txn.wait()
  const ownerSigner = ethers.provider.getSigner(protocol_owner)
  await seniorPool.connect(ownerSigner).invest(filledPool.address)

  txn = await filledPool.lockPool()
  await txn.wait()

  logger(`Pool ready for ${address}`)
  await writePoolMetadata({pool: filledPool, borrower: address})
}

/**
 * Write fake TranchedPool metadata for local development
 */
async function writePoolMetadata({
  pool,
  borrower,
  backerLimit = "0.025",
}: {
  pool: TranchedPool
  borrower: string
  backerLimit?: string
}) {
  const names = ["Degen Pool", "CryptoPunks Fund"]
  const categories = ["NFT Loans", "Loans to degens"]
  const icons = [
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAdUlEQVR42mNgGAWjAAj+48GUG37i92+cmFJL/hMDKLHkv1TeVYKYIgvwBQ81gommFvxHtqB0797/6BbCxMixAGzA7AcPUFyJzEcWI9sHxAQP1YIIGWPzCVUjeehbQLN8gK2wG1o+oElpSiiIqFoXUKuCoboFAP+MJG7jSOWlAAAAAElFTkSuQmCC",
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAqElEQVR42mNgGAVDAfzHgyk33NTU9H9gYCBWTKkleA2nhiXYDKJqcKEYDvINPkyOJf/JwKRZcOL3b4KY7OAh1+U7d+5sIMrlyD6AGYTF5SgWgAyHYZKChyYW4IqD2Q8eUCUOGMi1gBjXU2QBzZMp2T7Aljxp5gOQXGugCHoqIjlnEwwaJEsYYHwYJtkCXLkY2ScZNhxgPogm1wKs6pBdTqzhpFjAgC/sASQcCwwmy7ugAAAAAElFTkSuQmCC",
  ]
  const description =
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc eget mi fringilla, maximus quam sodales, condimentum arcu. Vivamus arcu lorem, ultrices at ligula ut, tempor consectetur nibh. Vivamus commodo felis eu urna facilisis, feugiat gravida lectus egestas. Suspendisse consectetur urna at ornare lacinia. Etiam erat nunc, interdum sed gravida at, condimentum in metus. Mauris at sagittis libero."
  const detailsUrl = "https://example.com"
  const NDAUrl = "https://example.com"
  const status = [false, true, undefined]

  const metadataPath = "../../packages/client/config/pool-metadata/localhost.json"
  let metadata: any
  try {
    const data = await fs.promises.readFile(metadataPath)
    metadata = JSON.parse(data.toString())
  } catch (error) {
    metadata = {}
  }
  const name = `${borrower.slice(0, 6)}: ${_.sample(names)}`
  logger(`Write metadata for ${pool.address}:${name}`)
  metadata[pool.address.toLowerCase()] = {
    name,
    category: _.sample(categories),
    icon: _.sample(icons),
    description,
    detailsUrl,
    NDAUrl,
    backerLimit,
    disabled: _.sample(status),
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

async function addUsersToGoList(goldfinchConfig: GoldfinchConfig, users: string[]) {
  logger("Adding", users, "to the go-list... on config with address", goldfinchConfig.address)
  await (await goldfinchConfig.bulkAddToGoList(users)).wait()
}

async function fundFromLocalWhale(userToFund: string, erc20s: any) {
  logger("Sending money to:", userToFund)
  const [protocol_owner] = await ethers.getSigners()
  if (protocol_owner) {
    await protocol_owner.sendTransaction({
      to: userToFund,
      value: ethers.utils.parseEther("10.0"),
    })
  } else {
    throw new Error("Failed to obtain `protocol_owner`.")
  }

  const ten = new BN(10)
  for (const erc20 of erc20s) {
    const {contract} = erc20
    const decimals = ten.pow(new BN(await contract.decimals()))
    await contract.transfer(userToFund, String(new BN(1000000).mul(decimals)))
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
  return await toEthers<T>(deployed)
}

async function createPoolForBorrower({
  getOrNull,
  underwriter,
  goldfinchFactory,
  borrower,
  depositor,
  erc20,
}: {
  getOrNull: any
  underwriter: string
  goldfinchFactory: GoldfinchFactory
  borrower: string
  depositor?: string
  erc20: Contract
}): Promise<TranchedPool> {
  const juniorFeePercent = String(new BN(20))
  const limit = String(new BN(10000).mul(USDCDecimals))
  const interestApr = String(interestAprAsBN("5.00"))
  const paymentPeriodInDays = String(new BN(30))
  const termInDays = String(new BN(360))
  const lateFeeApr = String(new BN(0))
  const principalGracePeriodInDays = String(new BN(185))
  const fundableAt = String(new BN(0))
  const underwriterSigner = ethers.provider.getSigner(underwriter)
  const allowedUIDTypes = []
  const result = await (
    await goldfinchFactory
      .connect(underwriterSigner)
      .createPool(
        borrower,
        juniorFeePercent,
        limit,
        interestApr,
        paymentPeriodInDays,
        termInDays,
        lateFeeApr,
        principalGracePeriodInDays,
        fundableAt,
        allowedUIDTypes
      )
  ).wait()
  const lastEventArgs = getLastEventArgs(result)
  const poolAddress = lastEventArgs[0]
  const poolContract = await getDeployedAsEthersContract<TranchedPool>(getOrNull, "TranchedPool")
  assertNonNullable(poolContract)
  const pool = poolContract.attach(poolAddress).connect(underwriterSigner)

  logger(`Created a Pool ${poolAddress} for the borrower ${borrower}`)
  let txn = await erc20.connect(underwriterSigner).approve(pool.address, String(limit))
  await txn.wait()

  if (depositor) {
    const depositAmount = String(new BN(limit).div(new BN(20)))
    const depositorSigner = ethers.provider.getSigner(depositor)
    txn = await erc20.connect(depositorSigner).approve(pool.address, String(limit))
    await txn.wait()
    txn = await pool.connect(depositorSigner).deposit(TRANCHES.Junior, depositAmount)
    await txn.wait()

    logger(`Deposited ${depositAmount} into ${pool.address} via ${depositor}`)
  }
  return pool
}

async function setupTestForwarder(
  deployer: ContractDeployer,
  config: GoldfinchConfig,
  getOrNull: any,
  protocol_owner: string
) {
  // Don't create a new one if we already have a trusted forwarder set.
  if (await config.getAddress(CONFIG_KEYS.TrustedForwarder)) {
    return
  }
  const forwarder = await deployer.deploy("TestForwarder", {
    from: protocol_owner,
    gasLimit: 4000000,
  })
  logger(`Created Forwarder at ${forwarder.address}`)

  assertNonNullable(forwarder)
  await forwarder.registerDomainSeparator("Defender", "1")

  await updateConfig(config, "address", CONFIG_KEYS.TrustedForwarder, forwarder.address, {logger})
}

module.exports = main
module.exports.dependencies = ["base_deploy"]
module.exports.tags = ["setup_for_testing"]
module.exports.skip = async ({getChainId}: HardhatRuntimeEnvironment) => {
  const chainId = await getChainId()
  return String(chainId) === MAINNET_CHAIN_ID
}

export default main
