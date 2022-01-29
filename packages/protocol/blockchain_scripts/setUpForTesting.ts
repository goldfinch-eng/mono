import {assertIsString, assertNonNullable, findEnvLocal} from "@goldfinch-eng/utils"
import BigNumber from "bignumber.js"
import BN from "bn.js"
import dotenv from "dotenv"
import {Contract, ContractReceipt} from "ethers"
import {Result} from "ethers/lib/utils"
import fs from "fs"
import hre, {ethers} from "hardhat"
import {Deployment} from "hardhat-deploy/types"
import {HardhatRuntimeEnvironment} from "hardhat/types"
import _ from "lodash"
import {CONFIG_KEYS} from "../blockchain_scripts/configKeys"
import {
  assertIsChainId,
  ContractDeployer,
  FIDU_DECIMALS,
  getProtocolOwner,
  getUSDCAddress,
  interestAprAsBN,
  isMainnetForking,
  isTestEnv,
  LOCAL_CHAIN_ID,
  SIGNER_ROLE,
  STAKING_REWARDS_MULTIPLIER_DECIMALS,
  toAtomic,
  TRANCHES,
  updateConfig,
  USDCDecimals,
} from "../blockchain_scripts/deployHelpers"
import {Logger} from "../blockchain_scripts/types"
import {advanceTime, GFI_DECIMALS, toEthers, usdcVal} from "../test/testHelpers"
import {
  Borrower,
  CommunityRewards,
  CreditLine,
  GFI,
  GoldfinchConfig,
  GoldfinchFactory,
  MerkleDirectDistributor,
  SeniorPool,
  StakingRewards,
  TestERC20,
  TranchedPool,
  UniqueIdentity,
} from "../typechain/ethers"

import * as migratev231 from "../blockchain_scripts/migrations/v2.3.1/migrate"
import {impersonateAccount} from "./helpers/impersonateAccount"
import {fundWithWhales} from "./helpers/fundWithWhales"

dotenv.config({path: findEnvLocal()})

/*
This deployment deposits some funds to the pool, and creates an underwriter, and a credit line.
It is only really used for test purposes, and should never be used on Mainnet (which it automatically never does);
*/
type OverrideOptions = {
  overrideAddress?: string
  logger?: typeof console.log // added because hre logger isn't working on async requests to the packages/server node instance
}

let logger: Logger
export async function setUpForTesting(hre: HardhatRuntimeEnvironment, {overrideAddress, logger}: OverrideOptions = {}) {
  const {
    getNamedAccounts,
    deployments: {getOrNull, log},
    getChainId,
  } = hre
  if (!logger) {
    logger = log
  }
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
  const borrower = overrideAddress || process.env.TEST_USER || protocol_owner
  const requestFromClient = !!overrideAddress

  const {erc20, erc20s} = await getERC20s({hre, chainId})

  if (chainId === LOCAL_CHAIN_ID && !isMainnetForking()) {
    logger("🐳 Funding from local whales")
    await fundFromLocalWhale(gf_deployer, erc20s, {logger})
    await fundFromLocalWhale(borrower, erc20s, {logger})
    logger("🐳 Finished funding from local whales")
  }

  if (isMainnetForking()) {
    logger("🐳 Funding from mainnet forking whales")
    const protocolOwner = await getProtocolOwner()
    await impersonateAccount(hre, protocolOwner)
    await fundWithWhales(["ETH"], [protocolOwner])

    logger("🐳 Funding protocol_owner with whales")
    underwriter = protocol_owner
    await fundWithWhales(["USDT", "BUSD", "ETH", "USDC"], [protocol_owner, gf_deployer, borrower], 75000)
    logger("🐳 Finished funding with whales.")

    // Grant local signer role
    await impersonateAccount(hre, protocol_owner)
    const uniqueIdentity = (await getDeployedAsEthersContract<UniqueIdentity>(getOrNull, "UniqueIdentity")).connect(
      protocolOwnerSigner
    )
    const {protocol_owner: trustedSigner} = await getNamedAccounts()
    assertNonNullable(trustedSigner)
    const tx = await uniqueIdentity.grantRole(SIGNER_ROLE, trustedSigner)
    await tx.wait()

    await migratev231.main()

    // TODO: temporary while GoldfinchFactory upgrade hasn't been deployed
    return
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

    await setUpRewards(erc20, getOrNull, protocol_owner)
  }
}

