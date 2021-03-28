/* global web3 */
const hre = require("hardhat")
const {
  getUSDCAddress,
  MAINNET_ONE_SPLIT_ADDRESS,
  isMainnetForking,
  getSignerForAddress,
  interestAprAsBN,
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
  getDeployedAsTruffleContract,
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
  let accounts, owner, bwr, person3, pool, reserve, underwriter, usdc, creditDesk, fidu, goldfinchConfig, usdcAddress
  let goldfinchFactory, busd, usdt, cUSDC
  let poolValue = usdcVal(1000)
  const cUSDCContractAddress = "0x39aa39c021dfbae8fac545936693ac917d5e7563"
  const setupTest = deployments.createFixture(async ({deployments}) => {
    await deployments.fixture("base_deploy")
    const pool = await getDeployedAsTruffleContract(deployments, "Pool")
    usdcAddress = getUSDCAddress("mainnet")
    const usdc = await artifacts.require("IERC20withDec").at(usdcAddress)
    const creditDesk = await getDeployedAsTruffleContract(deployments, "CreditDesk")
    const fidu = await getDeployedAsTruffleContract(deployments, "Fidu")
    const goldfinchConfig = await getDeployedAsTruffleContract(deployments, "GoldfinchConfig")
    const goldfinchFactory = await getDeployedAsTruffleContract(deployments, "CreditLineFactory")
    const cUSDC = await artifacts.require("ICUSDCContract").at(cUSDCContractAddress)

    // Unlocks a random account that owns tons of USDC, which we can send to our test users
    const erc20s = [{ticker: "USDC", contract: await ethers.getContractAt("IERC20withDec", usdcAddress)}]
    await fundWithWhales(erc20s, [owner, bwr, person3])
    // Approve transfers from the Pool for our test accounts
    await erc20Approve(usdc, pool.address, usdcVal(100000), [owner, bwr, person3])

    await pool.deposit(poolValue, {from: bwr})

    // Set the reserve to a separate address for easier separation. The current owner account gets used for many things in tests.
    await goldfinchConfig.setTreasuryReserve(reserve)
    await goldfinchConfig.setAddressForTest(CONFIG_KEYS.CUSDCContract, cUSDCContractAddress)
    await creditDesk.setUnderwriterGovernanceLimit(underwriter, usdcVal(100000), {from: owner})

    return {pool, usdc, creditDesk, fidu, goldfinchConfig, goldfinchFactory, cUSDC}
  })

  beforeEach(async function () {
    accounts = await web3.eth.getAccounts()
    ;[owner, bwr, person3, underwriter, reserve] = accounts
    ;({usdc, creditDesk, goldfinchFactory, pool, fidu, goldfinchConfig, cUSDC} = await setupTest())
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
      await advanceTime(creditDesk, {toBlock: (await cl.nextDueBlock()).add(new BN(1))})
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
      await advanceTime(creditDesk, {toBlock: (await cl.nextDueBlock()).add(new BN(1))})
      await expectAction(() => creditDesk.assessCreditLine(cl.address)).toChange([
        [async () => await cl.balance(), {decrease: true}],
        [async () => await getBalance(cl.address, usdc), {to: new BN(0)}],
      ])
    }).timeout(TEST_TIMEOUT)

    describe("payMultipleWithSwapOnOneInch", async () => {
      let cl2
      let amount2 = usdcVal(50)

      beforeEach(async () => {
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

        await advanceTime(creditDesk, {toBlock: (await cl.nextDueBlock()).add(new BN(1))})
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
      const result = await goldfinchFactory.createBorrower(bwr)
      let bwrConAddr = result.logs[result.logs.length - 1].args.borrower
      bwrCon = await Borrower.at(bwrConAddr)
      reserveAddress = await goldfinchConfig.getAddress(CONFIG_KEYS.TreasuryReserve)

      cl = await createCreditLine({creditDesk, borrower: bwrCon.address, underwriter})
    })

    it("should redeem from compound and recognize interest on drawdown", async function () {
      let usdcAmount = usdcVal(10)

      await expectAction(() => {
        return pool.sweepToCompound({from: owner})
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
      await expectAction(() => {
        return pool.sweepToCompound({from: owner})
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
      await pool.sweepToCompound({from: owner})

      await expect(pool.sweepToCompound({from: owner})).to.be.rejectedWith(/Cannot sweep/)
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
      usdcVal(1000).toString()
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

    // Pay off in full
    await bwrCreditDesk.pay(clAddress, usdcVal(501).toString())
    await bwrCreditDesk.applyPayment(clAddress, usdcVal(501).toString())

    expect((await clContract.balance()).isZero()).to.be.true

    bwrPool.withdrawInFidu(fiduBalance.toString())
    fiduBalance = await bwrFidu.balanceOf(bwr)
    expect(fiduBalance.isZero()).to.be.true
  }).timeout(TEST_TIMEOUT)
})
