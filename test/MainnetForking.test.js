/* global web3 */
const hre = require("hardhat")
const {
  getUSDCAddress,
  MAINNET_ONE_SPLIT_ADDRESS,
  isMainnetForking,
  getSignerForAddress,
  interestAprAsBN,
  MAINNET_CUSDC_ADDRESS,
  MAINNET_COMP_ADDRESS,
  PAUSER_ROLE,
  MINTER_ROLE,
  TRANCHES,
  ETHDecimals,
} = require("../blockchain_scripts/deployHelpers")
const {
  MAINNET_MULTISIG,
  MAINNET_UNDERWRITER,
  upgradeContracts,
  getExistingContracts,
  getMainnetContracts,
  impersonateAccount,
  fundWithWhales,
  performPostUpgradeMigration,
} = require("../blockchain_scripts/mainnetForkingHelpers")
const {
  deployPoolTokens,
  deploySeniorFund,
  deployTranchedPool,
  deployMigratedTranchedPool,
  deploySeniorFundStrategy,
  deploySeniorFundFidu,
} = require("../blockchain_scripts/baseDeploy")
const {CONFIG_KEYS} = require("../blockchain_scripts/configKeys")
const {time} = require("@openzeppelin/test-helpers")
const {deployments, ethers, artifacts} = hre
const Borrower = artifacts.require("Borrower")
const IOneSplit = artifacts.require("IOneSplit")
const ICUSDC = artifacts.require("ICUSDCContract")
const IV1CreditLine = artifacts.require("IV1CreditLine")
const SeniorFund = artifacts.require("SeniorFund")
const {
  createCreditLine,
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
  SECONDS_PER_DAY,
  BLOCKS_PER_DAY,
  decodeLogs,
  createPoolWithCreditLine,
} = require("./testHelpers")

const TEST_TIMEOUT = 180000 // 3 mins

async function deployV2(contracts) {
  const config = contracts.GoldfinchConfig.UpgradedContract
  const seniorPool = await deploySeniorFund(hre, {config})
  const seniorFundStrategy = await deploySeniorFundStrategy(hre, {config})
  const tranchedPool = await deployTranchedPool(hre, {config})
  const poolTokens = await deployPoolTokens(hre, {config})
  const migratedTranchedPool = await deployMigratedTranchedPool(hre, {config})
  await contracts.GoldfinchConfig.UpgradedContract.bulkAddToGoList([seniorPool.address])
  return {seniorPool, seniorFundStrategy, tranchedPool, poolTokens, migratedTranchedPool}
}

