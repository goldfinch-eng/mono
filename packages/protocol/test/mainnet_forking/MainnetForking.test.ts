import hre from "hardhat"
import {
  getUSDCAddress,
  MAINNET_ONE_SPLIT_ADDRESS,
  getSignerForAddress,
  interestAprAsBN,
  MAINNET_CUSDC_ADDRESS,
  TRANCHES,
  MAINNET_CHAIN_ID,
  getProtocolOwner,
  getTruffleContract,
  OWNER_ROLE,
  SIGNER_ROLE,
} from "../../blockchain_scripts/deployHelpers"
import {MAINNET_MULTISIG, getExistingContracts} from "../../blockchain_scripts/mainnetForkingHelpers"
import {CONFIG_KEYS} from "../../blockchain_scripts/configKeys"
import {time} from "@openzeppelin/test-helpers"
import * as uniqueIdentitySigner from "@goldfinch-eng/autotasks/unique-identity-signer"
import {FetchKYCFunction, KYC} from "@goldfinch-eng/autotasks/unique-identity-signer"

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
  decimals,
  USDC_DECIMALS,
  createPoolWithCreditLine,
  decodeLogs,
  getDeployedAsTruffleContract,
  getOnlyLog,
  getFirstLog,
  toEthers,
} from "../testHelpers"
import * as migrate231 from "../../blockchain_scripts/migrations/v2.3.1/migrate"
import * as migrate233 from "../../blockchain_scripts/migrations/v2.3.3/migrate"
import {asNonNullable, assertIsString, assertNonNullable} from "@goldfinch-eng/utils"
import {
  BackerRewardsInstance,
  BorrowerInstance,
  CommunityRewardsInstance,
  FiduInstance,
  FixedLeverageRatioStrategyInstance,
  GFIInstance,
  GoInstance,
  GoldfinchConfigInstance,
  GoldfinchFactoryInstance,
  MerkleDirectDistributorInstance,
  MerkleDistributorInstance,
  SeniorPoolInstance,
  StakingRewardsInstance,
  TranchedPoolInstance,
  UniqueIdentityInstance,
} from "@goldfinch-eng/protocol/typechain/truffle"
import {DepositMade} from "@goldfinch-eng/protocol/typechain/truffle/TranchedPool"
import {Staked} from "@goldfinch-eng/protocol/typechain/truffle/StakingRewards"
import {Granted} from "@goldfinch-eng/protocol/typechain/truffle/CommunityRewards"
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
import {DepositedAndStaked, RewardPaid} from "@goldfinch-eng/protocol/typechain/truffle/StakingRewards"
import {impersonateAccount} from "../../blockchain_scripts/helpers/impersonateAccount"
import {fundWithWhales} from "../../blockchain_scripts/helpers/fundWithWhales"
import {UniqueIdentity} from "@goldfinch-eng/protocol/typechain/ethers"
import {Signer} from "ethers"
import * as migrate2_5 from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.5/migrate"

const THREE_YEARS_IN_SECONDS = 365 * 24 * 60 * 60 * 3
const TOKEN_LAUNCH_TIME = new BN(TOKEN_LAUNCH_TIME_IN_SECONDS).add(new BN(THREE_YEARS_IN_SECONDS))

