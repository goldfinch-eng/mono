import {NON_US_UID_TYPES, US_UID_TYPES, US_UID_TYPES_SANS_NON_ACCREDITED} from "@goldfinch-eng/utils"
import {JsonRpcSigner} from "@ethersproject/providers"
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
  FIDU_DECIMALS,
  getEthersContract,
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
import {advanceTime, getCurrentTimestamp, GFI_DECIMALS, toEthers, usdcVal} from "../test/testHelpers"
import {
  BackerRewards,
  Borrower,
  CallableLoan,
  CommunityRewards,
  CreditLine,
  GFI,
  Go,
  GoldfinchConfig,
  GoldfinchFactory,
  MerkleDirectDistributor,
  SeniorPool,
  StakingRewards,
  TestERC20,
  TranchedPool,
  UniqueIdentity,
} from "../typechain/ethers"
import {fundWithWhales} from "./helpers/fundWithWhales"
import {impersonateAccount} from "./helpers/impersonateAccount"
import {overrideUsdcDomainSeparator} from "./mainnetForkingHelpers"
import {getDeploymentFor} from "../test/util/fixtures"
import {MonthlyScheduleRepoInstance} from "../typechain/truffle"

dotenv.config({path: findEnvLocal()})

export const BACKER_REWARDS_MAX_INTEREST_DOLLARS_ELIGIBLE = new BigNumber(100_000_000)
  .multipliedBy(new BigNumber(1e18))
  .toString(10)