/*
These tests are special. They use existing mainnet state, so
that we can easily and realistically test interactions with outside protocols
and contracts.
*/
describe("mainnet forking tests", async function () {
  // Hack way to only run this suite when we actually want to.
  if (!isMainnetForking()) {
    return
  }
  // eslint-disable-next-line no-unused-vars
  let accounts, owner, bwr, person3, pool, reserve, underwriter, usdc, creditDesk, fidu, goldfinchConfig, usdcAddress
  let goldfinchFactory, busd, usdt, cUSDC, creditLineFactory
  let upgradedContracts
  const contractsToUpgrade = ["CreditDesk", "Pool", "Fidu", "CreditLineFactory", "GoldfinchConfig"]
  const setupTest = deployments.createFixture(async ({deployments}) => {
    // Note: base_deploy always returns when mainnet forking, however
    // we need it here, because the "fixture" part is what let's hardhat
    // snapshot and give us a clean blockchain before each test.
    // Otherewise, we have state leaking across tests.
    await deployments.fixture("base_deploy")

    upgradedContracts = await upgrade(contractsToUpgrade)
    const usdcAddress = getUSDCAddress("mainnet")
    const pool = await artifacts.require("TestPool").at(upgradedContracts.Pool.UpgradedContract.address)
    const usdc = await artifacts.require("IERC20withDec").at(usdcAddress)
    const creditDesk = await artifacts
      .require("TestCreditDesk")
      .at(upgradedContracts.CreditDesk.UpgradedContract.address)
    const fidu = await artifacts.require("Fidu").at(upgradedContracts.Fidu.UpgradedContract.address)
    const goldfinchConfig = await artifacts
      .require("GoldfinchConfig")
      .at(upgradedContracts.GoldfinchConfig.UpgradedContract.address)
    const goldfinchFactory = await artifacts
      .require("CreditLineFactory")
      .at(upgradedContracts.CreditLineFactory.UpgradedContract.address)
    const cUSDC = await artifacts.require("IERC20withDec").at(MAINNET_CUSDC_ADDRESS)
    await creditDesk.setUnderwriterGovernanceLimit(underwriter, usdcVal(100000), {from: MAINNET_MULTISIG})

    return {pool, usdc, creditDesk, fidu, goldfinchConfig, goldfinchFactory, cUSDC, creditLineFactory}
  })

  async function upgrade(contractsToUpgrade) {
    ;[owner, bwr, person3, underwriter, reserve] = await web3.eth.getAccounts()
    const mainnetConfig = getMainnetContracts()
    const mainnetMultisigSigner = await ethers.provider.getSigner(MAINNET_MULTISIG)
    const usdcAddress = getUSDCAddress("mainnet")

    // Ensure the multisig has funds for upgrades and other transactions
    let ownerAccount = await getSignerForAddress(owner)
    await ownerAccount.sendTransaction({to: MAINNET_MULTISIG, value: ethers.utils.parseEther("10.0")})

    await impersonateAccount(hre, MAINNET_MULTISIG)
    const erc20s = [{ticker: "USDC", contract: await ethers.getContractAt("IERC20withDec", usdcAddress)}]
    await fundWithWhales(erc20s, [owner, bwr])
    const existingContracts = await getExistingContracts(contractsToUpgrade, mainnetConfig, mainnetMultisigSigner)

    const contracts = await upgradeContracts(
      contractsToUpgrade,
      existingContracts,
      mainnetMultisigSigner,
      owner,
      deployments
    )
    await performPostUpgradeMigration(contracts, deployments)
    return contracts
  }

  beforeEach(async function () {
    this.timeout(TEST_TIMEOUT)
    accounts = await web3.eth.getAccounts()
    ;[owner, bwr, person3, underwriter, reserve] = accounts
    ;({usdc, creditDesk, goldfinchFactory, pool, fidu, goldfinchConfig, cUSDC} = await setupTest())
    const usdcAddress = getUSDCAddress("mainnet")
    const busdAddress = "0x4fabb145d64652a948d72533023f6e7a623c7c53"
    const usdtAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
    busd = await artifacts.require("IERC20withDec").at(busdAddress)
    usdt = await artifacts.require("IERC20withDec").at(usdtAddress)

    let erc20s = [
      {ticker: "USDC", contract: await ethers.getContractAt("IERC20withDec", usdcAddress)},
      {ticker: "BUSD", contract: await ethers.getContractAt("IERC20withDec", busdAddress)},
      {ticker: "USDT", contract: await ethers.getContractAt("IERC20withDec", usdtAddress)},
    ]
    await fundWithWhales(erc20s, [owner, bwr, person3])
    await erc20Approve(usdc, pool.address, MAX_UINT, accounts)
    await pool.sweepFromCompound({from: MAINNET_MULTISIG})
    await goldfinchConfig.bulkAddToGoList(accounts, {from: MAINNET_MULTISIG})
  })

  describe("drawing down into another currency", async function () {
    let bwrCon, cl, oneSplit
    beforeEach(async function () {
      oneSplit = await IOneSplit.at(MAINNET_ONE_SPLIT_ADDRESS)
      const result = await goldfinchFactory.createBorrower(bwr)
      let bwrConAddr = result.logs[result.logs.length - 1].args.borrower
      bwrCon = await Borrower.at(bwrConAddr)

      cl = await createCreditLine({creditDesk, borrower: bwrCon.address, underwriter})
    })

    it("should let you drawdown to tether", async function () {
      let usdcAmount = usdcVal(10)
      const expectedReturn = await oneSplit.getExpectedReturn(usdc.address, usdt.address, usdcAmount, 10, 0, {
        from: bwr,
      })
      await expectAction(() => {
        return bwrCon.drawdownWithSwapOnOneInch(
          cl.address,
          usdcAmount,
          person3,
          usdt.address,
          expectedReturn.returnAmount.mul(new BN(99)).div(new BN(100)),
          expectedReturn.distribution,
          {from: bwr}
        )
      }).toChange([
        [async () => await getBalance(pool.address, usdc), {by: usdcAmount.neg()}],
        [async () => await getBalance(bwrCon.address, usdt), {by: new BN(0)}],
        [async () => await getBalance(person3, usdt), {byCloseTo: expectedReturn.returnAmount}],
        [async () => await getBalance(bwr, usdt), {by: new BN(0)}],
      ])
    }).timeout(TEST_TIMEOUT)

    describe("address forwarding", async () => {
      it("should support forwarding the money to another address", async () => {
        let usdcAmount = usdcVal(10)
        const expectedReturn = await oneSplit.getExpectedReturn(usdc.address, usdt.address, usdcAmount, 10, 0, {
          from: bwr,
        })
        await expectAction(() => {
          return bwrCon.drawdownWithSwapOnOneInch(
            cl.address,
            usdcAmount,
            person3,
            usdt.address,
            expectedReturn.returnAmount.mul(new BN(99)).div(new BN(100)),
            expectedReturn.distribution,
            {from: bwr}
          )
        }).toChange([
          [async () => await getBalance(pool.address, usdc), {by: usdcAmount.neg()}],
          [async () => await getBalance(person3, usdt), {byCloseTo: expectedReturn.returnAmount}],
          [async () => await getBalance(bwr, usdt), {by: new BN(0)}],
          [async () => await getBalance(bwrCon.address, usdt), {by: new BN(0)}],
        ])
      }).timeout(TEST_TIMEOUT)

      context("addressToSendTo is the contract address", async () => {
        it("should default to msg.sender", async function () {
          let usdcAmount = usdcVal(10)
          const expectedReturn = await oneSplit.getExpectedReturn(usdc.address, usdt.address, usdcAmount, 10, 0, {
            from: bwr,
          })
          await expectAction(() => {
            return bwrCon.drawdownWithSwapOnOneInch(
              cl.address,
              usdcAmount,
              bwrCon.address,
              usdt.address,
              expectedReturn.returnAmount.mul(new BN(99)).div(new BN(100)),
              expectedReturn.distribution,
              {from: bwr}
            )
          }).toChange([
            [async () => await getBalance(pool.address, usdc), {by: usdcAmount.neg()}],
            [async () => await getBalance(bwr, usdt), {byCloseTo: expectedReturn.returnAmount}],
            [async () => await getBalance(bwrCon.address, usdt), {by: new BN(0)}],
          ])
        }).timeout(TEST_TIMEOUT)
      })

      context("addressToSendTo is the zero address", async () => {
        it("should default to msg.sender", async () => {
          let usdcAmount = usdcVal(10)
          const expectedReturn = await oneSplit.getExpectedReturn(usdc.address, usdt.address, usdcAmount, 10, 0, {
            from: bwr,
          })
          await expectAction(() => {
            return bwrCon.drawdownWithSwapOnOneInch(
              cl.address,
              usdcAmount,
              ZERO_ADDRESS,
              usdt.address,
              expectedReturn.returnAmount.mul(new BN(99)).div(new BN(100)),
              expectedReturn.distribution,
              {from: bwr}
            )
          }).toChange([
            [async () => await getBalance(pool.address, usdc), {by: usdcAmount.neg()}],
            [async () => await getBalance(bwr, usdt), {byCloseTo: expectedReturn.returnAmount}],
            [async () => await getBalance(bwrCon.address, usdt), {by: new BN(0)}],
          ])
        }).timeout(TEST_TIMEOUT)
      })
    })

    it("should let you drawdown to BUSD", async function () {
      let usdcAmount = usdcVal(10)
      const expectedReturn = await oneSplit.getExpectedReturn(usdc.address, busd.address, usdcAmount, 10, 0, {
        from: bwr,
      })
      await expectAction(() => {
        return bwrCon.drawdownWithSwapOnOneInch(
          cl.address,
          usdcAmount,
          person3,
          busd.address,
          expectedReturn.returnAmount.mul(new BN(99)).div(new BN(100)),
          expectedReturn.distribution,
          {from: bwr}
        )
      }).toChange([
        [async () => await getBalance(pool.address, usdc), {by: usdcAmount.neg()}],
        [async () => await getBalance(person3, busd), {byCloseTo: expectedReturn.returnAmount}],
        [async () => await getBalance(bwr, busd), {by: new BN(0)}],
        [async () => await getBalance(bwrCon.address, busd), {by: new BN(0)}],
      ])
    }).timeout(TEST_TIMEOUT)
  })

  describe("paying back via another currency", async function () {
    let bwrCon, cl, oneSplit
    let amount = usdcVal(100)
    beforeEach(async function () {
      this.timeout(TEST_TIMEOUT)
      oneSplit = await IOneSplit.at(MAINNET_ONE_SPLIT_ADDRESS)
      const result = await goldfinchFactory.createBorrower(bwr)
      let bwrConAddr = result.logs[result.logs.length - 1].args.borrower
      bwrCon = await Borrower.at(bwrConAddr)
      await erc20Approve(busd, bwrCon.address, MAX_UINT, [bwr])
      await erc20Approve(usdt, bwrCon.address, MAX_UINT, [bwr])

      cl = await createCreditLine({creditDesk, borrower: bwrCon.address, underwriter})
      await bwrCon.drawdown(cl.address, amount, bwr, {from: bwr})
    })

    it("should allow you to pay with another currency", async () => {
      // USDT has the same decimals as USDC, so USDC val is fine here.
      let rawAmount = 10
      let usdtAmount = usdcVal(rawAmount)
      const expectedReturn = await oneSplit.getExpectedReturn(usdt.address, usdc.address, usdtAmount, 10, 0, {
        from: bwr,
      })
      await expectAction(() => {
        return bwrCon.payWithSwapOnOneInch(
          cl.address,
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
      await advanceTime(creditDesk, {toSecond: (await cl.nextDueTime()).add(new BN(1))})
      await expectAction(() => creditDesk.assessCreditLine(cl.address)).toChange([
        [async () => await cl.balance(), {decrease: true}],
        [async () => await getBalance(cl.address, usdc), {to: new BN(0)}],
      ])
    }).timeout(TEST_TIMEOUT)

    it("Works with BUSD", async () => {
      let rawAmount = 10
      let busdAmount = bigVal(rawAmount)
      const expectedReturn = await oneSplit.getExpectedReturn(busd.address, usdc.address, busdAmount, 10, 0, {
        from: bwr,
      })
      await expectAction(() => {
        return bwrCon.payWithSwapOnOneInch(
          cl.address,
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
      await advanceTime(creditDesk, {toSecond: (await cl.nextDueTime()).add(new BN(1))})
      await expectAction(() => creditDesk.assessCreditLine(cl.address)).toChange([
        [async () => await cl.balance(), {decrease: true}],
        [async () => await getBalance(cl.address, usdc), {to: new BN(0)}],
      ])
    }).timeout(TEST_TIMEOUT)

    describe("payMultipleWithSwapOnOneInch", async () => {
      let cl2
      let amount2 = usdcVal(50)

      beforeEach(async function () {
        this.timeout(TEST_TIMEOUT)
        cl2 = await createCreditLine({creditDesk, borrower: bwrCon.address, underwriter})
        expect(cl.address).to.not.eq(cl2.addresss)
        await bwrCon.drawdown(cl2.address, amount2, bwr, {from: bwr})
      })

      it("should pay back multiple loans", async () => {
        let padding = usdcVal(50)
        let originAmount = amount.add(amount2).add(padding)
        const expectedReturn = await oneSplit.getExpectedReturn(usdt.address, usdc.address, originAmount, 10, 0, {
          from: bwr,
        })
        let totalMinAmount = amount.add(amount2)
        let expectedExtra = expectedReturn.returnAmount.sub(totalMinAmount)

        await advanceTime(creditDesk, {toSecond: (await cl.nextDueTime()).add(new BN(1))})
        await creditDesk.assessCreditLine(cl.address)

        await expectAction(() =>
          bwrCon.payMultipleWithSwapOnOneInch(
            [cl.address, cl2.address],
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

  describe("compound integration", async () => {
    let bwrCon, cl, reserveAddress
    beforeEach(async function () {
      this.timeout(TEST_TIMEOUT)
      const result = await goldfinchFactory.createBorrower(bwr)
      let bwrConAddr = result.logs[result.logs.length - 1].args.borrower
      bwrCon = await Borrower.at(bwrConAddr)
      reserveAddress = await goldfinchConfig.getAddress(CONFIG_KEYS.TreasuryReserve)
      await goldfinchConfig.setNumber(CONFIG_KEYS.TotalFundsLimit, usdcVal(20000000), {from: MAINNET_MULTISIG})
      cl = await createCreditLine({creditDesk, borrower: bwrCon.address, underwriter})
    })

    it("should redeem from compound and recognize interest on drawdown", async function () {
      let usdcAmount = usdcVal(10)
      const poolValue = await getBalance(pool.address, usdc)

      await expectAction(() => {
        return pool.sweepToCompound({from: MAINNET_MULTISIG})
      }).toChange([
        [() => getBalance(pool.address, usdc), {to: new BN(0)}], // The pool balance is swept to compound
        [() => getBalance(pool.address, cUSDC), {increase: true}], // Pool should gain some cTokens
        [() => pool.assets(), {by: new BN(0)}], // Pool's assets should not change (it should include amount on compound)
      ])

      const originalSharePrice = await pool.sharePrice()

      const BLOCKS_TO_MINE = 10
      await time.advanceBlockTo((await time.latestBlock()).add(new BN(BLOCKS_TO_MINE)))

      let originalReserveBalance = await getBalance(reserveAddress, usdc)

      await expectAction(() => {
        return bwrCon.drawdown(cl.address, usdcAmount, bwr, {from: bwr})
      }).toChange([
        [() => getBalance(pool.address, usdc), {byCloseTo: poolValue.sub(usdcAmount)}], // regained usdc
        [() => getBalance(pool.address, cUSDC), {to: new BN(0)}], // No more cTokens
        [() => getBalance(bwr, usdc), {by: usdcAmount}], // borrower drew down the balance
      ])

      // Pool originally had 100, 10 was drawndown, we expect 90 to remain, but it's going to be slightly more due
      // to interest collected
      let poolBalanceChange = (await getBalance(pool.address, usdc)).sub(poolValue.sub(usdcAmount))
      let reserveBalanceChange = (await getBalance(reserveAddress, usdc)).sub(originalReserveBalance)
      const interestGained = poolBalanceChange.add(reserveBalanceChange)
      expect(interestGained).to.bignumber.gt(new BN(0))

      const newSharePrice = await pool.sharePrice()

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
      let usdcAmount = usdcVal(100)
      await pool.deposit(usdcAmount, {from: bwr})
      await expectAction(() => {
        return pool.sweepToCompound({from: MAINNET_MULTISIG})
      }).toChange([
        [() => getBalance(pool.address, usdc), {to: new BN(0)}],
        [() => getBalance(pool.address, cUSDC), {increase: true}],
        [() => pool.assets(), {by: new BN(0)}],
      ])

      const WITHDRAWL_FEE_DENOMINATOR = new BN(200)
      const expectedWithdrawAmount = usdcAmount.sub(usdcAmount.div(WITHDRAWL_FEE_DENOMINATOR))
      await expectAction(() => {
        return pool.withdraw(usdcAmount, {from: bwr})
      }).toChange([
        [() => getBalance(pool.address, usdc), {increase: true}], // USDC withdrawn, but interest was collected
        [() => getBalance(pool.address, cUSDC), {to: new BN(0)}], // No more cTokens
        [() => getBalance(bwr, usdc), {by: expectedWithdrawAmount}], // borrower drew down the full balance minus withdraw fee
        [() => pool.sharePrice(), {increase: true}], // Due to interest collected, the exact math is tested above
      ])
    }).timeout(TEST_TIMEOUT)

    it("does not allow sweeping to compound when there is already a balance", async () => {
      await pool.sweepToCompound({from: MAINNET_MULTISIG})

      await expect(pool.sweepToCompound({from: MAINNET_MULTISIG})).to.be.rejectedWith(/Cannot sweep/)
    }).timeout(TEST_TIMEOUT)

    it("can only be swept by the owner", async () => {
      await expect(pool.sweepToCompound({from: bwr})).to.be.rejectedWith(/Must have admin role/)
      await expect(pool.sweepFromCompound({from: bwr})).to.be.rejectedWith(/Must have admin role/)
    }).timeout(TEST_TIMEOUT)
  })

  describe("SeniorFund", async () => {
    describe("compound integration", async () => {
      let reserveAddress, tranchedPool, borrower, seniorPool, seniorFundStrategy, seniorFundFidu
      let limit = usdcVal(100000)
      let interestApr = interestAprAsBN("5.00")
      let paymentPeriodInDays = new BN(30)
      let termInDays = new BN(365)
      let lateFeeApr = new BN(0)
      let juniorFeePercent = new BN(20)
      let juniorInvestmentAmount = usdcVal(1000)

      beforeEach(async function () {
        this.timeout(TEST_TIMEOUT)
        ;({seniorPool, seniorFundStrategy} = await deployV2(upgradedContracts))
        seniorPool = await SeniorFund.at(seniorPool.address)

        seniorFundStrategy = await artifacts.require("IFundStrategy").at(seniorFundStrategy.address)
        // TODO: these should go away when we remove SeniorFundFidu in favor of Fidu
        seniorFundFidu = await deploySeniorFundFidu(hre, {
          config: upgradedContracts.GoldfinchConfig.UpgradedContract,
        })
        seniorFundFidu = await artifacts.require("SeniorFundFidu").at(seniorFundFidu.address)
        if (!(await seniorFundFidu.hasRole(MINTER_ROLE, seniorPool.address))) {
          await seniorFundFidu.grantRole(MINTER_ROLE, seniorPool.address)
        }

        await erc20Approve(usdc, seniorPool.address, usdcVal(10000), [owner])
        await seniorPool.deposit(usdcVal(10000), {from: owner})

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
        await goldfinchConfig.setNumber(CONFIG_KEYS.TotalFundsLimit, usdcVal(20000000), {from: MAINNET_MULTISIG})

        await erc20Approve(usdc, tranchedPool.address, usdcVal(100000), [owner])
        await tranchedPool.deposit(TRANCHES.Junior, juniorInvestmentAmount)
      })

      it("should redeem from compound and recognize interest on invest", async function () {
        await tranchedPool.lockJuniorCapital({from: borrower})
        let usdcAmount = await seniorFundStrategy.invest(seniorPool.address, tranchedPool.address)
        const seniorPoolValue = await getBalance(seniorPool.address, usdc)

        await expectAction(() => {
          // TODO: owner should be MAINNET_MULTISIG
          return seniorPool.sweepToCompound({from: owner})
        }).toChange([
          [() => getBalance(seniorPool.address, usdc), {to: new BN(0)}], // The pool balance is swept to compound
          [() => getBalance(seniorPool.address, cUSDC), {increase: true}], // Pool should gain some cTokens
          [() => seniorPool.assets(), {by: new BN(0)}], // Pool's assets should not change (it should include amount on compound)
        ])

        const originalSharePrice = await seniorPool.sharePrice()

        const BLOCKS_TO_MINE = 10
        await time.advanceBlockTo((await time.latestBlock()).add(new BN(BLOCKS_TO_MINE)))

        let originalReserveBalance = await getBalance(reserveAddress, usdc)

        await expectAction(() => seniorPool.invest(tranchedPool.address, {from: MAINNET_MULTISIG}), true).toChange([
          [() => getBalance(seniorPool.address, usdc), {byCloseTo: seniorPoolValue.sub(usdcAmount)}], // regained usdc
          [() => getBalance(seniorPool.address, cUSDC), {to: new BN(0)}], // No more cTokens
          [() => getBalance(tranchedPool.address, usdc), {by: usdcAmount}], // Funds were transferred to TranchedPool
        ])

        let poolBalanceChange = (await getBalance(seniorPool.address, usdc)).sub(seniorPoolValue.sub(usdcAmount))
        let reserveBalanceChange = (await getBalance(reserveAddress, usdc)).sub(originalReserveBalance)
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
          .div(await seniorFundFidu.totalSupply())
          .add(originalSharePrice)

        expect(newSharePrice).to.bignumber.gt(originalSharePrice)
        expect(newSharePrice).to.bignumber.equal(expectedSharePrice)
      }).timeout(TEST_TIMEOUT)

      it("should redeem from compound and recognize interest on withdraw", async function () {
        let usdcAmount = usdcVal(100)
        await erc20Approve(usdc, seniorPool.address, usdcAmount, [bwr])
        await seniorPool.deposit(usdcAmount, {from: bwr})
        await expectAction(() => {
          return seniorPool.sweepToCompound({from: owner})
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
        await seniorPool.sweepToCompound({from: owner})

        await expect(seniorPool.sweepToCompound({from: owner})).to.be.rejectedWith(/Cannot sweep/)
      }).timeout(TEST_TIMEOUT)

      it("can only be swept by the owner", async () => {
        await expect(seniorPool.sweepToCompound({from: bwr})).to.be.rejectedWith(/Must have admin role/)
        await expect(seniorPool.sweepFromCompound({from: bwr})).to.be.rejectedWith(/Must have admin role/)
      }).timeout(TEST_TIMEOUT)
    })
  })
})

// Note: These tests use ethers contracts instead of the truffle contracts.
describe("mainnet upgrade tests", async function () {
  if (!isMainnetForking()) {
    return
  }
  let owner, bwr, mainnetMultisigSigner, mainnetConfig, usdcTruffleContract
  const contractsToUpgrade = ["CreditDesk", "Pool", "Fidu", "CreditLineFactory", "GoldfinchConfig"]

  beforeEach(async function () {
    this.timeout(TEST_TIMEOUT)
    // Note: base_deploy always returns when mainnet forking, however
    // we need it here, because the "fixture" part is what let's hardhat
    // snapshot and give us a clean blockchain before each test.
    // Otherewise, we have state leaking across tests.
    await deployments.fixture("base_deploy")
    ;[owner, bwr] = await web3.eth.getAccounts()
    const usdcAddress = getUSDCAddress("mainnet")
    usdcTruffleContract = await artifacts.require("IERC20withDec").at(usdcAddress)

    mainnetConfig = getMainnetContracts()
    mainnetMultisigSigner = await ethers.provider.getSigner(MAINNET_MULTISIG)

    // Ensure the multisig has funds for upgrades and other transactions
    let ownerAccount = await getSignerForAddress(owner)
    await ownerAccount.sendTransaction({to: MAINNET_MULTISIG, value: ethers.utils.parseEther("5.0")})

    // Ensure mainnet underwriter has funds for transactions
    await ownerAccount.sendTransaction({to: MAINNET_UNDERWRITER, value: ethers.utils.parseEther("5.0")})

    await impersonateAccount(hre, MAINNET_MULTISIG)
    await impersonateAccount(hre, MAINNET_UNDERWRITER)
    const erc20s = [{ticker: "USDC", contract: await ethers.getContractAt("IERC20withDec", usdcAddress)}]
    await fundWithWhales(erc20s, [owner, bwr])
  })

  async function upgrade(contractsToUpgrade, contracts) {
    contracts = await upgradeContracts(contractsToUpgrade, contracts, mainnetMultisigSigner, owner, deployments)
    await performPostUpgradeMigration(contracts, deployments)
    await contracts.GoldfinchConfig.UpgradedContract.bulkAddToGoList(await web3.eth.getAccounts())
    return contracts
  }

  async function calculateTermTimes(clAddress) {
    const creditLine = await IV1CreditLine.at(clAddress)
    const termEndBlock = await creditLine.termEndBlock()
    const termInDays = await creditLine.termInDays()
    const termStartBlock = termEndBlock.sub(new BN(BLOCKS_PER_DAY).mul(termInDays))
    const termStartTime = (await web3.eth.getBlock(String(termStartBlock))).timestamp
    return {termEndTime: termStartTime + SECONDS_PER_DAY * termInDays.toNumber(), termStartTime}
  }

  async function calculateNextDueTime(clAddress, termStartTime) {
    const creditLine = await IV1CreditLine.at(clAddress)
    const nextDueBlock = await creditLine.nextDueBlock()
    const termInDays = await creditLine.termInDays()
    const termEndBlock = await creditLine.termEndBlock()
    const termStartBlock = termEndBlock.sub(new BN(BLOCKS_PER_DAY).mul(termInDays))
    const percentComplete =
      nextDueBlock.sub(termStartBlock).toNumber() / termInDays.mul(new BN(BLOCKS_PER_DAY)).toNumber()
    const percentCompleteInDays = percentComplete * termInDays
    return termStartTime + percentCompleteInDays * SECONDS_PER_DAY
  }

  async function getBlockTimestamp(blockNumber) {
    // Mainnet forking has a bug where it's claiming invalid signature when
    // attempting to call getBlock on this blockNumber. Lower block numbers work just fine
    // Not sure what's going on, but confirmed calling idential code on actual mainnet works
    // as expected. Don't want to fight with Hardhat right now, so hardcoding the true result
    if (blockNumber === 12430756) {
      return 1620438286
    }
    return (await web3.eth.getBlock(String(blockNumber))).timestamp
  }

  const borrowerAddresses = {
    "0xEEE76fFacd818Bd54CEDACD5E970736c91Deb795": {
      addresses: ["0xEEE76fFacd818Bd54CEDACD5E970736c91Deb795", "0xa9f9ce97e5244ebe307dbcc4feb18422e63b38ee"],
      label: "QuickCheck $150k Creditline",
    },
    "0x6dDC3a7233ecD5514607FB1a0E3475A7dA6E58ED": {
      addresses: ["0x4e38c33db5332975bd4dc63cfd9ff42b21eb2ad6", "0x6dDC3a7233ecD5514607FB1a0E3475A7dA6E58ED"],
      label: "QuickCheck $300k Creditline",
    },
    "0x2c3837122f9a5c88ad1d995eccda79c33d89fed4": {
      addresses: ["0x2c3837122f9a5c88ad1d995eccda79c33d89fed4"],
      label: "Aspire $150k Creditline",
    },
    "0xdc5c5e6b86835b608066d119b428d21b988ff663": {
      addresses: ["0xdc5c5e6b86835b608066d119b428d21b988ff663"],
      label: "Aspire $300k Creditline",
    },
    "0x0039aB09f6691F5A7716890864A289903b3AE548": {
      addresses: ["0x443c2ea20cd50dbcefa1352af962d1b6fa486d81", "0x0039aB09f6691F5A7716890864A289903b3AE548"],
      label: "PayJoy $100k Creditline",
    },
    "0xc7b11c0Ab6aB785B1E4Cc73f3f33d7Afa75aD427": {
      addresses: ["0xc7b11c0Ab6aB785B1E4Cc73f3f33d7Afa75aD427"],
      label: "Blake Test CreditLine",
    },
  }

  async function calculateTotalPaid(pool, creditLine) {
    // I verified this appears to return the right amounts, based on events
    // received for the quick check creditline, cross checked with
    // https://docs.google.com/spreadsheets/d/1trna25FAnzBtTDnWoBC9-JMZ-PRn-I87jNc7o9KLrto/edit#gid=0
    const otherPool = await artifacts.require("TestPool").at(pool.address)
    const web3Pool = new web3.eth.Contract(otherPool.abi, pool.address)
    const info = borrowerAddresses[creditLine]
    const events = await getPoolEvents(web3Pool, info.addresses)
    const totalInterestPaid = events
      .filter((val) => val.event === "InterestCollected")
      .reduce(
        (sum, curVal) => sum.add(new BN(curVal.returnValues.poolAmount)).add(new BN(curVal.returnValues.reserveAmount)),
        new BN(0)
      )
    const totalPrincipalPaid = events
      .filter((val) => val.event === "PrincipalCollected")
      .reduce((sum, curVal) => sum.add(new BN(curVal.returnValues.amount)), new BN(0))
    return {totalInterestPaid, totalPrincipalPaid}
  }

  async function getPoolEvents(web3Pool, addresses, events = ["InterestCollected", "PrincipalCollected"]) {
    const [interestCollected, principalCollected] = await Promise.all(
      events.map((eventName) => {
        return web3Pool.getPastEvents(eventName, {
          filter: {payer: addresses},
          fromBlock: 10360444, // Roughly May, 2020, well before we launched the protocol
          to: "latest",
        })
      })
    )
    return interestCollected.concat(principalCollected).filter((n) => n)
  }

  describe("migrating the Pool to the Senior Pool", async () => {
    it("should work", async () => {
      let contracts = await getExistingContracts(contractsToUpgrade, mainnetConfig, mainnetMultisigSigner)

      let existingSharePrice = await contracts.Pool.ExistingContract.sharePrice()

      expect(existingSharePrice.isZero()).to.be.false

      contracts = await upgrade(contractsToUpgrade, contracts)

      const {seniorPool} = await deployV2(contracts)

      const fidu = contracts.Fidu.UpgradedContract
      const seniorPoolSharePrice = await seniorPool.sharePrice()
      const cUSDC = await ICUSDC.at(MAINNET_CUSDC_ADDRESS)
      const comp = await ICUSDC.at(MAINNET_COMP_ADDRESS)
      const legacyPool = contracts.Pool.UpgradedContract
      const usdcBalance = await getBalance(legacyPool.address, usdcTruffleContract)
      const cUSDCBalance = await cUSDC.balanceOfUnderlying.call(legacyPool.address)
      const expectedTotalUSDC = usdcBalance.add(cUSDCBalance)

      expect(String(seniorPoolSharePrice)).to.eq(String(existingSharePrice))
      await expectAction(() => legacyPool.migrateToSeniorPool()).toChange([
        [() => getBalance(legacyPool.address, cUSDC), {to: new BN(0)}],
        // All the USDC was already in Compound
        [() => getBalance(legacyPool.address, usdcTruffleContract), {by: new BN(0)}],
        // Won't be exact because cUSDC exchange rate will change when calling the migration function
        [() => getBalance(seniorPool.address, usdcTruffleContract), {toCloseTo: expectedTotalUSDC}],
        [() => getBalance(seniorPool.address, comp), {increase: true}],
        [() => fidu.hasRole(PAUSER_ROLE, legacyPool.address), {to: false, bignumber: false}],
        [() => fidu.hasRole(MINTER_ROLE, legacyPool.address), {to: false, bignumber: false}],
        [() => legacyPool.paused(), {to: true, bignumber: false}],
      ])
      // Share price should be unchanged
      expect(String(await seniorPool.sharePrice())).to.eq(String(seniorPoolSharePrice))
    }).timeout(TEST_TIMEOUT)
  })

  describe("migrating credit lines to V2", async () => {
    it("should correctly migrate a credit line", async () => {
      // Upgrade to V2
      let contracts = await getExistingContracts(contractsToUpgrade, mainnetConfig, mainnetMultisigSigner)
      contracts = await upgrade(contractsToUpgrade, contracts)
      const {poolTokens: poolTokensEthers, seniorPool} = await deployV2(contracts)

      // Setup tons of variables and contracts we'll need,
      // including QuickCheck's $300k credit line that we'll test against
      const creditDesk = await artifacts.require("TestCreditDesk").at(contracts.CreditDesk.UpgradedContract.address)
      const quickCheck = await IV1CreditLine.at("0x6dDC3a7233ecD5514607FB1a0E3475A7dA6E58ED")
      const creditLineFactory = await artifacts.require("CreditLineFactory").at(mainnetConfig.CreditLineFactory.address)
      const poolTokens = await artifacts.require("PoolTokens").at(poolTokensEthers.address)
      const {termEndTime, termStartTime} = await calculateTermTimes(quickCheck.address)
      const nextDueTime = await calculateNextDueTime(quickCheck.address, termStartTime)
      const interestAccruedAsOf = await getBlockTimestamp((await quickCheck.interestAccruedAsOfBlock()).toNumber())
      const lastFullPaymentTime = await getBlockTimestamp((await quickCheck.lastFullPaymentBlock()).toNumber())
      const {totalInterestPaid, totalPrincipalPaid} = await calculateTotalPaid(
        contracts.Pool.UpgradedContract,
        "0x6dDC3a7233ecD5514607FB1a0E3475A7dA6E58ED"
      )
      const originalBalance = await quickCheck.balance()
      const originalUSDCBalance = await getBalance(quickCheck.address, usdcTruffleContract)

      // Sanity check the calculated numbers for QuickCheck's $300k credit line
      expect(termEndTime).to.eq(1643309098) // Thu Jan 27 2022 18:44:58 GMT
      expect(termStartTime).to.eq(1611773098) // Wed Jan 27 2021 18:44:58 GMT
      expect(nextDueTime).to.eq(1624733098) // Sat Jun 26 2021 18:44:58 GMT

      // Actually migrate
      const tx = await creditDesk.migrateV1CreditLine(
        quickCheck.address,
        termEndTime,
        nextDueTime,
        interestAccruedAsOf,
        lastFullPaymentTime,
        totalInterestPaid,
        totalPrincipalPaid,
        {from: MAINNET_MULTISIG}
      )
      // Can't migrate twice!
      await expect(
        creditDesk.migrateV1CreditLine(
          quickCheck.address,
          termEndTime,
          nextDueTime,
          interestAccruedAsOf,
          lastFullPaymentTime,
          totalInterestPaid,
          totalPrincipalPaid,
          {from: MAINNET_MULTISIG}
        )
      ).to.be.rejectedWith(/Can't migrate empty credit line/)

      // Setup a bunch more vars we'll need for the expectations
      const event = decodeLogs(tx.receipt.rawLogs, creditLineFactory.abi, "PoolCreated")[0]
      const tokenEvent = decodeLogs(tx.receipt.rawLogs, poolTokens.abi, "TokenMinted")[0]
      const tokenId = tokenEvent.args.tokenId
      const tranchedPool = await artifacts.require("TranchedPool").at(event.args.pool)
      const newClAddress = await tranchedPool.creditLine()
      const newCl = await artifacts.require("CreditLine").at(newClAddress)

      // Group 1: Creditline is closed out
      expect(await quickCheck.balance()).to.bignumber.eq(new BN(0))
      expect(await quickCheck.limit()).to.bignumber.eq(new BN(0))

      // Group 2: New Creditline has all expected values set
      expect(String(await newCl.balance())).to.eq(String(originalBalance))
      expect(String(await newCl.termEndTime())).to.eq(String(termEndTime))
      expect(String(await newCl.nextDueTime())).to.eq(String(nextDueTime))
      expect(String(await newCl.interestAccruedAsOf())).to.eq(String(interestAccruedAsOf))
      expect(String(await newCl.lastFullPaymentTime())).to.eq(String(lastFullPaymentTime))
      // TODO: Test that InterestAccrued is also set correctly!
      expect(await getBalance(newCl.address, usdcTruffleContract)).to.bignumber.eq(originalUSDCBalance)

      // Group 3: TranchedPool has expected tranche values
      const seniorTranche = await tranchedPool.getTranche(TRANCHES.Senior)
      const juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)

      // Group 4: Senior Tranch should be empty
      expect(seniorTranche.principalDeposited).to.eq("0")
      expect(seniorTranche.principalSharePrice).to.eq("0")
      expect(seniorTranche.interestSharePrice).to.eq("0")
      expect(seniorTranche.lockedAt).not.to.eq("0")

      // Group 5: Junior Tranch should be correct
      expect(juniorTranche.principalDeposited).to.eq(String(originalBalance))
      expect(totalInterestPaid.mul(ETHDecimals).div(originalBalance)).to.bignumber.eq(
        new BN(juniorTranche.interestSharePrice)
      )
      expect(totalPrincipalPaid.mul(ETHDecimals).div(originalBalance)).to.bignumber.eq(
        new BN(juniorTranche.principalSharePrice)
      )
      expect(juniorTranche.lockedAt).not.to.eq("0")

      // Group 6: Minted the correct tokens to the SeniorPool
      const tokenInfo = await poolTokens.getTokenInfo(tokenId)
      expect(tokenInfo.tranche).to.equal(String(TRANCHES.Junior))
      expect(tokenInfo.principalAmount).to.equal(String(originalBalance))
      expect(tokenInfo.principalRedeemed).to.equal(String(totalPrincipalPaid))
      expect(tokenInfo.interestRedeemed).to.equal(String(totalInterestPaid))
      expect(await poolTokens.ownerOf(tokenId)).to.eq(seniorPool.address)

      /*
      TODO: Requires Mark's where we start to track interest accrued:
      Advance time. Assess. Borrower should owe the expected amount

      await tranchedPool.assess()
      await advanceTime(creditDesk, {days: 31})
      await expectAction(() => tranchedPool.assess(), true).toChange([
        [() => newCl.interestAccrued(), {by: new BN(3698627078)}],
        [() => newCl.principalAccrued(), {by: new BN(0)}],
      ])
      */
    })

    it("should maintain the withdraw balance of senior pool investors after full migration", async () => {
      /*
        The test is...
        1.) Withdraw X amount of FIDU before the upgrade
        2.) Upgrade the contracts (v1.1 to V2)
        3.) Migrate all the credit lines, and the underlying USDC
        4.) Witdraw X amount of FIDU again, and the amount of USDC should be identical.
      */
    })
  })

  it("does not affect the storage layout", async () => {
    let contracts = await getExistingContracts(contractsToUpgrade, mainnetConfig, mainnetMultisigSigner)

    let existingSharePrice = await contracts.Pool.ExistingContract.sharePrice()
    let existingLoansOutstanding = await contracts.CreditDesk.ExistingContract.totalLoansOutstanding()
    let existingCompoundBalance = await contracts.Pool.ExistingContract.compoundBalance()

    expect(existingSharePrice.isZero()).to.be.false
    expect(existingLoansOutstanding.isZero()).to.be.false

    contracts = await upgrade(contractsToUpgrade, contracts)

    const newSharePrice = await contracts.Pool.UpgradedContract.sharePrice()
    const compoundBalance = await contracts.Pool.UpgradedContract.compoundBalance()
    expect(contracts.Pool.ExistingImplAddress).to.not.eq(contracts.Pool.UpgradedImplAddress)
    expect(existingSharePrice.toString()).to.eq(newSharePrice.toString())
    expect(compoundBalance.toString()).to.eq(String(existingCompoundBalance))

    let newLoansOutstanding = await contracts.CreditDesk.UpgradedContract.totalLoansOutstanding()
    expect(existingLoansOutstanding.toString()).to.eq(newLoansOutstanding.toString())
  }).timeout(TEST_TIMEOUT)

  xit("supports basic credit desk functions", async () => {
    let contracts = await getExistingContracts(contractsToUpgrade, mainnetConfig, mainnetMultisigSigner)
    let bwrSigner = await ethers.provider.getSigner(bwr)
    let bwrCreditDesk = contracts.CreditDesk.ExistingContract.connect(bwrSigner)
    let bwrPool = contracts.Pool.ExistingContract.connect(bwrSigner)
    let bwrFidu = contracts.Fidu.ExistingContract.connect(bwrSigner)

    const limit = usdcVal(1000).toString()
    const interest = interestAprAsBN("10.0").toString()
    await contracts.CreditDesk.ExistingContract.setUnderwriterGovernanceLimit(
      MAINNET_MULTISIG,
      usdcVal(10000).toString()
    )
    let res = await (
      await contracts.CreditDesk.ExistingContract.createCreditLine(bwr, limit, interest, "360", "30", "0")
    ).wait()
    let clAddress = res.events.find((e) => e.event === "CreditLineCreated").args.creditLine
    // Signer doesn't really matter for the creditline, since it's all reads
    let clContract = await ethers.getContractAt(mainnetConfig.CreditLine.abi, clAddress, bwrSigner)
    expect((await clContract.balance()).isZero()).to.be.true

    await erc20Approve(usdcTruffleContract, contracts.Pool.ExistingContract.address, usdcVal(100000), [bwr])

    let fiduBalance = await bwrFidu.balanceOf(bwr)
    expect(fiduBalance.isZero()).to.be.true

    await bwrPool.deposit(usdcVal(100).toString())
    fiduBalance = await bwrFidu.balanceOf(bwr)
    expect(fiduBalance.isZero()).to.be.false

    await bwrCreditDesk.drawdown(clAddress, usdcVal(500).toString())

    expect((await clContract.balance()).isZero()).to.be.false

    contracts = await upgrade(contractsToUpgrade, contracts)

    bwrCreditDesk = contracts.CreditDesk.UpgradedContract.connect(bwrSigner)
    bwrPool = contracts.Pool.UpgradedContract.connect(bwrSigner)

    const currentTime = new BN((await ethers.provider.getBlock("latest")).timestamp.toString())
    let migrationRes = await (
      await contracts.CreditDesk.UpgradedContract.migrateV1CreditLine(
        clAddress,
        currentTime.add(new BN(100)).toString(),
        currentTime.add(new BN(10)).toString(),
        currentTime.sub(new BN(50)).toString(),
        new BN(0).toString()
      )
    ).wait()
    let migratedClAddress = migrationRes.events.find((e) => e.event === "CreditLineCreated").args.creditLine
    const migratedCl = await artifacts.require("CreditLine").at(migratedClAddress)

    // Test that the creditline was migrated correctly
    expect((await clContract.balance()).isZero()).to.be.true
    expect((await clContract.limit()).isZero()).to.be.true
    expect(await migratedCl.balance()).to.bignumber.eq(usdcVal(500))
    expect(await migratedCl.limit()).to.bignumber.eq(limit)
    expect(await migratedCl.termEndTime()).to.bignumber.eq(currentTime.add(new BN(100)))
    expect(await migratedCl.nextDueTime()).to.bignumber.eq(currentTime.add(new BN(10)))
    expect(await migratedCl.interestAccruedAsOf()).to.bignumber.eq(currentTime.sub(new BN(50)))
    expect(await migratedCl.lastFullPaymentTime()).to.bignumber.eq("0")

    // Pay off in full
    await bwrCreditDesk.pay(migratedClAddress, usdcVal(501).toString())

    expect((await migratedCl.balance()).isZero()).to.be.true

    bwrPool.withdrawInFidu(fiduBalance.toString())
    fiduBalance = await bwrFidu.balanceOf(bwr)
    expect(fiduBalance.isZero()).to.be.true
  }).timeout(TEST_TIMEOUT)
})
