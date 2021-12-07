import hre, {getNamedAccounts} from "hardhat"
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
} from "../../blockchain_scripts/deployHelpers"
import {
  MAINNET_MULTISIG,
  getExistingContracts,
  impersonateAccount,
  fundWithWhales,
} from "../../blockchain_scripts/mainnetForkingHelpers"
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
} from "../testHelpers"
import {asNonNullable, assertIsString, assertNonNullable} from "@goldfinch-eng/utils"
import {
  BackerRewardsInstance,
  BorrowerInstance,
  FiduInstance,
  FixedLeverageRatioStrategyInstance,
  GFIInstance,
  GoInstance,
  GoldfinchConfigInstance,
  GoldfinchFactoryInstance,
  SeniorPoolInstance,
  StakingRewardsInstance,
  TranchedPoolInstance,
} from "@goldfinch-eng/protocol/typechain/truffle"
import * as migrate22 from "../../blockchain_scripts/migrations/v2.2/migrate"
import * as migrate23 from "../../blockchain_scripts/migrations/v2.3/migrate"
import {DepositMade} from "@goldfinch-eng/protocol/typechain/truffle/TranchedPool"
import {Staked} from "@goldfinch-eng/protocol/typechain/truffle/StakingRewards"

const setupTest = deployments.createFixture(async ({deployments}) => {
  // Note: base_deploy always returns when mainnet forking, however
  // we need it here, because the "fixture" part is what let's hardhat
  // snapshot and give us a clean blockchain before each test.
  // Otherwise, we have state leaking across tests.
  await deployments.fixture("base_deploy", {keepExistingDeployments: true})

  await migrate22.main()
  await migrate23.main()

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

  const goldfinchConfig: GoldfinchConfigInstance = await artifacts
    .require("GoldfinchConfig")
    .at(existingContracts.GoldfinchConfig.ExistingContract.address)

  const newGoldfinchConfig: GoldfinchConfigInstance = await artifacts
    .require("GoldfinchConfig")
    .at(await goldfinchConfig.getAddress(CONFIG_KEYS.GoldfinchConfig))

  const backerRewards: BackerRewardsInstance = await artifacts
    .require("BackerRewards")
    .at(await newGoldfinchConfig.getAddress(CONFIG_KEYS.BackerRewards))

  const goldfinchFactory: GoldfinchFactoryInstance = await artifacts
    .require("GoldfinchFactory")
    .at(existingContracts.GoldfinchFactory.ExistingContract.address)

  const seniorPoolStrategyAddress = await goldfinchConfig.getAddress(CONFIG_KEYS.SeniorPoolStrategy)
  const seniorPoolStrategy: FixedLeverageRatioStrategyInstance = await artifacts
    .require("FixedLeverageRatioStrategy")
    .at(seniorPoolStrategyAddress)

  const stakingRewards: StakingRewardsInstance = await artifacts
    .require("StakingRewards")
    .at(await newGoldfinchConfig.getAddress(CONFIG_KEYS.StakingRewards))

  // GFI is deployed by the temp multisig
  const gfi = await getDeployedAsTruffleContract<GFIInstance>(deployments, "GFI")

  // make protocolOwner the GFI owner and mint
  const protocolOwner = await getProtocolOwner()
  const {temp_multisig} = await getNamedAccounts()
  assertIsString(temp_multisig)
  await fundWithWhales(["ETH"], [temp_multisig])
  await gfi.grantRole(await gfi.MINTER_ROLE(), protocolOwner, {from: temp_multisig})
  await gfi.mint(protocolOwner, bigVal(999_999), {from: protocolOwner})

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
    gfi: GFIInstance

  async function setupSeniorPool() {
    seniorPoolStrategy = await artifacts.require("ISeniorPoolStrategy").at(seniorPoolStrategy.address)

    await goldfinchConfig.setNumber(CONFIG_KEYS.TotalFundsLimit, usdcVal(40000000), {from: MAINNET_MULTISIG})
    await erc20Approve(usdc, seniorPool.address, usdcVal(10000), [owner])
    await seniorPool.deposit(usdcVal(10000), {from: owner})
    await goldfinchConfig.setNumber(CONFIG_KEYS.TotalFundsLimit, usdcVal(20000000), {from: MAINNET_MULTISIG})
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
    } = await setupTest())
    const usdcAddress = getUSDCAddress(MAINNET_CHAIN_ID)
    assertIsString(usdcAddress)
    const busdAddress = "0x4fabb145d64652a948d72533023f6e7a623c7c53"
    const usdtAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
    busd = await artifacts.require("IERC20withDec").at(busdAddress)
    usdt = await artifacts.require("IERC20withDec").at(usdtAddress)
    await fundWithWhales(["USDC", "BUSD", "USDT"], [owner, bwr, person3])
    await erc20Approve(usdc, seniorPool.address, MAX_UINT, accounts)
    await goldfinchConfig.bulkAddToGoList([owner, bwr, person3], {from: MAINNET_MULTISIG})
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
        await goldfinchConfig.setNumber(CONFIG_KEYS.TotalFundsLimit, usdcVal(40000000), {from: MAINNET_MULTISIG})

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
})
