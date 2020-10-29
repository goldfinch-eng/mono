/* global artifacts web3 */
const {expect, BN, bigVal, mochaEach, tolerance, usdcVal} = require("./testHelpers.js")
const {time} = require("@openzeppelin/test-helpers")
const {interestAprAsBN} = require("../blockchain_scripts/deployHelpers.js")
const Accountant = artifacts.require("Accountant")
const TestAccountant = artifacts.require("TestAccountant")
const CreditLine = artifacts.require("CreditLine")

describe("Accountant", async () => {
  let accountant, owner, borrower, underwriter, testAccountant
  before(async () => {
    // Linking can only happen once, so we do it in a before block, rather than beforeEach
    accountant = await Accountant.new({from: owner})
    TestAccountant.link(accountant)
  })

  beforeEach(async () => {
    ;[owner, borrower, underwriter] = await web3.eth.getAccounts()
    testAccountant = await TestAccountant.new({from: owner})
  })

  describe("calculateInterestAndPrincipalAccrued", async () => {
    let creditLine, balance, blockNumber
    const calculateInterestAndPrincipalAccrued = async (blockNumber) => {
      const result = await testAccountant.calculateInterestAndPrincipalAccrued(creditLine.address, blockNumber)
      return [result[0], result[1]]
    }
    // You can get this by taking the interest rate * principal, and divide by the fraction of num blocks elapsed (100 in our case) to blocks in the term
    // (1000 * 0.03) * (100 / 2102400) = 1426
    const expectedInterest = new BN(String(1426))
    beforeEach(async () => {
      balance = usdcVal(1000)
      const termInDays = new BN(360)
      const paymentPeriodInDays = new BN(10)
      creditLine = await CreditLine.new({from: owner})
      await creditLine.initialize(
        owner,
        borrower,
        underwriter,
        bigVal(500),
        interestAprAsBN("3.00"),
        5,
        paymentPeriodInDays,
        termInDays
      )
      await creditLine.setBalance(balance)
      blockNumber = (await time.latestBlock()).add(new BN(100))
      // Simulate some time passing, so we can see real interest and principal accruing
      await time.advanceBlockTo(blockNumber)
      await creditLine.setTermEndBlock(blockNumber)
    })
    describe("when the block number is < the term end block", async () => {
      it("should return zero principal, but full interest", async () => {
        const [interestAccrued, principalAccrued] = await calculateInterestAndPrincipalAccrued(
          blockNumber.sub(new BN(1))
        )
        expect(interestAccrued).to.bignumber.closeTo(expectedInterest, tolerance)
        expect(principalAccrued).to.bignumber.equal(new BN(0))
      })
    })
    describe("when the block number == the term end block", async () => {
      it("should return the full principal and full interest", async () => {
        const [interestAccrued, principalAccrued] = await calculateInterestAndPrincipalAccrued(blockNumber)
        expect(interestAccrued).to.bignumber.closeTo(expectedInterest, tolerance)
        expect(principalAccrued).to.bignumber.equal(balance)
      })
    })
    describe("when the block number > the term end block", async () => {
      it("should return the full principal and full interest", async () => {
        const [interestAccrued, principalAccrued] = await calculateInterestAndPrincipalAccrued(
          blockNumber.add(new BN(1))
        )
        expect(interestAccrued).to.bignumber.closeTo(expectedInterest, tolerance)
        expect(principalAccrued).to.bignumber.equal(balance)
      })
    })
  })

  describe("allocatePayment", async () => {
    const tests = [
      // payment, balance, totalInterestOwed, totalPrincipalOwed, expectedResults
      [10, 40, 10, 20, {interestPayment: 10, principalPayment: 0, additionalBalancePayment: 0}],
      [5, 40, 10, 20, {interestPayment: 5, principalPayment: 0, additionalBalancePayment: 0}],
      [15, 40, 10, 20, {interestPayment: 10, principalPayment: 5, additionalBalancePayment: 0}],
      [35, 40, 10, 20, {interestPayment: 10, principalPayment: 20, additionalBalancePayment: 5}],
      [55, 40, 10, 20, {interestPayment: 10, principalPayment: 20, additionalBalancePayment: 20}],
      [0, 40, 10, 20, {interestPayment: 0, principalPayment: 0, additionalBalancePayment: 0}],
    ]
    mochaEach(tests).it(
      "should calculate things correctly!",
      async (paymentAmount, balance, totalInterestOwed, totalPrincipalOwed, expected) => {
        var result = await accountant.allocatePayment(
          bigVal(paymentAmount),
          bigVal(balance),
          bigVal(totalInterestOwed),
          bigVal(totalPrincipalOwed)
        )

        expect(result.interestPayment).to.be.bignumber.equals(bigVal(expected.interestPayment))
        expect(result.principalPayment).to.be.bignumber.equals(bigVal(expected.principalPayment))
        expect(result.additionalBalancePayment).to.be.bignumber.equals(bigVal(expected.additionalBalancePayment))
      }
    )
  })
})
