/* eslint-disable @typescript-eslint/no-non-null-assertion */

import hre, {getNamedAccounts} from "hardhat"
import {
  getUSDCAddress,
  MAINNET_ONE_SPLIT_ADDRESS,
  getSignerForAddress,
  MAINNET_CUSDC_ADDRESS,
  TRANCHES,
  MAINNET_CHAIN_ID,
  getProtocolOwner,
  getTruffleContract,
  getEthersContract,
} from "../../blockchain_scripts/deployHelpers"
import {
  MAINNET_GOVERNANCE_MULTISIG,
  MAINNET_TRUSTED_SIGNER_ADDRESS,
} from "../../blockchain_scripts/mainnetForkingHelpers"
import {getExistingContracts} from "../../blockchain_scripts/deployHelpers/getExistingContracts"
import {CONFIG_KEYS, CONFIG_KEYS_BY_TYPE} from "../../blockchain_scripts/configKeys"
import {time} from "@openzeppelin/test-helpers"

const {deployments, ethers, artifacts, web3} = hre
const Borrower = artifacts.require("Borrower")
const IOneSplit = artifacts.require("IOneSplit")
import {
  expect,
  expectAction,
  erc20Approve,
  usdcVal,
  getBalance,
  MAX_UINT,
  bigVal,
  advanceTime,
  BN,
  ZERO_ADDRESS,
  createPoolWithCreditLine,
  decodeLogs,
  getDeployedAsTruffleContract,
  getOnlyLog,
  getFirstLog,
  toEthers,
  mineInSameBlock,
  decodeAndGetFirstLog,
  erc721Approve,
  erc20Transfer,
  advanceAndMineBlock,
  getNumShares,
  HALF_CENT,
  ZERO,
  fiduVal,
  borrowers,
  stakedFiduHolders,
  amountLessProtocolFee,
  protocolFee,
  usdcFromShares,
  getCurrentTimestamp,
  getTruffleContractAtAddress,
  SECONDS_PER_DAY,
  getMonthlySchedule,
} from "../testHelpers"

import {asNonNullable, assertIsString, assertNonNullable} from "@goldfinch-eng/utils"
import {
  BackerRewardsInstance,
  BorrowerInstance,
  CommunityRewardsInstance,
  CreditLineInstance,
  FiduInstance,
  FixedLeverageRatioStrategyInstance,
  GFIInstance,
  GoInstance,
  GoldfinchConfigInstance,
  GoldfinchFactoryInstance,
  ICurveLPInstance,
  MerkleDirectDistributorInstance,
  MerkleDistributorInstance,
  MonthlyScheduleRepoInstance,
  PoolTokensInstance,
  SeniorPoolInstance,
  StakingRewardsInstance,
  TranchedPoolInstance,
  UniqueIdentityInstance,
  WithdrawalRequestTokenInstance,
  ZapperInstance,
} from "@goldfinch-eng/protocol/typechain/truffle"
import {DepositMade} from "@goldfinch-eng/protocol/typechain/truffle/contracts/protocol/core/TranchedPool"
import {TokenMinted} from "@goldfinch-eng/protocol/typechain/truffle/contracts/protocol/core/PoolTokens"
import {Granted} from "@goldfinch-eng/protocol/typechain/truffle/contracts/rewards/CommunityRewards"
import {assertCommunityRewardsVestingRewards} from "../communityRewardsHelpers"
import {TOKEN_LAUNCH_TIME_IN_SECONDS} from "@goldfinch-eng/protocol/blockchain_scripts/baseDeploy"
import {promises as fs} from "fs"
import _ from "lodash"
import {MerkleDistributorInfo} from "../../blockchain_scripts/merkle/merkleDistributor/types"
import {
  NO_VESTING_MERKLE_INFO_PATH,
  VESTING_MERKLE_INFO_PATH,
} from "../../blockchain_scripts/airdrop/community/calculation"
import {MerkleDirectDistributorInfo} from "../../blockchain_scripts/merkle/merkleDirectDistributor/types"
import {
  DepositedAndStaked,
  DepositedToCurveAndStaked,
  RewardPaid,
  Staked,
  Unstaked,
} from "@goldfinch-eng/protocol/typechain/truffle/contracts/rewards/StakingRewards"
import {impersonateAccount} from "../../blockchain_scripts/helpers/impersonateAccount"
import {fundWithWhales} from "../../blockchain_scripts/helpers/fundWithWhales"
import {
  BackerRewards,
  CreditLine,
  StakingRewards,
  TranchedPool,
  UniqueIdentity,
  Borrower as EthersBorrower,
  GoldfinchFactory,
  ERC20,
} from "@goldfinch-eng/protocol/typechain/ethers"
import {ContractReceipt, Signer, Wallet} from "ethers"
import BigNumber from "bignumber.js"
import {
  BorrowerCreated,
  PoolCreated,
} from "@goldfinch-eng/protocol/typechain/truffle/contracts/protocol/core/GoldfinchFactory"

const THREE_YEARS_IN_SECONDS = 365 * 24 * 60 * 60 * 3
const TOKEN_LAUNCH_TIME = new BN(TOKEN_LAUNCH_TIME_IN_SECONDS).add(new BN(THREE_YEARS_IN_SECONDS))

const circleEoa = "0x55FE002aefF02F77364de339a1292923A15844B8"

const setupTest = deployments.createFixture(async ({deployments}) => {
  // Note: Even if we do not have any pending mainnet migrations,
  // the "fixture" part is what lets hardhat
  // snapshot and give us a clean blockchain before each test.
  // Otherwise, we have state leaking across tests.
  await deployments.fixture("pendingMainnetMigrations", {keepExistingDeployments: true})

  const [owner, bwr] = await web3.eth.getAccounts()
  assertNonNullable(owner)
  assertNonNullable(bwr)

  // Ensure the multisig has funds for various transactions
  const ownerAccount = await getSignerForAddress(owner)
  assertNonNullable(ownerAccount)
  await ownerAccount.sendTransaction({to: MAINNET_GOVERNANCE_MULTISIG, value: ethers.utils.parseEther("10.0")})

  await impersonateAccount(hre, MAINNET_GOVERNANCE_MULTISIG)

  const mainnetMultisigSigner = ethers.provider.getSigner(MAINNET_GOVERNANCE_MULTISIG)
  const contractNames = ["SeniorPool", "Fidu", "GoldfinchFactory", "GoldfinchConfig", "Go"]
  const existingContracts = await getExistingContracts(contractNames, mainnetMultisigSigner)

  const usdcAddress = getUSDCAddress(MAINNET_CHAIN_ID)
  assertIsString(usdcAddress)
  const usdc = await artifacts.require("IERC20withDec").at(usdcAddress)
  const cUSDC = await artifacts.require("IERC20withDec").at(MAINNET_CUSDC_ADDRESS)

  assertNonNullable(existingContracts.SeniorPool)
  assertNonNullable(existingContracts.Fidu)
  assertNonNullable(existingContracts.GoldfinchConfig)
  assertNonNullable(existingContracts.GoldfinchFactory)

  const seniorPool: SeniorPoolInstance = await artifacts
    .require("SeniorPool")
    .at(existingContracts.SeniorPool.ExistingContract.address)

  const fidu: FiduInstance = await artifacts.require("Fidu").at(existingContracts.Fidu.ExistingContract.address)

  const go: GoInstance = await artifacts.require("Go").at(existingContracts.Go?.ExistingContract.address)

  const legacyGoldfinchConfig = await artifacts.require("GoldfinchConfig").at(await go.legacyGoList())

  const goldfinchConfig: GoldfinchConfigInstance = await artifacts
    .require("GoldfinchConfig")
    .at(existingContracts.GoldfinchConfig.ExistingContract.address)

  const backerRewards: BackerRewardsInstance = await getTruffleContract<BackerRewardsInstance>("BackerRewards")

  const goldfinchFactory: GoldfinchFactoryInstance = await artifacts
    .require("GoldfinchFactory")
    .at(existingContracts.GoldfinchFactory.ExistingContract.address)

  const seniorPoolStrategyAddress = await goldfinchConfig.getAddress(CONFIG_KEYS.SeniorPoolStrategy)
  const seniorPoolStrategy: FixedLeverageRatioStrategyInstance = await artifacts
    .require("FixedLeverageRatioStrategy")
    .at(seniorPoolStrategyAddress)

  const stakingRewards: StakingRewardsInstance = await getTruffleContract<StakingRewardsInstance>("StakingRewards")

  const poolTokens: PoolTokensInstance = await getTruffleContract<PoolTokensInstance>("PoolTokens")

  // GFI is deployed by the temp multisig
  const gfi = await getDeployedAsTruffleContract<GFIInstance>(deployments, "GFI")

  const communityRewards = await getDeployedAsTruffleContract<CommunityRewardsInstance>(deployments, "CommunityRewards")
  await communityRewards.setTokenLaunchTimeInSeconds(TOKEN_LAUNCH_TIME, {from: await getProtocolOwner()})

  const merkleDistributor = await getDeployedAsTruffleContract<MerkleDistributorInstance>(
    deployments,
    "MerkleDistributor"
  )

  const merkleDirectDistributor = await getDeployedAsTruffleContract<MerkleDirectDistributorInstance>(
    deployments,
    "MerkleDirectDistributor"
  )

  const uniqueIdentity = await getDeployedAsTruffleContract<UniqueIdentityInstance>(deployments, "UniqueIdentity")

  const ethersUniqueIdentity = await toEthers<UniqueIdentity>(uniqueIdentity)
  const signer = ethersUniqueIdentity.signer
  assertNonNullable(signer.provider, "Signer provider is null")
  const network = await signer.provider.getNetwork()

  const requestTokens = await getTruffleContract<WithdrawalRequestTokenInstance>("WithdrawalRequestToken")

  const zapper: ZapperInstance = await getDeployedAsTruffleContract<ZapperInstance>(deployments, "Zapper")

  return {
    poolTokens,
    seniorPool,
    requestTokens,
    seniorPoolStrategy,
    usdc,
    fidu,
    goldfinchConfig,
    goldfinchFactory,
    cUSDC,
    go,
    stakingRewards,
    backerRewards,
    zapper,
    gfi,
    communityRewards,
    merkleDistributor,
    merkleDirectDistributor,
    legacyGoldfinchConfig,
    uniqueIdentity,
    ethersUniqueIdentity,
    signer,
    network,
  }
})

export const TEST_TIMEOUT = 180000 // 3 mins

