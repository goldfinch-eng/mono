/* global web3 */
const hre = require("hardhat")
const {
  getUSDCAddress,
  MAINNET_ONE_SPLIT_ADDRESS,
  isMainnetForking,
  getSignerForAddress,
  interestAprAsBN,
  MAINNET_CUSDC_ADDRESS,
} = require("../blockchain_scripts/deployHelpers")
const {
  MAINNET_MULTISIG,
  upgradeContracts,
  getExistingContracts,
  getMainnetContracts,
  impersonateAccount,
  fundWithWhales,
  performPostUpgradeMigration,
} = require("../blockchain_scripts/mainnetForkingHelpers")
const {CONFIG_KEYS} = require("../blockchain_scripts/configKeys")
const {time} = require("@openzeppelin/test-helpers")
const {deployments, ethers, artifacts} = hre
const Borrower = artifacts.require("Borrower")
const IOneSplit = artifacts.require("IOneSplit")
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
} = require("./testHelpers")

const TEST_TIMEOUT = 180000 // 3 mins

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
  let goldfinchFactory, busd, usdt, cUSDC
  const contractsToUpgrade = ["CreditDesk", "Pool", "Fidu", "CreditLineFactory", "GoldfinchConfig"]
  const setupTest = deployments.createFixture(async ({deployments}) => {
    // Note: base_deploy always returns when mainnet forking, however
    // we need it here, because the "fixture" part is what let's hardhat
    // snapshot and give us a clean blockchain before each test.
    // Otherewise, we have state leaking across tests.
    await deployments.fixture("base_deploy")

    const contracts = await upgrade(contractsToUpgrade)
    const usdcAddress = getUSDCAddress("mainnet")
    const pool = await artifacts.require("TestPool").at(contracts.Pool.UpgradedContract.address)
    const usdc = await artifacts.require("IERC20withDec").at(usdcAddress)
    const creditDesk = await artifacts.require("TestCreditDesk").at(contracts.CreditDesk.UpgradedContract.address)
    const fidu = await artifacts.require("Fidu").at(contracts.Fidu.UpgradedContract.address)
    const goldfinchConfig = await artifacts
      .require("GoldfinchConfig")
      .at(contracts.GoldfinchConfig.UpgradedContract.address)
    const goldfinchFactory = await artifacts
      .require("CreditLineFactory")
      .at(contracts.CreditLineFactory.UpgradedContract.address)
    const cUSDC = await artifacts.require("IERC20withDec").at(MAINNET_CUSDC_ADDRESS)
    await creditDesk.setUnderwriterGovernanceLimit(underwriter, usdcVal(100000), {from: MAINNET_MULTISIG})

    return {pool, usdc, creditDesk, fidu, goldfinchConfig, goldfinchFactory, cUSDC}
  })

  async function upgrade(contractsToUpgrade) {
    ;[owner, bwr, person3, underwriter, reserve] = await web3.eth.getAccounts()
    const mainnetConfig = getMainnetContracts()
    const mainnetMultisigSigner = await ethers.provider.getSigner(MAINNET_MULTISIG)
    const usdcAddress = getUSDCAddress("mainnet")

    // Ensure the multisig has funds for upgrades and other transactions
    let ownerAccount = await getSignerForAddress(owner)
    await ownerAccount.sendTransaction({to: MAINNET_MULTISIG, value: ethers.utils.parseEther("5.0")})

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

    await impersonateAccount(hre, MAINNET_MULTISIG)
    const erc20s = [{ticker: "USDC", contract: await ethers.getContractAt("IERC20withDec", usdcAddress)}]
    await fundWithWhales(erc20s, [owner, bwr])
  })

  async function upgrade(contractsToUpgrade, contracts) {
    contracts = await upgradeContracts(contractsToUpgrade, contracts, mainnetMultisigSigner, owner, deployments)
    await performPostUpgradeMigration(contracts, deployments)
    await contracts.GoldfinchConfig.UpgradedContract.bulkAddToGoList(await web3.eth.getAccounts())
    return contracts
  }

  it("does not affect the storage layout", async () => {
    let contracts = await getExistingContracts(contractsToUpgrade, mainnetConfig, mainnetMultisigSigner)

    let existingSharePrice = await contracts.Pool.ExistingContract.sharePrice()
    let existingLoansOutstanding = await contracts.CreditDesk.ExistingContract.totalLoansOutstanding()

    expect(existingSharePrice.isZero()).to.be.false
    expect(existingLoansOutstanding.isZero()).to.be.false

    contracts = await upgrade(contractsToUpgrade, contracts)

    const newSharePrice = await contracts.Pool.UpgradedContract.sharePrice()
    const compoundBalance = await contracts.Pool.UpgradedContract.compoundBalance()
    expect(contracts.Pool.ExistingImplAddress).to.not.eq(contracts.Pool.UpgradedImplAddress)
    expect(existingSharePrice.toString()).to.eq(newSharePrice.toString())
    expect(compoundBalance.toString()).to.bignumber.eq("0")

    let newLoansOutstanding = await contracts.CreditDesk.UpgradedContract.totalLoansOutstanding()
    expect(existingLoansOutstanding.toString()).to.eq(newLoansOutstanding.toString())
  }).timeout(TEST_TIMEOUT)

  it("supports basic credit desk functions", async () => {
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
