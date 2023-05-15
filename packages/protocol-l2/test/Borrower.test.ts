/* global artifacts web3 */
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
  ZERO,
  SECONDS_PER_DAY,
  getTranchedPoolAndCreditLine,
} from "./testHelpers"
import {deployBaseFixture, deployBorrowerWithGoldfinchFactoryFixture, deployFundedTranchedPool} from "./util/fixtures"
import {BorrowerInstance, ERC20Instance} from "../typechain/truffle"

describe("Borrower", async () => {
  let owner,
    borrower: string,
    borrowerContract: BorrowerInstance,
    goldfinchConfig,
    usdc: ERC20Instance,
    accounts,
    person3: string,
    underwriter,
    reserve

  let tranchedPool
  let creditLine

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
    const {poolAddress, clAddress} = await deployFundedTranchedPool({
      borrower,
      borrowerContractAddress: borrowerContract.address,
      usdcAddress: usdc.address,
      id: "TranchedPool",
    })

    const {tranchedPool, creditLine} = await getTranchedPoolAndCreditLine(poolAddress, clAddress)

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

  async function pay(borrowerContract, poolAddress, amount) {
    return borrowerContract.methods["pay(address,uint256)"](poolAddress, amount, {from: borrower})
  }

  async function paySeparate(borrowerContract, poolAddress, principal, interest) {
    return borrowerContract.methods["pay(address,uint256,uint256)"](poolAddress, principal, interest, {from: borrower})
  }

  beforeEach(async () => {
    accounts = await web3.eth.getAccounts()
    ;[owner, borrower, person3, underwriter, reserve] = accounts
    ;({goldfinchConfig, usdc, borrowerContract, tranchedPool, creditLine} = await setupTest())
  })

  describe("drawdown", async () => {
    beforeEach(async () => {
      accounts = await web3.eth.getAccounts()
      ;[owner, borrower, person3, underwriter, reserve] = accounts
      ;({goldfinchConfig, usdc, borrowerContract, tranchedPool} = await setupTest())
    })

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
      const {poolAddress, clAddress} = await deployFundedTranchedPool({
        id: "TranchedPool",
        borrower,
        borrowerContractAddress: borrowerContract.address,
        usdcAddress: usdc.address,
      })
      const tranchedPool2 = (await getTranchedPoolAndCreditLine(poolAddress, clAddress)).tranchedPool

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
      await borrowerContract.drawdown(tranchedPool.address, amount, borrower, {from: borrower})
    })
    it("should pay back the loan", async () => {
      const dueTime = await creditLine.nextDueTime()
      const interestOwed = await creditLine.interestOwedAt(dueTime)
      await advanceTime({toSecond: dueTime})
      await expectAction(() => pay(borrowerContract, tranchedPool.address, interestOwed)).toChange([
        [() => usdc.balanceOf(borrower), {by: interestOwed.neg()}],
        [() => usdc.balanceOf(tranchedPool.address), {increase: true}],
        [creditLine.totalInterestPaid, {by: interestOwed}],
      ])
    })
  })

  describe("payInFull", () => {
    const amount = usdcVal(10)
    beforeEach(async () => {
      await borrowerContract.drawdown(tranchedPool.address, amount, borrower, {from: borrower})
    })
    it("should revert if not full amount", async () => {
      await expect(
        borrowerContract.payInFull(tranchedPool.address, amount.sub(new BN(1)), {from: borrower})
      ).to.be.rejectedWith(/Failed to fully pay off creditline/)
    })
    it("should pay back if full amount", async () => {
      await expectAction(async () =>
        borrowerContract.payInFull(
          tranchedPool.address,
          (await creditLine.interestOwed()).add(await creditLine.balance()),
          {from: borrower}
        )
      ).toChange([
        [creditLine.balance, {to: ZERO}],
        [() => usdc.balanceOf(borrower), {decrease: true}],
        [() => usdc.balanceOf(tranchedPool.address), {increase: true}],
      ])
    })
  })

  describe("payMultiple", () => {
    let pool2
    let cl2
    beforeEach(async () => {
      // Create second pool
      const {poolAddress, clAddress} = await deployFundedTranchedPool({
        borrower,
        borrowerContractAddress: borrowerContract.address,
        usdcAddress: usdc.address,
        id: "Pool",
      })
      // eslint-disable-next-line @typescript-eslint/no-extra-semi

      ;({tranchedPool: pool2, creditLine: cl2} = await getTranchedPoolAndCreditLine(poolAddress, clAddress))
      // Drawdown on both pools
      await borrowerContract.drawdown(tranchedPool.address, usdcVal(10), borrower, {from: borrower})
      await borrowerContract.drawdown(pool2.address, usdcVal(20), borrower, {from: borrower})
    })
    it("should pay back the loans", async () => {
      const pool2DueTime = await cl2.nextDueTime()
      const pool1InterestDue = await creditLine.interestOwedAt(pool2DueTime)
      const pool2InterestDue = await cl2.interestOwedAt(pool2DueTime)
      await advanceTime({toSecond: pool2DueTime})
      await expectAction(() =>
        borrowerContract.payMultiple([tranchedPool.address, pool2.address], [pool1InterestDue, pool2InterestDue], {
          from: borrower,
        })
      ).toChange([
        [() => usdc.balanceOf(borrower), {by: pool1InterestDue.add(pool2InterestDue).neg()}],
        [() => usdc.balanceOf(tranchedPool.address), {increase: true}],
        [() => usdc.balanceOf(pool2.address), {increase: true}],
      ])
    })
  })

  describe("paySeparate", async () => {
    const amount = usdcVal(10)
    beforeEach(async () => {
      await borrowerContract.drawdown(tranchedPool.address, amount, borrower, {from: borrower})
    })
    it("should pay back a loan as expected", async () => {
      const payTime = (await creditLine.termEndTime()).add(new BN(3).mul(SECONDS_PER_DAY))
      await advanceTime({toSecond: payTime})

      const checkpoint = await tranchedPool.getAmountsOwed(payTime)
      const principalPayment = new BN(checkpoint.principalOwed)
      const interestPayment = new BN(checkpoint.interestOwed).add(new BN(checkpoint.interestAccrued))
      await expectAction(() =>
        paySeparate(borrowerContract, tranchedPool.address, principalPayment, interestPayment)
      ).toChange([
        [() => usdc.balanceOf(borrower), {by: principalPayment.add(interestPayment).neg()}],
        [() => usdc.balanceOf(tranchedPool.address), {increase: true}],
        [creditLine.balance, {to: ZERO}],
        [creditLine.totalInterestPaid, {by: interestPayment}],
      ])
    })
    it("should only take what's owed if I pay extra", async () => {
      const payTime = (await creditLine.termEndTime()).add(new BN(3).mul(SECONDS_PER_DAY))
      await advanceTime({toSecond: payTime})

      const checkpoint = await tranchedPool.getAmountsOwed(payTime)
      const principalPayment = new BN(checkpoint.principalOwed) // add a little extra to the principal payment
      const interestPayment = new BN(checkpoint.interestOwed).add(new BN(checkpoint.interestAccrued))
      await expectAction(() =>
        paySeparate(
          borrowerContract,
          tranchedPool.address,
          principalPayment.add(usdcVal(100)),
          interestPayment.add(new BN(1234))
        )
      ).toChange([
        [() => usdc.balanceOf(borrower), {by: principalPayment.add(interestPayment).neg()}],
        [() => usdc.balanceOf(tranchedPool.address), {increase: true}],
        [creditLine.balance, {to: ZERO}],
        [creditLine.totalInterestPaid, {by: interestPayment}],
      ])
    })
  })
})
