/* global artifacts web3 */
const hre = require("hardhat")
const {deployments} = hre
const {
  expect,
  MAX_UINT,
  decimals,
  BN,
  usdcVal,
  tolerance,
  fiduTolerance,
  getBalance,
  deployAllContracts,
  erc20Transfer,
  erc20Approve,
  USDC_DECIMALS,
  BLOCKS_PER_DAY,
  BLOCKS_PER_YEAR,
} = require("./testHelpers.js")
const {
  OWNER_ROLE,
  PAUSER_ROLE,
  CONFIG_KEYS,
  interestAprAsBN,
  INTEREST_DECIMALS,
} = require("../blockchain_scripts/deployHelpers")
const {time} = require("@openzeppelin/test-helpers")
const CreditLine = artifacts.require("CreditLine")
const FEE_DENOMINATOR = new BN(10)

let accounts, owner, person2, person3, creditDesk, fidu, goldfinchConfig, reserve

describe("CreditDesk", () => {
  let underwriterLimit
  let underwriter
  let borrower
  let limit = usdcVal(500)
  let interestApr = interestAprAsBN("5.00")
  let paymentPeriodInDays = new BN(30)
  let termInDays = new BN(365)
  let lateFeeApr = new BN(0)
  let usdc
  let pool

  let createCreditLine = async ({
    _borrower,
    _underwriter,
    _limit,
    _interestApr,
    _paymentPeriodInDays,
    _termInDays,
    _lateFeeApr,
  } = {}) => {
    _borrower = _borrower || person3
    _underwriter = _underwriter || person2
    _limit = _limit || limit
    _interestApr = _interestApr || interestApr
    _paymentPeriodInDays = _paymentPeriodInDays || paymentPeriodInDays
    _termInDays = _termInDays || termInDays
    _lateFeeApr = _lateFeeApr || lateFeeApr
    return await creditDesk.createCreditLine(
      _borrower,
      _limit,
      _interestApr,
      _paymentPeriodInDays,
      _termInDays,
      _lateFeeApr,
      {
        from: _underwriter,
      }
    )
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

    // Use this instead of time.latestBlock so that it's semantically consistent
    // with setting creditDesk._setBlockNumberForTest before running this function
    let latestBlock = await creditDesk.blockNumberForTest()

    // These defaults are pretty arbitrary
    const termInDays = 360
    nextDueBlock = nextDueBlock || latestBlock.add(BLOCKS_PER_DAY.mul(paymentPeriodInDays))
    const lastFullPaymentBlock = BN.min(new BN(nextDueBlock), latestBlock)
    const termInBlocks = BLOCKS_PER_DAY.mul(new BN(termInDays))
    const termEndBlock = latestBlock.add(termInBlocks)
    await creditDesk.setUnderwriterGovernanceLimit(thisUnderwriter, limit.mul(new BN(5)))

    await creditDesk.createCreditLine(thisBorrower, limit, interestApr, paymentPeriodInDays, termInDays, lateFeeApr, {
      from: thisUnderwriter,
    })
    var borrowerCreditLines = await creditDesk.getBorrowerCreditLines(thisBorrower)
    const creditLine = await CreditLine.at(borrowerCreditLines[0])

    await Promise.all([
      creditDesk._setTotalLoansOutstanding(usdcVal(balance).add(usdcVal(interestOwed))),
      creditLine.setBalance(usdcVal(balance), {from: thisOwner}),
      creditLine.setInterestOwed(usdcVal(interestOwed), {from: thisOwner}),
      creditLine.setPrincipalOwed(usdcVal(principalOwed), {from: thisOwner}),
      creditLine.setLastFullPaymentBlock(lastFullPaymentBlock, {from: thisOwner}),
      usdc.transfer(creditLine.address, String(usdcVal(collectedPaymentBalance)), {from: thisOwner}),
      creditLine.setNextDueBlock(nextDueBlock, {from: thisOwner}),
      creditLine.setTermEndBlock(termEndBlock, {from: thisOwner}),
      creditLine.authorizePool(goldfinchConfig.address),
    ])

    return creditLine
  }

  const setupTest = deployments.createFixture(async ({deployments}) => {
    const {pool, usdc, creditDesk, fidu, goldfinchConfig} = await deployAllContracts(deployments)
    // Approve transfers for our test accounts
    await erc20Approve(usdc, pool.address, usdcVal(100000), [owner, person2, person3])
    // Some housekeeping so we have a usable creditDesk for tests, and a pool with funds
    await erc20Transfer(usdc, [person2], usdcVal(1000), owner)
    await pool.deposit(String(usdcVal(90)), {from: person2})
    // Set the reserve to a separate address for easier separation. The current owner account gets used for many things in tests.
    await goldfinchConfig.setTreasuryReserve(reserve)

    return {pool, usdc, creditDesk, fidu, goldfinchConfig}
  })

  beforeEach(async () => {
    accounts = await web3.eth.getAccounts()
    ;[owner, person2, person3, reserve] = accounts
    ;({usdc, pool, creditDesk, fidu, goldfinchConfig} = await setupTest())
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
      await cl.initialize(owner, borrower, underwriter, usdcVal(500), usdcVal(3), 10, 360, 0)
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
    let drawdown = async (amount, creditLineAddress) => {
      return await creditDesk.drawdown(creditLineAddress, amount, {from: borrower})
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

    it("should not allow unregistered borrowers to call it", async () => {
      const badDrawdown = creditDesk.drawdown(creditLine.address, usdcVal(10), {from: reserve})
      return expect(badDrawdown).to.be.rejectedWith(/No credit lines exist for this borrower/)
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
      expect(await creditLine.interestAccruedAsOfBlock()).to.bignumber.equal(await time.latestBlock())
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

    describe("if you're late", async () => {
      it("should not let you drawdown if you're late", async () => {
        // Do a drawdown
        await drawdown(usdcVal(10), creditLine.address)

        const BLOCKS_PER_DAY = await creditDesk.BLOCKS_PER_DAY()
        const paymentPeriodInBlocks = (await creditLine.paymentPeriodInDays()).mul(BLOCKS_PER_DAY)

        await creditDesk._setBlockNumberForTest((await time.latestBlock()).add(paymentPeriodInBlocks.mul(new BN(2))))

        return expect(drawdown(usdcVal(10), creditLine.address)).to.be.rejectedWith(/payments are past due/)
      })
    })
  })

  describe("migrateCreditLine", async () => {
    let existingCl, prepaymentAmount
    beforeEach(async () => {
      borrower = person3
      underwriter = owner
      prepaymentAmount = usdcVal(50)
      existingCl = await createAndSetCreditLineAttributes({
        balance: usdcVal(10000),
        interestOwed: usdcVal(1),
        principalOwed: usdcVal(1),
      })
    })

    it("should close out the old credit line", async () => {
      await creditDesk.pay(existingCl.address, String(prepaymentAmount), {from: owner})
      expect(await existingCl.balance()).to.not.bignumber.equal(new BN(0))
      expect(await existingCl.limit()).to.not.bignumber.equal(new BN(0))
      await creditDesk.migrateCreditLine(
        existingCl.address,
        borrower,
        limit,
        interestApr,
        paymentPeriodInDays,
        termInDays,
        lateFeeApr
      )
      const newClAddress = (await creditDesk.getBorrowerCreditLines(borrower))[1]

      expect(await existingCl.balance()).to.bignumber.equal(new BN(0))
      expect(await existingCl.limit()).to.bignumber.equal(new BN(0))
      expect(await getBalance(existingCl.address, usdc)).to.bignumber.equal(new BN(0))
      expect(await getBalance(newClAddress, usdc)).to.bignumber.equal(prepaymentAmount)
    })

    it("shouldn't let you migrate twice", async () => {
      await expect(
        creditDesk.migrateCreditLine(
          existingCl.address,
          borrower,
          limit,
          interestApr,
          paymentPeriodInDays,
          termInDays,
          lateFeeApr
        )
      ).to.be.fulfilled
      return expect(
        creditDesk.migrateCreditLine(
          existingCl.address,
          borrower,
          limit,
          interestApr,
          paymentPeriodInDays,
          termInDays,
          lateFeeApr
        )
      ).to.be.rejectedWith(/Can't migrate/)
    })

    it("should transfer the accounting variables", async () => {
      await creditDesk.pay(existingCl.address, String(prepaymentAmount), {from: owner})
      const oldBalance = await existingCl.balance()
      await creditDesk.migrateCreditLine(
        existingCl.address,
        borrower,
        limit,
        interestApr,
        paymentPeriodInDays,
        termInDays,
        lateFeeApr
      )
      const newClAddress = (await creditDesk.getBorrowerCreditLines(borrower))[1]
      const newCl = await CreditLine.at(newClAddress)

      expect(oldBalance).to.bignumber.equal(await newCl.balance())
      expect(await existingCl.interestOwed()).to.bignumber.equal(await newCl.interestOwed())
      expect(await existingCl.principalOwed()).to.bignumber.equal(await newCl.principalOwed())
      expect(await existingCl.termEndBlock()).to.bignumber.equal(await newCl.termEndBlock())
      expect(await existingCl.nextDueBlock()).to.bignumber.equal(await newCl.nextDueBlock())
      expect(await existingCl.interestAccruedAsOfBlock()).to.bignumber.equal(await newCl.interestAccruedAsOfBlock())
      expect(await existingCl.writedownAmount()).to.bignumber.equal(await newCl.writedownAmount())
      expect(await existingCl.lastFullPaymentBlock()).to.bignumber.equal(await newCl.lastFullPaymentBlock())
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

        let secondPrepayment = 15
        let totalPrepayment = usdcVal(prepaymentAmount).add(usdcVal(secondPrepayment))
        await makePrepayment(creditLine.address, secondPrepayment, borrower)
        expect(await getBalance(creditLine.address, usdc)).to.bignumber.equal(totalPrepayment)
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

  describe("appyPayment", async () => {
    describe("with an outstanding credit line", async () => {
      beforeEach(async () => {
        borrower = person3
        underwriter = person2
        usdc.transfer(borrower, usdcVal(50), {from: owner})
      })

      it("validates borrower and creditline", async () => {
        const creditLine = await createAndSetCreditLineAttributes({
          balance: 10,
          interestOwed: 5,
          principalOwed: 3,
          nextDueBlock: 1,
        })
        const paymentAmount = 6
        await expect(
          creditDesk.applyPayment(creditLine.address, String(usdcVal(paymentAmount)), {from: person2})
        ).to.be.rejectedWith(/You do not belong to this credit line/)

        await expect(
          creditDesk.applyPayment(usdc.address, String(usdcVal(paymentAmount)), {from: person2})
        ).to.be.rejectedWith(/Unknown credit line/)
      })

      it("apply the payment as of current block number and emit the event", async () => {
        const creditLine = await createAndSetCreditLineAttributes({
          balance: 10,
          interestOwed: 5,
          principalOwed: 3,
          nextDueBlock: 1,
        })
        const paymentAmount = 6
        await usdc.transfer(creditLine.address, String(usdcVal(paymentAmount)), {from: owner})
        const response = await creditDesk.applyPayment(creditLine.address, String(usdcVal(paymentAmount)), {
          from: borrower,
        })

        const event = response.logs[0]
        expect(event.event).to.equal("PaymentApplied")
        expect(event.args.payer).to.equal(borrower)
        expect(event.args.creditLine).to.equal(creditLine.address)
        expect(event.args.interestAmount).to.bignumber.closeTo(usdcVal(5), tolerance)
        expect(event.args.principalAmount).to.bignumber.closeTo(usdcVal(1), tolerance)
        expect(event.args.remainingAmount).to.bignumber.equal(usdcVal(0))
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
        const mostRecentDueBlock = new BN(1)
        const creditLine = await createAndSetCreditLineAttributes({
          balance: 10,
          interestOwed: 5,
          principalOwed: 3,
          nextDueBlock: mostRecentDueBlock,
        })
        const paymentAmount = 6
        await creditDesk.pay(creditLine.address, String(usdcVal(paymentAmount)), {from: borrower})

        // We use closeTo because several blocks may have passed between creating the creditLine and
        // making the payment, which accrues a very small amount of interest and principal. Also note
        // that 1e14 is actually a very small tolerance, since we use 1e18 as our decimals
        expect(await creditLine.interestOwed()).to.be.bignumber.closeTo(usdcVal(0), tolerance)
        expect(await creditLine.principalOwed()).to.be.bignumber.closeTo(usdcVal(2), tolerance)
        expect(await getBalance(creditLine.address, usdc)).to.be.bignumber.eq(usdcVal(0))
        expect(await creditLine.balance()).to.be.bignumber.closeTo(usdcVal(9), tolerance)
        expect(await creditLine.lastFullPaymentBlock()).to.be.bignumber.eq(mostRecentDueBlock)
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

        // This is a bit of a hack, we sholdn't have to be including thw writedown in this test, but it's
        // hard to isolate at the moment. We need to refactor these tests to be independent of writedowns
        let writedownAmount = await creditLine.writedownAmount()
        expect(writedownAmount).to.be.bignumber.gt("0")
        let normalizedWritedown = await pool._usdcToFidu(writedownAmount)

        var newSharePrice = await pool.sharePrice()
        var delta = newSharePrice.sub(originalSharePrice)

        let normalizedInterest = await pool._usdcToFidu(usdcVal(interestAmount))
        let expectedReserveFee = await pool._usdcToFidu(usdcVal(interestAmount).div(FEE_DENOMINATOR))
        var expectedDelta = normalizedInterest
          .sub(normalizedWritedown)
          .sub(expectedReserveFee)
          .mul(decimals)
          .div(originalTotalShares)

        expect(delta).to.bignumber.closeTo(expectedDelta, fiduTolerance)
        expect(newSharePrice).to.bignumber.closeTo(originalSharePrice.add(expectedDelta), fiduTolerance)
      })

      describe("When fully paying for a loan", async () => {
        it("should set the nextDueBlock and termEndBlock to zero", async () => {
          const mostRecentDueBlock = new BN(1)
          const creditLine = await createAndSetCreditLineAttributes({
            balance: 3,
            interestOwed: 1,
            principalOwed: 3,
            nextDueBlock: mostRecentDueBlock,
          })
          const originalNextDueBlock = await creditLine.nextDueBlock()
          expect(originalNextDueBlock).to.not.bignumber.equal(new BN(0))
          expect(await creditLine.termEndBlock()).to.not.bignumber.equal(new BN(0))
          await creditDesk.pay(creditLine.address, String(usdcVal(5)), {from: borrower})
          const nextDueBlock = await creditLine.nextDueBlock()
          expect(nextDueBlock).to.bignumber.equal(new BN(0))
          expect(await creditLine.termEndBlock()).to.bignumber.equal(new BN(0))
          expect(await creditLine.lastFullPaymentBlock()).to.bignumber.equal(mostRecentDueBlock)
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
          expect(await getBalance(creditLine.address, usdc)).to.bignumber.closeTo(expected, tolerance)
        })
      })

      describe("when the payment is late", async () => {
        it("should charge a late fee on the balance owed", async () => {
          let balance = 1000
          lateFeeApr = interestAprAsBN("3")
          let lateFeeGracePeriodInDays = paymentPeriodInDays
          let blockNumber = (await time.latestBlock()).add(new BN(100))

          const creditLine = await createAndSetCreditLineAttributes({
            balance: balance,
            interestOwed: 0,
            principalOwed: 0,
            nextDueBlock: blockNumber,
          })
          await creditLine.setInterestAccruedAsOfBlock(blockNumber)
          await creditLine.setLastFullPaymentBlock(new BN(0))
          await creditLine.setTermEndBlock(lateFeeGracePeriodInDays.mul(BLOCKS_PER_DAY).mul(new BN(10))) // some time in the future

          const totalInterestPerYear = usdcVal(balance).mul(interestApr).div(INTEREST_DECIMALS)
          let blocksPassed = lateFeeGracePeriodInDays.mul(BLOCKS_PER_DAY).mul(new BN(2))
          let expectedInterest = totalInterestPerYear.mul(blocksPassed).div(BLOCKS_PER_YEAR)

          const lateFeeInterestPerYear = usdcVal(balance).mul(lateFeeApr).div(INTEREST_DECIMALS)
          const lateFee = lateFeeInterestPerYear.mul(blocksPassed).div(BLOCKS_PER_YEAR)

          await creditDesk._setBlockNumberForTest(blockNumber.add(blocksPassed))

          await creditDesk.pay(creditLine.address, expectedInterest, {from: borrower})

          // Late fee should still be owed, and it should not count as a full payment
          expect(lateFee).to.be.bignumber.gt("0")
          expect(await creditLine.interestOwed()).to.be.bignumber.closeTo(lateFee, tolerance)
          expect(await creditLine.lastFullPaymentBlock()).to.be.bignumber.eq("0")
        })

        it("should allow paying late fees even if nextdueblock is in the future", async () => {
          let balance = 10
          lateFeeApr = interestAprAsBN("3")
          let lateFeeGracePeriodInDays = paymentPeriodInDays
          let blockNumber = paymentPeriodInDays.mul(BLOCKS_PER_DAY)

          const creditLine = await createAndSetCreditLineAttributes({
            balance: balance,
            interestOwed: 0,
            principalOwed: 0,
            nextDueBlock: blockNumber,
          })
          await creditLine.setInterestAccruedAsOfBlock(new BN(0))
          await creditLine.setLastFullPaymentBlock(new BN(0))
          await creditLine.setTermEndBlock(lateFeeGracePeriodInDays.mul(BLOCKS_PER_DAY).mul(new BN(10))) // some time in the future

          let blocksPassed = lateFeeGracePeriodInDays.mul(BLOCKS_PER_DAY).mul(new BN(2))

          await creditDesk._setBlockNumberForTest(blockNumber.add(new BN(10)))
          await creditDesk.assessCreditLine(creditLine.address, {from: borrower})
          let interestOwed = await creditLine.interestOwed()
          expect(interestOwed).to.be.bignumber.gt("0")

          // Set the next due block some time in the future
          await creditLine.setNextDueBlock(blockNumber.add(blocksPassed).add(new BN(100)))
          await creditDesk._setBlockNumberForTest(blockNumber.add(blocksPassed))

          await creditDesk.assessCreditLine(creditLine.address, {from: borrower})
          const newInterestOwed = await creditLine.interestOwed()
          expect(newInterestOwed).to.be.bignumber.gt(interestOwed)

          await creditDesk.pay(creditLine.address, newInterestOwed, {from: borrower})

          // It should pay off the interest even before the next due block
          expect(await creditLine.interestOwed()).to.be.bignumber.eq("0")
        })

        it("should not charge a late fee within the grace period", async () => {
          let balance = 1000
          lateFeeApr = interestAprAsBN("3")
          let lateFeeGracePeriodInDays = paymentPeriodInDays
          let blockNumber = (await time.latestBlock()).add(new BN(100))

          const creditLine = await createAndSetCreditLineAttributes({
            balance: balance,
            interestOwed: 0,
            principalOwed: 0,
            nextDueBlock: blockNumber,
          })
          await creditLine.setInterestAccruedAsOfBlock(blockNumber)
          await creditLine.setLastFullPaymentBlock(new BN("0"))
          await creditLine.setTermEndBlock(lateFeeGracePeriodInDays.mul(BLOCKS_PER_DAY).mul(new BN(10))) // some time in the future

          const totalInterestPerYear = usdcVal(balance).mul(interestApr).div(INTEREST_DECIMALS)
          let blocksPassed = lateFeeGracePeriodInDays.mul(BLOCKS_PER_DAY).div(new BN(2))
          let expectedInterest = totalInterestPerYear.mul(blocksPassed).div(BLOCKS_PER_YEAR)

          await creditDesk._setBlockNumberForTest(blockNumber.add(blocksPassed))

          await creditDesk.pay(creditLine.address, expectedInterest, {from: borrower})

          // No late fee owed and it should count as a full payment
          expect(await creditLine.interestOwed()).to.be.bignumber.eq("0")
          expect(await creditLine.lastFullPaymentBlock()).to.be.bignumber.eq(blockNumber)
        })
      })
    })
  })

  describe("writedowns", async () => {
    var originalSharePrice, originalTotalShares, interestOwedForOnePeriod, creditLine, nextDueBlock
    const lowTolerance = new BN(200)

    beforeEach(async () => {
      borrower = person3
      underwriter = person2
      usdc.transfer(borrower, usdcVal(50), {from: owner})

      originalSharePrice = await pool.sharePrice()
      originalTotalShares = await fidu.totalSupply()
      const latestBlock = await time.latestBlock()

      const paymentPeriodInBlocks = paymentPeriodInDays.mul(BLOCKS_PER_DAY)
      const totalInterestPerYear = usdcVal(10).mul(interestApr).div(INTEREST_DECIMALS)
      interestOwedForOnePeriod = totalInterestPerYear.mul(paymentPeriodInBlocks).divRound(BLOCKS_PER_YEAR)
      nextDueBlock = latestBlock.add(paymentPeriodInBlocks)

      // Note in actuality, we calculate by the day, and use decimal math. BN can't handle decimals,
      // So we just use a small tolerance in the expectations later on
      expect(interestOwedForOnePeriod).to.bignumber.eq(new BN("41096"))

      // Set it just after the next due block, so that assessment actually runs
      await creditDesk._setBlockNumberForTest(nextDueBlock.add(new BN(1)))
      creditLine = await createAndSetCreditLineAttributes({
        balance: 10,
        interestOwed: 5,
        principalOwed: 0,
        nextDueBlock: nextDueBlock,
      })
    })

    describe("before loan term ends", async () => {
      it("should write down the principal and distribute losses", async () => {
        // Assume already 1 period late
        const periodsLate = new BN("1")
        const interestOwed = interestOwedForOnePeriod.mul(periodsLate)
        await creditLine.setInterestOwed(interestOwed)

        // This will assess one additional period, making for 2 total periods of lateness
        await creditDesk.assessCreditLine(creditLine.address)

        // So writedown is 2 periods late - 1 grace period / 4 max = 25%
        let expectedWritedown = usdcVal(10).div(new BN(4)) // 25% of 10 = 2.5

        expect(await creditLine.interestOwed()).to.be.bignumber.closeTo(interestOwed.mul(new BN(2)), tolerance)
        expect(await creditLine.principalOwed()).to.be.bignumber.closeTo(usdcVal(0), tolerance)
        expect(await creditLine.writedownAmount()).to.be.bignumber.closeTo(expectedWritedown, tolerance)

        var newSharePrice = await pool.sharePrice()
        var delta = originalSharePrice.sub(newSharePrice)
        let normalizedWritedown = await pool._usdcToFidu(expectedWritedown)
        var expectedDelta = normalizedWritedown.mul(decimals).div(originalTotalShares)

        const totalWritedowns = await creditDesk.totalWritedowns()

        expect(delta).to.be.bignumber.closeTo(expectedDelta, fiduTolerance)
        expect(newSharePrice).to.be.bignumber.lt(originalSharePrice)
        expect(newSharePrice).to.be.bignumber.closeTo(originalSharePrice.sub(delta), fiduTolerance)
        expect(totalWritedowns).to.be.bignumber.closeTo(expectedWritedown, tolerance)
      })

      it("should decrease the write down amount if partially paid back", async () => {
        // Assume 1 periods late already
        const periodsLate = new BN("1")
        const interestOwed = interestOwedForOnePeriod.mul(periodsLate)
        await creditLine.setInterestOwed(interestOwed)

        // This will assess one additional period, making for 2 total periods of lateness
        await creditDesk.assessCreditLine(creditLine.address)

        // Reset the next due block so we trigger the applyPayment when we pay
        await creditLine.setNextDueBlock(nextDueBlock)
        var sharePriceAfterAsses = await pool.sharePrice()

        // Writedown should be 2 periods late - 1 grace period / 4 max = 25%
        let expectedWritedown = usdcVal(10).div(new BN(4)) // 25% of 10 = 2.5

        expect(await creditLine.writedownAmount()).to.be.bignumber.closeTo(expectedWritedown, tolerance)

        // Payback half of one period
        let interestPaid = interestOwedForOnePeriod.div(new BN(2))
        await creditDesk.pay(creditLine.address, String(interestPaid), {from: borrower})

        let expectedNewWritedown = expectedWritedown.div(new BN(2))

        let newWritedown = await creditLine.writedownAmount()
        expect(newWritedown).to.be.bignumber.closeTo(expectedNewWritedown, lowTolerance)

        var finalSharePrice = await pool.sharePrice()
        var delta = originalSharePrice.sub(finalSharePrice)
        let normalizedWritedown = await pool._usdcToFidu(newWritedown)
        let normalizedInterest = await pool._usdcToFidu(interestPaid)
        let expectedReserveFee = await pool._usdcToFidu(interestPaid.div(FEE_DENOMINATOR))
        var expectedDelta = normalizedWritedown
          .add(expectedReserveFee)
          .sub(normalizedInterest)
          .mul(decimals)
          .div(originalTotalShares)

        expect(delta).to.be.bignumber.closeTo(expectedDelta, fiduTolerance)
        // Share price must go down after the initial write down, and then up after partially paid back
        expect(sharePriceAfterAsses).to.be.bignumber.lt(originalSharePrice)
        expect(finalSharePrice).to.be.bignumber.gt(sharePriceAfterAsses)
        expect(finalSharePrice).to.be.bignumber.closeTo(originalSharePrice.sub(delta), fiduTolerance)
      })

      it("should reset the writedowns to 0 if fully paid back", async () => {
        // Assume 1 periods late already
        const periodsLate = new BN("1")
        const interestOwed = interestOwedForOnePeriod.mul(periodsLate)
        await creditLine.setInterestOwed(interestOwed)

        // This will assess one additional period, making for 2 total periods of lateness
        await creditDesk.assessCreditLine(creditLine.address)
        // Reset the next due block so we trigger the applyPayment when we pay
        await creditLine.setNextDueBlock(nextDueBlock)

        // Writedown should be 2 periods late - 1 grace period / 4 max = 25%
        let expectedWritedown = usdcVal(10).div(new BN(4)) // 25% of 10 = 2.5

        expect(await creditLine.writedownAmount()).to.be.bignumber.closeTo(expectedWritedown, tolerance)

        let totalWritedowns = await creditDesk.totalWritedowns()
        expect(totalWritedowns).to.be.bignumber.closeTo(expectedWritedown, tolerance)

        // Payback all interest owed
        await creditDesk.pay(creditLine.address, String(interestOwed), {from: borrower})

        expect(await creditLine.writedownAmount()).to.be.bignumber.eq("0")
        var newSharePrice = await pool.sharePrice()
        let normalizedInterest = await pool._usdcToFidu(interestOwed)
        let expectedReserveFee = await pool._usdcToFidu(interestOwed.div(FEE_DENOMINATOR))
        var delta = newSharePrice.sub(originalSharePrice)
        var expectedDelta = normalizedInterest.sub(expectedReserveFee).mul(decimals).div(originalTotalShares)

        totalWritedowns = await creditDesk.totalWritedowns()

        expect(delta).to.be.bignumber.eq(expectedDelta)
        expect(newSharePrice).to.be.bignumber.eq(originalSharePrice.add(delta))
        expect(totalWritedowns).to.be.bignumber.eq("0")
      })
    })

    // This scenario is harder to test because we will need to advance time by at least 1 day (or mock out BLOCKS_PER_DAY)
    // Currently, this is just tested with unit tests at the accountant level
    // describe("after loan term ends", async () => {
    //   xit("takes the principal owed into account to determining write downs", async () => {
    //   })
    // })
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

        expect(await getBalance(creditLine.address, usdc)).to.bignumber.equal("0")
        expect(await creditLine.balance()).to.bignumber.equal(usdcVal(7))
        expect(await getBalance(creditLine.address, usdc)).to.bignumber.equal("0")
        expect(await creditLine.interestOwed()).to.bignumber.equal("0")
        expect(await creditLine.principalOwed()).to.bignumber.equal("0")
        expect(await creditLine.lastFullPaymentBlock()).to.bignumber.equal(latestBlock)
        const actualNextDueBlock = await creditLine.nextDueBlock()
        expect(await creditLine.lastFullPaymentBlock()).to.bignumber.lt(actualNextDueBlock)
        const expectedFeeAmount = usdcVal(interestOwed).div(FEE_DENOMINATOR)
        expect(actualNextDueBlock).to.bignumber.closeTo(expectedNextDueBlock, actualNextDueBlock.div(new BN(100))) // 1% tolerance;
        expect(newPoolBalance.sub(originalPoolBalance)).to.bignumber.equal(usdcVal(8).sub(expectedFeeAmount))
        expect(newReserveBalance.sub(originalReserveBalance)).to.bignumber.equal(expectedFeeAmount)
      })

      describe("when you are multiple periods behind", async () => {
        it("should update the nextDueBlock to the closest period in time", async () => {
          const collectedPaymentBalance = 8
          const interestOwed = 5
          var creditLine = await createAndSetCreditLineAttributes({
            balance: 10,
            interestOwed: interestOwed,
            principalOwed: 3,
            collectedPaymentBalance: collectedPaymentBalance,
            nextDueBlock: latestBlock,
          })
          const paymentPeriodInDays = await creditLine.paymentPeriodInDays()
          const blocksPerDay = await creditDesk.BLOCKS_PER_DAY()
          const blocksPerPeriod = paymentPeriodInDays.mul(blocksPerDay)

          // Set it as if you are multiple periods behind, ie. time is 2 periods in the future.
          const blockForTest = latestBlock.add(blocksPerPeriod.mul(new BN(2)))
          await creditDesk._setBlockNumberForTest(blockForTest)

          // Assess!
          await creditDesk.assessCreditLine(creditLine.address, {from: underwriter})

          // Should shift it one additional block past the one where it's currently set.
          const expectedNextDueBlock = latestBlock.add(blocksPerPeriod.mul(new BN(3)))

          expect(await creditLine.nextDueBlock()).to.bignumber.equal(expectedNextDueBlock)
        })
      })

      describe("When you assess multiple periods after the termEndBlock", async () => {
        it("should not set the nextDueBlock past the termEndBlock", async () => {
          const collectedPaymentBalance = 8
          const interestOwed = 5
          var creditLine = await createAndSetCreditLineAttributes({
            balance: 10,
            interestOwed: interestOwed,
            principalOwed: 3,
            collectedPaymentBalance: collectedPaymentBalance,
            nextDueBlock: latestBlock,
          })
          const termInDays = await creditLine.termInDays()
          const paymentPeriodInDays = await creditLine.paymentPeriodInDays()
          const blocksPerDay = await creditDesk.BLOCKS_PER_DAY()
          const blocksPerTerm = termInDays.mul(blocksPerDay)
          const blocksPerPeriod = paymentPeriodInDays.mul(BLOCKS_PER_DAY)

          // Set it as if you one period past the termEndBlock
          const blockForTest = latestBlock.add(blocksPerTerm.add(blocksPerPeriod).add(new BN(1)))
          await creditDesk._setBlockNumberForTest(blockForTest)

          // Assess!
          await creditDesk.assessCreditLine(creditLine.address, {from: underwriter})

          // Should cap it at the termEndBlock
          const expectedNextDueBlock = await creditLine.termEndBlock()

          expect(await creditLine.nextDueBlock()).to.bignumber.equal(expectedNextDueBlock)
        })
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
          const expectedLastFullPaymentBlock = await creditLine.lastFullPaymentBlock()
          expect(actualNextDueBlock).to.bignumber.closeTo(expectedNextDueBlock, actualNextDueBlock.div(new BN(100))) // 1% tolerance;

          await creditDesk.assessCreditLine(creditLine.address, {from: underwriter})
          const actualNextDueBlockAgain = await creditLine.nextDueBlock()
          const actualTermEndBlock = await creditLine.termEndBlock()
          const actualInterestOwed = await creditLine.interestOwed()
          const actualPrincipalOwed = await creditLine.principalOwed()
          const actualLastFullPaymentBlock = await creditLine.lastFullPaymentBlock()

          expect(actualNextDueBlockAgain).to.bignumber.equal(actualNextDueBlock) // No tolerance. Should be exact.
          expect(actualTermEndBlock).to.bignumber.equal(originalTermEndBlock)
          expect(actualInterestOwed).to.bignumber.equal(expectedInterestOwed)
          expect(actualPrincipalOwed).to.bignumber.equal(expectedPrincipalOwed)
          expect(actualLastFullPaymentBlock).to.bignumber.equal(expectedLastFullPaymentBlock)
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
        const mostRecentDueBlock = await time.latestBlock()
        var creditLine = await createAndSetCreditLineAttributes({
          balance: 10,
          interestOwed: interestOwed,
          principalOwed: 3,
          collectedPaymentBalance: collectedPaymentBalance,
          nextDueBlock: mostRecentDueBlock,
        })
        const originalPoolBalance = await getBalance(pool.address, usdc)
        const originalSharePrice = await pool.sharePrice()
        const originalTotalShares = await fidu.totalSupply()
        const expectedFeeAmount = usdcVal(interestOwed).div(FEE_DENOMINATOR)

        await creditDesk.assessCreditLine(creditLine.address)

        // This is a bit of a hack, we sholdn't have to be including thw writedown in this test, but it's
        // hard to isolate at the moment. We need to refactor these tests to be independent of writedowns
        let writedownAmount = await creditLine.writedownAmount()
        expect(writedownAmount).to.be.bignumber.gt("0")
        let normalizedWritedown = await pool._usdcToFidu(writedownAmount)
        let normalizedInterest = await pool._usdcToFidu(usdcVal(interestOwed))
        let expectedReserveFee = await pool._usdcToFidu(expectedFeeAmount)
        var expectedDelta = normalizedInterest
          .sub(normalizedWritedown)
          .sub(expectedReserveFee)
          .mul(decimals)
          .div(originalTotalShares)

        const newPoolBalance = await getBalance(pool.address, usdc)

        expect(await getBalance(creditLine.address, usdc)).to.bignumber.equal("0")
        expect(await creditLine.interestOwed()).to.bignumber.equal("0")
        expect(await creditLine.principalOwed()).to.bignumber.equal(usdcVal(principalOwed))
        expect(await creditLine.lastFullPaymentBlock()).to.bignumber.equal(mostRecentDueBlock)
        expect(await pool.sharePrice()).to.bignumber.closeTo(originalSharePrice.add(expectedDelta), fiduTolerance)
        expect(newPoolBalance.sub(originalPoolBalance)).to.bignumber.equal(usdcVal(interestOwed).sub(expectedFeeAmount))
      })
    })

    describe("when there is not enough to pay interest", async () => {
      it("should pay interest first but not update lastFullPaymentBlock", async () => {
        const collectedPaymentBalance = 3
        const interestOwed = 5
        const principalOwed = 3
        const mostRecentDueBlock = await time.latestBlock()
        var creditLine = await createAndSetCreditLineAttributes({
          balance: 10,
          interestOwed: interestOwed,
          principalOwed: 3,
          collectedPaymentBalance: collectedPaymentBalance,
          nextDueBlock: mostRecentDueBlock,
        })
        const interestPaid = collectedPaymentBalance
        const originalPoolBalance = await getBalance(pool.address, usdc)
        const originalSharePrice = await pool.sharePrice()
        const originalTotalShares = await fidu.totalSupply()
        const originalLastPaidBlock = await creditLine.lastFullPaymentBlock()
        const expectedFeeAmount = usdcVal(interestPaid).div(FEE_DENOMINATOR)

        await creditDesk.assessCreditLine(creditLine.address)

        // This is a bit of a hack, we sholdn't have to be including thw writedown in this test, but it's
        // hard to isolate at the moment. We need to refactor these tests to be independent of writedowns
        let writedownAmount = await creditLine.writedownAmount()
        expect(writedownAmount).to.be.bignumber.gt("0")
        let normalizedWritedown = await pool._usdcToFidu(writedownAmount)
        let normalizedInterest = await pool._usdcToFidu(usdcVal(interestPaid))
        let expectedReserveFee = await pool._usdcToFidu(expectedFeeAmount)
        var expectedDelta = normalizedInterest
          .sub(normalizedWritedown)
          .sub(expectedReserveFee)
          .mul(decimals)
          .div(originalTotalShares)

        const newPoolBalance = await getBalance(pool.address, usdc)

        expect(await getBalance(creditLine.address, usdc)).to.bignumber.equal("0")
        expect(await creditLine.interestOwed()).to.bignumber.equal(usdcVal(interestOwed).sub(usdcVal(interestPaid)))
        expect(await creditLine.principalOwed()).to.bignumber.equal(usdcVal(principalOwed))
        expect(await creditLine.lastFullPaymentBlock()).to.bignumber.equal(originalLastPaidBlock)
        expect(await pool.sharePrice()).to.bignumber.closeTo(originalSharePrice.add(expectedDelta), fiduTolerance)
        expect(newPoolBalance.sub(originalPoolBalance)).to.bignumber.equal(usdcVal(interestPaid).sub(expectedFeeAmount))
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
        expect(await getBalance(creditLine.address, usdc)).to.bignumber.equal("0")
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
        expect(await getBalance(creditLine.address, usdc)).to.bignumber.equal(usdcVal(expectedLeftover))
        expect(await creditLine.interestOwed()).to.bignumber.equal("0")
        expect(await creditLine.principalOwed()).to.bignumber.equal(usdcVal("0"))
      })
    })
  })
})