const setupTest = deployments.createFixture(async ({deployments}) => {
  // Note: base_deploy always returns when mainnet forking, however
  // we need it here, because the "fixture" part is what let's hardhat
  // snapshot and give us a clean blockchain before each test.
  // Otherwise, we have state leaking across tests.
  await deployments.fixture("base_deploy", {keepExistingDeployments: true})

  await migrate231.main()
  await migrate233.main()
  await migrate2_5.main()

  const [owner, bwr] = await web3.eth.getAccounts()
  assertNonNullable(owner)
  assertNonNullable(bwr)
  await fundWithWhales(["USDC"], [owner, bwr])

  // Ensure the multisig has funds for various transactions
  const ownerAccount = await getSignerForAddress(owner)
  assertNonNullable(ownerAccount)
  await ownerAccount.sendTransaction({to: MAINNET_MULTISIG, value: ethers.utils.parseEther("10.0")})

  await impersonateAccount(hre, MAINNET_MULTISIG)

  const mainnetMultisigSigner = ethers.provider.getSigner(MAINNET_MULTISIG)
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

  return {
    seniorPool,
    seniorPoolStrategy,
    usdc,
    fidu,
    goldfinchConfig,
    goldfinchFactory,
    cUSDC,
    go,
    stakingRewards,
    backerRewards,
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
  this.retries(2)

  // eslint-disable-next-line no-unused-vars
  let accounts, owner, bwr, person3, usdc, fidu, goldfinchConfig
  let goldfinchFactory, busd, usdt, cUSDC
  let reserveAddress,
    tranchedPool: TranchedPoolInstance,
    borrower,
    seniorPool: SeniorPoolInstance,
    seniorPoolStrategy,
    go: GoInstance,
    stakingRewards: StakingRewardsInstance,
    backerRewards: BackerRewardsInstance,
    gfi: GFIInstance,
    communityRewards: CommunityRewardsInstance,
    merkleDistributor: MerkleDistributorInstance,
    merkleDirectDistributor: MerkleDirectDistributorInstance,
    legacyGoldfinchConfig: GoldfinchConfigInstance,
    uniqueIdentity: UniqueIdentityInstance,
    ethersUniqueIdentity: UniqueIdentity,
    signer: Signer,
    network

  async function setupSeniorPool() {
    seniorPoolStrategy = await artifacts.require("ISeniorPoolStrategy").at(seniorPoolStrategy.address)

    await erc20Approve(usdc, seniorPool.address, usdcVal(10000), [owner])
    await seniorPool.deposit(usdcVal(10000), {from: owner})
  }

  async function createBorrowerContract() {
    const result = await goldfinchFactory.createBorrower(bwr)
    const bwrConAddr = result.logs[result.logs.length - 1].args.borrower
    const bwrCon = await Borrower.at(bwrConAddr)
    await erc20Approve(busd, bwrCon.address, MAX_UINT, [bwr])
    await erc20Approve(usdt, bwrCon.address, MAX_UINT, [bwr])
    return bwrCon
  }

  async function initializeTranchedPool(pool, bwrCon) {
    await erc20Approve(usdc, pool.address, usdcVal(100000), [owner])
    await pool.deposit(TRANCHES.Junior, usdcVal(2000))
    await bwrCon.lockJuniorCapital(pool.address, {from: bwr})
    await pool.grantRole(await pool.SENIOR_ROLE(), owner, {from: MAINNET_MULTISIG})
    await pool.deposit(TRANCHES.Senior, usdcVal(8000))
    await pool.revokeRole(await pool.SENIOR_ROLE(), owner, {from: MAINNET_MULTISIG})
  }

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
      cUSDC,
      go,
      stakingRewards,
      backerRewards,
      gfi,
      communityRewards,
      merkleDistributor,
      merkleDirectDistributor,
      legacyGoldfinchConfig,
      uniqueIdentity,
      signer,
      network,
      ethersUniqueIdentity,
    } = await setupTest())
    const usdcAddress = getUSDCAddress(MAINNET_CHAIN_ID)
    assertIsString(usdcAddress)
    const busdAddress = "0x4fabb145d64652a948d72533023f6e7a623c7c53"
    const usdtAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
    busd = await artifacts.require("IERC20withDec").at(busdAddress)
    usdt = await artifacts.require("IERC20withDec").at(usdtAddress)
    await fundWithWhales(["USDC", "BUSD", "USDT"], [owner, bwr, person3])
    await erc20Approve(usdc, seniorPool.address, MAX_UINT, accounts)
    await legacyGoldfinchConfig.bulkAddToGoList([owner, bwr, person3], {from: MAINNET_MULTISIG})
    await setupSeniorPool()
  })

  describe("drawing down into another currency", async function () {
    let bwrCon: BorrowerInstance, oneSplit
    beforeEach(async () => {
      this.timeout(TEST_TIMEOUT)
      oneSplit = await IOneSplit.at(MAINNET_ONE_SPLIT_ADDRESS)
      bwrCon = await createBorrowerContract()
      ;({tranchedPool} = await createPoolWithCreditLine({
        people: {owner: MAINNET_MULTISIG, borrower: bwrCon.address},
        goldfinchFactory,
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
    const amount = usdcVal(100)
    beforeEach(async function () {
      this.timeout(TEST_TIMEOUT)
      oneSplit = await IOneSplit.at(MAINNET_ONE_SPLIT_ADDRESS)
      bwrCon = await createBorrowerContract()
      ;({tranchedPool, creditLine: cl} = await createPoolWithCreditLine({
        people: {owner: MAINNET_MULTISIG, borrower: bwrCon.address},
        goldfinchFactory,
        usdc,
      }))

      await initializeTranchedPool(tranchedPool, bwrCon)
      await bwrCon.drawdown(tranchedPool.address, amount, bwr, {from: bwr})
    })

    it("should allow you to pay with another currency", async () => {
      // USDT has the same decimals as USDC, so USDC val is fine here.
      const rawAmount = 10
      const usdtAmount = usdcVal(rawAmount)
      const expectedReturn = await oneSplit.getExpectedReturn(usdt.address, usdc.address, usdtAmount, 10, 0, {
        from: bwr,
      })
      await expectAction(() => {
        return bwrCon.payWithSwapOnOneInch(
          tranchedPool.address,
          usdtAmount,
          usdt.address,
          expectedReturn.returnAmount.mul(new BN(99)).div(new BN(100)),
          expectedReturn.distribution,
          {from: bwr}
        )
      }).toChange([
        [async () => await getBalance(bwr, usdt), {by: usdtAmount.neg()}],
        [async () => await getBalance(cl.address, usdc), {byCloseTo: expectedReturn.returnAmount}],
      ])
      await advanceTime({toSecond: (await cl.nextDueTime()).add(new BN(1))})
      await expectAction(() => tranchedPool.assess()).toChange([
        [async () => await cl.balance(), {decrease: true}],
        [async () => await getBalance(cl.address, usdc), {to: new BN(0)}],
      ])
    }).timeout(TEST_TIMEOUT)

    it("Works with BUSD", async () => {
      const rawAmount = 10
      const busdAmount = bigVal(rawAmount)
      const expectedReturn = await oneSplit.getExpectedReturn(busd.address, usdc.address, busdAmount, 10, 0, {
        from: bwr,
      })
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
        [async () => await getBalance(cl.address, usdc), {byCloseTo: expectedReturn.returnAmount}],
      ])
      await advanceTime({toSecond: (await cl.nextDueTime()).add(new BN(1))})
      await expectAction(() => tranchedPool.assess()).toChange([
        [async () => await cl.balance(), {decrease: true}],
        [async () => await getBalance(cl.address, usdc), {to: new BN(0)}],
      ])
    }).timeout(TEST_TIMEOUT)

    describe("payMultipleWithSwapOnOneInch", async () => {
      let tranchedPool2, cl2
      const amount2 = usdcVal(50)

      beforeEach(async function () {
        this.timeout(TEST_TIMEOUT)
        ;({tranchedPool: tranchedPool2, creditLine: cl2} = await createPoolWithCreditLine({
          people: {owner: MAINNET_MULTISIG, borrower: bwrCon.address},
          goldfinchFactory,
          usdc,
        }))

        expect(cl.address).to.not.eq(cl2.addresss)
        expect(tranchedPool.address).to.not.eq(tranchedPool2.addresss)

        await initializeTranchedPool(tranchedPool2, bwrCon)
        await bwrCon.drawdown(tranchedPool2.address, amount2, bwr, {from: bwr})
      })

      it("should pay back multiple loans", async () => {
        const padding = usdcVal(50)
        const originAmount = amount.add(amount2).add(padding)
        const expectedReturn = await oneSplit.getExpectedReturn(usdt.address, usdc.address, originAmount, 10, 0, {
          from: bwr,
        })
        const totalMinAmount = amount.add(amount2)
        const expectedExtra = expectedReturn.returnAmount.sub(totalMinAmount)

        await advanceTime({toSecond: (await cl.nextDueTime()).add(new BN(1))})
        await tranchedPool.assess()

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
          [async () => (await cl.balance()).add(await cl.interestOwed()), {by: amount.neg()}],
          // Excess USDC from swap should be added to the first CreditLine's contract balance
          // rather than applied as payment
          [() => getBalance(cl.address, usdc), {byCloseTo: expectedExtra}],
          [() => getBalance(cl2.address, usdc), {by: amount2}],
          [() => getBalance(bwr, usdt), {by: originAmount.neg()}],
        ])
        expect(await getBalance(bwrCon.address, usdc)).to.bignumber.eq(new BN(0))
        expect(await getBalance(bwrCon.address, usdt)).to.bignumber.eq(new BN(0))
      }).timeout(TEST_TIMEOUT)
    })
  })

  describe("SeniorPool", async () => {
    describe("compound integration", async () => {
      beforeEach(async function () {
        this.timeout(TEST_TIMEOUT)
        const limit = usdcVal(100000)
        const interestApr = interestAprAsBN("5.00")
        const paymentPeriodInDays = new BN(30)
        const termInDays = new BN(365)
        const lateFeeApr = new BN(0)
        const juniorFeePercent = new BN(20)
        const juniorInvestmentAmount = usdcVal(1000)

        borrower = bwr
        ;({tranchedPool} = await createPoolWithCreditLine({
          people: {owner: MAINNET_MULTISIG, borrower},
          goldfinchFactory,
          limit,
          interestApr,
          paymentPeriodInDays,
          termInDays,
          lateFeeApr,
          juniorFeePercent,
          usdc,
        }))

        reserveAddress = await goldfinchConfig.getAddress(CONFIG_KEYS.TreasuryReserve)

        await erc20Approve(usdc, tranchedPool.address, usdcVal(100000), [owner])
        await tranchedPool.deposit(TRANCHES.Junior, juniorInvestmentAmount)
      })

      it("should redeem from compound and recognize interest on invest", async function () {
        await tranchedPool.lockJuniorCapital({from: borrower})
        const usdcAmount = await seniorPoolStrategy.invest(seniorPool.address, tranchedPool.address)
        const seniorPoolValue = await getBalance(seniorPool.address, usdc)
        const protocolOwner = await getProtocolOwner()

        await expectAction(() => {
          return seniorPool.sweepToCompound({from: protocolOwner})
        }).toChange([
          [() => getBalance(seniorPool.address, usdc), {to: new BN(0)}], // The pool balance is swept to compound
          [() => getBalance(seniorPool.address, cUSDC), {increase: true}], // Pool should gain some cTokens
          [() => seniorPool.assets(), {by: new BN(0)}], // Pool's assets should not change (it should include amount on compound)
        ])

        const originalSharePrice = await seniorPool.sharePrice()

        const BLOCKS_TO_MINE = 10
        await time.advanceBlockTo((await time.latestBlock()).add(new BN(BLOCKS_TO_MINE)))

        const originalReserveBalance = await getBalance(reserveAddress, usdc)

        await expectAction(() => seniorPool.invest(tranchedPool.address, {from: protocolOwner})).toChange([
          [() => getBalance(seniorPool.address, usdc), {byCloseTo: seniorPoolValue.sub(usdcAmount)}], // regained usdc
          [() => getBalance(seniorPool.address, cUSDC), {to: new BN(0)}], // No more cTokens
          [() => getBalance(tranchedPool.address, usdc), {by: usdcAmount}], // Funds were transferred to TranchedPool
        ])

        const poolBalanceChange = (await getBalance(seniorPool.address, usdc)).sub(seniorPoolValue.sub(usdcAmount))
        const reserveBalanceChange = (await getBalance(reserveAddress, usdc)).sub(originalReserveBalance)
        const interestGained = poolBalanceChange.add(reserveBalanceChange)
        expect(interestGained).to.bignumber.gt(new BN(0))

        const newSharePrice = await seniorPool.sharePrice()

        const FEE_DENOMINATOR = new BN(10)
        const expectedfeeAmount = interestGained.div(FEE_DENOMINATOR)

        // This could be zero, if the mainnet Compound interest rate is too low, if this test fails in the future,
        // consider increasing BLOCKS_TO_MINE (but it could slow down the test)
        expect(expectedfeeAmount).to.bignumber.gt(new BN(0))
        expect(await getBalance(reserveAddress, usdc)).to.bignumber.eq(originalReserveBalance.add(expectedfeeAmount))

        const expectedSharePrice = new BN(interestGained)
          .sub(expectedfeeAmount)
          .mul(decimals.div(USDC_DECIMALS)) // This part is our "normalization" between USDC and Fidu
          .mul(decimals)
          .div(await fidu.totalSupply())
          .add(originalSharePrice)

        expect(newSharePrice).to.bignumber.gt(originalSharePrice)
        expect(newSharePrice).to.bignumber.equal(expectedSharePrice)
      }).timeout(TEST_TIMEOUT)

      it("should redeem from compound and recognize interest on withdraw", async function () {
        const usdcAmount = usdcVal(100)
        await erc20Approve(usdc, seniorPool.address, usdcAmount, [bwr])
        await seniorPool.deposit(usdcAmount, {from: bwr})
        const protocolOwner = await getProtocolOwner()
        await expectAction(() => {
          return seniorPool.sweepToCompound({from: protocolOwner})
        }).toChange([
          [() => getBalance(seniorPool.address, usdc), {to: new BN(0)}],
          [() => getBalance(seniorPool.address, cUSDC), {increase: true}],
          [() => seniorPool.assets(), {by: new BN(0)}],
        ])

        const WITHDRAWL_FEE_DENOMINATOR = new BN(200)
        const expectedWithdrawAmount = usdcAmount.sub(usdcAmount.div(WITHDRAWL_FEE_DENOMINATOR))
        await expectAction(() => {
          return seniorPool.withdraw(usdcAmount, {from: bwr})
        }).toChange([
          [() => getBalance(seniorPool.address, usdc), {increase: true}], // USDC withdrawn, but interest was collected
          [() => getBalance(seniorPool.address, cUSDC), {to: new BN(0)}], // No more cTokens
          [() => getBalance(bwr, usdc), {by: expectedWithdrawAmount}], // Investor withdrew the full balance minus withdraw fee
          [() => seniorPool.sharePrice(), {increase: true}], // Due to interest collected, the exact math is tested above
        ])
      }).timeout(TEST_TIMEOUT)

      it("does not allow sweeping to compound when there is already a balance", async () => {
        const protocolOwner = await getProtocolOwner()
        await seniorPool.sweepToCompound({from: protocolOwner})

        await expect(seniorPool.sweepToCompound({from: protocolOwner})).to.be.rejectedWith(/Cannot sweep/)
      }).timeout(TEST_TIMEOUT)

      it("can only be swept by the owner", async () => {
        await expect(seniorPool.sweepToCompound({from: bwr})).to.be.rejectedWith(/Must have admin role/)
        await expect(seniorPool.sweepFromCompound({from: bwr})).to.be.rejectedWith(/Must have admin role/)
      }).timeout(TEST_TIMEOUT)
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
          people: {borrower: bwr, owner: MAINNET_MULTISIG},
          usdc,
          goldfinchFactory,
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
          await expect(stakingRewards.depositAndStake(usdcVal(10), {from: unGoListedUser})).to.be.rejectedWith(
            /This address has not been go-listed/i
          )
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
          people: {borrower, owner: MAINNET_MULTISIG},
          usdc,
          goldfinchFactory,
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

      describe("when I deposit and subsequently withdraw into the senior pool", async () => {
        it("it works", async () => {
          await expect(seniorPool.deposit(usdcVal(10), {from: goListedUser})).to.be.fulfilled
          await expect(seniorPool.withdraw(usdcVal(10), {from: goListedUser})).to.be.fulfilled
        })
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
          const tx = await expect(stakingRewards.depositAndStake(usdcVal(10_000), {from: goListedUser})).to.be.fulfilled
          const logs = decodeLogs<Staked>(tx.receipt.rawLogs, stakingRewards, "Staked")
          const stakedEvent = asNonNullable(logs[0])
          const tokenId = stakedEvent?.args.tokenId
          await expect(stakingRewards.exit(tokenId, {from: goListedUser})).to.be.fulfilled
        })
      })

      describe("when I deposit and stake with lockup, and then exit", async () => {
        it("it works", async () => {
          const tx = await expect(
            stakingRewards.depositAndStakeWithLockup(usdcVal(10_000), new BN(0), {from: goListedUser})
          ).to.be.fulfilled
          const logs = decodeLogs<Staked>(tx.receipt.rawLogs, stakingRewards, "Staked")
          const stakedEvent = asNonNullable(logs[0])
          const tokenId = stakedEvent?.args.tokenId
          await advanceTime({days: 30})
          // before lockup expires
          await expect(stakingRewards.exit(tokenId, {from: goListedUser})).to.be.rejectedWith(
            /staked funds are locked/i
          )
          await advanceTime({days: 6 * 31})
          await expect(stakingRewards.exit(tokenId, {from: goListedUser})).to.be.fulfilled
        })
      })
    })

    describe("as a go listed borrower", async () => {
      describe("with a pool that I don't own", async () => {
        beforeEach(async () => {
          // eslint-disable-next-line @typescript-eslint/no-extra-semi
          ;({tranchedPool} = await createPoolWithCreditLine({
            people: {
              owner: MAINNET_MULTISIG,
              borrower: person3,
            },
            usdc,
            goldfinchFactory,
          }))
          bwr = person3
          bwrCon = await createBorrowerContract()
          await erc20Approve(usdc, tranchedPool.address, MAX_UINT, [bwr, owner])
          await erc20Approve(usdc, bwrCon.address, MAX_UINT, [bwr, owner])
          await tranchedPool.deposit(TRANCHES.Junior, usdcVal(100), {from: owner})
          await tranchedPool.lockJuniorCapital({from: MAINNET_MULTISIG})
          await tranchedPool.grantRole(await tranchedPool.SENIOR_ROLE(), owner, {from: MAINNET_MULTISIG})
          await tranchedPool.deposit(TRANCHES.Senior, usdcVal(300), {from: owner})
          await tranchedPool.revokeRole(await tranchedPool.SENIOR_ROLE(), owner, {from: MAINNET_MULTISIG})
          await tranchedPool.lockPool({from: MAINNET_MULTISIG})
        })

        describe("when I try to withdraw", async () => {
          it("it fails", async () => {
            await expect(bwrCon.drawdown(tranchedPool.address, usdcVal(400), bwr, {from: bwr})).to.be.rejectedWith(
              /Must have locker role/i
            )
          })
        })
      })

      describe("with a pool that I own", async () => {
        let backerTokenId
        beforeEach(async () => {
          // eslint-disable-next-line @typescript-eslint/no-extra-semi
          ;({tranchedPool} = await createPoolWithCreditLine({
            people: {
              owner: MAINNET_MULTISIG,
              borrower: bwr,
            },
            usdc,
            goldfinchFactory,
          }))
          await erc20Approve(usdc, tranchedPool.address, MAX_UINT, [bwr, owner])
          await erc20Approve(usdc, bwrCon.address, MAX_UINT, [bwr, owner])
          const tx = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(2_500), {from: owner})
          const logs = decodeLogs<DepositMade>(tx.receipt.rawLogs, tranchedPool, "DepositMade")
          const depositMadeEvent = asNonNullable(logs[0])
          backerTokenId = depositMadeEvent.args.tokenId
          await tranchedPool.lockJuniorCapital({from: bwr})
          await tranchedPool.grantRole(await tranchedPool.SENIOR_ROLE(), owner, {from: MAINNET_MULTISIG})
          await tranchedPool.deposit(TRANCHES.Senior, usdcVal(7_500), {from: owner})
          await tranchedPool.revokeRole(await tranchedPool.SENIOR_ROLE(), owner, {from: MAINNET_MULTISIG})
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
            await expect(bwrCon.pay(tranchedPool.address, usdcVal(10_000), {from: bwr})).to.be.fulfilled

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
              await expect(bwrCon.pay(tranchedPool.address, usdcVal(10_000), {from: bwr})).to.be.fulfilled
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
      describe("MerkleDistributor", () => {
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

      describe("MerkleDirectDistributor", () => {
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
      it("deposits and stakings into senior pool, and can withdraw", async () => {
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
        expect(depositedAndStakedEvent.args.lockedUntil).to.bignumber.equal(stakedEvent.args.lockedUntil)
        expect(depositedAndStakedEvent.args.multiplier).to.bignumber.equal(stakedEvent.args.multiplier)

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
    })
  })

  describe("UID", () => {
    let fetchKYCFunction: FetchKYCFunction

    function fetchStubbedKycStatus(kyc: KYC): FetchKYCFunction {
      return async (_) => {
        return Promise.resolve(kyc)
      }
    }

    beforeEach(async () => {
      await uniqueIdentity.grantRole(OWNER_ROLE, owner, {from: await getProtocolOwner()})
      await uniqueIdentity.grantRole(SIGNER_ROLE, await signer.getAddress(), {from: await getProtocolOwner()})
    })

    describe("KYC is elligible", () => {
      describe("non accredited investor", () => {
        beforeEach(() => {
          fetchKYCFunction = fetchStubbedKycStatus({
            status: "approved",
            countryCode: "US",
          })
        })

        it("returns a signature that can be used to mint", async () => {
          const nonUSIdType = await uniqueIdentity.ID_TYPE_0()
          const usAccreditedIdType = await uniqueIdentity.ID_TYPE_1()
          const usNonAccreditedIdType = await uniqueIdentity.ID_TYPE_2()
          const usEntityIdType = await uniqueIdentity.ID_TYPE_3()
          const nonUsEntityIdType = await uniqueIdentity.ID_TYPE_4()
          const auth = {
            "x-goldfinch-address": person3,
            "x-goldfinch-signature": "test_signature",
            "x-goldfinch-signature-block-num": "fake_block_number",
          }
          await uniqueIdentity.setSupportedUIDTypes([usNonAccreditedIdType], [true])

          let result = await uniqueIdentitySigner.main({
            auth,
            signer,
            network,
            uniqueIdentity: ethersUniqueIdentity,
            fetchKYCStatus: fetchKYCFunction,
          })

          // mint non-accredited investor
          await uniqueIdentity.mint(usNonAccreditedIdType, result.expiresAt, result.signature, {
            from: person3,
            value: web3.utils.toWei("0.00083"),
          })
          expect(await uniqueIdentity.balanceOf(person3, nonUSIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(person3, usAccreditedIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(person3, usNonAccreditedIdType)).to.bignumber.eq(new BN(1))
          expect(await uniqueIdentity.balanceOf(person3, usEntityIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(person3, nonUsEntityIdType)).to.bignumber.eq(new BN(0))

          // Indirectly test that the nonce is correctly used, thereby allowing the burn to succeed
          result = await uniqueIdentitySigner.main({
            auth,
            signer,
            network,
            uniqueIdentity: ethersUniqueIdentity,
            fetchKYCStatus: fetchKYCFunction,
          })

          await uniqueIdentity.burn(person3, usNonAccreditedIdType, result.expiresAt, result.signature, {
            from: person3,
          })
          expect(await uniqueIdentity.balanceOf(person3, nonUSIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(person3, usAccreditedIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(person3, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(person3, usEntityIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(person3, nonUsEntityIdType)).to.bignumber.eq(new BN(0))
        }).timeout(TEST_TIMEOUT)
      })

      describe("non US investor", () => {
        beforeEach(() => {
          fetchKYCFunction = fetchStubbedKycStatus({
            status: "approved",
            countryCode: "CA",
          })
        })

        it("returns a signature that can be used to mint", async () => {
          const nonUSIdType = await uniqueIdentity.ID_TYPE_0()
          const usAccreditedIdType = await uniqueIdentity.ID_TYPE_1()
          const usNonAccreditedIdType = await uniqueIdentity.ID_TYPE_2()
          const usEntityIdType = await uniqueIdentity.ID_TYPE_3()
          const nonUsEntityIdType = await uniqueIdentity.ID_TYPE_4()
          const auth = {
            "x-goldfinch-address": person3,
            "x-goldfinch-signature": "test_signature",
            "x-goldfinch-signature-block-num": "fake_block_number",
          }
          await uniqueIdentity.setSupportedUIDTypes([nonUSIdType], [true])

          let result = await uniqueIdentitySigner.main({
            auth,
            signer,
            network,
            uniqueIdentity: ethersUniqueIdentity,
            fetchKYCStatus: fetchKYCFunction,
          })

          // mint non-accredited investor
          await uniqueIdentity.mint(nonUSIdType, result.expiresAt, result.signature, {
            from: person3,
            value: web3.utils.toWei("0.00083"),
          })
          expect(await uniqueIdentity.balanceOf(person3, nonUSIdType)).to.bignumber.eq(new BN(1))
          expect(await uniqueIdentity.balanceOf(person3, usAccreditedIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(person3, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(person3, usEntityIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(person3, nonUsEntityIdType)).to.bignumber.eq(new BN(0))

          // Indirectly test that the nonce is correctly used, thereby allowing the burn to succeed
          result = await uniqueIdentitySigner.main({
            auth,
            signer,
            network,
            uniqueIdentity: ethersUniqueIdentity,
            fetchKYCStatus: fetchKYCFunction,
          })

          await uniqueIdentity.burn(person3, nonUSIdType, result.expiresAt, result.signature, {
            from: person3,
          })
          expect(await uniqueIdentity.balanceOf(person3, nonUSIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(person3, usAccreditedIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(person3, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(person3, usEntityIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(person3, nonUsEntityIdType)).to.bignumber.eq(new BN(0))
        }).timeout(TEST_TIMEOUT)
      })

      describe("US accredited investor", () => {
        beforeEach(() => {
          fetchKYCFunction = fetchStubbedKycStatus({
            status: "approved",
            countryCode: "US",
          })
        })

        it("returns a signature that can be used to mint", async () => {
          const address = "0x948D99554dC5b90ac3DD00daeCF76100d3219B02"
          await impersonateAccount(hre, address)
          await fundWithWhales(["ETH"], [address])

          const nonUSIdType = await uniqueIdentity.ID_TYPE_0()
          const usAccreditedIdType = await uniqueIdentity.ID_TYPE_1()
          const usNonAccreditedIdType = await uniqueIdentity.ID_TYPE_2()
          const usEntityIdType = await uniqueIdentity.ID_TYPE_3()
          const nonUsEntityIdType = await uniqueIdentity.ID_TYPE_4()
          const auth = {
            "x-goldfinch-address": address,
            "x-goldfinch-signature": "test_signature",
            "x-goldfinch-signature-block-num": "fake_block_number",
          }
          await uniqueIdentity.setSupportedUIDTypes([usAccreditedIdType], [true])

          let result = await uniqueIdentitySigner.main({
            auth,
            signer,
            network,
            uniqueIdentity: ethersUniqueIdentity,
            fetchKYCStatus: fetchKYCFunction,
          })

          // mint non-accredited investor
          await uniqueIdentity.mint(usAccreditedIdType, result.expiresAt, result.signature, {
            from: address,
            value: web3.utils.toWei("0.00083"),
          })
          expect(await uniqueIdentity.balanceOf(address, nonUSIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(address, usAccreditedIdType)).to.bignumber.eq(new BN(1))
          expect(await uniqueIdentity.balanceOf(address, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(address, usEntityIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(address, nonUsEntityIdType)).to.bignumber.eq(new BN(0))

          // Indirectly test that the nonce is correctly used, thereby allowing the burn to succeed
          result = await uniqueIdentitySigner.main({
            auth,
            signer,
            network,
            uniqueIdentity: ethersUniqueIdentity,
            fetchKYCStatus: fetchKYCFunction,
          })

          await uniqueIdentity.burn(address, usAccreditedIdType, result.expiresAt, result.signature, {
            from: address,
          })
          expect(await uniqueIdentity.balanceOf(address, nonUSIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(address, usAccreditedIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(address, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(address, usEntityIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(address, nonUsEntityIdType)).to.bignumber.eq(new BN(0))
        }).timeout(TEST_TIMEOUT)
      })

      describe("US entity", () => {
        beforeEach(() => {
          fetchKYCFunction = fetchStubbedKycStatus({
            status: "approved",
            countryCode: "CA",
          })
        })

        it("returns a signature that can be used to mint", async () => {
          const address = "0x79e92C775F4AB5a6a0eC1FDf05E8cEC6Eaa17bcb"
          await impersonateAccount(hre, address)
          await fundWithWhales(["ETH"], [address])
          const nonUSIdType = await uniqueIdentity.ID_TYPE_0()
          const usAccreditedIdType = await uniqueIdentity.ID_TYPE_1()
          const usNonAccreditedIdType = await uniqueIdentity.ID_TYPE_2()
          const usEntityIdType = await uniqueIdentity.ID_TYPE_3()
          const nonUsEntityIdType = await uniqueIdentity.ID_TYPE_4()
          const auth = {
            "x-goldfinch-address": address,
            "x-goldfinch-signature": "test_signature",
            "x-goldfinch-signature-block-num": "fake_block_number",
          }
          await uniqueIdentity.setSupportedUIDTypes([usEntityIdType], [true])

          let result = await uniqueIdentitySigner.main({
            auth,
            signer,
            network,
            uniqueIdentity: ethersUniqueIdentity,
            fetchKYCStatus: fetchKYCFunction,
          })

          await uniqueIdentity.mint(usEntityIdType, result.expiresAt, result.signature, {
            from: address,
            value: web3.utils.toWei("0.00083"),
          })
          expect(await uniqueIdentity.balanceOf(address, nonUSIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(address, usAccreditedIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(address, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(address, usEntityIdType)).to.bignumber.eq(new BN(1))
          expect(await uniqueIdentity.balanceOf(address, nonUsEntityIdType)).to.bignumber.eq(new BN(0))

          // Indirectly test that the nonce is correctly used, thereby allowing the burn to succeed
          result = await uniqueIdentitySigner.main({
            auth,
            signer,
            network,
            uniqueIdentity: ethersUniqueIdentity,
            fetchKYCStatus: fetchKYCFunction,
          })

          await uniqueIdentity.burn(address, usEntityIdType, result.expiresAt, result.signature, {
            from: address,
          })
          expect(await uniqueIdentity.balanceOf(address, nonUSIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(address, usAccreditedIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(address, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(address, usEntityIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(address, nonUsEntityIdType)).to.bignumber.eq(new BN(0))
        }).timeout(TEST_TIMEOUT)
      })

      describe("non US entity", () => {
        beforeEach(() => {
          fetchKYCFunction = fetchStubbedKycStatus({
            status: "approved",
            countryCode: "CA",
          })
        })

        it("returns a signature that can be used to mint", async () => {
          const address = "0x0cdb67d1A9A847492da820f1BB3804516f8F5422"
          await impersonateAccount(hre, address)
          await fundWithWhales(["ETH"], [address])
          const nonUSIdType = await uniqueIdentity.ID_TYPE_0()
          const usAccreditedIdType = await uniqueIdentity.ID_TYPE_1()
          const usNonAccreditedIdType = await uniqueIdentity.ID_TYPE_2()
          const usEntityIdType = await uniqueIdentity.ID_TYPE_3()
          const nonUsEntityIdType = await uniqueIdentity.ID_TYPE_4()
          const auth = {
            "x-goldfinch-address": person3,
            "x-goldfinch-signature": "test_signature",
            "x-goldfinch-signature-block-num": "fake_block_number",
          }
          await uniqueIdentity.setSupportedUIDTypes([nonUsEntityIdType], [true])

          let result = await uniqueIdentitySigner.main({
            auth,
            signer,
            network,
            uniqueIdentity: ethersUniqueIdentity,
            fetchKYCStatus: fetchKYCFunction,
          })

          await uniqueIdentity.mint(nonUsEntityIdType, result.expiresAt, result.signature, {
            from: person3,
            value: web3.utils.toWei("0.00083"),
          })
          expect(await uniqueIdentity.balanceOf(person3, nonUSIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(person3, usAccreditedIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(person3, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(person3, usEntityIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(person3, nonUsEntityIdType)).to.bignumber.eq(new BN(1))

          // Indirectly test that the nonce is correctly used, thereby allowing the burn to succeed
          result = await uniqueIdentitySigner.main({
            auth,
            signer,
            network,
            uniqueIdentity: ethersUniqueIdentity,
            fetchKYCStatus: fetchKYCFunction,
          })

          await uniqueIdentity.burn(person3, nonUsEntityIdType, result.expiresAt, result.signature, {
            from: person3,
          })
          expect(await uniqueIdentity.balanceOf(person3, nonUSIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(person3, usAccreditedIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(person3, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(person3, usEntityIdType)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(person3, nonUsEntityIdType)).to.bignumber.eq(new BN(0))
        }).timeout(TEST_TIMEOUT)
      })
    })
  })
})