/*
These tests are special. They use existing mainnet state, so
that we can easily and realistically test interactions with outside protocols
and contracts.
*/
describe("mainnet forking tests", async function () {
  // eslint-disable-next-line no-unused-vars
  let accounts, owner, bwr, person3, usdc, fidu, goldfinchConfig
  let goldfinchFactory: GoldfinchFactoryInstance, busd, usdt
  let reserveAddress,
    tranchedPool: TranchedPoolInstance,
    borrower,
    seniorPool: SeniorPoolInstance,
    seniorPoolStrategy,
    go: GoInstance,
    requestTokens: WithdrawalRequestTokenInstance,
    stakingRewards: StakingRewardsInstance,
    curvePool: ICurveLPInstance,
    backerRewards: BackerRewardsInstance,
    zapper: ZapperInstance,
    gfi: GFIInstance,
    communityRewards: CommunityRewardsInstance,
    merkleDistributor: MerkleDistributorInstance,
    merkleDirectDistributor: MerkleDirectDistributorInstance,
    legacyGoldfinchConfig: GoldfinchConfigInstance,
    uniqueIdentity: UniqueIdentityInstance,
    ethersUniqueIdentity: UniqueIdentity,
    signer: Signer,
    network,
    poolTokens: PoolTokensInstance

  async function setupSeniorPool() {
    seniorPoolStrategy = await artifacts.require("ISeniorPoolStrategy").at(seniorPoolStrategy.address)

    await erc20Approve(usdc, seniorPool.address, usdcVal(100_000), [owner])
    await seniorPool.deposit(usdcVal(100_000), {from: owner})
  }

  async function createBorrowerContract() {
    const result = await goldfinchFactory.createBorrower(bwr)
    assertNonNullable(result.logs)
    const bwrConAddr = (result.logs[result.logs.length - 1] as unknown as BorrowerCreated).args.borrower
    const bwrCon = await Borrower.at(bwrConAddr)
    await erc20Approve(busd, bwrCon.address, MAX_UINT, [bwr])
    await erc20Approve(usdt, bwrCon.address, MAX_UINT, [bwr])
    return bwrCon
  }

  async function initializeTranchedPool(pool, bwrCon) {
    await erc20Approve(usdc, pool.address, usdcVal(100000), [owner])
    await pool.deposit(TRANCHES.Junior, usdcVal(2000))
    await bwrCon.lockJuniorCapital(pool.address, {from: bwr})
    await pool.grantRole(await pool.SENIOR_ROLE(), owner, {from: MAINNET_GOVERNANCE_MULTISIG})
    await pool.deposit(TRANCHES.Senior, usdcVal(8000))
    await pool.revokeRole(await pool.SENIOR_ROLE(), owner, {from: MAINNET_GOVERNANCE_MULTISIG})
  }

  const stratosEoa = "0x26b36FB2a3Fd28Df48bc1B77cDc2eCFdA3A5fF9D"

  beforeEach(async function () {
    this.timeout(TEST_TIMEOUT)
    accounts = await web3.eth.getAccounts()
    ;[owner, bwr, person3] = accounts
    ;({
      usdc,
      goldfinchFactory,
      seniorPool,
      seniorPoolStrategy,
      fidu,
      goldfinchConfig,
      go,
      stakingRewards,
      backerRewards,
      zapper,
      gfi,
      communityRewards,
      merkleDistributor,
      merkleDirectDistributor,
      legacyGoldfinchConfig,
      uniqueIdentity,
      poolTokens,
      requestTokens,
    } = await setupTest())
    reserveAddress = await goldfinchConfig.getAddress(CONFIG_KEYS.TreasuryReserve)
    const usdcAddress = getUSDCAddress(MAINNET_CHAIN_ID)
    assertIsString(usdcAddress)
    const busdAddress = "0x4fabb145d64652a948d72533023f6e7a623c7c53"
    const usdtAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
    const curveAddress = "0x80aa1a80a30055DAA084E599836532F3e58c95E2"
    busd = await artifacts.require("IERC20withDec").at(busdAddress)
    usdt = await artifacts.require("IERC20withDec").at(usdtAddress)
    curvePool = await artifacts.require("ICurveLP").at(curveAddress)
    await fundWithWhales(["USDC", "BUSD", "USDT"], [owner, bwr, person3])
    const {gf_deployer} = await getNamedAccounts()
    await fundWithWhales(["ETH"], [gf_deployer!, MAINNET_TRUSTED_SIGNER_ADDRESS, stratosEoa])
    await erc20Approve(usdc, seniorPool.address, MAX_UINT, accounts)
    await legacyGoldfinchConfig.bulkAddToGoList([owner, bwr, person3], {from: MAINNET_GOVERNANCE_MULTISIG})
    await setupSeniorPool()
  })

  describe("Go", () => {
    it("should not be re-initializable", async () => {
      await expect(
        go.initialize(Wallet.createRandom().address, goldfinchConfig.address, uniqueIdentity.address)
      ).to.be.rejectedWith(/Contract instance has already been initialized/)
    })
  })

  describe("daily interest accrual tranched pools", () => {
    it("initializes a pool with a monthyl scheduel", async () => {
      // Create a schedule for a 1 yr bullet loan
      const monthlyScheduleRepoAddress = await goldfinchConfig.getAddress(
        CONFIG_KEYS_BY_TYPE.addresses.MonthlyScheduleRepo
      )
      expect(monthlyScheduleRepoAddress).to.not.eq(ZERO_ADDRESS)
      const monthylScheduleRepo = await getTruffleContract<MonthlyScheduleRepoInstance>("MonthlyScheduleRepo", {
        at: monthlyScheduleRepoAddress,
      })

      const periodsInTerm = 12
      const periodsPerPrincipalPeriod = 12
      const periodsPerInterestPeriod = 1
      const principalGracePeriods = 0
      await monthylScheduleRepo.createSchedule(
        periodsInTerm,
        periodsPerPrincipalPeriod,
        periodsPerInterestPeriod,
        principalGracePeriods
      )
      const oneYearBulletSchedule = await monthylScheduleRepo.getSchedule(
        periodsInTerm,
        periodsPerPrincipalPeriod,
        periodsPerInterestPeriod,
        principalGracePeriods
      )

      // Create the pool
      const borrower = "0x26b36FB2a3Fd28Df48bc1B77cDc2eCFdA3A5fF9D" // stratos EOA
      await impersonateAccount(hre, borrower)

      const protocolAdminAddress = await goldfinchConfig.getAddress(CONFIG_KEYS.ProtocolAdmin)
      const protocolAdminSigner = await ethers.provider.getSigner(protocolAdminAddress)
      assertNonNullable(protocolAdminSigner)

      const gfFactoryEthers = await (
        await getEthersContract<GoldfinchFactory>("GoldfinchFactory", {at: goldfinchFactory.address})
      ).connect(protocolAdminSigner)

      const poolCreationTx = await (
        await gfFactoryEthers.createPool(
          borrower,
          0,
          "100000000",
          "135000000000000000",
          oneYearBulletSchedule,
          "0",
          `${await getCurrentTimestamp()}`,
          ["0", "1", "2", "3", "4"]
        )
      ).wait()

      const event = asNonNullable(poolCreationTx.events![poolCreationTx.events!.length - 1])
      const poolAddress = event.args!.pool
      const pool = await getEthersContract<TranchedPool>("TranchedPool", {at: poolAddress})

      // Drawdown on the pool
      await fundWithWhales(["USDC"], [protocolAdminAddress])
      const usdcEthers = await getEthersContract<ERC20>("ERC20", {at: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"})
      await usdcEthers.connect(protocolAdminSigner).approve(poolAddress, `${usdcVal(10)}`)
      await pool.connect(protocolAdminSigner).deposit(2, `${usdcVal(10)}`)

      // Now that there's an investment, the borrower drawsdown
      const borrowerSigner = await ethers.provider.getSigner(borrower)
      await pool.connect(borrowerSigner).lockJuniorCapital()
      await pool.connect(borrowerSigner).lockPool()
      await pool.connect(borrowerSigner).drawdown(`${usdcVal(10)}`)

      // Assert it has a monthly payment schedule as expected
      const creditLine = await getTruffleContractAtAddress<CreditLineInstance>("CreditLine", await pool.creditLine())
      // Term start time should be March 1st (when the stub period ends)
      expect(await creditLine.termStartTime()).to.bignumber.eq("1677628800") // Wed Mar 01 2023 00:00:00 GMT+0000
      // Next due time should be the end of the period after the stub period (Apr 1st)
      expect(await creditLine.nextDueTime()).to.bignumber.eq("1680307200") // Sat Apr 01 2023 00:00:00 GMT+0000
    })
  })

  /**
   * This test takes three staked fidu holders, unstakes their fidu, and then requets to withdraw their full fidu amount
   * We advance time, keeping track of pool repayments and the amount of usdc available for each epoch. Then after four
   * epochs we claim their requests and assert the amounts are correct and sent to the right addresses
   */
  describe("epoch withdrawals", () => {
    async function repayPool(i: number, owner) {
      const pool = await getTruffleContract<TranchedPoolInstance>("TranchedPool", {at: borrowers[i]!.poolAddress})
      const cl = await getTruffleContract<CreditLineInstance>("CreditLine", {at: await pool.creditLine()})

      await pool.assess()

      // Advance time to the end of the epoch or next due time, whichever is later
      // We do this because we need to ensure that the epoch has passed
      const fourteenDaysInSeconds = new BN(14 * 24 * 60 * 60)
      const timeToAdvance = BN.max(await cl.nextDueTime(), new BN(await time.latest()).add(fourteenDaysInSeconds))
      await advanceTime({toSecond: timeToAdvance})
      await pool.assess()

      const interestOwed = await cl.interestOwed()
      await fundWithWhales(["USDC"], [owner.address])
      await impersonateAccount(hre, owner.address)
      await usdc.approve(pool.address, interestOwed, {from: owner.address})
      await pool.methods["pay(uint256)"](await cl.interestOwed(), {from: owner.address})
    }

    async function redeemPool(token: number) {
      const tokenPreRedeem = await poolTokens.getTokenInfo(token)
      await expectAction(() => seniorPool.redeem(token)).toChange([
        [() => usdc.balanceOf(seniorPool.address), {increase: true}],
        [seniorPool.usdcAvailable, {increase: true}],
      ])
      const tokenPostRedeem = await poolTokens.getTokenInfo(token)
      const interestRedeemed = new BN(tokenPostRedeem.interestRedeemed).sub(new BN(tokenPreRedeem.interestRedeemed))
      const principalRedeemed = new BN(tokenPostRedeem.principalRedeemed).sub(new BN(tokenPreRedeem.principalRedeemed))
      return interestRedeemed.add(principalRedeemed)
    }

    it("withdraws", async () => {
      const [owner] = await ethers.getSigners()
      assertNonNullable(owner)

      await fundWithWhales(["USDC"], [owner.address], 1_000_000)

      let usdcAvailable = await seniorPool.usdcAvailable()
      const expectedFiduLiquidatedByEpoch: BN[] = []
      const expectedUsdcAllocatedByEpoch: BN[] = []
      const fiduRequestedByEpoch: BN[] = []
      const withdrawalRequestsByEpoch: any[] = []
      const requestIds: BN[] = []

      // Each staked fidu holder is going to unstake and request to withdraw
      const currentEpoch = await seniorPool.currentEpoch()
      const latestMainnetWithdrawalRequestIndex = (await requestTokens._tokenIdTracker()).toNumber()

      fiduRequestedByEpoch.push(new BN(currentEpoch.fiduRequested))
      for (let i = 0; i < stakedFiduHolders.length; ++i) {
        const {stakingRewardsTokenId, address} = stakedFiduHolders[i]!
        const fiduBalance = await stakingRewards.stakedBalanceOf(stakingRewardsTokenId)
        await impersonateAccount(hre, address)
        await stakingRewards.unstake(stakingRewardsTokenId, fiduBalance, {
          from: address,
        })
        await fidu.approve(seniorPool.address, fiduBalance, {from: address})
        await expectAction(() => seniorPool.requestWithdrawal(fiduBalance, {from: address})).toChange([
          [() => fidu.balanceOf(address), {by: fiduBalance.neg()}],
          [() => fidu.balanceOf(seniorPool.address), {by: fiduBalance}],
        ])

        requestIds.push(await requestTokens.tokenOfOwnerByIndex(address, "0"))

        fiduRequestedByEpoch[0] = fiduRequestedByEpoch[0]!.add(fiduBalance)
      }

      expectedFiduLiquidatedByEpoch.push(getNumShares(usdcAvailable, await seniorPool.sharePrice()))
      expectedUsdcAllocatedByEpoch.push(usdcAvailable)
      withdrawalRequestsByEpoch.push([])
      for (let i = 0; i < stakedFiduHolders.length; ++i) {
        withdrawalRequestsByEpoch[0].push(
          await seniorPool.withdrawalRequest(i + latestMainnetWithdrawalRequestIndex + 1)
        )
      }

      // Stratos repayment  (also advances time to payment due date)
      await repayPool(0, owner)

      // IN EPOCH 2
      usdcAvailable = await redeemPool(613)
      fiduRequestedByEpoch.push(fiduRequestedByEpoch[0]!.sub(expectedFiduLiquidatedByEpoch[0]!))
      expectedFiduLiquidatedByEpoch.push(getNumShares(usdcAvailable, await seniorPool.sharePrice()))
      expectedUsdcAllocatedByEpoch.push(usdcAvailable)
      withdrawalRequestsByEpoch.push([])
      for (let i = 0; i < stakedFiduHolders.length; ++i) {
        withdrawalRequestsByEpoch[1].push(
          await seniorPool.withdrawalRequest(i + latestMainnetWithdrawalRequestIndex + 1)
        )
      }

      // Addem Repayment (also advances time to payment due date)
      await repayPool(1, owner)
      await advanceAndMineBlock({days: 14})

      // IN EPOCH 3
      fiduRequestedByEpoch.push(fiduRequestedByEpoch[1]!.sub(expectedFiduLiquidatedByEpoch[1]!))

      const depositAmount = usdcFromShares(fiduRequestedByEpoch[2]!, await seniorPool.sharePrice())
      await fundWithWhales(["USDC"], [owner.address], depositAmount.div(new BN(10 ** 6)).toNumber())
      await usdc.approve(seniorPool.address, depositAmount, {from: owner.address})
      await seniorPool.deposit(depositAmount, {
        from: owner.address,
      })

      // Full liquidation - liquidate fiduRequested instead of usdcAvailable
      expectedFiduLiquidatedByEpoch.push(fiduRequestedByEpoch[2]!)
      expectedUsdcAllocatedByEpoch.push(usdcFromShares(fiduRequestedByEpoch[2]!, await seniorPool.sharePrice()))
      withdrawalRequestsByEpoch.push([])
      for (let i = 0; i < stakedFiduHolders.length; ++i) {
        withdrawalRequestsByEpoch[2].push(
          await seniorPool.withdrawalRequest(i + latestMainnetWithdrawalRequestIndex + 1)
        )
      }

      // Advance to Epoch 4
      await advanceAndMineBlock({days: 14})

      // IN EPOCH 4

      // Full liquidation
      expectedFiduLiquidatedByEpoch.push(ZERO)
      expectedUsdcAllocatedByEpoch.push(ZERO)
      fiduRequestedByEpoch.push(fiduRequestedByEpoch[2]!.sub(expectedFiduLiquidatedByEpoch[2]!))
      withdrawalRequestsByEpoch.push([])
      for (let i = 0; i < stakedFiduHolders.length; ++i) {
        withdrawalRequestsByEpoch[3].push(
          await seniorPool.withdrawalRequest(i + latestMainnetWithdrawalRequestIndex + 1)
        )
      }

      // Verify that the request after each epoch had the correct usdc withdrawable and fidu requested
      const cumulativeUsdcWithdrawableByRequest: BN[] = []
      const cumulativeFiduLiquidatedByRequest: BN[] = []
      for (let i = 0; i < stakedFiduHolders.length; ++i) {
        cumulativeUsdcWithdrawableByRequest.push(ZERO)
        cumulativeFiduLiquidatedByRequest.push(ZERO)
      }
      for (let epoch = 0; epoch < 3; ++epoch) {
        for (let i = 0; i < stakedFiduHolders.length; ++i) {
          const requestBeforeLiquidation = withdrawalRequestsByEpoch[epoch][i]!
          const requestAfterLiquidation = withdrawalRequestsByEpoch[epoch + 1][i]!

          const proRataUsdc = new BN(expectedUsdcAllocatedByEpoch[epoch]!)
            .mul(new BN(requestBeforeLiquidation.fiduRequested))
            .div(new BN(fiduRequestedByEpoch[epoch]!))

          const fiduLiquidated = new BN(expectedFiduLiquidatedByEpoch[epoch]!)
            .mul(new BN(requestBeforeLiquidation.fiduRequested))
            .div(new BN(fiduRequestedByEpoch[epoch]!))

          const expectedUsdcWithdrawable = cumulativeUsdcWithdrawableByRequest[i]!.add(proRataUsdc)
          expect(requestAfterLiquidation.usdcWithdrawable).to.bignumber.eq(expectedUsdcWithdrawable)

          const expectedFiduRequested = new BN(withdrawalRequestsByEpoch[0][i].fiduRequested)
            .sub(cumulativeFiduLiquidatedByRequest[i]!)
            .sub(fiduLiquidated)

          // Compare the usdc equivalent of fiduRequested because there could be some dust leftover
          expect(
            usdcFromShares(new BN(requestAfterLiquidation.fiduRequested), await seniorPool.sharePrice())
          ).to.bignumber.eq(usdcFromShares(new BN(expectedFiduRequested), await seniorPool.sharePrice()))

          cumulativeUsdcWithdrawableByRequest[i] = cumulativeUsdcWithdrawableByRequest[i]!.add(proRataUsdc)
          cumulativeFiduLiquidatedByRequest[i] = cumulativeFiduLiquidatedByRequest[i]!.add(fiduLiquidated)
        }
      }

      // Verify claim sends udsc to all the right places
      for (let requestId = 0; requestId < stakedFiduHolders.length; ++requestId) {
        const request = withdrawalRequestsByEpoch[3][requestId]
        const userUsdc = amountLessProtocolFee(new BN(request.usdcWithdrawable))
        const reserveUsdc = protocolFee(new BN(request.usdcWithdrawable))

        await expectAction(() =>
          seniorPool.claimWithdrawalRequest(requestId + latestMainnetWithdrawalRequestIndex + 1, {
            from: stakedFiduHolders[requestId]!.address,
          })
        ).toChange([
          [() => usdc.balanceOf(stakedFiduHolders[requestId]!.address), {byCloseTo: userUsdc, threshold: HALF_CENT}],
          [() => usdc.balanceOf(reserveAddress), {by: reserveUsdc}],
          [
            () => usdc.balanceOf(seniorPool.address),
            {byCloseTo: userUsdc.add(reserveUsdc).neg(), threshold: HALF_CENT},
          ],
        ])

        expect(
          (await requestTokens.balanceOf(stakedFiduHolders[requestId]!.address)).eq(new BN("0")) ||
            (
              await seniorPool.withdrawalRequest(requestId + latestMainnetWithdrawalRequestIndex + 1)
            ).usdcWithdrawable.eq(new BN("0"))
        ).to.be.true
      }
    })

    it("takes cancellation fees according to SeniorPoolWithdrawalCancelationFeeInBps", async () => {
      const {address: stakedFiduHolder, stakingRewardsTokenId} = stakedFiduHolders[1]!
      await impersonateAccount(hre, stakedFiduHolder)
      await stakingRewards.unstake(stakingRewardsTokenId, fiduVal(10_000), {from: stakedFiduHolder})
      await fidu.approve(seniorPool.address, fiduVal(10_000), {from: stakedFiduHolder})
      await seniorPool.requestWithdrawal(fiduVal(10_000), {from: stakedFiduHolder})

      const cancelationFeeInBps = await goldfinchConfig.getNumber(CONFIG_KEYS.SeniorPoolWithdrawalCancelationFeeInBps)
      const expectedCancelationFee = fiduVal(10_000).mul(cancelationFeeInBps).div(new BN(10_000))
      const expectedFiduReturnedToUser = fiduVal(10_000).sub(expectedCancelationFee)

      const protocolAdminAddress = await goldfinchConfig.getAddress(CONFIG_KEYS.ProtocolAdmin)

      const totalSupply = await requestTokens._tokenIdTracker()

      await expectAction(() => seniorPool.cancelWithdrawalRequest(totalSupply, {from: stakedFiduHolder})).toChange([
        [() => fidu.balanceOf(stakedFiduHolder), {by: expectedFiduReturnedToUser}],
        [() => fidu.balanceOf(protocolAdminAddress), {by: expectedCancelationFee}],
        [() => fidu.balanceOf(seniorPool.address), {by: fiduVal(10_000).neg()}],
      ])
    })
  })

  describe("poolToken splitting", () => {
    /**
     * The stratos test simualates progressing through the loan, having the token holder withdrawing some rewards
     * partway through, and then finally at the end of the loan asserting that interest redeemed, principal redeemed,
     * and total claimable backer rewards are what we would expect
     */
    describe("stratos", () => {
      const stratosPoolAddress = "0x00c27fc71b159a346e179b4a1608a0865e8a7470"
      const tokenId = 536 // This is a pool token belonging to the Stratos Pool
      let tokenOwner: string
      let tranchedPool: TranchedPoolInstance
      let creditLine: CreditLineInstance
      let tokenInfoBeforePayment
      beforeEach(async () => {
        tokenOwner = await poolTokens.ownerOf(tokenId)
        tranchedPool = await getTruffleContractAtAddress<TranchedPoolInstance>("TranchedPool", stratosPoolAddress)
        creditLine = await getTruffleContractAtAddress<CreditLineInstance>(
          "CreditLine",
          await tranchedPool.creditLine()
        )

        await fundWithWhales(["USDC"], [stratosEoa], 10_000_000)

        // At the current blockNum, tokenOwner hasn't claimed any rewards. We want a test where they have non-zero
        // rewardsClaimed at token split, so we'll withdraw all their claimable rewards up to now (they will accrue)
        // more claimable rewards after payment time
        // Need to make payment first. We can't claim rewards because the pool is late on payments...
        await hre.network.provider.request({
          method: "hardhat_impersonateAccount",
          params: [stratosEoa],
        })
        await tranchedPool.assess()
        let interestOwed = await creditLine.interestOwed()
        await usdc.approve(tranchedPool.address, interestOwed, {from: stratosEoa})
        await tranchedPool.pay(interestOwed, {from: stratosEoa})
        await hre.network.provider.request({
          method: "hardhat_impersonateAccount",
          params: [tokenOwner],
        })
        await backerRewards.withdraw(tokenId, {from: tokenOwner})

        await advanceTime({toSecond: (await creditLine.termEndTime()).sub(SECONDS_PER_DAY.mul(new BN(30)))})
        await tranchedPool.assess()
        await hre.network.provider.request({
          method: "hardhat_impersonateAccount",
          params: [stratosEoa],
        })
        interestOwed = await creditLine.interestOwed()
        await usdc.approve(tranchedPool.address, interestOwed, {from: stratosEoa})
        tokenInfoBeforePayment = await poolTokens.getTokenInfo(tokenId) // do not DELETE! needed to calculate expectedRedeemableInterest
        await tranchedPool.pay(interestOwed, {from: stratosEoa})
      })

      it("doesn't change interest and principal redeemed/redeemable", async () => {
        await hre.network.provider.request({
          method: "hardhat_impersonateAccount",
          params: [tokenOwner],
        })

        // These are the values we expect to be able to redeem with the original pool token
        // after stratos's next repayment. They are computed by uncommenting the code snippet
        // below and reading the console output

        // await tranchedPool.withdrawMax(tokenId, {from: tokenOwner})
        // const tokenInfoAfterPaymentAndWithdrawal = await poolTokens.getTokenInfo(tokenId)

        // const interestRedeemed = new BN(tokenInfoAfterPaymentAndWithdrawal.interestRedeemed)
        //   .sub(new BN(tokenInfoBeforePayment.interestRedeemed))
        // const principalRedeemed = new BN(tokenInfoAfterPaymentAndWithdrawal.principalRedeemed)
        //   .sub(new BN(tokenInfoBeforePayment.principalRedeemed))

        // console.log(`interestRedeemed ${interestRedeemed}`)
        // console.log(`principalRedeemed ${principalRedeemed}`)
        const expectedRedeemableInterest = new BN(597978187)
        const expectedRedeemablePrincipal = new BN(8744)

        const principalAmount = new BN(tokenInfoBeforePayment.principalAmount)
        const amount1 = principalAmount.div(new BN(4))

        const tx = await poolTokens.splitToken(tokenId, amount1, {from: tokenOwner})
        const logs = decodeLogs<TokenMinted>(tx.receipt.rawLogs, poolTokens, "TokenMinted")
        const [newTokenId1, newTokenId2] = logs.map((log) => log.args.tokenId)
        assertNonNullable(newTokenId1)
        assertNonNullable(newTokenId2)

        const newTokenInfo1BeforeWithdraw = await poolTokens.getTokenInfo(newTokenId1)
        const newTokenInfo2BeforeWithdraw = await poolTokens.getTokenInfo(newTokenId2)

        // The sum of interest redeemed in the split tokens should match the interest redeemed on
        // the original token
        expect(
          new BN(newTokenInfo1BeforeWithdraw.interestRedeemed).add(new BN(newTokenInfo2BeforeWithdraw.interestRedeemed))
        ).to.bignumber.eq(tokenInfoBeforePayment.interestRedeemed)
        // The sum of principal redeemed in the split tokens should match the principal redeemed on
        // the original token
        expect(
          new BN(newTokenInfo1BeforeWithdraw.principalRedeemed).add(
            new BN(newTokenInfo2BeforeWithdraw.principalRedeemed)
          )
        ).to.bignumber.eq(tokenInfoBeforePayment.principalRedeemed)

        await tranchedPool.withdrawMax(newTokenId1, {from: tokenOwner})
        await tranchedPool.withdrawMax(newTokenId2, {from: tokenOwner})

        const newTokenInfo1AfterWithdraw = await poolTokens.getTokenInfo(newTokenId1)
        const newTokenInfo2AfterWithdraw = await poolTokens.getTokenInfo(newTokenId2)

        // The sum of interest redeemable on the split tokens should match what the tokenOwner would
        // have been able to redeem with the original token (but it might be a little less due to rounding
        // in integer division)
        const token1InterestRedeemed = new BN(newTokenInfo1AfterWithdraw.interestRedeemed).sub(
          new BN(newTokenInfo1BeforeWithdraw.interestRedeemed)
        )
        const token2InterestRedeemed = new BN(newTokenInfo2AfterWithdraw.interestRedeemed).sub(
          new BN(newTokenInfo2BeforeWithdraw.interestRedeemed)
        )
        expect(token1InterestRedeemed.add(token2InterestRedeemed)).to.bignumber.closeTo(expectedRedeemableInterest, "1")

        // The sum of principal redeemable on the split tokens should match what the tokenOwner would
        // have been able to redeem with the original token (but it might be a little less due to rounding
        // in integer division)
        const token1PrincipalRedeemed = new BN(newTokenInfo1AfterWithdraw.principalRedeemed).sub(
          new BN(newTokenInfo1BeforeWithdraw.principalRedeemed)
        )
        const token2PrincipalRedeemed = new BN(newTokenInfo2AfterWithdraw.principalRedeemed).sub(
          new BN(newTokenInfo2BeforeWithdraw.principalRedeemed)
        )
        expect(token1PrincipalRedeemed.add(token2PrincipalRedeemed)).to.bignumber.closeTo(
          expectedRedeemablePrincipal,
          "1"
        )
      })

      it("doesn't change rewardsClaimed or rewardsClaimable", async () => {
        const rewardsClaimed = new BN((await backerRewards.getTokenInfo(tokenId)).rewardsClaimed)
        const rewardsClaimable = new BN(await backerRewards.poolTokenClaimableRewards(tokenId))

        await hre.network.provider.request({
          method: "hardhat_impersonateAccount",
          params: [tokenOwner],
        })

        const principalAmount = new BN(tokenInfoBeforePayment.principalAmount)
        const amount1 = principalAmount.div(new BN(4))
        const tx = await poolTokens.splitToken(tokenId, amount1, {from: tokenOwner})
        const logs = decodeLogs<TokenMinted>(tx.receipt.rawLogs, poolTokens, "TokenMinted")
        const [newTokenId1, newTokenId2] = logs.map((log) => log.args.tokenId)
        assertNonNullable(newTokenId1)
        assertNonNullable(newTokenId2)

        // The sum of the split tokens' claimable rewards should be the claimable rewards of the original
        const claimableRewards1 = new BN(await backerRewards.poolTokenClaimableRewards(newTokenId1))
        const claimableRewards2 = new BN(await backerRewards.poolTokenClaimableRewards(newTokenId2))
        expect(claimableRewards1.add(claimableRewards2)).to.bignumber.eq(rewardsClaimable)

        // The sum of the split tokens' claimed rewards should be the claimed rewards of the original
        const claimedRewards1 = new BN((await backerRewards.getTokenInfo(newTokenId1)).rewardsClaimed)
        const claimedRewards2 = new BN((await backerRewards.getTokenInfo(newTokenId2)).rewardsClaimed)
        expect(claimedRewards1.add(claimedRewards2)).to.bignumber.eq(rewardsClaimed)
      })
    })
  })

  // Regression test for senior pool writedown bug fix
  // https://bugs.immunefi.com/dashboard/submission/10342
  describe("writedowns", () => {
    it("doesn't tank the share price when a loan reaches maturity", async () => {
      // Get stratos borrower contract
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [stratosEoa],
      })
      await fundWithWhales(["USDC"], [stratosEoa], 10_000_000)
      const stratosSigner = await ethers.getSigner(stratosEoa)
      const stratosBrwContract = await (
        await getEthersContract<EthersBorrower>("Borrower", {at: "0xf8C4A0fEDf9b249253D89203034374E5A57b617C"})
      ).connect(stratosSigner)
      await erc20Approve(usdc, stratosBrwContract.address, usdcVal(10_000_000), [stratosEoa])
      const stratosPool = await getEthersContract<TranchedPool>("TranchedPool", {
        at: "0x00c27FC71b159a346e179b4A1608a0865e8A7470",
      })
      const stratosCl = await getEthersContract<CreditLine>("CreditLine", {at: await stratosPool.creditLine()})

      while (!(await stratosCl.nextDueTime()).eq(await stratosCl.termEndTime())) {
        const nextDueTime = await stratosCl.nextDueTime()
        if (new BN(nextDueTime.toString()).gt(new BN((await getCurrentTimestamp()).toString()))) {
          await advanceTime({toSecond: nextDueTime.toString()})
        }

        await stratosPool.assess()
        const interestOwed = await stratosCl.interestOwed()
        await stratosBrwContract["pay(address,uint256)"](stratosPool.address, interestOwed)
      }

      const sharePriceBefore = await seniorPool.sharePrice()
      await advanceTime({toSecond: (await stratosCl.termEndTime()).toString()})
      await stratosPool.assess()
      await seniorPool.writedown(613)
      const sharePriceAfter = await seniorPool.sharePrice()

      // The bug caused the share price to tank when calling writedown after termEndTime
      // The expectation is that share price is unchanged.
      expect(sharePriceBefore).to.bignumber.eq(sharePriceAfter)
    })
  })

  describe("drawing down into another currency", async function () {
    let bwrCon: BorrowerInstance, oneSplit
    beforeEach(async () => {
      this.timeout(TEST_TIMEOUT)
      oneSplit = await IOneSplit.at(MAINNET_ONE_SPLIT_ADDRESS)
      bwrCon = await createBorrowerContract()
      ;({tranchedPool} = await createPoolWithCreditLine({
        people: {owner: MAINNET_GOVERNANCE_MULTISIG, borrower: bwrCon.address},
        usdc,
      }))
      await initializeTranchedPool(tranchedPool, bwrCon)
    })

    it("should let you drawdown to tether", async function () {
      const usdcAmount = usdcVal(10)
      const expectedReturn = await oneSplit.getExpectedReturn(usdc.address, usdt.address, usdcAmount, 10, 0, {
        from: bwr,
      })
      await expectAction(() => {
        return bwrCon.drawdownWithSwapOnOneInch(
          tranchedPool.address,
          usdcAmount,
          person3,
          usdt.address,
          expectedReturn.returnAmount.mul(new BN(99)).div(new BN(100)),
          expectedReturn.distribution,
          {from: bwr}
        )
      }).toChange([
        [async () => await getBalance(tranchedPool.address, usdc), {by: usdcAmount.neg()}],
        [async () => await getBalance(bwrCon.address, usdt), {by: new BN(0)}],
        [async () => await getBalance(person3, usdt), {byCloseTo: expectedReturn.returnAmount}],
        [async () => await getBalance(bwr, usdt), {by: new BN(0)}],
      ])
    }).timeout(TEST_TIMEOUT)

    describe("address forwarding", async () => {
      it("should support forwarding the money to another address", async () => {
        const usdcAmount = usdcVal(10)
        const expectedReturn = await oneSplit.getExpectedReturn(usdc.address, usdt.address, usdcAmount, 10, 0, {
          from: bwr,
        })
        await expectAction(() => {
          return bwrCon.drawdownWithSwapOnOneInch(
            tranchedPool.address,
            usdcAmount,
            person3,
            usdt.address,
            expectedReturn.returnAmount.mul(new BN(99)).div(new BN(100)),
            expectedReturn.distribution,
            {from: bwr}
          )
        }).toChange([
          [async () => await getBalance(tranchedPool.address, usdc), {by: usdcAmount.neg()}],
          [async () => await getBalance(person3, usdt), {byCloseTo: expectedReturn.returnAmount}],
          [async () => await getBalance(bwr, usdt), {by: new BN(0)}],
          [async () => await getBalance(bwrCon.address, usdt), {by: new BN(0)}],
        ])
      }).timeout(TEST_TIMEOUT)

      context("addressToSendTo is the contract address", async () => {
        it("should default to msg.sender", async function () {
          const usdcAmount = usdcVal(10)
          const expectedReturn = await oneSplit.getExpectedReturn(usdc.address, usdt.address, usdcAmount, 10, 0, {
            from: bwr,
          })
          await expectAction(() => {
            return bwrCon.drawdownWithSwapOnOneInch(
              tranchedPool.address,
              usdcAmount,
              bwrCon.address,
              usdt.address,
              expectedReturn.returnAmount.mul(new BN(99)).div(new BN(100)),
              expectedReturn.distribution,
              {from: bwr}
            )
          }).toChange([
            [async () => await getBalance(tranchedPool.address, usdc), {by: usdcAmount.neg()}],
            [async () => await getBalance(bwr, usdt), {byCloseTo: expectedReturn.returnAmount}],
            [async () => await getBalance(bwrCon.address, usdt), {by: new BN(0)}],
          ])
        }).timeout(TEST_TIMEOUT)
      })

      context("addressToSendTo is the zero address", async () => {
        it("should default to msg.sender", async () => {
          const usdcAmount = usdcVal(10)
          const expectedReturn = await oneSplit.getExpectedReturn(usdc.address, usdt.address, usdcAmount, 10, 0, {
            from: bwr,
          })
          await expectAction(() => {
            return bwrCon.drawdownWithSwapOnOneInch(
              tranchedPool.address,
              usdcAmount,
              ZERO_ADDRESS,
              usdt.address,
              expectedReturn.returnAmount.mul(new BN(99)).div(new BN(100)),
              expectedReturn.distribution,
              {from: bwr}
            )
          }).toChange([
            [async () => await getBalance(tranchedPool.address, usdc), {by: usdcAmount.neg()}],
            [async () => await getBalance(bwr, usdt), {byCloseTo: expectedReturn.returnAmount}],
            [async () => await getBalance(bwrCon.address, usdt), {by: new BN(0)}],
          ])
        }).timeout(TEST_TIMEOUT)
      })
    })

    it("should let you drawdown to BUSD", async function () {
      const usdcAmount = usdcVal(10)
      const expectedReturn = await oneSplit.getExpectedReturn(usdc.address, busd.address, usdcAmount, 10, 0, {
        from: bwr,
      })
      await expectAction(() => {
        return bwrCon.drawdownWithSwapOnOneInch(
          tranchedPool.address,
          usdcAmount,
          person3,
          busd.address,
          expectedReturn.returnAmount.mul(new BN(99)).div(new BN(100)),
          expectedReturn.distribution,
          {from: bwr}
        )
      }).toChange([
        [async () => await getBalance(tranchedPool.address, usdc), {by: usdcAmount.neg()}],
        [async () => await getBalance(person3, busd), {byCloseTo: expectedReturn.returnAmount}],
        [async () => await getBalance(bwr, busd), {by: new BN(0)}],
        [async () => await getBalance(bwrCon.address, busd), {by: new BN(0)}],
      ])
    }).timeout(TEST_TIMEOUT)
  })

  describe("paying back via another currency", async function () {
    let bwrCon, cl, oneSplit
    const amount = usdcVal(1)
    beforeEach(async function () {
      this.timeout(TEST_TIMEOUT)
      oneSplit = await IOneSplit.at(MAINNET_ONE_SPLIT_ADDRESS)
      bwrCon = await createBorrowerContract()
      ;({tranchedPool, creditLine: cl} = await createPoolWithCreditLine({
        people: {owner: MAINNET_GOVERNANCE_MULTISIG, borrower: bwrCon.address},
        usdc,
      }))

      await initializeTranchedPool(tranchedPool, bwrCon)
      await bwrCon.drawdown(tranchedPool.address, amount, bwr, {from: bwr})
    })

    it("should allow you to pay with another currency", async () => {
      await advanceAndMineBlock({toSecond: await cl.nextDueTime()})
      const interestOwed = await cl.interestOwed()
      const expectedReturn = await oneSplit.getExpectedReturn(usdt.address, usdc.address, interestOwed, 10, 0, {
        from: bwr,
      })

      await expectAction(() => {
        return bwrCon.payWithSwapOnOneInch(
          tranchedPool.address,
          interestOwed,
          usdt.address,
          expectedReturn.returnAmount.mul(new BN(99)).div(new BN(100)),
          expectedReturn.distribution,
          {from: bwr}
        )
      }).toChange([
        [async () => await getBalance(bwr, usdt), {by: interestOwed.neg()}],
        [async () => await cl.interestOwed(), {toCloseTo: ZERO, threshold: HALF_CENT}],
      ])
    }).timeout(TEST_TIMEOUT)

    it("Works with BUSD", async () => {
      const rawAmount = 1
      const busdAmount = bigVal(rawAmount)
      const expectedReturn = await oneSplit.getExpectedReturn(busd.address, usdc.address, busdAmount, 10, 0, {
        from: bwr,
      })
      await advanceAndMineBlock({toSecond: await cl.nextDueTime()})
      const interestOwed = await cl.interestOwed()
      await expectAction(() => {
        return bwrCon.payWithSwapOnOneInch(
          tranchedPool.address,
          busdAmount,
          busd.address,
          expectedReturn.returnAmount.mul(new BN(99)).div(new BN(100)),
          expectedReturn.distribution,
          {from: bwr}
        )
      }).toChange([
        [async () => await getBalance(bwr, busd), {by: busdAmount.neg()}],
        [async () => await cl.balance(), {decrease: true}],
        // It was an excess payment so we expect the interest to be fully cleared
        // (or decreased by the total interestOwed)
        [async () => await cl.interestOwed(), {byCloseTo: interestOwed.neg()}],
      ])
    }).timeout(TEST_TIMEOUT)

    describe("payMultipleWithSwapOnOneInch", async () => {
      let tranchedPool2, cl2
      const amount2 = usdcVal(2)

      beforeEach(async function () {
        this.timeout(TEST_TIMEOUT)
        ;({tranchedPool: tranchedPool2, creditLine: cl2} = await createPoolWithCreditLine({
          people: {owner: MAINNET_GOVERNANCE_MULTISIG, borrower: bwrCon.address},
          usdc,
        }))

        expect(cl.address).to.not.eq(cl2.addresss)
        expect(tranchedPool.address).to.not.eq(tranchedPool2.addresss)

        await initializeTranchedPool(tranchedPool2, bwrCon)
        await bwrCon.drawdown(tranchedPool2.address, amount2, bwr, {from: bwr})
      })

      it("should pay back multiple loans", async () => {
        await advanceAndMineBlock({toSecond: (await cl.nextDueTime()).add(new BN(1))})
        const padding = usdcVal(1)
        const originAmount = amount.add(amount2).add(padding)
        const expectedReturn = await oneSplit.getExpectedReturn(usdt.address, usdc.address, originAmount, 10, 0, {
          from: bwr,
        })

        await expectAction(() =>
          bwrCon.payMultipleWithSwapOnOneInch(
            [tranchedPool.address, tranchedPool2.address],
            [amount, amount2],
            originAmount,
            usdt.address,
            expectedReturn.distribution,
            {from: bwr}
          )
        ).toChange([
          // CreditLine should be paid down by `amount`
          [async () => await cl.interestOwed(), {to: ZERO}],
          [async () => await cl2.interestOwed(), {to: ZERO}],
          // Excess USDC from swap should be added to the first CreditLine's contract balance
          // rather than applied as payment
          [() => getBalance(bwr, usdt), {by: originAmount.neg()}],
          // Borrower con's usdc balance should increase because the excess usdt payment was converted
          // to an excess usdc payment and the usdc sits in the borrower contract.
          [() => getBalance(bwrCon.address, usdc), {increase: true}],
        ])
        expect(await getBalance(bwrCon.address, usdt)).to.bignumber.eq(new BN(0))
      }).timeout(TEST_TIMEOUT)
    })
  })

  describe("BackerRewards", () => {
    const microTolerance = String(1e5)
    const tolerance = String(1e14)
    let stakingRewardsEthers: StakingRewards
    let backerRewardsEthers: BackerRewards
    let tranchedPoolWithBorrowerConnected: TranchedPool
    let tranchedPoolWithOwnerConnected: TranchedPool
    let backerStakingTokenId: string
    let creditLine: CreditLine
    const trackedStakedAmount = usdcVal(2500)
    const untrackedStakedAmount = usdcVal(1000)
    const limit = trackedStakedAmount.add(untrackedStakedAmount).mul(new BN("5"))
    const setup = deployments.createFixture(async () => {
      const result = await goldfinchFactory.createPool(
        bwr,
        "20",
        limit.toString(),
        "100000000000000000",
        await getMonthlySchedule(goldfinchConfig, "12", "1", "6", "1"),
        "0",
        "0",
        ["0"],
        {from: await getProtocolOwner()}
      )
      const ownerSigner = asNonNullable(await getSignerForAddress(owner))
      const borrowerSigner = asNonNullable(await getSignerForAddress(bwr))
      assertNonNullable(result.logs)
      const event = result.logs[result.logs.length - 1] as unknown as PoolCreated

      const stakingRewardsEthers = await (
        await getEthersContract<StakingRewards>("StakingRewards", {at: stakingRewards.address})
      ).connect(ownerSigner)
      const backerRewardsEthers = await (
        await getEthersContract<BackerRewards>("BackerRewards", {at: backerRewards.address})
      ).connect(ownerSigner)
      const tranchedPoolWithBorrowerConnected = await (
        await getEthersContract<TranchedPool>("TranchedPool", {at: event.args.pool})
      ).connect(borrowerSigner)
      const creditLine = await getEthersContract<CreditLine>("CreditLine", {
        at: await tranchedPoolWithBorrowerConnected.creditLine(),
      })

      const tranchedPoolWithOwnerConnected = await tranchedPoolWithBorrowerConnected.connect(ownerSigner)

      await erc20Approve(usdc, tranchedPoolWithBorrowerConnected.address, MAX_UINT, [bwr, owner])
      // two token holders
      await (await tranchedPoolWithOwnerConnected.deposit(TRANCHES.Junior, String(untrackedStakedAmount))).wait()
      const depositTx = await (
        await tranchedPoolWithOwnerConnected.deposit(TRANCHES.Junior, String(trackedStakedAmount))
      ).wait()
      await (await tranchedPoolWithBorrowerConnected.lockJuniorCapital()).wait()
      await legacyGoldfinchConfig.addToGoList(circleEoa, {from: await getProtocolOwner()})
      await impersonateAccount(hre, circleEoa)
      await usdc.approve(seniorPool.address, usdcVal(20_000_000), {from: circleEoa})
      await seniorPool.deposit(usdcVal(20_000_000), {from: circleEoa})
      await seniorPool.invest(tranchedPoolWithBorrowerConnected.address, {from: owner})

      await erc20Approve(usdc, stakingRewardsEthers.address, MAX_UINT, [bwr, owner])
      await erc20Approve(gfi, stakingRewardsEthers.address, MAX_UINT, [bwr, owner])

      const topic = tranchedPoolWithBorrowerConnected.interface.getEventTopic("DepositMade")
      const rawEvent = depositTx.logs.find((x) => x.topics.indexOf(topic) >= 0)
      const parsedEvent = tranchedPoolWithBorrowerConnected.interface.parseLog(asNonNullable(rawEvent))
      const backerStakingTokenId = parsedEvent.args.tokenId

      return {
        backerStakingTokenId,
        tranchedPoolWithOwnerConnected,
        tranchedPoolWithBorrowerConnected,
        backerRewardsEthers,
        stakingRewardsEthers,
        creditLine,
      }
    })

    beforeEach(async () => {
      // eslint-disable-next-line @typescript-eslint/no-extra-semi
      ;({
        backerStakingTokenId,
        tranchedPoolWithOwnerConnected,
        tranchedPoolWithBorrowerConnected,
        backerRewardsEthers,
        stakingRewardsEthers,
        creditLine,
      } = await setup())
    })

    async function getStakingRewardsForToken(tokenId: string, blockNum?: number): Promise<BN> {
      const amount = await stakingRewardsEthers.earnedSinceLastCheckpoint(tokenId, {
        blockTag: blockNum,
      })

      return new BN(amount.toString())
    }

    async function getBackerStakingRewardsForToken(tokenId: string, blockNum?: number): Promise<BN> {
      const amount = await backerRewardsEthers.stakingRewardsEarnedSinceLastWithdraw(tokenId, {
        blockTag: blockNum,
      })

      return new BN(amount.toString())
    }

    async function expectRewardsAreEqualForTokens(
      stakingTokenId: string,
      backerTokenId: string,
      blockNum?: number,
      closeTo?: string
    ) {
      const stakingRewards = await getStakingRewardsForToken(stakingTokenId, blockNum)
      const backerStakingRewardsEarned = await getBackerStakingRewardsForToken(backerTokenId, blockNum)
      if (closeTo !== undefined) {
        expect(stakingRewards).to.bignumber.closeTo(backerStakingRewardsEarned, closeTo)
      } else {
        expect(stakingRewards).to.bignumber.eq(backerStakingRewardsEarned)
      }
    }

    function getStakingRewardTokenFromTransactionReceipt(tx: ContractReceipt): string {
      const topic = stakingRewardsEthers.interface.getEventTopic("Staked")
      const rawEvent = tx.logs.find((x) => x.topics.indexOf(topic) >= 0)
      const parsedEvent = stakingRewardsEthers.interface.parseLog(asNonNullable(rawEvent))
      return parsedEvent.args.tokenId
    }

    function getWithdrawnStakingAmountFromTransactionReceipt(tx: ContractReceipt) {
      const topic = backerRewardsEthers.interface.getEventTopic("BackerRewardsClaimed")
      const rawEvent = tx.logs.find((x) => x.topics.indexOf(topic) >= 0)
      const parsedEvent = backerRewardsEthers.interface.parseLog(asNonNullable(rawEvent))
      return parsedEvent.args.amountOfSeniorPoolRewards
    }

    async function payOffTranchedPoolInterest(tranchedPool: TranchedPool): Promise<ContractReceipt> {
      const creditLine = await getEthersContract<CreditLine>("CreditLine", {at: await tranchedPool.creditLine()})
      const interestOwed = await creditLine.interestOwed()
      return (await tranchedPool["pay(uint256)"](interestOwed.toString())).wait()
    }

    async function fullyRepayTranchedPool(tranchedPool: TranchedPool, at?: BigNumber): Promise<ContractReceipt> {
      await (await tranchedPool.assess()).wait()
      const creditLine = await getEthersContract<CreditLine>("CreditLine", {at: await tranchedPool.creditLine()})

      const principalOwed = await creditLine.principalOwedAt(`${(await getCurrentTimestamp()).add(new BN(1))}`)
      const interestOwed = await creditLine.interestOwedAt(`${(await getCurrentTimestamp()).add(new BN(1))}`)
      const totalOwed = principalOwed.add(interestOwed)

      const paymentTx = await tranchedPool["pay(uint256)"](totalOwed)

      const principalOwedAfterFinalRepayment = await creditLine.principalOwed()
      const interestOwedAfterFinalRepayment = await creditLine.interestOwed()
      expect(String(principalOwedAfterFinalRepayment)).to.bignumber.eq("0")
      expect(String(interestOwedAfterFinalRepayment)).to.bignumber.eq("0")

      return paymentTx.wait()
    }

    it("backers only earn rewards for full payments", async () => {
      await (await tranchedPoolWithBorrowerConnected.drawdown(String(limit))).wait()
      await advanceTime({toSecond: (await creditLine.nextDueTime()).toString()})
      const partialPaybackTx = await (await tranchedPoolWithBorrowerConnected["pay(uint256)"]("1")).wait()
      let backerRewardsEarned = await getBackerStakingRewardsForToken(
        backerStakingTokenId,
        partialPaybackTx.blockNumber
      )
      expect(backerRewardsEarned).to.bignumber.eq("0")

      const interestOwed = await creditLine.interestOwed()
      const fullPaybackTx = await (await tranchedPoolWithBorrowerConnected["pay(uint256)"](interestOwed)).wait()
      backerRewardsEarned = await getBackerStakingRewardsForToken(backerStakingTokenId, fullPaybackTx.blockNumber)
      expect(backerRewardsEarned).to.not.bignumber.eq("0")
    })

    it("behaves correctly, 1 slice, full drawdown", async () => {
      const [, stakingTx] = await mineInSameBlock(
        [
          // were staking another person here to make sure that each person receieves their proportional rewards,
          // and not that someone is receiving 100% of the rewards
          await stakingRewardsEthers.populateTransaction.depositAndStake(untrackedStakedAmount.toString()),
          await stakingRewardsEthers.populateTransaction.depositAndStake(trackedStakedAmount.toString()),
          await tranchedPoolWithBorrowerConnected.populateTransaction.drawdown(limit.toString()),
        ],
        this.timeout()
      )
      const stakingRewardsTokenId = getStakingRewardTokenFromTransactionReceipt(stakingTx as ContractReceipt)

      for (let i = 0; new BN(`${await getCurrentTimestamp()}`).lt(new BN(`${await creditLine.termEndTime()}`)); i++) {
        await advanceAndMineBlock({toSecond: (await creditLine.nextDueTime()).toString()})
        const payTx = await payOffTranchedPoolInterest(tranchedPoolWithBorrowerConnected)
        await (await tranchedPoolWithOwnerConnected.withdrawMax(backerStakingTokenId)).wait()
        await expectRewardsAreEqualForTokens(stakingRewardsTokenId, backerStakingTokenId, payTx.blockNumber)
      }

      const blockNumAtTermEnd = await ethers.provider.getBlockNumber()
      const stakingRewardsAtTermEnd = await getStakingRewardsForToken(stakingRewardsTokenId, blockNumAtTermEnd)

      // this section tests the final repayment
      // the final repayment is different because if the payment happens after the term is over
      // the backer rewards should be less
      const termEndTime = await creditLine.termEndTime()
      const thirtyDaysAfterTermEndTime = termEndTime.add("2592000") // 30 days in seconds
      await advanceAndMineBlock({toSecond: thirtyDaysAfterTermEndTime.toString()})
      // Going to fully repay tranched pool
      const paymentTx = await fullyRepayTranchedPool(tranchedPoolWithBorrowerConnected)

      const backerStakingRewardsEarnedAfterFinalRepayment = await getBackerStakingRewardsForToken(
        backerStakingTokenId,
        paymentTx.blockNumber
      )
      expect(backerStakingRewardsEarnedAfterFinalRepayment).to.bignumber.closeTo(
        stakingRewardsAtTermEnd,
        microTolerance
      )

      // Even long after the final repayment where there was no outstanding principal
      // You should have accrued no rewards during that time
      await advanceAndMineBlock({days: "365"})
      const muchLaterBlockNumber = await ethers.provider.getBlockNumber()
      const backerStakingRewardsEarnedMuchLater = await getBackerStakingRewardsForToken(
        backerStakingTokenId,
        muchLaterBlockNumber
      )
      expect(backerStakingRewardsEarnedMuchLater).to.bignumber.eq(backerStakingRewardsEarnedAfterFinalRepayment)

      const withdrawTx = await (await backerRewardsEthers.withdraw(backerStakingTokenId)).wait()
      const amountOfStakingRewardsWithdrawn = getWithdrawnStakingAmountFromTransactionReceipt(withdrawTx)
      expect(backerStakingRewardsEarnedMuchLater).to.bignumber.eq(String(amountOfStakingRewardsWithdrawn))
    }).timeout(TEST_TIMEOUT)

    it("behaves correctly, 1 slice, two partial drawdowns", async () => {
      // person we dont care about but is participating in the pool to make sure
      // that other people are receieving staking rewards
      const firstStakedAmount = trackedStakedAmount.div(new BN("2"))
      const firstUntrackedStakedAmount = untrackedStakedAmount.div(new BN("2"))
      const firstDrawdownAmount = limit.div(new BN("2"))
      const [, initialStakeTx] = await mineInSameBlock(
        [
          await stakingRewardsEthers.populateTransaction.depositAndStake(String(firstUntrackedStakedAmount)),
          await stakingRewardsEthers.populateTransaction.depositAndStake(String(firstStakedAmount)),
          await tranchedPoolWithBorrowerConnected.populateTransaction.drawdown(String(firstDrawdownAmount)),
        ],
        this.timeout()
      )
      expect(String(firstDrawdownAmount)).to.bignumber.lt(new BN(await (await creditLine.limit()).toString()))
      const stakingRewardsTokenId = getStakingRewardTokenFromTransactionReceipt(initialStakeTx as ContractReceipt)

      let backerStakingRewardsEarned = await getBackerStakingRewardsForToken(
        backerStakingTokenId,
        initialStakeTx?.blockNumber
      )
      let stakingRewardsEarned = await getStakingRewardsForToken(stakingRewardsTokenId, initialStakeTx?.blockNumber)

      expect(backerStakingRewardsEarned).to.bignumber.eq("0")
      expect(stakingRewardsEarned).to.bignumber.eq("0")

      // Run through the first half of payments normally
      for (let i = 0; i < 6; i++) {
        await advanceAndMineBlock({toSecond: `${await creditLine.nextDueTime()}`})
        const payTx = await payOffTranchedPoolInterest(tranchedPoolWithBorrowerConnected)
        stakingRewardsEarned = await getStakingRewardsForToken(stakingRewardsTokenId, payTx.blockNumber)
        backerStakingRewardsEarned = await getBackerStakingRewardsForToken(backerStakingTokenId, payTx.blockNumber)
        expect(backerStakingRewardsEarned).to.bignumber.closeTo(stakingRewardsEarned, microTolerance)
      }

      // we need to stake the equivalent amount drawndown
      const secondStakedAmount = firstStakedAmount.div(new BN("2")) // 1 / 4
      const secondUntrackedStakedAmount = firstUntrackedStakedAmount.div(new BN("2")) // (1 / 2) / 2 = 1/4
      const secondDrawdownAmount = limit.div(new BN("4")) // 1 / 4
      expect(secondDrawdownAmount.add(firstDrawdownAmount)).to.bignumber.lt(
        new BN((await creditLine.limit()).toString())
      )
      const [, secondStakeTx] = await mineInSameBlock(
        [
          await stakingRewardsEthers.populateTransaction.depositAndStake(secondUntrackedStakedAmount.toString()),
          await stakingRewardsEthers.populateTransaction.depositAndStake(secondStakedAmount.toString()),
          await tranchedPoolWithBorrowerConnected.populateTransaction.drawdown(secondDrawdownAmount.toString()),
        ],
        this.timeout()
      )

      const secondStakingTokenId = getStakingRewardTokenFromTransactionReceipt(secondStakeTx as ContractReceipt)
      const backerStakingRewardsEarnedAfterSecondDrawdown = await getBackerStakingRewardsForToken(
        backerStakingTokenId,
        secondStakeTx?.blockNumber
      )

      // check that the backer doesnt earn rewards on a drawdown
      expect(backerStakingRewardsEarnedAfterSecondDrawdown).to.bignumber.eq(backerStakingRewardsEarned)

      // second half of the payments
      for (let i = 0; i < 6; i++) {
        await advanceAndMineBlock({toSecond: `${await creditLine.nextDueTime()}`})
        const payTx = await payOffTranchedPoolInterest(tranchedPoolWithBorrowerConnected)
        // withdraw to make sure that the backer originally backer wont have less rewards
        // when their unutilized capital is removed from the pool
        await (await tranchedPoolWithOwnerConnected.withdrawMax(backerStakingTokenId)).wait()
        stakingRewardsEarned = await getStakingRewardsForToken(stakingRewardsTokenId, payTx.blockNumber)
        const secondStakingRewardsEarned = await getStakingRewardsForToken(secondStakingTokenId, payTx.blockNumber)
        backerStakingRewardsEarned = await getBackerStakingRewardsForToken(backerStakingTokenId, payTx.blockNumber)

        expect(backerStakingRewardsEarned).to.bignumber.closeTo(
          stakingRewardsEarned.add(secondStakingRewardsEarned),
          microTolerance
        )
      }

      // await advanceTime({toSecond: termEndTime.toString()})
      // await mineBlock()
      const stakingRewardsAtTermEnd = await getStakingRewardsForToken(stakingRewardsTokenId)
      const secondStakingRewardsAtTermEnd = await getStakingRewardsForToken(secondStakingTokenId)

      // this section tests the final repayment
      // the final repayment is different because if the payment happens after the term is over
      // the backer rewards should be less
      const termEndTime = await creditLine.termEndTime()
      const thirtyDaysAfterTermEnd = termEndTime.add("2592000") // < 30 days in seconds
      await advanceAndMineBlock({toSecond: thirtyDaysAfterTermEnd.toString()})
      const payTx = await fullyRepayTranchedPool(tranchedPoolWithBorrowerConnected)
      const backerStakingRewardsEarnedAfterFinalRepayment = await getBackerStakingRewardsForToken(
        backerStakingTokenId,
        payTx.blockNumber
      )

      expect(backerStakingRewardsEarnedAfterFinalRepayment).to.bignumber.closeTo(
        stakingRewardsAtTermEnd.add(secondStakingRewardsAtTermEnd),
        microTolerance
      )

      // Even long after the final repayment where there was no outstanding principal
      // You should have accrued no rewards during that time
      await advanceAndMineBlock({days: "365"})
      const backerStakingRewardsEarnedMuchLater = await getBackerStakingRewardsForToken(backerStakingTokenId)
      expect(backerStakingRewardsEarnedMuchLater).to.bignumber.eq(backerStakingRewardsEarnedAfterFinalRepayment)
    }).timeout(TEST_TIMEOUT)

    // FAILING WITH THE GP Error
    it("behaves correctly, 2 slices, full drawdown", async () => {
      const [, stakingTx] = await mineInSameBlock(
        [
          // we're staking another person here to make sure that each person receives their proportional rewards,
          // and that no one is receiving 100% of the rewards
          await stakingRewardsEthers.populateTransaction.depositAndStake(untrackedStakedAmount.toString()),
          await stakingRewardsEthers.populateTransaction.depositAndStake(trackedStakedAmount.toString()),
          await tranchedPoolWithBorrowerConnected.populateTransaction.drawdown(limit.toString()),
        ],
        this.timeout()
      )
      const stakingRewardsTokenId = getStakingRewardTokenFromTransactionReceipt(stakingTx as ContractReceipt)

      for (let i = 0; i < 5; i++) {
        await advanceAndMineBlock({toSecond: `${await creditLine.nextDueTime()}`})
        const payTx = await payOffTranchedPoolInterest(tranchedPoolWithBorrowerConnected)
        await (await tranchedPoolWithOwnerConnected.withdrawMax(backerStakingTokenId)).wait()
        expect((await getBackerStakingRewardsForToken(backerStakingTokenId, payTx.blockNumber)).gt(new BN(0)))
        await expectRewardsAreEqualForTokens(stakingRewardsTokenId, backerStakingTokenId, payTx.blockNumber)
      }

      const tranchedPoolTruffle = await getTruffleContract<TranchedPoolInstance>("TranchedPool", {
        at: tranchedPoolWithBorrowerConnected.address,
      })
      await tranchedPoolTruffle.setMaxLimit(limit.mul(new BN("2")), {from: await getProtocolOwner()})
      await tranchedPoolWithBorrowerConnected.initializeNextSlice("1")

      const secondJuniorTrancheId = 4
      await (
        await tranchedPoolWithOwnerConnected.deposit(secondJuniorTrancheId, untrackedStakedAmount.toString())
      ).wait()
      const secondDepositTx = await (
        await tranchedPoolWithOwnerConnected.deposit(secondJuniorTrancheId, trackedStakedAmount.toString())
      ).wait()
      const secondJuniorTranche = await tranchedPoolWithOwnerConnected.getTranche(secondJuniorTrancheId)
      expect(secondJuniorTranche.principalDeposited.toString()).to.eq(
        untrackedStakedAmount.add(trackedStakedAmount).toString()
      )

      const events = await tranchedPoolWithBorrowerConnected.queryFilter(
        tranchedPoolWithBorrowerConnected.filters.DepositMade(owner),
        secondDepositTx.blockNumber
      )
      const depositMadeEvent = asNonNullable(events[0])
      expect(depositMadeEvent).to.not.be.undefined
      expect(depositMadeEvent.args.tranche.toString()).to.eq("4")
      const secondSliceDepositTokenId = depositMadeEvent.args.tokenId

      await (await tranchedPoolWithBorrowerConnected.lockJuniorCapital()).wait()
      // Deposit more funds into the senior pool. Cannot fund with whales because the senior
      // pool now tracks its usdcBalance with a separate varaible
      await usdc.approve(seniorPool.address, usdcVal(20_000_000), {from: circleEoa})
      await seniorPool.deposit(usdcVal(20_000_000), {from: circleEoa})

      await seniorPool.invest(tranchedPoolWithBorrowerConnected.address, {from: bwr.address})

      const [, secondSliceStakingTx] = await mineInSameBlock(
        [
          await stakingRewardsEthers.populateTransaction.depositAndStake(untrackedStakedAmount.toString()),
          await stakingRewardsEthers.populateTransaction.depositAndStake(trackedStakedAmount.toString()),
          await tranchedPoolWithBorrowerConnected.populateTransaction.drawdown(limit.toString()),
        ],
        this.timeout()
      )

      const balance = await creditLine.balance()
      expect(balance.toString()).to.eq(limit.mul(new BN(2)).toString())
      expect(balance.toString()).to.eq((await creditLine.limit()).toString())
      const secondSliceStakingRewardsTokenId = getStakingRewardTokenFromTransactionReceipt(
        asNonNullable(secondSliceStakingTx)
      )
      // no rewards should be accrued before the first repayment comes back
      expect(
        await backerRewards.stakingRewardsEarnedSinceLastWithdraw(secondSliceDepositTokenId.toString())
      ).to.bignumber.eq("0")

      for (let i = 0; i < 7; i++) {
        await advanceAndMineBlock({toSecond: `${await creditLine.nextDueTime()}`})
        const payTx = await payOffTranchedPoolInterest(tranchedPoolWithBorrowerConnected)
        // withdraw, as a way of establishing that a backer who removed their unutilized capital
        // would not receive less rewards as a consequence
        await (await tranchedPoolWithOwnerConnected.withdrawMax(backerStakingTokenId)).wait()
        await (await tranchedPoolWithOwnerConnected.withdrawMax(secondSliceDepositTokenId)).wait()

        expect((await getBackerStakingRewardsForToken(backerStakingTokenId, payTx.blockNumber)).gt(new BN(0)))
        await expectRewardsAreEqualForTokens(stakingRewardsTokenId, backerStakingTokenId, payTx.blockNumber, tolerance)

        expect(
          (await getBackerStakingRewardsForToken(secondSliceDepositTokenId.toString(), payTx.blockNumber)).gt(new BN(0))
        )
        await expectRewardsAreEqualForTokens(
          secondSliceStakingRewardsTokenId,
          secondSliceDepositTokenId.toString(),
          payTx.blockNumber,
          tolerance
        )
      }

      const termEndTime = await creditLine.termEndTime()
      const blockNumAtTermEnd = await ethers.provider.getBlockNumber()
      const firstSliceStakingRewardsAtTermEnd = await getStakingRewardsForToken(
        stakingRewardsTokenId,
        blockNumAtTermEnd
      )
      const secondSliceStakingRewardsAtTermEnd = await getStakingRewardsForToken(
        secondSliceStakingRewardsTokenId,
        blockNumAtTermEnd
      )

      // this section tests the final repayment
      // the final repayment is different because if the payment happens after the term is over
      // the backer rewards should be less
      const thirtyDaysAfterTermEndTime = termEndTime.add("2592000") // 30 days in seconds
      await advanceTime({toSecond: thirtyDaysAfterTermEndTime.toString()})
      const paymentTx = await fullyRepayTranchedPool(tranchedPoolWithBorrowerConnected)

      const firstSliceStakingRewardsEarnedAfterFinalRepayment = await getBackerStakingRewardsForToken(
        backerStakingTokenId,
        paymentTx.blockNumber
      )
      expect(firstSliceStakingRewardsEarnedAfterFinalRepayment).to.bignumber.closeTo(
        firstSliceStakingRewardsAtTermEnd,
        tolerance
      )

      const secondSliceStakingRewardsEarnedAfterFinalRepayment = await getBackerStakingRewardsForToken(
        secondSliceDepositTokenId.toString(),
        paymentTx.blockNumber
      )
      expect(secondSliceStakingRewardsEarnedAfterFinalRepayment).to.bignumber.closeTo(
        secondSliceStakingRewardsAtTermEnd,
        tolerance
      )

      // Even long after the final repayment where there was no outstanding principal
      // You should have accrued no rewards during that time
      await advanceAndMineBlock({days: "365"})
      const muchLaterBlockNumber = await ethers.provider.getBlockNumber()
      const firstSliceStakingRewardsEarnedMuchLater = await getBackerStakingRewardsForToken(
        backerStakingTokenId,
        muchLaterBlockNumber
      )
      expect(firstSliceStakingRewardsEarnedMuchLater).to.bignumber.eq(firstSliceStakingRewardsEarnedAfterFinalRepayment)

      const secondSliceStakingRewardsEarnedMuchLater = await getBackerStakingRewardsForToken(
        secondSliceDepositTokenId.toString(),
        muchLaterBlockNumber
      )
      expect(secondSliceStakingRewardsEarnedMuchLater).to.bignumber.eq(
        secondSliceStakingRewardsEarnedAfterFinalRepayment
      )

      const firstSliceWithdrawTx = await (await backerRewardsEthers.withdraw(backerStakingTokenId)).wait()
      const firstSliceAmountOfStakingRewardsWithdrawn =
        getWithdrawnStakingAmountFromTransactionReceipt(firstSliceWithdrawTx)
      expect(firstSliceStakingRewardsEarnedMuchLater).to.bignumber.eq(String(firstSliceAmountOfStakingRewardsWithdrawn))

      const secondSliceWithdrawTx = await (
        await backerRewardsEthers.withdraw(secondSliceDepositTokenId.toString())
      ).wait()
      const secondSliceAmountOfStakingRewardsWithdrawn =
        getWithdrawnStakingAmountFromTransactionReceipt(secondSliceWithdrawTx)
      expect(secondSliceStakingRewardsEarnedMuchLater).to.bignumber.eq(
        String(secondSliceAmountOfStakingRewardsWithdrawn)
      )
    }).timeout(TEST_TIMEOUT)

    describe("before drawdown", async () => {
      it("when a user withdraws they should earn 0 rewards", async () => {
        const backerStakingRewardsEarned = await backerRewards.stakingRewardsEarnedSinceLastWithdraw(
          backerStakingTokenId
        )
        expect(backerStakingRewardsEarned).to.bignumber.eq("0")
        const withdrawTx = await (await backerRewardsEthers.withdraw(backerStakingTokenId)).wait()
        const rewardsWithdrawn = getWithdrawnStakingAmountFromTransactionReceipt(withdrawTx)
        expect(String(rewardsWithdrawn)).to.bignumber.eq("0")
      })
    })

    describe("after drawdown but before the first payment", () => {
      beforeEach(async () => {
        const limit = await creditLine.maxLimit()
        tranchedPoolWithBorrowerConnected.drawdown(limit.toString())
      })

      it("backers should earned 0 rewards", async () => {
        const backerStakingRewardsEarned = await getBackerStakingRewardsForToken(backerStakingTokenId)
        expect(backerStakingRewardsEarned).to.bignumber.eq("0")
        const withdrawTx = await (await backerRewardsEthers.withdraw(backerStakingTokenId)).wait()
        const rewardsWithdrawn = getWithdrawnStakingAmountFromTransactionReceipt(withdrawTx)
        expect(String(rewardsWithdrawn)).to.bignumber.eq("0")
      })
    })
  })

  describe("integration tests", async () => {
    let bwrCon: BorrowerInstance
    describe("as a not user on the go list and without a UID", async () => {
      let unGoListedUser: string

      beforeEach(async () => {
        const [, , , maybeUser] = await hre.getUnnamedAccounts()
        unGoListedUser = asNonNullable(maybeUser)
        ;({tranchedPool} = await createPoolWithCreditLine({
          people: {borrower: bwr, owner: MAINNET_GOVERNANCE_MULTISIG},
          usdc,
        }))
        await fundWithWhales(["USDC"], [unGoListedUser])
        await erc20Approve(usdc, seniorPool.address, MAX_UINT, [unGoListedUser])
        await erc20Approve(usdc, tranchedPool.address, MAX_UINT, [unGoListedUser])
        await erc20Approve(usdc, stakingRewards.address, MAX_UINT, [unGoListedUser])
        await expect(go.go(unGoListedUser)).to.eventually.be.false
      })

      describe("when I deposit and subsequently withdraw into the senior pool", async () => {
        it("it reverts", async () => {
          await expect(seniorPool.deposit(usdcVal(10), {from: unGoListedUser})).to.be.rejected
          await expect(seniorPool.withdraw(usdcVal(10), {from: unGoListedUser})).to.be.rejected
        })
      })

      describe("when I deposit and subsequently withdraw from a tranched pool's junior tranche", async () => {
        it("it reverts", async () => {
          await expect(tranchedPool.deposit(TRANCHES.Junior, usdcVal(10), {from: unGoListedUser})).to.be.rejected
          await expect(tranchedPool.withdraw(new BN("0"), usdcVal(10), {from: unGoListedUser})).to.be.rejected
        })
      })

      describe("when I deposit and stake", async () => {
        it("it reverts", async () => {
          await expect(stakingRewards.depositAndStake(usdcVal(10), {from: unGoListedUser})).to.be.rejectedWith(/GL/i)
        })
      })
    })

    describe("as a user on the go list", async () => {
      let goListedUser: string

      beforeEach(async () => {
        const [, , , , maybeUser, maybeBorrower] = await hre.getUnnamedAccounts()
        goListedUser = asNonNullable(maybeUser)
        borrower = asNonNullable(maybeBorrower)
        ;({tranchedPool} = await createPoolWithCreditLine({
          people: {borrower, owner: MAINNET_GOVERNANCE_MULTISIG},
          usdc,
        }))
        await fundWithWhales(["USDC"], [goListedUser])
        const goldfinchConfigWithGoListAddress = await go.legacyGoList()
        const goldfinchConfigWithGoList = await getTruffleContract<GoldfinchConfigInstance>("GoldfinchConfig", {
          at: goldfinchConfigWithGoListAddress,
        })
        await goldfinchConfigWithGoList.addToGoList(goListedUser)
        await erc20Approve(usdc, seniorPool.address, MAX_UINT, [goListedUser])
        await erc20Approve(usdc, tranchedPool.address, MAX_UINT, [goListedUser])
        await erc20Approve(usdc, stakingRewards.address, MAX_UINT, [goListedUser])
        await expect(go.go(goListedUser)).to.eventually.be.true
      })

      describe("when I deposit and subsequently withdraw from a tranched pool's junior tranche", async () => {
        it("it works", async () => {
          const tx = await expect(tranchedPool.deposit(TRANCHES.Junior, usdcVal(10), {from: goListedUser})).to.be
            .fulfilled
          const logs = decodeLogs<DepositMade>(tx.receipt.rawLogs, tranchedPool, "DepositMade")
          let depositMadeEvent = logs[0]
          expect(depositMadeEvent).to.not.be.undefined
          depositMadeEvent = asNonNullable(depositMadeEvent)
          const tokenId = depositMadeEvent.args.tokenId
          await expect(tranchedPool.withdraw(tokenId, usdcVal(10), {from: goListedUser})).to.be.fulfilled
        })
      })

      describe("when I deposit and stake and then exit", async () => {
        it("it works", async () => {
          const depositAmount = usdcVal(10_000)
          const tx = await expect(stakingRewards.depositAndStake(depositAmount, {from: goListedUser})).to.be.fulfilled
          const logs = decodeLogs<Staked>(tx.receipt.rawLogs, stakingRewards, "Staked")
          const stakedEvent = asNonNullable(logs[0])
          const tokenId = stakedEvent?.args.tokenId
          await expect(stakingRewards.unstake(tokenId, depositAmount, {from: goListedUser})).to.be.fulfilled
        })
      })

      describe("when I deposit and stake, and then zap to Curve", async () => {
        beforeEach(async () => {
          await erc20Approve(usdc, seniorPool.address, MAX_UINT, [owner])
          await erc20Approve(usdc, stakingRewards.address, MAX_UINT, [goListedUser, owner])
          await erc20Approve(usdc, zapper.address, MAX_UINT, [goListedUser])
          await erc20Approve(fidu, stakingRewards.address, MAX_UINT, [goListedUser, owner])

          // Seed the Curve pool with funds
          await erc20Approve(usdc, curvePool.address, MAX_UINT, [owner])
          await erc20Approve(fidu, curvePool.address, MAX_UINT, [owner])
          await fundWithWhales(["USDC"], [owner])
          await seniorPool.deposit(usdcVal(100_000), {from: owner})
          await curvePool.add_liquidity([bigVal(10_000), usdcVal(10_000)], new BN(0), false, owner, {
            from: owner,
          })
        })

        context("for a FIDU only migration", async () => {
          it("it works", async () => {
            const curveFiduBalanceBefore = await curvePool.balances(0)
            const curveUSDCBalanceBefore = await curvePool.balances(1)

            // Deposit and stake
            const tx = await expect(stakingRewards.depositAndStake(usdcVal(10_000), {from: goListedUser})).to.be
              .fulfilled
            const stakedEvent = decodeAndGetFirstLog<Staked>(tx.receipt.rawLogs, stakingRewards, "Staked")
            const tokenId = stakedEvent.args.tokenId

            // Zap to curve
            await erc721Approve(stakingRewards, zapper.address, tokenId, [goListedUser])
            const zapperTx = await expect(
              zapper.zapStakeToCurve(tokenId, new BN(stakedEvent?.args.amount.toString(10)), new BN(0), {
                from: goListedUser,
              })
            ).to.be.fulfilled

            const unstakedLog = await decodeAndGetFirstLog<Unstaked>(
              zapperTx.receipt.rawLogs,
              stakingRewards,
              "Unstaked"
            )
            expect(unstakedLog.args.tokenId).to.bignumber.equal(tokenId)
            expect(unstakedLog.args.amount).to.bignumber.equal(new BN(stakedEvent.args.amount.toString(10)))

            const depositedToCurveAndStakeLog = await decodeAndGetFirstLog<DepositedToCurveAndStaked>(
              zapperTx.receipt.rawLogs,
              stakingRewards,
              "DepositedToCurveAndStaked"
            )
            expect(depositedToCurveAndStakeLog.args.fiduAmount).to.bignumber.equal(
              new BN(stakedEvent.args.amount.toString(10))
            )
            expect(depositedToCurveAndStakeLog.args.usdcAmount).to.bignumber.equal(new BN(0))

            const curveFiduBalanceAfter = await curvePool.balances(0)
            const curveUSDCBalanceAfter = await curvePool.balances(1)
            expect(curveFiduBalanceAfter.sub(curveFiduBalanceBefore)).to.bignumber.equal(
              depositedToCurveAndStakeLog.args.fiduAmount
            )
            expect(curveUSDCBalanceAfter.sub(curveUSDCBalanceBefore)).to.bignumber.equal(new BN(0))
          })
        })

        context("for a FIDU with USDC migration", async () => {
          it("it works", async () => {
            const curveFiduBalanceBefore = await curvePool.balances(0)
            const curveUSDCBalanceBefore = await curvePool.balances(1)
            await erc20Transfer(usdc, [goListedUser], usdcVal(1_000), owner)

            // Deposit and stake
            const tx = await expect(stakingRewards.depositAndStake(usdcVal(100), {from: goListedUser})).to.be.fulfilled
            const stakedEvent = decodeAndGetFirstLog<Staked>(tx.receipt.rawLogs, stakingRewards, "Staked")
            const tokenId = stakedEvent.args.tokenId

            // Zap to curve
            await erc721Approve(stakingRewards, zapper.address, tokenId, [goListedUser])
            const zapperTx = await expect(
              zapper.zapStakeToCurve(tokenId, new BN(stakedEvent?.args.amount.toString(10)), usdcVal(100), {
                from: goListedUser,
              })
            ).to.be.fulfilled

            const unstakedLog = await decodeAndGetFirstLog<Unstaked>(
              zapperTx.receipt.rawLogs,
              stakingRewards,
              "Unstaked"
            )
            expect(unstakedLog.args.tokenId).to.bignumber.equal(tokenId)
            expect(unstakedLog.args.amount).to.bignumber.equal(new BN(stakedEvent.args.amount.toString(10)))

            const depositedToCurveAndStakeLog = await decodeAndGetFirstLog<DepositedToCurveAndStaked>(
              zapperTx.receipt.rawLogs,
              stakingRewards,
              "DepositedToCurveAndStaked"
            )
            expect(depositedToCurveAndStakeLog.args.fiduAmount).to.bignumber.equal(
              new BN(stakedEvent.args.amount.toString(10))
            )
            expect(depositedToCurveAndStakeLog.args.usdcAmount).to.bignumber.equal(usdcVal(100))

            const curveFiduBalanceAfter = await curvePool.balances(0)
            const curveUSDCBalanceAfter = await curvePool.balances(1)
            expect(curveFiduBalanceAfter.sub(curveFiduBalanceBefore)).to.bignumber.equal(
              depositedToCurveAndStakeLog.args.fiduAmount
            )
            expect(curveUSDCBalanceAfter.sub(curveUSDCBalanceBefore)).to.bignumber.equal(
              depositedToCurveAndStakeLog.args.usdcAmount
            )
          })
        })
      })
    })

    describe("as a go listed borrower", async () => {
      describe("with a pool that I don't own", async () => {
        beforeEach(async () => {
          // eslint-disable-next-line @typescript-eslint/no-extra-semi
          ;({tranchedPool} = await createPoolWithCreditLine({
            people: {
              owner: MAINNET_GOVERNANCE_MULTISIG,
              borrower: person3,
            },
            usdc,
          }))
          bwr = person3
          bwrCon = await createBorrowerContract()
          await erc20Approve(usdc, tranchedPool.address, MAX_UINT, [bwr, owner])
          await erc20Approve(usdc, bwrCon.address, MAX_UINT, [bwr, owner])
          await tranchedPool.deposit(TRANCHES.Junior, usdcVal(100), {from: owner})
          await tranchedPool.lockJuniorCapital({from: MAINNET_GOVERNANCE_MULTISIG})
          await tranchedPool.grantRole(await tranchedPool.SENIOR_ROLE(), owner, {from: MAINNET_GOVERNANCE_MULTISIG})
          await tranchedPool.deposit(TRANCHES.Senior, usdcVal(300), {from: owner})
          await tranchedPool.revokeRole(await tranchedPool.SENIOR_ROLE(), owner, {from: MAINNET_GOVERNANCE_MULTISIG})
          await tranchedPool.lockPool({from: MAINNET_GOVERNANCE_MULTISIG})
        })

        describe("when I try to withdraw", async () => {
          it("it fails", async () => {
            await expect(bwrCon.drawdown(tranchedPool.address, usdcVal(400), bwr, {from: bwr})).to.be.rejectedWith(/NA/)
          })
        })
      })

      describe("with a pool that I own", async () => {
        let backerTokenId
        beforeEach(async () => {
          // eslint-disable-next-line @typescript-eslint/no-extra-semi
          ;({tranchedPool} = await createPoolWithCreditLine({
            people: {
              owner: MAINNET_GOVERNANCE_MULTISIG,
              borrower: bwr,
            },
            usdc,
          }))
          await erc20Approve(usdc, tranchedPool.address, MAX_UINT, [bwr, owner])
          await erc20Approve(usdc, bwrCon.address, MAX_UINT, [bwr, owner])
          const tx = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(2_500), {from: owner})
          const logs = decodeLogs<DepositMade>(tx.receipt.rawLogs, tranchedPool, "DepositMade")
          const depositMadeEvent = asNonNullable(logs[0])
          backerTokenId = depositMadeEvent.args.tokenId
          await tranchedPool.lockJuniorCapital({from: bwr})
          await tranchedPool.grantRole(await tranchedPool.SENIOR_ROLE(), owner, {from: MAINNET_GOVERNANCE_MULTISIG})
          await tranchedPool.deposit(TRANCHES.Senior, usdcVal(7_500), {from: owner})
          await tranchedPool.revokeRole(await tranchedPool.SENIOR_ROLE(), owner, {from: MAINNET_GOVERNANCE_MULTISIG})
          await tranchedPool.lockPool({from: bwr})
        })

        describe("if backerrewards contract is configured", () => {
          beforeEach(async () => {
            const totalRewards = 1_000
            const maxInterestDollarsEligible = 1_000_000_000
            const protocolOwner = await getProtocolOwner()
            await backerRewards.setMaxInterestDollarsEligible(bigVal(maxInterestDollarsEligible), {from: protocolOwner})
            await backerRewards.setTotalRewards(bigVal(Math.round(totalRewards * 100)).div(new BN(100)), {
              from: protocolOwner,
            })
            await backerRewards.setTotalInterestReceived(usdcVal(0), {from: protocolOwner})
          })

          it("properly allocates rewards", async () => {
            await expect(bwrCon.drawdown(tranchedPool.address, usdcVal(10_000), bwr, {from: bwr})).to.be.fulfilled
            await advanceTime({days: 90})
            await ethers.provider.send("evm_mine", [])
            await expect(bwrCon.methods["pay(address,uint256)"](tranchedPool.address, usdcVal(10_000), {from: bwr})).to
              .be.fulfilled

            // verify accRewardsPerPrincipalDollar
            const accRewardsPerPrincipalDollar = await backerRewards.pools(tranchedPool.address)
            expect(accRewardsPerPrincipalDollar).to.bignumber.equal(new BN(0))

            // verify claimable rewards
            const expectedPoolTokenClaimableRewards = await backerRewards.poolTokenClaimableRewards(backerTokenId)
            expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(new BN(0))
          })
        })

        describe("if backerrewards contract is not configured", () => {
          describe("when I drawdown and pay back", async () => {
            it("it works", async () => {
              await expect(bwrCon.drawdown(tranchedPool.address, usdcVal(10_000), bwr, {from: bwr})).to.be.fulfilled
              await advanceTime({days: 90})
              await ethers.provider.send("evm_mine", [])
              await expect(bwrCon.methods["pay(address,uint256)"](tranchedPool.address, usdcVal(10_000), {from: bwr}))
                .to.be.fulfilled
              const rewards = await expect(backerRewards.poolTokenClaimableRewards(backerTokenId)).to.be.fulfilled
              // right now rewards rates aren't set, so no rewards should be claimable
              expect(rewards).to.bignumber.eq("0")
            })
          })
        })
      })
    })
  })

  describe("CommunityRewards", () => {
    describe("claimableRewards", () => {
      // no vesting to merkle direct distributor balance
      describe.skip("MerkleDistributor", () => {
        it("proper reward allocation for users claimable", async () => {
          const vestingGrantsJson: MerkleDistributorInfo = JSON.parse(
            await fs.readFile(VESTING_MERKLE_INFO_PATH, {
              encoding: "utf8",
            })
          )
          await advanceTime({toSecond: new BN(TOKEN_LAUNCH_TIME)})
          await ethers.provider.send("evm_mine", [])

          // randomly sample 50 grants
          const sampledGrants = _.sampleSize(vestingGrantsJson.grants, 50)
          for (const grant of sampledGrants) {
            const {
              index,
              proof,
              account: recipient,
              grant: {amount, vestingLength, cliffLength, vestingInterval},
            } = grant

            const rewardsAvailableBefore = await communityRewards.rewardsAvailable()
            const recipientBalanceBefore = await gfi.balanceOf(recipient)

            await impersonateAccount(hre, recipient)
            await fundWithWhales(["ETH"], [recipient])
            try {
              const receipt = await merkleDistributor.acceptGrant(
                index,
                amount,
                vestingLength,
                cliffLength,
                vestingInterval,
                proof,
                {from: recipient}
              )
              const grantedEvent = getOnlyLog<Granted>(decodeLogs(receipt.receipt.rawLogs, communityRewards, "Granted"))
              const tokenId = grantedEvent.args.tokenId

              // verify grant properties
              const grantState = await communityRewards.grants(tokenId)
              assertCommunityRewardsVestingRewards(grantState)
              expect(grantState.totalGranted).to.bignumber.equal(web3.utils.toBN(amount))
              expect(grantState.totalClaimed).to.bignumber.equal(new BN(0))
              expect(grantState.vestingInterval).to.bignumber.equal(web3.utils.toBN(vestingInterval))
              expect(grantState.cliffLength).to.bignumber.equal(web3.utils.toBN(cliffLength))

              // advance time to end of grant
              if ((await time.latest()).lt(new BN(TOKEN_LAUNCH_TIME).add(web3.utils.toBN(vestingLength)))) {
                await advanceTime({toSecond: new BN(TOKEN_LAUNCH_TIME).add(web3.utils.toBN(vestingLength))})
                await ethers.provider.send("evm_mine", [])
              }

              // verify fully vested claimable rewards
              const claimable = await communityRewards.claimableRewards(tokenId)
              expect(claimable).to.bignumber.equal(web3.utils.toBN(amount))

              // claim all awards
              await communityRewards.getReward(tokenId, {from: recipient})

              const rewardsAvailableAfter = await communityRewards.rewardsAvailable()
              expect(rewardsAvailableAfter).to.bignumber.equal(rewardsAvailableBefore.sub(claimable))

              const recipientBalanceAfter = await gfi.balanceOf(recipient)
              expect(recipientBalanceAfter).to.bignumber.equal(recipientBalanceBefore.add(claimable))
            } catch (e: any) {
              if (e instanceof Error && String(e).indexOf("Grant already accepted")) {
                console.log("Skipping grant, already accepted")
                continue
              }

              console.error(e)
            }
          }
        }).timeout(TEST_TIMEOUT)

        it("works for partial vesting periods", async () => {
          const vestingGrantsJson: MerkleDistributorInfo = JSON.parse(
            await fs.readFile(VESTING_MERKLE_INFO_PATH, {
              encoding: "utf8",
            })
          )

          const affectedAddresses = new Set([
            "0x3e4b143ec4aa78acb5c9f51b4955dc60f8268f14",
            "0x977c827a997e6cb67e70daeaa7145b17d0cb8bda",
            "0xc25d35024dd497d3825115828994bb08d12a3aa7",
            "0x61203f1a49a1df8da163647fb7fa0105e51f7341",
            "0xea93c16b2ed1cd73e6f9d5b5a92c36e504e8dc72",
            "0xd06ac243a362fe59bc336c918485d3fcc733fd1e",
            "0xb49ce783e7572ffe985c0eeced326b621201ffda",
            "0xba8a69673b6b3934c43998d1e18220b0154950e0",
            "0xcd84959ccf9cbd0abbc7e20e30c1c05bcbd2533e",
            "0x13e9b3ea5159ca4dccef9dc2907974027d663703",
            "0x7f1b17848969f0ea6f8814929cf2c14806b23e40",
            "0xfec5746990aeb84572d03def94dfb26ecbc4fe87",
          ])

          const affectedGrants = vestingGrantsJson.grants.filter((g) => affectedAddresses.has(g.account.toLowerCase()))

          for (const grant of affectedGrants) {
            const {
              index,
              proof,
              account: recipient,
              grant: {amount, vestingLength, cliffLength, vestingInterval},
            } = grant

            const rewardsAvailableBefore = await communityRewards.rewardsAvailable()
            const recipientBalanceBefore = await gfi.balanceOf(recipient)

            await impersonateAccount(hre, recipient)
            await fundWithWhales(["ETH"], [recipient])

            try {
              const receipt = await merkleDistributor.acceptGrant(
                index,
                amount,
                vestingLength,
                cliffLength,
                vestingInterval,
                proof,
                {from: recipient}
              )
              const grantedEvent = getOnlyLog<Granted>(decodeLogs(receipt.receipt.rawLogs, communityRewards, "Granted"))
              const tokenId = grantedEvent.args.tokenId

              // verify grant properties
              const grantState = await communityRewards.grants(tokenId)
              assertCommunityRewardsVestingRewards(grantState)
              expect(grantState.totalGranted).to.bignumber.equal(web3.utils.toBN(amount))
              expect(grantState.totalClaimed).to.bignumber.equal(new BN(0))

              if (web3.utils.toBN(vestingInterval).isZero()) {
                expect(grantState.vestingInterval).to.bignumber.equal(web3.utils.toBN(vestingLength))
              } else {
                expect(grantState.vestingInterval).to.bignumber.equal(web3.utils.toBN(vestingInterval))
              }

              expect(grantState.cliffLength).to.bignumber.equal(web3.utils.toBN(cliffLength))

              // advance time to end of grant
              if ((await time.latest()).lt(new BN(TOKEN_LAUNCH_TIME).add(web3.utils.toBN(vestingLength)))) {
                await advanceTime({toSecond: new BN(TOKEN_LAUNCH_TIME).add(web3.utils.toBN(vestingLength))})
                await ethers.provider.send("evm_mine", [])
              }

              // verify fully vested claimable rewards
              const claimable = await communityRewards.claimableRewards(tokenId)
              expect(claimable).to.bignumber.equal(web3.utils.toBN(amount))

              // claim all awards
              await communityRewards.getReward(tokenId, {from: recipient})

              const rewardsAvailableAfter = await communityRewards.rewardsAvailable()
              expect(rewardsAvailableAfter).to.bignumber.equal(rewardsAvailableBefore.sub(claimable))

              const recipientBalanceAfter = await gfi.balanceOf(recipient)
              expect(recipientBalanceAfter).to.bignumber.equal(recipientBalanceBefore.add(claimable))
            } catch (e: any) {
              if (e instanceof Error && String(e).indexOf("Grant already accepted")) {
                console.log("Skipping grant, already accepted")
                continue
              }

              console.error(e)
            }
          }
        }).timeout(TEST_TIMEOUT)
      })

      describe.skip("MerkleDirectDistributor", () => {
        it("proper reward allocation for users claimable", async () => {
          const noVestingGrantsJson: MerkleDirectDistributorInfo = JSON.parse(
            await fs.readFile(NO_VESTING_MERKLE_INFO_PATH, {
              encoding: "utf8",
            })
          )

          await advanceTime({toSecond: new BN(TOKEN_LAUNCH_TIME)})
          await ethers.provider.send("evm_mine", [])

          // randomly sample 50 grants
          const sampledGrants = _.sampleSize(noVestingGrantsJson.grants, 50)
          for (const grant of sampledGrants) {
            const {
              index,
              proof,
              account: recipient,
              grant: {amount},
            } = grant
            const recipientBalanceBefore = await gfi.balanceOf(recipient)

            await impersonateAccount(hre, recipient)
            await fundWithWhales(["ETH"], [recipient])

            try {
              await merkleDirectDistributor.acceptGrant(index, amount, proof, {from: recipient})

              const recipientBalanceAfter = await gfi.balanceOf(recipient)
              expect(recipientBalanceAfter).to.bignumber.equal(recipientBalanceBefore.add(web3.utils.toBN(amount)))
            } catch (e: any) {
              if (e instanceof Error && String(e).indexOf("Grant already accepted")) {
                console.log("Skipping grant, already accepted")
                continue
              }

              console.error(e)
            }
          }
        }).timeout(TEST_TIMEOUT)
      })
    })

    describe("StakingRewards", () => {
      it("deposits and stakes into senior pool, and can withdraw", async () => {
        const yearInSeconds = new BN(365 * 24 * 60 * 60)
        const halfYearInSeconds = yearInSeconds.div(new BN(2))
        const amount = usdcVal(1000)

        await usdc.approve(stakingRewards.address, amount, {from: owner})

        const receipt = await stakingRewards.depositAndStake(amount, {from: owner})
        const stakedEvent = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked"))
        const tokenId = stakedEvent.args.tokenId
        const depositedAndStakedEvent = getFirstLog<DepositedAndStaked>(
          decodeLogs(receipt.receipt.rawLogs, stakingRewards, "DepositedAndStaked")
        )
        expect(depositedAndStakedEvent.args.user).to.equal(stakedEvent.args.user)
        expect(depositedAndStakedEvent.args.depositedAmount).to.bignumber.equal(amount)
        expect(depositedAndStakedEvent.args.tokenId).to.equal(tokenId)
        expect(depositedAndStakedEvent.args.amount).to.bignumber.equal(stakedEvent.args.amount)

        // advance time to end of grant
        await advanceTime({seconds: halfYearInSeconds})
        await ethers.provider.send("evm_mine", [])

        const rewardReceipt = await stakingRewards.getReward(tokenId, {from: owner})
        const rewardEvent = getFirstLog<RewardPaid>(
          decodeLogs(rewardReceipt.receipt.rawLogs, stakingRewards, "RewardPaid")
        )
        const gfiBalance = await gfi.balanceOf(owner)
        expect(gfiBalance).to.bignumber.gt(new BN("0"))
        expect(gfiBalance).to.bignumber.equal(rewardEvent.args.reward)
      })

      it("does not affect reward calculations for a staked position created prior to GIP-1", async () => {
        // Use a known staked position created prior to GIP-1
        // Note: If this test starts failing, check that this position is still staked
        const tokenId = new BN(72)

        // The unsafeEffectiveMultiplier and unsafeBaseTokenExchangeRate should be 0
        const position = await stakingRewards.positions(tokenId)
        expect(position[5]).to.bignumber.equal(new BN(0))
        expect(position[6]).to.bignumber.equal(new BN(0))

        // The position's earnedSinceLastCheckpoint() should be non-zero, implying that the
        // 0 values for the position's `unsafeEffectiveMultiplier` and `unsafeBaseTokenExchangeRate`
        // are being handled safely and not adversely affecting the earning of additional rewards.
        expect(await stakingRewards.earnedSinceLastCheckpoint(tokenId)).to.bignumber.gt(new BN(0))
      })
    })
  })
})