export const BACKER_REWARDS_PERCENT_OF_TOTAL_GFI = 2

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

    // Patch USDC DOMAIN_SEPARATOR to make permit work locally
    await overrideUsdcDomainSeparator()
  }

  // Grant local signer role
  await impersonateAccount(hre, protocol_owner)

  // setup UID supported types for local dev
  if (!isMainnetForking()) {
    const uniqueIdentity = (await getDeployedAsEthersContract<UniqueIdentity>(getOrNull, "UniqueIdentity")).connect(
      protocolOwnerSigner
    )
    const {protocol_owner: trustedSigner} = await getNamedAccounts()
    assertNonNullable(trustedSigner)
    const tx = await uniqueIdentity.grantRole(SIGNER_ROLE, trustedSigner)
    await tx.wait()

    await uniqueIdentity.setSupportedUIDTypes(
      [
        await uniqueIdentity.ID_TYPE_0(),
        await uniqueIdentity.ID_TYPE_1(),
        await uniqueIdentity.ID_TYPE_2(),
        await uniqueIdentity.ID_TYPE_3(),
        await uniqueIdentity.ID_TYPE_4(),
      ],
      [true, true, true, true, true]
    )
  }

  await impersonateAccount(hre, protocol_owner)

  let seniorPool: SeniorPool = await getDeployedAsEthersContract<SeniorPool>(getOrNull, "SeniorPool")
  let go = await getDeployedAsEthersContract<Go>(getOrNull, "Go")
  const goldfinchConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig")
  if (!isMainnetForking()) {
    go = go.connect(protocolOwnerSigner)
    await go.setLegacyGoList(goldfinchConfig.address)
  }
  const legacyGoldfinchConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig", {
    at: await go.legacyGoList(),
  })

  config = config.connect(protocolOwnerSigner)

  await updateConfig(config, "number", CONFIG_KEYS.TotalFundsLimit, String(usdcVal(100_000_000)))
  await updateConfig(config, "number", CONFIG_KEYS.DrawdownPeriodInSeconds, 300, {logger})

  await addUsersToGoList(legacyGoldfinchConfig, [borrower])

  if (requestFromClient) {
    await createBorrowerContractAndPools({
      erc20,
      address: borrower,
      getOrNull,
      seniorPool,
      goldfinchFactory,
      // NOTE: We make the borrower a depositor in their own pool here, for the sake of convenience
      // in manual testing: this enables the test user to use the borrow page UI to drawdown and repay
      // the loan, and then, because they're a depositor (i.e. backer) in that pool, they can also use the
      // GFI page UI to receive backer rewards for the pool upon repayments.
      depositor: borrower,
    })
  } else {
    await addUsersToGoList(legacyGoldfinchConfig, [underwriter])

    if (chainId === LOCAL_CHAIN_ID && !isMainnetForking()) {
      await setUpRewards(erc20, getOrNull, protocol_owner)
    }

    const result = await (await goldfinchFactory.createBorrower(protocol_owner)).wait()
    const lastEventArgs = getLastEventArgs(result)
    const protocolBorrowerCon = lastEventArgs[0]
    logger(`Created borrower contract: ${protocolBorrowerCon} for ${protocol_owner}`)

    let signer = ethers.provider.getSigner(borrower)
    let depositAmount = new BN(10000).mul(USDCDecimals)

    let txn

    /*** CALLABLE LOAN OPEN START ***/
    const openCallableLoan = await createCallableLoanForBorrower({
      getOrNull,
      underwriter,
      goldfinchFactory,
      borrower: protocolBorrowerCon,
      erc20,
      allowedUIDTypes: [...NON_US_UID_TYPES, ...US_UID_TYPES_SANS_NON_ACCREDITED],
    })
    // TODO: Pool metadata will be incorrect for now
    await writePoolMetadata({pool: openCallableLoan, borrower: "CALLABLE OPEN"})
    await impersonateAccount(hre, borrower)
    depositAmount = new BN(5000).mul(USDCDecimals)
    txn = await erc20.connect(signer).approve(openCallableLoan.address, String(depositAmount))
    await txn.wait()

    txn = await openCallableLoan.connect(signer).deposit(UNCALLED_CAPITAL_TRANCHE, String(depositAmount))
    await txn.wait()
    /*** CALLABLE LOAN OPEN END ***/

    /*** CALLABLE LOAN - FAZZ EXAMPLE START ***/
    const fazzExampleCallableLoan = await createCallableLoanForBorrower({
      getOrNull,
      underwriter,
      goldfinchFactory,
      borrower: protocolBorrowerCon,
      erc20,
      allowedUIDTypes: [...NON_US_UID_TYPES, ...US_UID_TYPES_SANS_NON_ACCREDITED],
      fundableAt: String(new BN(1679587200)), // Thu Mar 23 2023 09:00:00 GMT-0700 (Pacific Daylight Time)
    })
    // TODO: Pool metadata will be incorrect for now
    await writePoolMetadata({pool: fazzExampleCallableLoan, borrower: "CALLABLE OPEN"})
    await impersonateAccount(hre, borrower)
    depositAmount = new BN(5000).mul(USDCDecimals)
    txn = await erc20.connect(signer).approve(fazzExampleCallableLoan.address, String(depositAmount))
    await txn.wait()

    txn = await fazzExampleCallableLoan.connect(signer).deposit(UNCALLED_CAPITAL_TRANCHE, String(depositAmount))
    await txn.wait()
    /*** CALLABLE LOAN FAZZ EXAMPLE END ***/

    /*** CALLABLE LOAN CLOSED START ***/
    const closedCallableLoan = await createCallableLoanForBorrower({
      getOrNull,
      underwriter,
      goldfinchFactory,
      borrower: protocolBorrowerCon,
      erc20,
      allowedUIDTypes: [...NON_US_UID_TYPES, ...US_UID_TYPES_SANS_NON_ACCREDITED],
    })
    await writePoolMetadata({pool: closedCallableLoan, borrower: "CALLABLE CLOSED"})
    await impersonateAccount(hre, borrower)
    signer = ethers.provider.getSigner(borrower)
    depositAmount = new BN(10000).mul(USDCDecimals)
    txn = await erc20.connect(signer).approve(closedCallableLoan.address, String(depositAmount))
    await txn.wait()
    txn = await closedCallableLoan.connect(signer).deposit(UNCALLED_CAPITAL_TRANCHE, String(depositAmount))
    await txn.wait()

    txn = await closedCallableLoan.drawdown(String(depositAmount))
    await txn.wait()
    /*** CALLABLE LOAN CLOSED END ***/

    /*** UNITRANCHE OPEN START ***/
    const unitranche = await createPoolForBorrower({
      getOrNull,
      underwriter,
      goldfinchFactory,
      borrower: protocolBorrowerCon,
      erc20,
      allowedUIDTypes: [...NON_US_UID_TYPES, ...US_UID_TYPES],
    })
    await writePoolMetadata({pool: unitranche, borrower: "UNITRANCHE OPEN"})
    await impersonateAccount(hre, borrower)
    depositAmount = new BN(5000).mul(USDCDecimals)
    txn = await erc20.connect(signer).approve(unitranche.address, String(depositAmount))
    await txn.wait()
    txn = await unitranche.connect(signer).deposit(TRANCHES.Junior, String(depositAmount))
    await txn.wait()
    /*** UNITRANCHE END ***/

    /*** UNITRANCHE CLOSED START ***/
    const unitrancheClosed = await createPoolForBorrower({
      getOrNull,
      underwriter,
      goldfinchFactory,
      borrower: protocolBorrowerCon,
      erc20,
      allowedUIDTypes: [...NON_US_UID_TYPES, ...US_UID_TYPES],
    })
    await writePoolMetadata({pool: unitrancheClosed, borrower: "UNITRANCHE CLOSED"})
    await impersonateAccount(hre, borrower)
    signer = ethers.provider.getSigner(borrower)
    depositAmount = new BN(10000).mul(USDCDecimals)
    txn = await erc20.connect(signer).approve(unitrancheClosed.address, String(depositAmount))
    await txn.wait()
    txn = await unitrancheClosed.connect(signer).deposit(TRANCHES.Junior, String(depositAmount))
    await txn.wait()

    txn = await unitrancheClosed.lockJuniorCapital()
    await txn.wait()
    await unitrancheClosed.lockPool()
    await txn.wait()
    /*** UNITRANCHE CLOSED END ***/

    /*** EMPTY POOL START ***/
    const empty = await createPoolForBorrower({
      getOrNull,
      underwriter,
      goldfinchFactory,
      borrower: protocolBorrowerCon,
      erc20,
      allowedUIDTypes: [...NON_US_UID_TYPES, ...US_UID_TYPES],
    })
    await writePoolMetadata({pool: empty, borrower: "US Pool Empty"})
    /*** EMPTY POOL START ***/

    /*** COMMON POOL START ***/
    const commonPool = await createPoolForBorrower({
      getOrNull,
      underwriter,
      goldfinchFactory,
      borrower: protocolBorrowerCon,
      erc20,
      allowedUIDTypes: [...NON_US_UID_TYPES],
    })
    await writePoolMetadata({pool: commonPool, borrower: "NON-US Pool GFI"})

    await fundAddressAndDepositToCommonPool({erc20, depositorAddress: borrower, commonPool, seniorPool})

    // Senior fund invest to the "NON-US Pool GFI", lock, drawdown
    seniorPool = seniorPool.connect(protocolOwnerSigner)
    txn = await commonPool.lockJuniorCapital()
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

    // Borrower repay a portion of their loan
    await impersonateAccount(hre, protocol_owner)
    const borrowerSigner = ethers.provider.getSigner(protocol_owner)
    assertNonNullable(borrowerSigner)
    const bwrCon = (await ethers.getContractAt("Borrower", protocolBorrowerCon)).connect(borrowerSigner) as Borrower
    const payAmount = new BN(100).mul(USDCDecimals)
    await (erc20 as TestERC20).connect(borrowerSigner).approve(bwrCon.address, payAmount.mul(new BN(2)).toString())
    await bwrCon["pay(address,uint256)"](commonPool.address, payAmount.toString())

    await advanceTime({days: 32})

    await bwrCon["pay(address,uint256)"](commonPool.address, payAmount.toString())
    /*** COMMON POOL END ***/

    await seniorPool.redeem(tokenId)
  }
}

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
  const backerMerkleDirectDistributor = await getDeployedAsEthersContractOrNull<MerkleDirectDistributor>(
    getOrNull,
    "BackerMerkleDirectDistributor"
  )
  const backerRewards = await getDeployedAsEthersContract<BackerRewards>(getOrNull, "BackerRewards")
  const rewardsAmount = amount.div(new BN(5))

  const gfi = await getDeployedAsEthersContract<GFI>(getOrNull, "GFI")

  if (!isMainnetForking()) {
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

    // If the BackerMerkleDirectDistributor contract is deployed, fund its GFI balance, so that it has GFI to disburse.
    if (backerMerkleDirectDistributor) {
      await gfi.transfer(backerMerkleDirectDistributor.address, rewardsAmount.toString(10), {from: protocolOwner})
    }
  }

  // Configure BackerRewards
  const backerRewardsGfiAmount = amount.mul(new BN(BACKER_REWARDS_PERCENT_OF_TOTAL_GFI)).div(new BN(100))
  await gfi.transfer(backerRewards.address, backerRewardsGfiAmount.toString(10))
  await backerRewards.setMaxInterestDollarsEligible(BACKER_REWARDS_MAX_INTEREST_DOLLARS_ELIGIBLE, {from: protocolOwner})
  await backerRewards.setTotalRewards(backerRewardsGfiAmount.toString(10), {from: protocolOwner})
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
  depositorAddress,
  commonPool,
  seniorPool,
}: {
  erc20: Contract
  depositorAddress: string
  commonPool: TranchedPool
  seniorPool: SeniorPool
}): Promise<void> {
  logger(`Deposit into senior fund address:${depositorAddress}`)
  // fund with address into sr fund
  await impersonateAccount(hre, depositorAddress)
  const signer = ethers.provider.getSigner(depositorAddress)
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
async function createBorrowerContractAndPools({
  erc20,
  address,
  getOrNull,
  seniorPool,
  goldfinchFactory,
  depositor,
}: {
  erc20: Contract
  address: string
  getOrNull: any
  seniorPool: SeniorPool
  goldfinchFactory: GoldfinchFactory
  depositor: string | undefined
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
    depositor: depositor || protocol_owner,
    allowedUIDTypes: [...NON_US_UID_TYPES, ...US_UID_TYPES],
  })

  let filledPoolTxn = await filledPool.lockJuniorCapital()
  await filledPoolTxn.wait()
  const ownerSigner = ethers.provider.getSigner(protocol_owner)
  await seniorPool.connect(ownerSigner).invest(filledPool.address)

  filledPoolTxn = await filledPool.lockPool()
  await filledPoolTxn.wait()

  await writePoolMetadata({pool: filledPool, borrower: address})

  await createUnfilledPool(address, bwrConAddr, erc20, getOrNull, goldfinchFactory, ownerSigner, underwriter)
  await createFullPool(address, bwrConAddr, erc20, getOrNull, goldfinchFactory, ownerSigner, underwriter)
  await createFullPool(address, bwrConAddr, erc20, getOrNull, goldfinchFactory, ownerSigner, underwriter)

  logger(`Pools ready for ${address}`)
}

