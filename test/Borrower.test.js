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
const Borrower = artifacts.require("Borrower")

let accounts, owner, bwr, person3, underwriter, reserve, goldfinchFactory, creditDesk, usdc

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
    ;({goldfinchFactory, usdc, creditDesk} = await setupTest())
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
})
