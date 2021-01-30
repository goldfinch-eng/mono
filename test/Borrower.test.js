/* global artifacts web3 */
const BN = require("bn.js")
const hre = require("hardhat")
const {deployments} = hre
const {
  createCreditLine,
  usdcVal,
  deployAllContracts,
  erc20Transfer,
  erc20Approve,
  expectAction,
  getBalance,
  expect,
  ZERO_ADDRESS,
  advanceTime,
} = require("./testHelpers.js")
const {CONFIG_KEYS} = require("../blockchain_scripts/deployHelpers")
const Borrower = artifacts.require("Borrower")

let accounts, owner, bwr, person3, underwriter, reserve, goldfinchFactory, goldfinchConfig, creditDesk, usdc, pool

describe("Borrower", async () => {
  const setupTest = deployments.createFixture(async ({deployments}) => {
    const {pool, usdc, creditDesk, fidu, goldfinchConfig, goldfinchFactory} = await deployAllContracts(deployments)
    // Approve transfers for our test accounts
    await erc20Approve(usdc, pool.address, usdcVal(100000), [owner, bwr, person3])
    // Some housekeeping so we have a usable creditDesk for tests, and a pool with funds
    await erc20Transfer(usdc, [bwr], usdcVal(1000), owner)
    await pool.deposit(String(usdcVal(90)), {from: bwr})
    // Set the reserve to a separate address for easier separation. The current owner account gets used for many things in tests.
    await goldfinchConfig.setTreasuryReserve(reserve)
    await creditDesk.setUnderwriterGovernanceLimit(underwriter, usdcVal(100000), {from: owner})

    return {pool, usdc, creditDesk, fidu, goldfinchConfig, goldfinchFactory}
  })

  beforeEach(async () => {
    accounts = await web3.eth.getAccounts()
    ;[owner, bwr, person3, underwriter, reserve] = accounts
    ;({goldfinchFactory, goldfinchConfig, usdc, creditDesk, pool} = await setupTest())
  })

  describe("drawdown", async () => {
    let bwrCon, cl
    let amount = usdcVal(10)
    beforeEach(async () => {
      const result = await goldfinchFactory.createBorrower(bwr)
      let bwrConAddr = result.logs[result.logs.length - 1].args.borrower
      bwrCon = await Borrower.at(bwrConAddr)
      await erc20Approve(usdc, bwrCon.address, usdcVal(100000), [bwr])
      cl = await createCreditLine({creditDesk, borrower: bwrCon.address, underwriter})
    })
    it("should let you drawdown the amount", async () => {
      await expectAction(() => bwrCon.drawdown(cl.address, amount, bwrCon.address, {from: bwr})).toChange([
        [async () => await getBalance(bwrCon.address, usdc), {by: amount}],
      ])
    })
    it("should not let anyone except the borrower drawdown", async () => {
      return expect(bwrCon.drawdown(cl.address, amount, bwrCon.address, {from: person3})).to.be.rejectedWith(
        /Must have admin role/
      )
    })
    it("should block you from drawing down on some random credit line", async () => {
      let someRandomAddress = person3
      return expect(bwrCon.drawdown(someRandomAddress, amount, bwrCon.address, {from: bwr})).to.be.rejectedWith(
        /Unknown credit line/
      )
    })
    describe("address forwarding", async () => {
      it("should support forwarding the money to another address", async () => {
        await expectAction(() => bwrCon.drawdown(cl.address, amount, bwr, {from: bwr})).toChange([
          [async () => await getBalance(bwrCon.address, usdc), {by: new BN(0)}],
          [async () => await getBalance(bwr, usdc), {by: amount}],
        ])
      })
      it("if you pass up the zero address, it should send money to the borrower contract", async () => {
        await expectAction(() => bwrCon.drawdown(cl.address, amount, ZERO_ADDRESS, {from: bwr})).toChange([
          [async () => await getBalance(bwrCon.address, usdc), {by: amount}],
          [async () => await getBalance(bwr, usdc), {by: new BN(0)}],
        ])
      })
    })
    describe("transfering USDC", async () => {
      it("should allow the borrower to transfer it anywhere", async () => {
        // Drawsdown money directly to the borrower contract (not the borrower themselves)
        await bwrCon.drawdown(cl.address, amount, ZERO_ADDRESS, {from: bwr})

        // Send that money to the borrower!
        await expectAction(() => bwrCon.transferUSDC(bwr, amount, {from: bwr})).toChange([
          [async () => await getBalance(bwr, usdc), {by: amount}],
        ])
      })
      it("should even allow transfers not to the borrower themselves", async () => {
        // Drawsdown money directly to the borrower contract (not the borrower themselves)
        await bwrCon.drawdown(cl.address, amount, ZERO_ADDRESS, {from: bwr})

        // Send that money to the borrower!
        await expectAction(() => bwrCon.transferUSDC(person3, amount, {from: bwr})).toChange([
          [async () => await getBalance(person3, usdc), {by: amount}],
        ])
      })
      it("should only allow admins to transfer the money", async () => {
        // Drawsdown money directly to the borrower contract (not the borrower themselves)
        await bwrCon.drawdown(cl.address, amount, ZERO_ADDRESS, {from: bwr})

        // Send that money to the borrower!
        return expect(bwrCon.transferUSDC(person3, amount, {from: person3})).to.be.rejectedWith(/Must have admin role/)
      })
    })
  })

  // These tests are not yet passing. Not sure how to pack the arguments in JS so it will be deconstructed correctly
  // by the BaseRelayRecipient and TrustedForwarder: https://github.com/opengsn/forwarder/blob/master/contracts/Forwarder.sol#L60
  // https://github.com/opengsn/forwarder/blob/master/contracts/BaseRelayRecipient.sol#L41
  xdescribe("gasless transactions", async () => {
    let bwrCon, cl
    let amount = usdcVal(10)

    async function createBorrowerAndCreditLine() {
      const result = await goldfinchFactory.createBorrower(bwr)
      let bwrConAddr = result.logs[result.logs.length - 1].args.borrower
      bwrCon = await Borrower.at(bwrConAddr)
      await erc20Approve(usdc, bwrCon.address, usdcVal(100000), [bwr])
      cl = await createCreditLine({creditDesk, borrower: bwrCon.address, underwriter})
    }

    describe("When the forwarder is not trusted", async () => {
      it("does use the passed in msg sender", async () => {
        await createBorrowerAndCreditLine()
        const paramsWithSenderAppended = web3.eth.abi.encodeParameters(
          ["address", "uint256", "address", "address"],
          [cl.address, amount.toNumber(), bwrCon.address, person3]
        )
        return expect(
          bwrCon.drawdown.sendTransaction({data: paramsWithSenderAppended, from: person3})
        ).to.be.rejectedWith(/Must have admin role/)
      })
    })

    describe("when the forwarder is trusted", async () => {
      it("uses the passed in msg sender", async () => {
        await goldfinchConfig.setAddressForTest(CONFIG_KEYS.TrustedForwarder, person3)
        await createBorrowerAndCreditLine()

        const paramsWithSenderAppended = web3.eth.abi.encodeParameters(
          ["address", "uint256", "address", "address"],
          [cl.address, amount.toNumber(), bwrCon.address, person3]
        )
        await expectAction(() =>
          bwrCon.drawdown.sendTransaction({data: paramsWithSenderAppended, from: person3})
        ).toChange([[async () => await getBalance(bwrCon.address, usdc), {by: amount}]])
      })
    })
  })

  describe("pay", async () => {
    let bwrCon, cl
    let amount = usdcVal(10)
    beforeEach(async () => {
      const result = await goldfinchFactory.createBorrower(bwr)
      let bwrConAddr = result.logs[result.logs.length - 1].args.borrower
      bwrCon = await Borrower.at(bwrConAddr)
      await erc20Approve(usdc, bwrCon.address, usdcVal(100000), [bwr])
      cl = await createCreditLine({creditDesk, borrower: bwrCon.address, underwriter})
      await bwrCon.drawdown(cl.address, amount, bwr, {from: bwr})
    })

    it("should payback the loan as expected", async () => {
      await expectAction(() => bwrCon.pay(cl.address, amount, {from: bwr})).toChange([
        [async () => await getBalance(cl.address, usdc), {by: amount}],
        [async () => await getBalance(bwr, usdc), {by: amount.neg()}],
      ])
      await advanceTime(creditDesk, {toBlock: (await cl.nextDueBlock()).add(new BN(1))})
      await expectAction(() => creditDesk.assessCreditLine(cl.address)).toChange([
        [async () => await cl.balance(), {decrease: true}],
        [async () => await getBalance(cl.address, usdc), {by: amount.neg()}],
      ])
    })
  })

  describe("payMultiple", async () => {
    let bwrCon, cl, cl2
    let amount = usdcVal(10)
    let amount2 = usdcVal(5)
    beforeEach(async () => {
      const result = await goldfinchFactory.createBorrower(bwr)
      let bwrConAddr = result.logs[result.logs.length - 1].args.borrower
      bwrCon = await Borrower.at(bwrConAddr)
      await erc20Approve(usdc, bwrCon.address, usdcVal(100000), [bwr])
      cl = await createCreditLine({creditDesk, borrower: bwrCon.address, underwriter})
      cl2 = await createCreditLine({creditDesk, borrower: bwrCon.address, underwriter})

      expect(cl.address).to.not.eq(cl2.addresss)

      await bwrCon.drawdown(cl.address, amount, bwr, {from: bwr})
      await bwrCon.drawdown(cl2.address, amount2, bwr, {from: bwr})
    })

    it("should payback the loan as expected", async () => {
      await expectAction(() => bwrCon.payMultiple([cl.address, cl2.address], [amount, amount2], {from: bwr})).toChange([
        [() => getBalance(cl.address, usdc), {by: amount}],
        [() => getBalance(cl2.address, usdc), {by: amount2}],
        [() => getBalance(bwr, usdc), {by: amount.add(amount2).neg()}],
      ])
      await advanceTime(creditDesk, {toBlock: (await cl.nextDueBlock()).add(new BN(1))})
      await expectAction(() => creditDesk.assessCreditLine(cl.address)).toChange([
        [() => cl.balance(), {decrease: true}],
        [() => getBalance(cl.address, usdc), {by: amount.neg()}],
      ])
      await expectAction(() => creditDesk.assessCreditLine(cl2.address)).toChange([
        [() => cl2.balance(), {decrease: true}],
        [() => getBalance(cl2.address, usdc), {by: amount2.neg()}],
      ])
    })
  })

  describe("payInFull", async () => {
    let bwrCon, cl
    let amount = usdcVal(10)
    beforeEach(async () => {
      const result = await goldfinchFactory.createBorrower(bwr)
      let bwrConAddr = result.logs[result.logs.length - 1].args.borrower
      bwrCon = await Borrower.at(bwrConAddr)
      await erc20Approve(usdc, bwrCon.address, usdcVal(100000), [bwr])
      cl = await createCreditLine({creditDesk, borrower: bwrCon.address, underwriter})
      await bwrCon.drawdown(cl.address, amount, bwr, {from: bwr})
    })

    it("should fully pay back the loan", async () => {
      await advanceTime(creditDesk, {toBlock: (await cl.nextDueBlock()).add(new BN(1))})
      await expectAction(async () => bwrCon.payInFull(cl.address, usdcVal(11), {from: bwr})).toChange([
        [async () => cl.balance(), {to: new BN(0)}],
        [async () => getBalance(pool.address, usdc), {increase: true}],
        [async () => pool.sharePrice(), {increase: true}],
      ])
    })

    it("fails if the loan is not fully paid off", async () => {
      await expect(bwrCon.payInFull(cl.address, usdcVal(5), {from: bwr})).to.be.rejectedWith(
        /Failed to fully pay off creditline/
      )
      expect(await cl.balance()).to.bignumber.gt(new BN(0))
    })
  })
})