export async function createPoolAndFundWithSenior(hre: HardhatRuntimeEnvironment, usdcAmount: string) {
  const {
    deployments: {getOrNull},
  } = hre
  const chainId = await hre.getChainId()
  const {erc20} = await getERC20s({hre, chainId})
  const protocol_owner = await getProtocolOwner()
  const underwriter = protocol_owner
  const borrower = protocol_owner
  const goldfinchFactory = await getDeployedAsEthersContract<GoldfinchFactory>(getOrNull, "GoldfinchFactory")

  const seniorAmount = new BN(usdcAmount)
  // Senior pool invests 4x the junio investment
  const juniorAmount = seniorAmount.div(new BN("4"))

  const pool = await createPoolForBorrower({
    getOrNull,
    underwriter,
    goldfinchFactory,
    borrower,
    erc20,
    allowedUIDTypes: [...NON_US_UID_TYPES],
    limitInDollars: 1_000_000_000, // set a very large limit
  })

  // Invest in Junior Tranche
  const ownerSigner = ethers.provider.getSigner(protocol_owner)
  const approveTxn = await erc20.connect(ownerSigner).approve(pool.address, juniorAmount.toNumber())
  await approveTxn.wait()
  const juniorDepositTxn = await pool.connect(ownerSigner).deposit(TRANCHES.Junior, juniorAmount.toNumber())
  await juniorDepositTxn.wait()
  const juniorLockTx = await pool.connect(ownerSigner).lockJuniorCapital()
  await juniorLockTx.wait()

  // Invest in Senior Tranche
  const seniorPool = await getDeployedAsEthersContract<SeniorPool>(getOrNull, "SeniorPool")
  const seniorDepositTxn = await seniorPool.invest(pool.address)
  await seniorDepositTxn.wait()

  return pool.address
}