// TODO: need to deal with this in the migration script
async function setUpRewards(
  erc20: any,
  getOrNull: (name: string) => Promise<Deployment | null>,
  protocolOwner: string
) {
  const amount = new BN(String(1e8)).mul(GFI_DECIMALS)
  const communityRewards = await getDeployedAsEthersContract<CommunityRewards>(getOrNull, "CommunityRewards")
  const stakingRewards = await getDeployedAsEthersContract<StakingRewards>(getOrNull, "StakingRewards")
  const merkleDirectDistributor = await getDeployedAsEthersContractOrNull<MerkleDirectDistributor>(
    getOrNull,
    "MerkleDirectDistributor"
  )
  const rewardsAmount = amount.div(new BN(3))

  const gfi = await getDeployedAsEthersContract<GFI>(getOrNull, "GFI")
  await gfi.mint(protocolOwner, amount.toString(10))
  await gfi.approve(communityRewards.address, rewardsAmount.toString(10))
  await gfi.approve(stakingRewards.address, rewardsAmount.toString(10))

  await communityRewards.loadRewards(rewardsAmount.toString(10))

  await stakingRewards.loadRewards(rewardsAmount.toString(10))
  await stakingRewards.setRewardsParameters(
    toAtomic(new BN(1000), FIDU_DECIMALS),
    new BigNumber("10000000000")
      .multipliedBy(
        // This is just an arbitrary number meant to be in the same ballpark as how many FIDU the test user might
        // stake, so that given a GFI price around $1, the APY from GFI can work out to a reasonable-looking
        // double-digit percent.
        new BigNumber(75000)
      )
      .toString(10),
    new BigNumber("20000000000").multipliedBy(new BigNumber(75000)).toString(10),
    toAtomic(new BN(3), STAKING_REWARDS_MULTIPLIER_DECIMALS), // 300%
    toAtomic(new BN(0.5), STAKING_REWARDS_MULTIPLIER_DECIMALS) // 50%
  )

  // Have the protocol owner deposit-and-stake something, so that `stakingRewards.currentEarnRatePerToken()` will
  // not be 0 (due to a 0 staked supply), so that there's a non-zero APY from GFI rewards.
  const signer = ethers.provider.getSigner(protocolOwner)
  const usdcAmount = String(usdcVal(50000))
  await erc20.connect(signer).approve(stakingRewards.address, usdcAmount)
  await stakingRewards.depositAndStake(usdcAmount, {from: protocolOwner})

  // If the MerkleDirectDistributor contract is deployed, fund its GFI balance, so that it has GFI to disburse.
  if (merkleDirectDistributor) {
    await gfi.transfer(merkleDirectDistributor.address, rewardsAmount.toString(10), {from: protocolOwner})
  }
}

export async function getERC20s({hre, chainId}) {
  const {deployments} = hre
  const {getOrNull, log} = deployments
  logger = log

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
  logger(`📜 Created borrower contract: ${bwrConAddr} for ${address}`)

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

export async function fundFromLocalWhale(userToFund: string, erc20s: any, {logger}: {logger: typeof console.log}) {
  logger("💰 Sending money to:", userToFund)
  const [protocol_owner] = await ethers.getSigners()
  if (protocol_owner) {
    await protocol_owner.sendTransaction({
      to: userToFund,
      value: ethers.utils.parseEther("10.0"),
    })
  } else {
    throw new Error("🚨 Failed to obtain `protocol_owner`.")
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
async function getDeployedAsEthersContractOrNull<T>(
  getter: (name: string) => Promise<Deployment | null>,
  name: string
): Promise<T | null> {
  const {
    deployments: {log: logger},
  } = hre

  logger("📡 Trying to get the deployed version of...", name)
  let deployed = await getter(name)
  if (!deployed && isTestEnv()) {
    deployed = await getter(`Test${name}`)
  }
  if (deployed) {
    return await toEthers<T>(deployed as Parameters<typeof toEthers>[0])
  } else {
    return null
  }
}

async function getDeployedAsEthersContract<T>(
  getter: (name: string) => Promise<Deployment | null>,
  name: string
): Promise<T> {
  const deployed = await getDeployedAsEthersContractOrNull<T>(getter, name)
  if (deployed) {
    return deployed
  } else {
    throw new Error("Contract is not deployed")
  }
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
