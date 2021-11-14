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
} from "../testHelpers"
import {assertIsString, assertNonNullable} from "@goldfinch-eng/utils"

const setupTest = deployments.createFixture(async ({deployments}) => {
  // Note: base_deploy always returns when mainnet forking, however
  // we need it here, because the "fixture" part is what let's hardhat
  // snapshot and give us a clean blockchain before each test.
  // Otherwise, we have state leaking across tests.
  await deployments.fixture("base_deploy", {keepExistingDeployments: true})

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
  const contractNames = ["SeniorPool", "Fidu", "GoldfinchFactory", "GoldfinchConfig"]
  const existingContracts = await getExistingContracts(contractNames, mainnetMultisigSigner)

  const usdcAddress = getUSDCAddress(MAINNET_CHAIN_ID)
  assertIsString(usdcAddress)
  const usdc = await artifacts.require("IERC20withDec").at(usdcAddress)
  const cUSDC = await artifacts.require("IERC20withDec").at(MAINNET_CUSDC_ADDRESS)

  assertNonNullable(existingContracts.SeniorPool)
  assertNonNullable(existingContracts.Fidu)
  assertNonNullable(existingContracts.GoldfinchConfig)
  assertNonNullable(existingContracts.GoldfinchFactory)

  const seniorPool = await artifacts.require("SeniorPool").at(existingContracts.SeniorPool.ExistingContract.address)

  const fidu = await artifacts.require("Fidu").at(existingContracts.Fidu.ExistingContract.address)

  const goldfinchConfig = await artifacts
    .require("GoldfinchConfig")
    .at(existingContracts.GoldfinchConfig.ExistingContract.address)

  const goldfinchFactory = await artifacts
    .require("GoldfinchFactory")
    .at(existingContracts.GoldfinchFactory.ExistingContract.address)

  const seniorPoolStrategyAddress = await goldfinchConfig.getAddress(CONFIG_KEYS.SeniorPoolStrategy)
  const seniorPoolStrategy = await artifacts.require("FixedLeverageRatioStrategy").at(seniorPoolStrategyAddress)

  return {seniorPool, seniorPoolStrategy, usdc, fidu, goldfinchConfig, goldfinchFactory, cUSDC}
})

export const TEST_TIMEOUT = 180000 // 3 mins

/*
These tests are special. They use existing mainnet state, so
that we can easily and realistically test interactions with outside protocols
and contracts.
*/
// TODO: This is broken until we fix contract upgrades
xdescribe("mainnet forking tests", async function () {
  this.retries(2)

  // eslint-disable-next-line no-unused-vars
  let accounts, owner, bwr, person3, usdc, fidu, goldfinchConfig
  let goldfinchFactory, busd, usdt, cUSDC
  let reserveAddress, tranchedPool, borrower, seniorPool, seniorPoolStrategy

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
    await pool.deposit(TRANCHES.Senior, usdcVal(8000))
  }

  beforeEach(async function () {
    this.timeout(TEST_TIMEOUT)
    accounts = await web3.eth.getAccounts()
    ;[owner, bwr, person3] = accounts
    ;({usdc, goldfinchFactory, seniorPool, seniorPoolStrategy, fidu, goldfinchConfig, cUSDC} = await setupTest())
    const usdcAddress = getUSDCAddress(MAINNET_CHAIN_ID)
    assertIsString(usdcAddress)
    const busdAddress = "0x4fabb145d64652a948d72533023f6e7a623c7c53"
    const usdtAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
    busd = await artifacts.require("IERC20withDec").at(busdAddress)
    usdt = await artifacts.require("IERC20withDec").at(usdtAddress)
    await fundWithWhales(["USDC", "BUSD", "USDT"], [owner, bwr, person3])
    await erc20Approve(usdc, seniorPool.address, MAX_UINT, accounts)
    await goldfinchConfig.bulkAddToGoList(accounts, {from: MAINNET_MULTISIG})
    await setupSeniorPool()
  })

  describe("drawing down into another currency", async function () {
    let bwrCon, oneSplit
    beforeEach(async function () {
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
})