async function createUnfilledPool(
  address: string,
  bwrConAddr: string,
  erc20: Contract,
  getOrNull: any,
  goldfinchFactory: GoldfinchFactory,
  ownerSigner: JsonRpcSigner,
  underwriter: string
) {
  const pool = await createPoolForBorrower({
    getOrNull,
    underwriter,
    goldfinchFactory,
    borrower: bwrConAddr,
    erc20,
    allowedUIDTypes: [...NON_US_UID_TYPES],
    limitInDollars: 25000,
  })
  await writePoolMetadata({pool: pool, borrower: address})
}

async function createFullPool(
  address: string,
  bwrConAddr: string,
  erc20: Contract,
  getOrNull: any,
  goldfinchFactory: GoldfinchFactory,
  ownerSigner: JsonRpcSigner,
  underwriter: string
) {
  const depositAmount = new BN(10000).mul(USDCDecimals)
  let creditLine = await getDeployedAsEthersContract<CreditLine>(getOrNull, "CreditLine")

  const pool = await createPoolForBorrower({
    getOrNull,
    underwriter,
    goldfinchFactory,
    borrower: bwrConAddr,
    erc20,
    allowedUIDTypes: [...NON_US_UID_TYPES],
  })

  let txn
  txn = await erc20.connect(ownerSigner).approve(pool.address, String(depositAmount))
  await txn.wait()
  txn = await pool.connect(ownerSigner).deposit(TRANCHES.Junior, String(depositAmount))
  await txn.wait()
  logger(`Deposited ${depositAmount} into the full pool`)

  txn = await pool.lockJuniorCapital()
  await txn.wait()

  await pool.lockPool()
  creditLine = creditLine.attach(await pool.creditLine())

  await pool.drawdown((await creditLine.limit()).div(2))

  await writePoolMetadata({pool: pool, borrower: address})
}

