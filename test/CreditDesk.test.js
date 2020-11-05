/* global artifacts web3 */
const bre = require("@nomiclabs/buidler")
const {deployments} = bre
const {
  expect,
  MAX_UINT,
  decimals,
  BN,
  usdcVal,
  tolerance,
  getBalance,
  getDeployedAsTruffleContract,
  USDC_DECIMALS,
  ZERO_ADDRESS,
} = require("./testHelpers.js")
const {OWNER_ROLE, PAUSER_ROLE, CONFIG_KEYS, interestAprAsBN} = require("../blockchain_scripts/deployHelpers")
const {time} = require("@openzeppelin/test-helpers")
const CreditLine = artifacts.require("CreditLine")
const FEE_DENOMINATOR = new BN(10)

let accounts, owner, person2, person3, person4, creditDesk, fidu, goldfinchConfig, reserve

describe("CreditDesk", () => {
  let underwriterLimit
  let underwriter
  let borrower
  let limit = usdcVal(500)
  let interestApr = interestAprAsBN("5.00")
  let paymentPeriodInDays = new BN(30)
  let termInDays = new BN(365)
  let usdc
  let pool

  let createCreditLine = async ({
    _borrower,
    _underwriter,
    _limit,
    _interestApr,
    _paymentPeriodInDays,
    _termInDays,
  } = {}) => {
    _borrower = _borrower || person3
    _underwriter = _underwriter || person2
    _limit = _limit || limit
    _interestApr = _interestApr || interestApr
    _paymentPeriodInDays = _paymentPeriodInDays || paymentPeriodInDays
    _termInDays = _termInDays || termInDays
    return await creditDesk.createCreditLine(_borrower, _limit, _interestApr, _paymentPeriodInDays, _termInDays, {
      from: _underwriter,
    })
  }

  let createAndSetCreditLineAttributes = async (
    {balance, interestOwed, principalOwed, collectedPaymentBalance = 0, nextDueBlock},
    people = {}
  ) => {
    const thisOwner = people.owner || owner
    const thisBorrower = people.borrower || borrower
    const thisUnderwriter = people.underwriter || underwriter

    if (!thisBorrower) {
      throw new Error("No borrower is set. Set one in a beforeEach, or pass it in explicitly")
    }

    if (!thisOwner) {
      throw new Error("No owner is set. Please set one in a beforeEach or pass it in explicitly")
    }

    // 1000 is pretty high for test environments, and generally shouldn't be hit.
    nextDueBlock = nextDueBlock || 1000
    const termInDays = 360
    const termInBlocks = (await creditDesk.BLOCKS_PER_DAY()).mul(new BN(termInDays))
    const termEndBlock = (await time.latestBlock()).add(termInBlocks)
    await creditDesk.setUnderwriterGovernanceLimit(thisUnderwriter, limit.mul(new BN(5)))

    await creditDesk.createCreditLine(thisBorrower, limit, interestApr, paymentPeriodInDays, termInDays, {
      from: thisUnderwriter,
    })
    var borrowerCreditLines = await creditDesk.getBorrowerCreditLines(thisBorrower)
    const creditLine = await CreditLine.at(borrowerCreditLines[0])

    await Promise.all([
      creditDesk._setTotalLoansOutstanding(usdcVal(balance).add(usdcVal(interestOwed))),
      creditLine.setBalance(usdcVal(balance), {from: thisOwner}),
      creditLine.setInterestOwed(usdcVal(interestOwed), {from: thisOwner}),
      creditLine.setPrincipalOwed(usdcVal(principalOwed), {from: thisOwner}),
      usdc.transfer(creditLine.address, String(usdcVal(collectedPaymentBalance)), {from: thisOwner}),
      creditLine.setCollectedPaymentBalance(String(usdcVal(collectedPaymentBalance)), {from: thisOwner}),
      creditLine.setNextDueBlock(nextDueBlock, {from: thisOwner}),
      creditLine.setTermEndBlock(termEndBlock, {from: thisOwner}),
      creditLine.authorizePool(goldfinchConfig.address),
    ])

    return creditLine
  }

  const setupTest = deployments.createFixture(async ({deployments}) => {
    await deployments.fixture("base_deploy")
    const pool = await getDeployedAsTruffleContract(deployments, "Pool")
    const usdc = await getDeployedAsTruffleContract(deployments, "ERC20")
    const creditDesk = await getDeployedAsTruffleContract(deployments, "CreditDesk")
    const fidu = await getDeployedAsTruffleContract(deployments, "Fidu")
    const goldfinchConfig = await getDeployedAsTruffleContract(deployments, "GoldfinchConfig")

    // Approve transfers for our test accounts
    await usdc.approve(pool.address, new BN(100000).mul(decimals), {from: owner})
    await usdc.approve(pool.address, new BN(100000).mul(decimals), {from: person2})
    await usdc.approve(pool.address, new BN(100000).mul(decimals), {from: person3})

    // Some housekeeping so we have a usable creditDesk for tests, and a pool with funds
    await usdc.transfer(person2, String(usdcVal(1000)), {from: owner})
    await pool.deposit(String(usdcVal(90)), {from: person2})
    // Set the reserve to a separate address for easier separation. The current owner account gets used for many things in tests.
    await goldfinchConfig.setTreasuryReserve(reserve)

    return {pool, usdc, creditDesk, fidu, goldfinchConfig}
  })

  beforeEach(async () => {
    accounts = await web3.eth.getAccounts()
    ;[owner, person2, person3, person4, reserve] = accounts
    const deployResult = await setupTest()

    usdc = deployResult.usdc
    pool = deployResult.pool
    creditDesk = deployResult.creditDesk
    fidu = deployResult.fidu
    goldfinchConfig = deployResult.goldfinchConfig
  })

  describe("Access Controls", () => {
    it("sets the owner", async () => {
      expect(await creditDesk.hasRole(OWNER_ROLE, owner)).to.equal(true)
      expect(await creditDesk.getRoleAdmin(OWNER_ROLE)).to.equal(OWNER_ROLE)
    })

    it("sets the pauser", async () => {
      expect(await creditDesk.hasRole(PAUSER_ROLE, owner)).to.equal(true)
      expect(await creditDesk.getRoleAdmin(PAUSER_ROLE)).to.equal(OWNER_ROLE)
    })

    it("allows the owner to set new addresses as roles", async () => {
      expect(await creditDesk.hasRole(OWNER_ROLE, person2)).to.equal(false)
      await creditDesk.grantRole(OWNER_ROLE, person2, {from: owner})
      expect(await creditDesk.hasRole(OWNER_ROLE, person2)).to.equal(true)
    })

    it("should not allow anyone else to add an owner", async () => {
      return expect(creditDesk.grantRole(OWNER_ROLE, person2, {from: person3})).to.be.rejected
    })
  })

  describe("Pausability", () => {
    describe("actually pausing", async () => {
      it("should allow the owner to pause", async () => {
        return expect(creditDesk.pause()).to.be.fulfilled
      })
      it("should disallow non-owner to pause", async () => {
        return expect(creditDesk.pause({from: person2})).to.be.rejectedWith(/Must have pauser role/)
      })
    })
  })

  describe("setUnderwriterGovernanceLimit", () => {
    let underwriter
    beforeEach(() => {
      underwriter = person2
    })
    it("sets the correct limit", async () => {
      const amount = usdcVal(537)
      await creditDesk.setUnderwriterGovernanceLimit(underwriter, amount, {from: owner})
      const underwriterLimit = await creditDesk.underwriters(underwriter)
      expect(underwriterLimit).to.bignumber.equal(amount)
    })

    it("emits an event with the correct data", async () => {
      const amount = usdcVal(537)
      const response = await creditDesk.setUnderwriterGovernanceLimit(underwriter, amount, {from: owner})
      const event = response.logs[0]

      expect(event.event).to.equal("GovernanceUpdatedUnderwriterLimit")
      expect(event.args.underwriter).to.equal(underwriter)
      expect(event.args.newLimit).to.bignumber.equal(amount)
    })

    describe("limits", async () => {
      beforeEach(async () => {
        await goldfinchConfig.setNumber(CONFIG_KEYS.MaxUnderwriterLimit, usdcVal(9))
      })
      it("should allow you to withdraw right up to the limit", async () => {
        return expect(creditDesk.setUnderwriterGovernanceLimit(underwriter, usdcVal(9))).to.be.fulfilled
      })
      it("should fail with anything greater", async () => {
        return expect(
          creditDesk.setUnderwriterGovernanceLimit(underwriter, usdcVal(9).add(new BN(1)))
        ).to.be.rejectedWith(/greater than the max allowed/)
      })
    })
  })

  describe("createCreditLine", () => {
    let interestApr = new BN(5)
    let paymentPeriodInDays = new BN(30)
    let termInDays = new BN(365)

    beforeEach(async () => {
      underwriter = person2
      borrower = person3
      const underwriterLimit = usdcVal(600)
      await creditDesk.setUnderwriterGovernanceLimit(underwriter, underwriterLimit, {from: owner})
    })

    it("sets the CreditDesk as the owner", async () => {
      await createCreditLine()
      var ulCreditLines = await creditDesk.getUnderwriterCreditLines(underwriter)
      const creditLine = await CreditLine.at(ulCreditLines[0])

      expect(await creditLine.hasRole(OWNER_ROLE, creditDesk.address)).to.be.true
    })

    it("emits an event with the correct data", async () => {
      const response = await createCreditLine()
      // Note we pick the 2nd index, because the 0th and 1st are RoleGranted events, which
      // happen automatically when creating CreditLines, but we don't care about that.
      const event = response.logs[2]

      expect(event.event).to.equal("CreditLineCreated")
      expect(event.args.borrower).to.equal(borrower)
      expect(event.args.creditLine).to.not.be.empty
    })

    it("should create and save a creditline", async () => {
      await createCreditLine({
        _limit: limit,
        _interestApr: interestApr,
        _paymentPeriodInDays: paymentPeriodInDays,
      })

      var ulCreditLines = await creditDesk.getUnderwriterCreditLines(underwriter)
      const creditLine = await CreditLine.at(ulCreditLines[0])

      expect(ulCreditLines.length).to.equal(1)
      expect(await creditLine.borrower()).to.equal(borrower)
      expect((await creditLine.limit()).eq(limit)).to.be.true
      expect((await creditLine.interestApr()).eq(interestApr)).to.be.true
      expect((await creditLine.paymentPeriodInDays()).eq(paymentPeriodInDays)).to.be.true
      expect((await creditLine.termInDays()).eq(termInDays)).to.be.true
      expect(await usdc.allowance(creditLine.address, pool.address)).to.bignumber.equal(MAX_UINT)
    })

    it("should not let you create a credit line above your limit", async () => {
      const expectedErr = "The underwriter cannot create this credit line"
      try {
        await createCreditLine({_limit: usdcVal(601)})
        throw "This test should have failed earlier"
      } catch (e) {
        expect(e.message).to.include(expectedErr)
      }
    })

    it("should not let you create a credit line above your limit, if the sum of your existing credit lines puts you over the limit", async () => {
      await createCreditLine({_limit: usdcVal(300)})
      await createCreditLine({_limit: usdcVal(300)})

      const expectedErr = "The underwriter cannot create this credit line"
      try {
        await createCreditLine({_limit: usdcVal(1)})
        throw "This test should have failed earlier"
      } catch (e) {
        expect(e.message).to.include(expectedErr)
      }
    })
  })

  describe("changing the credit line limit", async () => {
    let cl
    beforeEach(async () => {
      borrower = person3
      underwriter = person2

      cl = await CreditLine.new({from: owner})
      await cl.initialize(owner, borrower, underwriter, usdcVal(500), usdcVal(3), 10, 360)
    })

    it("Should let you change the limit after its created", async () => {
      const newLimit = new BN(100)
      expect(newLimit).not.to.bignumber.equal(await cl.limit())
      await cl.setLimit(newLimit, {from: owner})
      expect(newLimit).to.bignumber.equal(await cl.limit())
    })

    it("Should also let underwriter set the limit", async () => {
      const newLimit = new BN(100)
      expect(newLimit).not.to.bignumber.equal(await cl.limit())
      await cl.setLimit(newLimit, {from: underwriter})
      expect(newLimit).to.bignumber.equal(await cl.limit())
    })

    it("Should not let anyone else set the limit", async () => {
      return expect(cl.setLimit(1234, {from: borrower})).to.be.rejected
    })
  })

  describe("drawdown", async () => {
    let drawdown = async (amount, creditLineAddress, addressToSendTo) => {
      addressToSendTo = addressToSendTo || borrower
      return await creditDesk.drawdown(amount, creditLineAddress, addressToSendTo, {from: borrower})
    }
    let creditLine
    let blocksPerDay = (60 * 60 * 24) / 15

    beforeEach(async () => {
      underwriter = person2
      borrower = person3
      underwriterLimit = usdcVal(600)
      await creditDesk.setUnderwriterGovernanceLimit(underwriter, underwriterLimit, {from: owner})

      await createCreditLine({_interestApr: interestAprAsBN("123.12345678")})
      var ulCreditLines = await creditDesk.getUnderwriterCreditLines(underwriter)
      creditLine = await CreditLine.at(ulCreditLines[0])
    })

    it("should emit an event with the correct data", async () => {
      const response = await drawdown(usdcVal(10), creditLine.address)
      const event = response.logs[0]

      expect(event.event).to.equal("DrawdownMade")
      expect(event.args.borrower).to.equal(borrower)
      expect(event.args.creditLine).to.equal(creditLine.address)
      expect(event.args.drawdownAmount).to.bignumber.equal(usdcVal(10))
    })

    it("should not allow random addresses to be passed up as credit lines", async () => {
      // Note this wasn't created through the credit desk, so it shouldn't have been registered
      const fakeMaliciousCreditLine = await CreditLine.new({from: owner})
      return expect(drawdown(usdcVal(10), fakeMaliciousCreditLine.address)).to.be.rejectedWith(/Unknown credit line/)
    })

    it("should increase the total loans outstanding on the credit desk", async () => {
      const drawdownAmount = usdcVal(10)
      const amountBefore = await creditDesk.totalLoansOutstanding()
      await drawdown(drawdownAmount, creditLine.address)
      const amountAfter = await creditDesk.totalLoansOutstanding()
      expect(amountAfter.sub(amountBefore)).to.bignumber.equal(drawdownAmount)
    })

    it("should increase the total loans outstanding correctly if you do two drawdowns close by", async () => {
      const drawdownAmount = usdcVal(10)
      await drawdown(drawdownAmount, creditLine.address)
      const totalLoansOutstanding = await creditDesk.totalLoansOutstanding()
      expect(totalLoansOutstanding).to.bignumber.equal(drawdownAmount)

      const currentBlock = await time.latestBlock()
      await time.advanceBlockTo(currentBlock.add(new BN(99)))

      await drawdown(drawdownAmount, creditLine.address)
      const totalLoansOutstanding2 = await creditDesk.totalLoansOutstanding()
      const interestOwed = await creditLine.interestOwed()
      expect(interestOwed).to.bignumber.be.greaterThan(new BN(0))
      expect(totalLoansOutstanding2).to.bignumber.equal(drawdownAmount.add(drawdownAmount))
    })

    it("should increase the usdc balance of the borrower", async () => {
      const drawdownAmount = usdcVal(10)
      const originalBalance = await getBalance(borrower, usdc)
      await drawdown(drawdownAmount, creditLine.address)
      const newBalance = await getBalance(borrower, usdc)
      expect(newBalance.sub(originalBalance)).to.bignumber.equal(drawdownAmount)
    })

    it("should track your accrued interest if you drawdown again", async () => {
      const drawdownAmount = usdcVal(10)
      await drawdown(drawdownAmount, creditLine.address)
      expect(await creditLine.balance()).to.bignumber.equal(drawdownAmount)
      expect(await creditLine.interestOwed()).to.bignumber.equal(new BN(0))

      const currentBlock = await time.latestBlock()
      const nextBlock = currentBlock.add(new BN(99))
      await time.advanceBlockTo(nextBlock)
      // Divide by 100 blocks because we advance 99, and then the drawdown happens on the 100th block.
      // Roughly 10 * 123.12345678% apr * (100 / 2,102,400 blocks per year) * 1e6 (USDC Decimals)
      const expectedInterestAfter100Blocks = new BN(585)

      await drawdown(drawdownAmount, creditLine.address)
      expect(await creditLine.balance()).to.bignumber.equal(drawdownAmount.add(drawdownAmount))
      expect(await creditLine.interestOwed()).to.bignumber.equal(expectedInterestAfter100Blocks)
    })

    it("should set the termEndAt correctly", async () => {
      expect((await creditLine.termEndBlock()).eq(new BN(0))).to.be.true

      await drawdown(usdcVal(10), creditLine.address)
      const currentBlock = await time.latestBlock()
      const blockLength = new BN(termInDays).mul(new BN(blocksPerDay))

      const expectedTermEndBlock = currentBlock.add(blockLength)
      expect((await creditLine.termEndBlock()).eq(expectedTermEndBlock)).to.be.true
    })

    it("should set the last updated block on drawdown to be the most recent block number", async () => {
      const drawdownAmount = usdcVal(10)
      await drawdown(drawdownAmount, creditLine.address)
      expect(await creditLine.lastUpdatedBlock()).to.bignumber.equal(await time.latestBlock())
    })

    it("should set the nextDueAt correctly", async () => {
      expect((await creditLine.nextDueBlock()).eq(new BN(0))).to.be.true

      await drawdown(usdcVal(10), creditLine.address)
      const currentBlock = await time.latestBlock()
      const blockLength = new BN(paymentPeriodInDays).mul(new BN(blocksPerDay))

      const expectedNextDueBlock = currentBlock.add(blockLength)
      expect(await creditLine.nextDueBlock()).to.bignumber.equal(expectedNextDueBlock)
    })

    describe("limits", async () => {
      beforeEach(async () => {
        await goldfinchConfig.setNumber(CONFIG_KEYS.TransactionLimit, usdcVal(9))
      })
      it("should allow you to withdraw right up to the limit", async () => {
        return expect(drawdown(usdcVal(9), creditLine.address)).to.be.fulfilled
      })
      it("should fail with anything greater", async () => {
        return expect(drawdown(usdcVal(9).add(new BN(1)), creditLine.address)).to.be.rejectedWith(
          /over the per-transaction limit/
        )
      })
    })

    describe("pausing", async () => {
      it("should be disallowed when paused", async () => {
        await creditDesk.pause()
        return expect(drawdown(usdcVal(10), creditLine.address)).to.be.rejectedWith(/Pausable: paused/)
      })
    })

    describe("when using a forwarding address", async () => {
      it("should send to that address", async () => {
        const drawdownAmount = usdcVal(3)
        const originalBalance = await getBalance(person4, usdc)
        await drawdown(drawdownAmount, creditLine.address, person4)
        const newBalance = await getBalance(person4, usdc)
        expect(newBalance.sub(originalBalance)).to.bignumber.equal(drawdownAmount)
      })

      it("should not send to the borrower address", async () => {
        const drawdownAmount = usdcVal(3)
        const originalBalance = await getBalance(borrower, usdc)
        await drawdown(drawdownAmount, creditLine.address, person4)
        const newBalance = await getBalance(borrower, usdc)
        expect(newBalance.sub(originalBalance)).to.bignumber.equal(new BN(0))
      })

      it("if you pass up the zero address, it should send money to the borrower", async () => {
        const drawdownAmount = usdcVal(3)
        const originalBalance = await getBalance(borrower, usdc)
        await drawdown(drawdownAmount, creditLine.address, ZERO_ADDRESS)
        const newBalance = await getBalance(borrower, usdc)
        expect(newBalance.sub(originalBalance)).to.bignumber.equal(drawdownAmount)
      })
    })
  })

  describe("prepayment", async () => {
    let makePrepayment = async (creditLineAddress, amount, from) => {
      // There's no separate collectedPayment anymore, a collectedPayment is just a payment that happens before
      // the due block
      return await creditDesk.pay(creditLineAddress, String(usdcVal(amount)), {from: from})
    }
    describe("with a valid creditline id", async () => {
      let creditLine
      beforeEach(async () => {
        underwriter = person2
        borrower = person2
        creditLine = creditLine = await createAndSetCreditLineAttributes({
          balance: 10,
          interestOwed: 0,
          principalOwed: 0,
        })
      })
      it("should increment the prepaid balance", async () => {
        const prepaymentAmount = 10
        expect(await (await getBalance(creditLine.address, usdc)).eq(usdcVal(0))).to.be.true
        await makePrepayment(creditLine.address, prepaymentAmount, borrower)
        expect((await getBalance(creditLine.address, usdc)).eq(usdcVal(prepaymentAmount))).to.be.true
        expect((await creditLine.collectedPaymentBalance()).eq(usdcVal(prepaymentAmount))).to.be.true

        let secondPrepayment = 15
        let totalPrepayment = usdcVal(prepaymentAmount).add(usdcVal(secondPrepayment))
        await makePrepayment(creditLine.address, secondPrepayment, borrower)
        expect(await getBalance(creditLine.address, usdc)).to.bignumber.equal(totalPrepayment)
        expect(await creditLine.collectedPaymentBalance()).to.bignumber.equal(totalPrepayment)
      })

      it("should emit an event with the correct data", async () => {
        const collectedPaymentAmount = 10
        const response = await makePrepayment(creditLine.address, collectedPaymentAmount, borrower)
        const event = response.logs[0]

        expect(event.event).to.equal("PaymentCollected")
        expect(event.args.payer).to.equal(borrower)
        expect(event.args.creditLine).to.equal(creditLine.address)
        expect(event.args.paymentAmount).to.bignumber.closeTo(usdcVal(10), tolerance)
      })
    })
  })

  describe("payment", async () => {
    describe("with an outstanding credit line", async () => {
      beforeEach(async () => {
        borrower = person3
        underwriter = person2
        usdc.transfer(borrower, usdcVal(50), {from: owner})
      })

      describe("pausing", async () => {
        it("should be disallowed when paused", async () => {
          const creditLine = await createAndSetCreditLineAttributes({
            balance: 10,
            interestOwed: 5,
            principalOwed: 3,
            nextDueBlock: 1,
          })
          await creditDesk.pause()
          const result = creditDesk.pay(creditLine.address, String(usdcVal(4)), {from: borrower})
          return expect(result).to.be.rejectedWith(/Pausable: paused/)
        })
      })

      it("should emit an event with the correct data", async () => {
        const creditLine = await createAndSetCreditLineAttributes({
          balance: 10,
          interestOwed: 5,
          principalOwed: 3,
          nextDueBlock: 1,
        })
        const paymentAmount = 6
        const response = await creditDesk.pay(creditLine.address, String(usdcVal(paymentAmount)), {from: borrower})
        const paymentCollectedEvent = response.logs[0]
        expect(paymentCollectedEvent.event).to.equal("PaymentCollected")
        expect(paymentCollectedEvent.args.payer).to.equal(borrower)
        expect(paymentCollectedEvent.args.paymentAmount).to.bignumber.closeTo(usdcVal(paymentAmount), tolerance)

        const event = response.logs[1]
        expect(event.event).to.equal("PaymentApplied")
        expect(event.args.payer).to.equal(borrower)
        expect(event.args.creditLine).to.equal(creditLine.address)
        expect(event.args.interestAmount).to.bignumber.closeTo(usdcVal(5), tolerance)
        expect(event.args.principalAmount).to.bignumber.closeTo(usdcVal(1), tolerance)
        expect(event.args.remainingAmount).to.bignumber.equal(usdcVal(0))
      })

      it("should pay off interest first", async () => {
        const creditLine = await createAndSetCreditLineAttributes({
          balance: 10,
          interestOwed: 5,
          principalOwed: 3,
          nextDueBlock: 1,
        })
        const paymentAmount = 6
        await creditDesk.pay(creditLine.address, String(usdcVal(paymentAmount)), {from: borrower})

        // We use closeTo because several blocks may have passed between creating the creditLine and
        // making the payment, which accrues a very small amount of interest and principal. Also note
        // that 1e14 is actually a very small tolerance, since we use 1e18 as our decimals
        expect(await creditLine.interestOwed()).to.be.bignumber.closeTo(usdcVal(0), tolerance)
        expect(await creditLine.principalOwed()).to.be.bignumber.closeTo(usdcVal(2), tolerance)
        expect(await creditLine.collectedPaymentBalance()).to.be.bignumber.eq(usdcVal(0))
        expect(await creditLine.balance()).to.be.bignumber.closeTo(usdcVal(9), tolerance)
      })

      it("should send the payment to the pool", async () => {
        var originalPoolBalance = await getBalance(pool.address, usdc)
        var interestOwed = 5
        const creditLine = await createAndSetCreditLineAttributes({
          balance: 10,
          interestOwed: interestOwed,
          principalOwed: 3,
          nextDueBlock: 1,
        })
        const paymentAmount = 6
        await creditDesk.pay(creditLine.address, String(usdcVal(paymentAmount)), {from: borrower})

        var newPoolBalance = await getBalance(pool.address, usdc)
        var expectedFeeAmount = usdcVal(interestOwed).div(FEE_DENOMINATOR)
        var delta = newPoolBalance.sub(originalPoolBalance)
        expect(delta).to.be.bignumber.equal(usdcVal(6).sub(expectedFeeAmount))
      })

      it("should send the fee amount to the reserve address", async () => {
        var originalReserveBalance = await getBalance(reserve, usdc)
        var interestOwed = 5
        const creditLine = await createAndSetCreditLineAttributes({
          balance: 10,
          interestOwed: interestOwed,
          principalOwed: 3,
          nextDueBlock: 1,
        })
        const paymentAmount = 6
        await creditDesk.pay(creditLine.address, String(usdcVal(paymentAmount)), {from: borrower})

        var newReserveBalance = await getBalance(reserve, usdc)
        var expectedFeeAmount = usdcVal(interestOwed).div(FEE_DENOMINATOR)
        var delta = newReserveBalance.sub(originalReserveBalance)
        expect(delta).to.be.bignumber.equal(expectedFeeAmount)
      })

      it("should increase the share price of the pool only based on the paid interest (not principal)", async () => {
        var originalSharePrice = await pool.sharePrice()
        var originalTotalShares = await fidu.totalSupply()

        var interestAmount = 5
        const paymentAmount = 7
        const creditLine = await createAndSetCreditLineAttributes({
          balance: 10,
          interestOwed: interestAmount,
          principalOwed: 3,
          nextDueBlock: 1,
        })
        await creditDesk.pay(creditLine.address, String(usdcVal(paymentAmount)), {from: borrower})

        var newSharePrice = await pool.sharePrice()
        var delta = newSharePrice.sub(originalSharePrice)

        let normalizedInterest = await pool._usdcToFidu(usdcVal(interestAmount))
        let expectedReserveFee = await pool._usdcToFidu(usdcVal(interestAmount).div(FEE_DENOMINATOR))
        var expectedDelta = normalizedInterest.sub(expectedReserveFee).mul(decimals).div(originalTotalShares)
        let fidu_tolerance = decimals.div(USDC_DECIMALS)

        // Ensure the tolerance is not too big
        expect(delta).to.bignumber.gt(fidu_tolerance)
        expect(newSharePrice).to.bignumber.gt(fidu_tolerance)

        expect(delta).to.bignumber.closeTo(expectedDelta, fidu_tolerance)
        expect(newSharePrice).to.bignumber.closeTo(originalSharePrice.add(expectedDelta), fidu_tolerance)
      })

      describe("When fully paying for a loan", async () => {
        it("should set the nextDueBlock and termEndBlock to zero", async () => {
          const creditLine = await createAndSetCreditLineAttributes({
            balance: 3,
            interestOwed: 1,
            principalOwed: 3,
            nextDueBlock: 1,
          })
          const originalNextDueBlock = await creditLine.nextDueBlock()
          expect(originalNextDueBlock).to.not.bignumber.equal(new BN(0))
          expect(await creditLine.termEndBlock()).to.not.bignumber.equal(new BN(0))
          await creditDesk.pay(creditLine.address, String(usdcVal(5)), {from: borrower})
          const nextDueBlock = await creditLine.nextDueBlock()
          expect(nextDueBlock).to.bignumber.equal(new BN(0))
          expect(await creditLine.termEndBlock()).to.bignumber.equal(new BN(0))
        })
      })

      describe("with extra payment left over", async () => {
        it("should send the extra to the collectedPayment of the credit line", async () => {
          var interestAmount = 1
          const balance = 10
          const paymentAmount = 15
          const creditLine = await createAndSetCreditLineAttributes({
            balance: 10,
            interestOwed: interestAmount,
            principalOwed: 3,
            nextDueBlock: 1,
          })
          await creditDesk.pay(creditLine.address, String(usdcVal(paymentAmount)), {from: borrower})

          const expected = usdcVal(paymentAmount).sub(usdcVal(interestAmount)).sub(usdcVal(balance))
          expect(await creditLine.collectedPaymentBalance()).to.bignumber.closeTo(expected, tolerance)
        })
      })
    })
  })

  describe("assessCreditLine", async () => {
    let latestBlock
    beforeEach(async () => {
      underwriter = person2
      borrower = person3
      latestBlock = await time.latestBlock()
    })

    describe("pausing", async () => {
      it("should be disallowed when paused", async () => {
        const collectedPaymentBalance = 8
        const interestOwed = 5
        var creditLine = await createAndSetCreditLineAttributes({
          balance: 10,
          interestOwed: interestOwed,
          principalOwed: 3,
          collectedPaymentBalance: collectedPaymentBalance,
          latestBlock: latestBlock,
        })

        await creditDesk.pause()
        const result = creditDesk.assessCreditLine(creditLine.address)
        return expect(result).to.be.rejectedWith(/Pausable: paused/)
      })
    })

    describe("when there is exactly enough collectedPaymentBalance", async () => {
      it("should successfully process the payment and correctly update all attributes", async () => {
        const collectedPaymentBalance = 8
        const interestOwed = 5
        const originalReserveBalance = await getBalance(reserve, usdc)
        var creditLine = await createAndSetCreditLineAttributes({
          balance: 10,
          interestOwed: interestOwed,
          principalOwed: 3,
          collectedPaymentBalance: collectedPaymentBalance,
          nextDueBlock: latestBlock,
        })
        const originalPoolBalance = await getBalance(pool.address, usdc)

        await creditDesk.assessCreditLine(creditLine.address, {from: underwriter})

        const newPoolBalance = await getBalance(pool.address, usdc)
        const expectedNextDueBlock = (await creditLine.paymentPeriodInDays())
          .mul(await creditDesk.BLOCKS_PER_DAY())
          .add(latestBlock)
        const newReserveBalance = await getBalance(reserve, usdc)

        expect(await creditLine.collectedPaymentBalance()).to.bignumber.equal("0")
        expect(await creditLine.balance()).to.bignumber.equal(usdcVal(7))
        expect(await getBalance(creditLine.address, usdc)).to.bignumber.equal("0")
        expect(await creditLine.interestOwed()).to.bignumber.equal("0")
        expect(await creditLine.principalOwed()).to.bignumber.equal("0")
        const actualNextDueBlock = await creditLine.nextDueBlock()
        const expectedFeeAmount = usdcVal(interestOwed).div(FEE_DENOMINATOR)
        expect(actualNextDueBlock).to.bignumber.closeTo(expectedNextDueBlock, actualNextDueBlock.div(new BN(100))) // 1% tolerance;
        expect(newPoolBalance.sub(originalPoolBalance)).to.bignumber.equal(usdcVal(8).sub(expectedFeeAmount))
        expect(newReserveBalance.sub(originalReserveBalance)).to.bignumber.equal(expectedFeeAmount)
      })

      describe("idempotency", async () => {
        it("should keep the nextDueBlock and termEndBlock what it is if you call it twice", async () => {
          const collectedPaymentBalance = 8
          const interestOwed = 5
          var creditLine = await createAndSetCreditLineAttributes({
            balance: 10,
            interestOwed: interestOwed,
            principalOwed: 3,
            collectedPaymentBalance: collectedPaymentBalance,
            nextDueBlock: latestBlock,
          })
          const originalTermEndBlock = await creditLine.termEndBlock()
          await creditDesk.assessCreditLine(creditLine.address, {from: underwriter})

          const expectedNextDueBlock = (await creditLine.paymentPeriodInDays())
            .mul(await creditDesk.BLOCKS_PER_DAY())
            .add(latestBlock)
          const actualNextDueBlock = await creditLine.nextDueBlock()
          const expectedInterestOwed = await creditLine.interestOwed()
          const expectedPrincipalOwed = await creditLine.principalOwed()
          expect(actualNextDueBlock).to.bignumber.closeTo(expectedNextDueBlock, actualNextDueBlock.div(new BN(100))) // 1% tolerance;

          await creditDesk.assessCreditLine(creditLine.address, {from: underwriter})
          const actualNextDueBlockAgain = await creditLine.nextDueBlock()
          const actualTermEndBlock = await creditLine.termEndBlock()
          const actualInterestOwed = await creditLine.interestOwed()
          const actualPrincipalOwed = await creditLine.principalOwed()

          expect(actualNextDueBlockAgain).to.bignumber.equal(actualNextDueBlock) // No tolerance. Should be exact.
          expect(actualTermEndBlock).to.bignumber.equal(originalTermEndBlock)
          expect(actualInterestOwed).to.bignumber.equal(expectedInterestOwed)
          expect(actualPrincipalOwed).to.bignumber.equal(expectedPrincipalOwed)
        })
      })

      it("should emit an event with the correct data", async () => {
        const collectedPaymentBalance = 9
        const interestOwed = 5
        var creditLine = await createAndSetCreditLineAttributes({
          balance: 10,
          interestOwed: interestOwed,
          principalOwed: 3,
          collectedPaymentBalance: collectedPaymentBalance,
          nextDueBlock: latestBlock,
        })
        const response = await creditDesk.assessCreditLine(creditLine.address)
        const event = response.logs[0]

        expect(event.event).to.equal("PaymentApplied")
        expect(event.args.payer).to.equal(borrower)
        expect(event.args.creditLine).to.equal(creditLine.address)
        expect(event.args.interestAmount).to.bignumber.closeTo(usdcVal(5), tolerance)
        expect(event.args.principalAmount).to.bignumber.closeTo(usdcVal(4), tolerance)
        expect(event.args.remainingAmount).to.bignumber.equal(usdcVal(0))
      })

      it("should only increase the share price from interest paid", async () => {
        const collectedPaymentBalance = 8
        const interestOwed = 5
        const originalSharePrice = await pool.sharePrice()
        var creditLine = await createAndSetCreditLineAttributes({
          balance: 10,
          interestOwed: interestOwed,
          principalOwed: 3,
          collectedPaymentBalance: collectedPaymentBalance,
          nextDueBlock: latestBlock,
        })
        const expectedfeeAmount = usdcVal(interestOwed).div(FEE_DENOMINATOR)

        await creditDesk.assessCreditLine(creditLine.address)

        const newSharePrice = await pool.sharePrice()
        const expectedSharePrice = usdcVal(interestOwed)
          .sub(expectedfeeAmount)
          .mul(decimals.div(USDC_DECIMALS)) // This part is our "normalization" between USDC and Fidu
          .mul(decimals)
          .div(await fidu.totalSupply())
          .add(originalSharePrice)
        expect(newSharePrice).to.bignumber.equal(expectedSharePrice)
      })
    })

    describe("when there is only enough to pay interest", async () => {
      it("should pay interest first", async () => {
        const collectedPaymentBalance = 5
        const interestOwed = 5
        const principalOwed = 3
        var creditLine = await createAndSetCreditLineAttributes({
          balance: 10,
          interestOwed: interestOwed,
          principalOwed: 3,
          collectedPaymentBalance: collectedPaymentBalance,
          nextDueBlock: await time.latestBlock(),
        })
        const originalPoolBalance = await getBalance(pool.address, usdc)
        const originalSharePrice = await pool.sharePrice()
        const expectedFeeAmount = usdcVal(interestOwed).div(FEE_DENOMINATOR)

        await creditDesk.assessCreditLine(creditLine.address)

        const newPoolBalance = await getBalance(pool.address, usdc)

        expect(await creditLine.collectedPaymentBalance()).to.bignumber.equal("0")
        expect(await creditLine.interestOwed()).to.bignumber.equal("0")
        expect(await creditLine.principalOwed()).to.bignumber.equal(usdcVal(principalOwed))
        expect(await pool.sharePrice()).to.bignumber.gt(originalSharePrice)
        expect(newPoolBalance.sub(originalPoolBalance)).to.bignumber.equal(usdcVal(interestOwed).sub(expectedFeeAmount))
      })
    })

    describe("when there is more collectedPayment than total amount owed", async () => {
      it("should retain apply the remaining towards the principal", async () => {
        const balance = 10
        const collectedPaymentBalance = 10
        const interestOwed = 5
        const principalOwed = 3
        var creditLine = await createAndSetCreditLineAttributes({
          balance: balance,
          interestOwed: interestOwed,
          principalOwed: 3,
          collectedPaymentBalance: collectedPaymentBalance,
          nextDueBlock: await time.latestBlock(),
        })

        await creditDesk.assessCreditLine(creditLine.address)

        const paymentRemaining = usdcVal(collectedPaymentBalance).sub(usdcVal(interestOwed)).sub(usdcVal(principalOwed))
        const expectedBalance = usdcVal(balance).sub(usdcVal(principalOwed)).sub(paymentRemaining)
        expect(await creditLine.balance()).to.bignumber.equal(expectedBalance)
        expect(await creditLine.collectedPaymentBalance()).to.bignumber.equal("0")
        expect(await creditLine.interestOwed()).to.bignumber.equal("0")
        expect(await creditLine.principalOwed()).to.bignumber.equal(usdcVal("0"))
      })
    })

    describe("when there is more collectedPayment than the total owed", async () => {
      it("should retain the final remaining payment towards the next collectedPayment", async () => {
        const balance = 3
        const interestOwed = 1
        const principalOwed = 2
        const expectedLeftover = 1
        const collectedPaymentBalance = balance + interestOwed + expectedLeftover
        var creditLine = await createAndSetCreditLineAttributes({
          balance: balance,
          interestOwed: interestOwed,
          principalOwed: principalOwed,
          collectedPaymentBalance: collectedPaymentBalance,
          nextDueBlock: await time.latestBlock(),
        })

        await creditDesk.assessCreditLine(creditLine.address)

        expect(await creditLine.balance()).to.bignumber.equal("0")
        expect(await creditLine.collectedPaymentBalance()).to.bignumber.equal(usdcVal(expectedLeftover))
        expect(await creditLine.interestOwed()).to.bignumber.equal("0")
        expect(await creditLine.principalOwed()).to.bignumber.equal(usdcVal("0"))
      })
    })
  })
})
