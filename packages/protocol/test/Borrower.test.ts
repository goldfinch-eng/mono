/* global web3 */
import BN from "bn.js"
import hre from "hardhat"
const {deployments} = hre
import {
  usdcVal,
  erc20Transfer,
  erc20Approve,
  expectAction,
  getBalance,
  expect,
  ZERO_ADDRESS,
  advanceTime,
} from "./testHelpers"
import {deployBaseFixture, deployBorrowerWithGoldfinchFactoryFixture, deployFundedTranchedPool} from "./util/fixtures"
import {BorrowerInstance, CreditLineInstance, ERC20Instance, TranchedPoolInstance} from "../typechain/truffle"

describe("Borrower", async () => {
  let owner,
    borrower: string,
    borrowerContract: BorrowerInstance,
    usdc: ERC20Instance,
    tranchedPool: TranchedPoolInstance,
    creditLine: CreditLineInstance,
    accounts,
    person3: string,
    underwriter,
    reserve

  const setupTest = deployments.createFixture(async () => {
    const {seniorPool, usdc, fidu, goldfinchConfig, goldfinchFactory} = await deployBaseFixture({})

    // Approve transfers for our test accounts
    await erc20Approve(usdc, seniorPool.address, usdcVal(100000), [owner, borrower, person3])
    await goldfinchConfig.bulkAddToGoList([owner, borrower, person3, underwriter, reserve])
    // Some housekeeping so we have a usable setup for tests
    await erc20Transfer(usdc, [borrower], usdcVal(1000), owner)
    await seniorPool.deposit(String(usdcVal(90)), {from: borrower})
    // Set the reserve to a separate address for easier separation. The current owner account gets used for many things in tests.
    await goldfinchConfig.setTreasuryReserve(reserve)

    const {borrowerContract} = await deployBorrowerWithGoldfinchFactoryFixture({
      borrower,
      usdcAddress: usdc.address,
      id: "Borrower",
    })
    const {tranchedPool, creditLine} = await deployFundedTranchedPool({
      borrower,
      borrowerContractAddress: borrowerContract.address,
      usdcAddress: usdc.address,
      id: "TranchedPool",
    })

    return {
      seniorPool,
      usdc,
      fidu,
      goldfinchConfig,
      goldfinchFactory,
      borrowerContract,
      tranchedPool,
      creditLine,
    }
  })

  beforeEach(async () => {
    accounts = await web3.eth.getAccounts()
    ;[owner, borrower, person3, underwriter, reserve] = accounts
    ;({usdc, tranchedPool, creditLine, borrowerContract} = await setupTest())
  })

  describe("drawdown", async () => {
    const amount = usdcVal(10)
    it("should let you drawdown the amount", async () => {
      await expectAction(() =>
        borrowerContract.drawdown(tranchedPool.address, amount, borrower, {from: borrower})
      ).toChange([[async () => await getBalance(borrower, usdc), {by: amount}]])
    })

    it("should not let anyone except the borrower drawdown", async () => {
      return expect(
        borrowerContract.drawdown(tranchedPool.address, amount, person3, {from: person3})
      ).to.be.rejectedWith(/Must have admin role/)
    })

    it("should not let anyone except the borrower drawdown via oneInch", async () => {
      return expect(
        borrowerContract.drawdownWithSwapOnOneInch(tranchedPool.address, amount, person3, usdc.address, amount, [], {
          from: person3,
        })
      ).to.be.rejectedWith(/Must have admin role/)
    })

    it("should block you from drawing down on some random credit line", async () => {
      const originalBorrowerContract = borrowerContract
      const originalBorrower = borrower
      borrower = person3
      ;({borrowerContract} = await deployBorrowerWithGoldfinchFactoryFixture({
        borrower,
        usdcAddress: usdc.address,
        id: "Borrower",
      }))
      const deployments = await deployFundedTranchedPool({
        id: "TranchedPool",
        borrower,
        borrowerContractAddress: borrowerContract.address,
        usdcAddress: usdc.address,
      })
      const tranchedPool2 = deployments.tranchedPool

      return expect(
        originalBorrowerContract.drawdown(tranchedPool2.address, amount, borrower, {from: originalBorrower})
      ).to.be.rejectedWith(/NA/)
    })

    describe("address forwarding", async () => {
      it("should support forwarding the money to another address", async () => {
        await expectAction(() =>
          borrowerContract.drawdown(tranchedPool.address, amount, person3, {from: borrower})
        ).toChange([
          [async () => await getBalance(borrowerContract.address, usdc), {by: new BN(0)}],
          [async () => await getBalance(person3, usdc), {by: amount}],
        ])
      })

      context("addressToSendTo is the zero address", async () => {
        it("should default to msg.sender", async () => {
          await expectAction(() =>
            borrowerContract.drawdown(tranchedPool.address, amount, ZERO_ADDRESS, {from: borrower})
          ).toChange([
            [async () => await getBalance(borrower, usdc), {by: amount}],
            [async () => await getBalance(borrowerContract.address, usdc), {by: new BN(0)}],
          ])
        })
      })

      context("addressToSendTo is the contract address", async () => {
        it("should default to msg.sender", async () => {
          await expectAction(() =>
            borrowerContract.drawdown(tranchedPool.address, amount, borrowerContract.address, {from: borrower})
          ).toChange([
            [async () => await getBalance(borrower, usdc), {by: amount}],
            [async () => await getBalance(borrowerContract.address, usdc), {by: new BN(0)}],
          ])
        })
      })
    })

    describe("transfering ERC20", async () => {
      it("should allow the borrower to transfer it anywhere", async () => {
        // Fund the borrower contract (in practice, this would be unexpected)
        await erc20Transfer(usdc, [borrowerContract.address], usdcVal(1000), owner)

        // Send that money to the borrower!
        await expectAction(() =>
          borrowerContract.transferERC20(usdc.address, borrower, amount, {from: borrower})
        ).toChange([[async () => await getBalance(borrower, usdc), {by: amount}]])
      })

      it("should even allow transfers not to the borrower themselves", async () => {
        // Fund the borrower contract (in practice, this would be unexpected)
        await erc20Transfer(usdc, [borrowerContract.address], usdcVal(1000), owner)

        // Send that money to the borrower!
        await expectAction(() =>
          borrowerContract.transferERC20(usdc.address, person3, amount, {from: borrower})
        ).toChange([[async () => await getBalance(person3, usdc), {by: amount}]])
      })

      it("should only allow admins to transfer the money", async () => {
        // Fund the borrower contract (in practice, this would be unexpected)
        await erc20Transfer(usdc, [borrowerContract.address], usdcVal(1000), owner)

        // Send that money to the borrower!
        return expect(
          borrowerContract.transferERC20(usdc.address, person3, amount, {from: person3})
        ).to.be.rejectedWith(/Must have admin role/)
      })
    })
  })

  describe("pay", async () => {
    const amount = usdcVal(10)
    beforeEach(async () => {
      // eslint-disable-next-line @typescript-eslint/no-extra-semi
      ;({borrowerContract} = await deployBorrowerWithGoldfinchFactoryFixture({
        borrower,
        usdcAddress: usdc.address,
        id: "Borrower",
      }))
      ;({creditLine, tranchedPool} = await deployFundedTranchedPool({
        borrower,
        borrowerContractAddress: borrowerContract.address,
        usdcAddress: usdc.address,
        id: "TranchedPool",
      }))
      await borrowerContract.drawdown(tranchedPool.address, amount, borrower, {from: borrower})
    })

    it("should payback the loan as expected", async () => {
      await expectAction(() => borrowerContract.pay(tranchedPool.address, amount, {from: borrower})).toChange([
        [async () => await getBalance(creditLine.address, usdc), {increase: true}],
        [async () => await getBalance(borrower, usdc), {by: amount.neg()}],
      ])

      await advanceTime({toSecond: (await creditLine.nextDueTime()).add(new BN(1))})

      await expectAction(() => tranchedPool.assess()).toChange([
        [async () => await creditLine.balance(), {decrease: true}],
        [async () => await getBalance(creditLine.address, usdc), {by: amount.neg()}],
        [async () => await getBalance(tranchedPool.address, usdc), {increase: true}],
      ])
    })
  })

  describe("payMultiple", async () => {
    let tranchedPool2: TranchedPoolInstance, creditLine2: CreditLineInstance
    let tranchedPool: TranchedPoolInstance, creditLine: CreditLineInstance
    const amount = usdcVal(10)
    const amount2 = usdcVal(5)

    beforeEach(async () => {
      // eslint-disable-next-line @typescript-eslint/no-extra-semi
      ;({borrowerContract} = await deployBorrowerWithGoldfinchFactoryFixture({
        borrower: borrower,
        usdcAddress: usdc.address,
        id: "Borrower",
      }))

      const firstTrancheDeploy = await deployFundedTranchedPool({
        borrower,
        borrowerContractAddress: borrowerContract.address,
        usdcAddress: usdc.address,
        id: "FirstTranchedPool",
      })
      tranchedPool = firstTrancheDeploy.tranchedPool
      creditLine = firstTrancheDeploy.creditLine

      const secondTrancheDeploy = await deployFundedTranchedPool({
        borrower,
        borrowerContractAddress: borrowerContract.address,
        usdcAddress: usdc.address,
        id: "SecondTranchedPool",
      })
      tranchedPool2 = secondTrancheDeploy.tranchedPool
      creditLine2 = secondTrancheDeploy.creditLine

      expect(creditLine.address).to.not.eq(creditLine2.address)
      expect(tranchedPool.address).to.not.eq(tranchedPool2.address)
      expect(await tranchedPool.creditLine()).to.not.eq(await tranchedPool2.creditLine())

      await borrowerContract.drawdown(tranchedPool.address, amount, borrower, {from: borrower})
      await borrowerContract.drawdown(tranchedPool2.address, amount2, borrower, {from: borrower})
    })

    it("should payback the loan as expected", async () => {
      await expectAction(() =>
        borrowerContract.payMultiple([tranchedPool.address, tranchedPool2.address], [amount, amount2], {from: borrower})
      ).toChange([
        [() => getBalance(creditLine.address, usdc), {by: amount}],
        [() => getBalance(creditLine2.address, usdc), {by: amount2}],
        [() => getBalance(borrower, usdc), {by: amount.add(amount2).neg()}],
      ])

      await advanceTime({toSecond: (await creditLine.nextDueTime()).add(new BN(100))})
      await advanceTime({toSecond: (await creditLine2.nextDueTime()).add(new BN(100))})

      await expectAction(() => tranchedPool.assess()).toChange([
        [() => creditLine.balance(), {decrease: true}],
        [() => getBalance(tranchedPool.address, usdc), {increase: true}],
      ])
      await expectAction(() => tranchedPool2.assess()).toChange([
        [() => creditLine2.balance(), {decrease: true}],
        [() => getBalance(tranchedPool2.address, usdc), {increase: true}],
      ])
    })
  })

  describe("payInFull", async () => {
    const amount = usdcVal(10)

    beforeEach(async () => {
      await borrowerContract.drawdown(tranchedPool.address, amount, borrower, {from: borrower})
    })

    it("should fully pay back the loan", async () => {
      await advanceTime({toSecond: (await creditLine.nextDueTime()).add(new BN(1))})
      await expectAction(async () =>
        borrowerContract.payInFull(tranchedPool.address, usdcVal(11), {from: borrower})
      ).toChange([
        [async () => creditLine.balance(), {to: new BN(0)}],
        [async () => getBalance(tranchedPool.address, usdc), {increase: true}],
      ])
    })

    it("fails if the loan is not fully paid off", async () => {
      await expect(borrowerContract.payInFull(tranchedPool.address, usdcVal(5), {from: borrower})).to.be.rejectedWith(
        /Failed to fully pay off creditline/
      )
      expect(await creditLine.balance()).to.bignumber.gt(new BN(0))
    })
  })
})