/**
 * Write fake TranchedPool metadata for local development
 */
async function writePoolMetadata({
  pool,
  borrower,
  backerLimit = "1.00",
}: {
  pool: {address: string}
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

  const metadataPath = "../../packages/pools/metadata/localhost.json"
  let metadata: any
  try {
    const data = await fs.promises.readFile(metadataPath)
    metadata = JSON.parse(data.toString())
  } catch (error) {
    metadata = {}
  }
  const name = `${borrower}: ${_.sample(names)}`
  const launchTime = await getCurrentTimestamp()

  logger(`Write metadata for ${pool.address}:${name}`)
  metadata[pool.address.toLowerCase()] = {
    name,
    dealType: name.toLowerCase().indexOf("unitranche") ? "Unitranche" : "Multitranche",
    category: _.sample(categories),
    icon: _.sample(icons),
    description,
    detailsUrl,
    NDAUrl,
    backerLimit,
    disabled: false,
    launchTime,
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

async function addUsersToGoList(legacyGoldfinchConfig: GoldfinchConfig, users: string[]) {
  logger("Adding", users, "to the go-list... on config with address", legacyGoldfinchConfig.address)
  await (await legacyGoldfinchConfig.bulkAddToGoList(users)).wait()
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
    await contract.transfer(userToFund, String(new BN(250000).mul(decimals)))
  }
}

export async function addUserToGoList(address: string) {
  const {
    deployments: {getOrNull, log},
  } = hre

  logger = log

  const protocol_owner = await getProtocolOwner()

  const protocolOwnerSigner = ethers.provider.getSigner(protocol_owner)

  let go = await getDeployedAsEthersContract<Go>(getOrNull, "Go")
  const goldfinchConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig")
  if (!isMainnetForking()) {
    go = go.connect(protocolOwnerSigner)
    await go.setLegacyGoList(goldfinchConfig.address)
  }
  const legacyGoldfinchConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig", {
    at: await go.legacyGoList(),
  })

  return await addUsersToGoList(legacyGoldfinchConfig, [address])
}

