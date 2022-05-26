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
  getEthersContract,
} from "../../blockchain_scripts/deployHelpers"
import {MAINNET_MULTISIG, getExistingContracts} from "../../blockchain_scripts/mainnetForkingHelpers"
import {CONFIG_KEYS} from "../../blockchain_scripts/configKeys"
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
  decimals,
  USDC_DECIMALS,
  createPoolWithCreditLine,
  decodeLogs,
  getDeployedAsTruffleContract,
  getOnlyLog,
  getFirstLog,
  toEthers,
  mineInSameBlock,
  mineBlock,
  decodeAndGetFirstLog,
  erc721Approve,
  erc20Transfer,
} from "../testHelpers"

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
  ICurveLPInstance,
  MerkleDirectDistributorInstance,
  MerkleDistributorInstance,
  PoolTokensInstance,
  SeniorPoolInstance,
  StakingRewardsInstance,
  TranchedPoolInstance,
  UniqueIdentityInstance,
  ZapperInstance,
} from "@goldfinch-eng/protocol/typechain/truffle"
import {DepositMade} from "@goldfinch-eng/protocol/typechain/truffle/TranchedPool"
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
import {
  DepositedAndStaked,
  DepositedToCurveAndStaked,
  RewardPaid,
  Staked,
  Unstaked,
} from "@goldfinch-eng/protocol/typechain/truffle/StakingRewards"
import {impersonateAccount} from "../../blockchain_scripts/helpers/impersonateAccount"
import {fundWithWhales} from "../../blockchain_scripts/helpers/fundWithWhales"
import {
  BackerRewards,
  CreditLine,
  StakingRewards,
  TranchedPool,
  UniqueIdentity,
} from "@goldfinch-eng/protocol/typechain/ethers"
import {ContractReceipt, Signer} from "ethers"
import BigNumber from "bignumber.js"
import {BorrowerCreated, PoolCreated} from "@goldfinch-eng/protocol/typechain/truffle/GoldfinchFactory"

const THREE_YEARS_IN_SECONDS = 365 * 24 * 60 * 60 * 3
const TOKEN_LAUNCH_TIME = new BN(TOKEN_LAUNCH_TIME_IN_SECONDS).add(new BN(THREE_YEARS_IN_SECONDS))

