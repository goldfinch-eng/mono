/* global artifacts web3 */
const {expect, decimals, BN, bigVal, mochaEach} = require("./testHelpers.js")
const Accountant = artifacts.require("Accountant")

describe("Accountant", async () => {
  let accountant
  beforeEach(async () => {
    const [owner] = await web3.eth.getAccounts()
    accountant = await Accountant.new({from: owner})
  })

  describe("calculateAnnuityPayment", async () => {
    var tests = [
      [10000, 12.0, 360, 30, "887719069147705830000"],
      [10000, 6.0, 360, 30, "860286563187360300000"],
      [2000000, 15.0, 360, 30, "180322762358335458000000"],
      [123456, 12.345, 1800, 30, "2757196297755729374016"],
      [50000, 10.0, 500, 10, "1071423534507233600000"],
      [50000, 1.0, 3600, 30, "437723402324420700000"],
      [1, 0.002, 3600, 30, "8334162127476676"],
      [71601, 13.672, 493, 17, "2711812617616937811069"],
      [10000, 0.0, 360, 30, "833333333333333333333"],
      [10000, 12.0, 1, 1, "10003287671232875100000"],
      [0, 12.0, 360, 30, "0"],
    ]
    mochaEach(tests).it(
      "should calculate things correctly",
      async (balance, interestApr, termInDays, paymentPeriodInDays, expected) => {
        var rateDecimals = 1000 // This is just for convenience so we can denominate rates in decimals
        var rateMultiplier = decimals.div(new BN(rateDecimals)).div(new BN(100))
        balance = bigVal(balance)
        interestApr = new BN(interestApr * rateDecimals).mul(rateMultiplier)
        termInDays = new BN(termInDays)
        paymentPeriodInDays = new BN(paymentPeriodInDays)
        expected = new BN(expected)

        const result = await accountant.calculateAnnuityPayment(balance, interestApr, termInDays, paymentPeriodInDays)
        expect(result.eq(expected)).to.be.true
      }
    )

    it("should gracefully handle extremely small, but > 0 interest rates", async () => {
      const balance = bigVal(10000)
      const interestApr = new BN(1)
      const termInDays = new BN(360)
      const paymentPeriodInDays = new BN(30)
      const expected = new BN("833333333333333333333")
      const result = await accountant.calculateAnnuityPayment(balance, interestApr, termInDays, paymentPeriodInDays)
      expect(result.eq(expected)).to.be.true
    })

    describe("with invalid data", async () => {
      // TODO: Consider if we need this.
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