export async function fundUser(address: string) {
  const {
    deployments: {log, getOrNull},
  } = hre

  logger = log

  const chainId = await hre.getChainId()

  if (chainId === LOCAL_CHAIN_ID && !isMainnetForking()) {
    const fakeUsdcContract = await getDeployedAsEthersContract<Contract>(getOrNull, "TestERC20")
    const gfiContract = await getDeployedAsEthersContract<Contract>(getOrNull, "GFI")
    await fundFromLocalWhale(
      address,
      [
        {ticker: "USDC", contract: fakeUsdcContract},
        {ticker: "GFI", contract: gfiContract},
      ],
      {logger}
    )
  }

  if (isMainnetForking()) {
    const protocolOwner = await getProtocolOwner()
    await impersonateAccount(hre, protocolOwner)
    await fundWithWhales(["ETH"], [protocolOwner])
    await fundWithWhales(["USDT", "BUSD", "ETH", "USDC"], [address], 75000)

    // Patch USDC DOMAIN_SEPARATOR to make permit work locally
    await overrideUsdcDomainSeparator()
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
  allowedUIDTypes,
  limitInDollars,
}: {
  getOrNull: any
  underwriter: string
  goldfinchFactory: GoldfinchFactory
  borrower: string
  depositor?: string
  erc20: Contract
  allowedUIDTypes: Array<number>
  limitInDollars?: number
}): Promise<TranchedPool> {
  const monthlyScheduleRepo = await getDeploymentFor<MonthlyScheduleRepoInstance>("MonthlyScheduleRepo")
  await monthlyScheduleRepo.createSchedule(24, 1, 1, 1)
  const schedule = await monthlyScheduleRepo.getSchedule(24, 1, 1, 1)
  const juniorFeePercent = String(new BN(20))
  const limit = String(new BN(limitInDollars || 10000).mul(USDCDecimals))
  const interestApr = String(interestAprAsBN("5.00"))
  const lateFeeApr = String(new BN(0))
  const fundableAt = String(new BN(0))
  const underwriterSigner = ethers.provider.getSigner(underwriter)

  const result = await (
    await goldfinchFactory
      .connect(underwriterSigner)
      .createPool(borrower, juniorFeePercent, limit, interestApr, schedule, lateFeeApr, fundableAt, allowedUIDTypes)
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

const CALLABLE_LOAN_SCHEDULE_CONFIG = {
  numPeriods: 24,
  numPeriodsPerPrincipalPeriod: 3,
  numPeriodsPerInterestPeriod: 1,
  gracePrincipalPeriods: 0,
}
const UNCALLED_CAPITAL_TRANCHE =
  CALLABLE_LOAN_SCHEDULE_CONFIG.numPeriods / CALLABLE_LOAN_SCHEDULE_CONFIG.numPeriodsPerPrincipalPeriod -
  CALLABLE_LOAN_SCHEDULE_CONFIG.gracePrincipalPeriods -
  1
async function createCallableLoanForBorrower({
  getOrNull,
  underwriter,
  goldfinchFactory,
  borrower,
  depositor,
  erc20,
  allowedUIDTypes,
  limitInDollars,
  interestApr = String(interestAprAsBN("13.00")),
  numLockPeriods = 2,
  lateFeeApr = String(interestAprAsBN("5.00")), // TODO: Make this the Fazz deal late APR (good example of a late fee)
  fundableAt = String(new BN(0)), // 0 means immediately
  numPeriods = CALLABLE_LOAN_SCHEDULE_CONFIG.numPeriods,
  gracePrincipalPeriods = CALLABLE_LOAN_SCHEDULE_CONFIG.gracePrincipalPeriods,
  numPeriodsPerInterestPeriod = CALLABLE_LOAN_SCHEDULE_CONFIG.numPeriodsPerInterestPeriod,
  numPeriodsPerPrincipalPeriod = CALLABLE_LOAN_SCHEDULE_CONFIG.numPeriodsPerPrincipalPeriod,
}: {
  getOrNull: any
  underwriter: string
  goldfinchFactory: GoldfinchFactory
  borrower: string
  depositor?: string
  erc20: Contract
  allowedUIDTypes: Array<number>
  limitInDollars?: number
  interestApr?: string
  numLockPeriods?: number
  lateFeeApr?: string
  fundableAt?: string
  numPeriods?: number
  gracePrincipalPeriods?: number
  numPeriodsPerInterestPeriod?: number
  numPeriodsPerPrincipalPeriod?: number
}): Promise<CallableLoan> {
  const monthlyScheduleRepo = await getDeploymentFor<MonthlyScheduleRepoInstance>("MonthlyScheduleRepo")
  await monthlyScheduleRepo.createSchedule(
    numPeriods,
    numPeriodsPerPrincipalPeriod,
    numPeriodsPerInterestPeriod,
    gracePrincipalPeriods
  )
  const schedule = await monthlyScheduleRepo.getSchedule(
    numPeriods,
    numPeriodsPerPrincipalPeriod,
    numPeriodsPerInterestPeriod,
    gracePrincipalPeriods
  )

  const limit = String(new BN(limitInDollars || 2000000).mul(USDCDecimals))
  const underwriterSigner = ethers.provider.getSigner(underwriter)

  const result = await (
    await goldfinchFactory
      .connect(underwriterSigner)
      .createCallableLoan(
        borrower,
        limit,
        interestApr,
        numLockPeriods,
        schedule,
        lateFeeApr,
        fundableAt,
        allowedUIDTypes
      )
  ).wait()
  const lastEventArgs = getLastEventArgs(result)
  const loanAddress = lastEventArgs[0]
  const loanContract = await getDeployedAsEthersContract<CallableLoan>(getOrNull, "CallableLoan")
  assertNonNullable(loanContract)
  const loan = loanContract.attach(loanAddress).connect(underwriterSigner)

  logger(`Created a Callable Loan ${loanAddress} for the borrower ${borrower}`)
  let txn = await erc20.connect(underwriterSigner).approve(loan.address, String(limit))
  await txn.wait()

  if (depositor) {
    const depositAmount = String(new BN(limit).div(new BN(20)))
    const depositorSigner = ethers.provider.getSigner(depositor)
    txn = await erc20.connect(depositorSigner).approve(loan.address, String(limit))
    await txn.wait()
    txn = await loan.connect(depositorSigner).deposit(UNCALLED_CAPITAL_TRANCHE, depositAmount)
    await txn.wait()

    logger(`Deposited ${depositAmount} into ${loan.address} via ${depositor}`)
  }
  return loan
}