const setupTest = deployments.createFixture(async ({deployments}) => {
  // Note: base_deploy always returns when mainnet forking, however
  // we need it here, because the "fixture" part is what let's hardhat
  // snapshot and give us a clean blockchain before each test.
  // Otherwise, we have state leaking across tests.
  await deployments.fixture("base_deploy", {keepExistingDeployments: true})

  const [owner, bwr] = await web3.eth.getAccounts()
  assertNonNullable(owner)
  assertNonNullable(bwr)

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

  const zapper: ZapperInstance = await getDeployedAsTruffleContract<ZapperInstance>(deployments, "Zapper")

  return {
    poolTokens,
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
  let goldfinchFactory: GoldfinchFactoryInstance, busd, usdt, cUSDC
  let reserveAddress,
    tranchedPool: TranchedPoolInstance,
    borrower,
    seniorPool: SeniorPoolInstance,
    seniorPoolStrategy,
    go: GoInstance,
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
      zapper,
      gfi,
      communityRewards,
      merkleDistributor,
      merkleDirectDistributor,
      legacyGoldfinchConfig,
      uniqueIdentity,
      signer,
      network,
      ethersUniqueIdentity,
      poolTokens,
    } = await setupTest())
    const usdcAddress = getUSDCAddress(MAINNET_CHAIN_ID)
    assertIsString(usdcAddress)
    const busdAddress = "0x4fabb145d64652a948d72533023f6e7a623c7c53"
    const usdtAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
    const curveAddress = "0x80aa1a80a30055DAA084E599836532F3e58c95E2"
    busd = await artifacts.require("IERC20withDec").at(busdAddress)
    usdt = await artifacts.require("IERC20withDec").at(usdtAddress)
    curvePool = await artifacts.require("ICurveLP").at(curveAddress)
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

  describe("BackerRewards", () => {
    const microTolerance = String(1e5)
    const tolerance = String(1e14)
    let stakingRewardsEthers: StakingRewards
    let backerRewardsEthers: BackerRewards
    let tranchedPoolWithBorrowerConnected: TranchedPool
    let tranchedPoolWithOwnerConnected: TranchedPool
    let backerStakingTokenId: string
    let creditLine: CreditLine
    const paymentPeriodInDays = new BigNumber("30")
    const termInDays = new BigNumber("365")
    const trackedStakedAmount = usdcVal(2500)
    const untrackedStakedAmount = usdcVal(1000)
    const limit = trackedStakedAmount.add(untrackedStakedAmount).mul(new BN("5"))
    const setup = deployments.createFixture(async () => {
      const result = await goldfinchFactory.createPool(
        bwr,
        "20",
        limit.toString(),
        "100000000000000000",
        paymentPeriodInDays.toString(),
        termInDays.toString(),
        "0",
        termInDays.toString(),
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
      await (await tranchedPool.assess()).wait()
      const creditLine = await getEthersContract<CreditLine>("CreditLine", {at: await tranchedPool.creditLine()})
      const interestOwed = await creditLine.interestOwed()
      return (await tranchedPool.pay(interestOwed.toString())).wait()
    }

    async function fullyRepayTranchedPool(tranchedPool: TranchedPool): Promise<ContractReceipt> {
      await (await tranchedPool.assess()).wait()
      const creditLine = await getEthersContract<CreditLine>("CreditLine", {at: await tranchedPool.creditLine()})
      const principalOwed = await creditLine.principalOwed()
      const interestOwed = await creditLine.interestOwed()
      const paymentTx = await (await tranchedPool.pay(principalOwed.add(interestOwed).toString())).wait()
      const principalOwedAfterFinalRepayment = await creditLine.principalOwed()
      const interestOwedAfterFinalRepayment = await creditLine.interestOwed()
      expect(String(principalOwedAfterFinalRepayment)).to.bignumber.eq("0")
      expect(String(interestOwedAfterFinalRepayment)).to.bignumber.eq("0")
      return paymentTx
    }

    it("backers only earn rewards for full payments", async () => {
      await (await tranchedPoolWithBorrowerConnected.drawdown(String(limit))).wait()
      await advanceTime({days: (await creditLine.paymentPeriodInDays()).toString()})
      const partialPaybackTx = await (await tranchedPoolWithBorrowerConnected.pay("1")).wait()
      let backerRewardsEarned = await getBackerStakingRewardsForToken(
        backerStakingTokenId,
        partialPaybackTx.blockNumber
      )
      expect(backerRewardsEarned).to.bignumber.eq("0")

      const interestOwed = await creditLine.interestOwed()
      const fullPaybackTx = await (await tranchedPoolWithBorrowerConnected.pay(interestOwed)).wait()
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
      const numberOfPaymentIntervals = termInDays.dividedBy(paymentPeriodInDays).integerValue().toNumber()

      for (let i = 0; i < numberOfPaymentIntervals; i++) {
        await advanceTime({days: paymentPeriodInDays.toFixed()})
        const payTx = await payOffTranchedPoolInterest(tranchedPoolWithBorrowerConnected)
        await (await tranchedPoolWithOwnerConnected.withdrawMax(backerStakingTokenId)).wait()
        await expectRewardsAreEqualForTokens(stakingRewardsTokenId, backerStakingTokenId, payTx.blockNumber)
      }

      const termEndTime = await creditLine.termEndTime()
      await advanceTime({toSecond: termEndTime.toString()})
      await mineBlock()
      const blockNumAtTermEnd = await ethers.provider.getBlockNumber()
      const stakingRewardsAtTermEnd = await getStakingRewardsForToken(stakingRewardsTokenId, blockNumAtTermEnd)

      // this section tests the final repayment
      // the final repayment is different because if the payment happens after the term is over
      // the backer rewards should be less
      const thirtyDaysAfterTermEndTime = termEndTime.add("2592000") // 30 days in seconds
      await advanceTime({toSecond: thirtyDaysAfterTermEndTime.toString()})
      const paymentTx = await fullyRepayTranchedPool(tranchedPoolWithBorrowerConnected)

      const backerStakingRewardsEarnedAfterFinalRepayment = await getBackerStakingRewardsForToken(
        backerStakingTokenId,
        paymentTx.blockNumber
      )
      expect(backerStakingRewardsEarnedAfterFinalRepayment).to.bignumber.eq(stakingRewardsAtTermEnd)

      // Even long after the final repayment where there was no outstanding principal
      // You should have accrued no rewards during that time
      await advanceTime({days: "365"})
      await mineBlock()
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

      const numberOfPaymentIntervals = termInDays.dividedBy(paymentPeriodInDays).integerValue().toNumber()

      let backerStakingRewardsEarned = await getBackerStakingRewardsForToken(
        backerStakingTokenId,
        initialStakeTx?.blockNumber
      )
      let stakingRewardsEarned = await getStakingRewardsForToken(stakingRewardsTokenId, initialStakeTx?.blockNumber)

      expect(backerStakingRewardsEarned).to.bignumber.eq("0")
      expect(stakingRewardsEarned).to.bignumber.eq("0")

      // Run through the first half of payments normally
      for (let i = 0; i < numberOfPaymentIntervals / 2; i++) {
        await advanceTime({days: paymentPeriodInDays.toFixed()})
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

      // check that the backer doesnt earned rewards on a drawdown
      expect(backerStakingRewardsEarnedAfterSecondDrawdown).to.bignumber.eq(backerStakingRewardsEarned)

      // second half of the payments
      for (let i = numberOfPaymentIntervals / 2; i < numberOfPaymentIntervals; i++) {
        await advanceTime({days: paymentPeriodInDays.toFixed()})
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

      const termEndTime = await creditLine.termEndTime()
      await advanceTime({toSecond: termEndTime.toString()})
      await mineBlock()
      const stakingRewardsAtTermEnd = await getStakingRewardsForToken(stakingRewardsTokenId)
      const secondStakingRewardsAtTermEnd = await getStakingRewardsForToken(secondStakingTokenId)

      // this section tests the final repayment
      // the final repayment is different because if the payment happens after the term is over
      // the backer rewards should be less
      const thirtyDaysAfterTermEnd = termEndTime.add("2592000") // < 30 days in seconds
      await advanceTime({toSecond: thirtyDaysAfterTermEnd.toString()})
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
      await advanceTime({days: "365"})
      await mineBlock()
      const backerStakingRewardsEarnedMuchLater = await getBackerStakingRewardsForToken(backerStakingTokenId)
      expect(backerStakingRewardsEarnedMuchLater).to.bignumber.eq(backerStakingRewardsEarnedAfterFinalRepayment)
    }).timeout(TEST_TIMEOUT)

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
      const numberOfPaymentIntervals = termInDays.dividedBy(paymentPeriodInDays).integerValue().toNumber()

      for (let i = 0; i < numberOfPaymentIntervals / 2; i++) {
        await advanceTime({days: paymentPeriodInDays.toFixed()})
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
      await seniorPool.invest(tranchedPoolWithBorrowerConnected.address)

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

      for (let i = numberOfPaymentIntervals / 2; i < numberOfPaymentIntervals; i++) {
        await advanceTime({days: paymentPeriodInDays.toFixed()})
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
      await advanceTime({toSecond: termEndTime.toString()})
      await mineBlock()
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
      await advanceTime({days: "365"})
      await mineBlock()
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
        const tokenId = new BN(70)

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
