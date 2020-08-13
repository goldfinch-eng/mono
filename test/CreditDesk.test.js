const {chai, expect, decimals, BN, bigVal, mochaEach, getBalance } = require('./testHelpers.js');
const { time } = require('@openzeppelin/test-helpers');
const { before } = require('mocha');
const { latestBlock } = require('@openzeppelin/test-helpers/src/time');
let accounts;
let owner
let person2
let person3;
const CreditDesk = artifacts.require('TestCreditDesk');
const CreditLine = artifacts.require('CreditLine');
const Pool = artifacts.require('TestPool');
let creditDesk;
const tolerance = bigVal(1).div(new BN(10)); // 1e17 as a BN;

describe("CreditDesk", () => {
  let underwriterLimit;
  let underwriter;
  let borrower;
  let limit = bigVal(500);
  let interestApr = bigVal(5).div(new BN(100));
  let minCollateralPercent = bigVal(10);
  let paymentPeriodInDays = new BN(30);
  let termInDays = new BN(365);

  let createCreditLine = async ({_borrower, _limit, _interestApr, _minCollateralPercent, _paymentPeriodInDays,_termInDays} = {}) => {
    _borrower = _borrower || person3;
    _limit = _limit || limit;
    _interestApr = _interestApr || interestApr;
    _minCollateralPercent = _minCollateralPercent || minCollateralPercent;
    _paymentPeriodInDays = _paymentPeriodInDays || paymentPeriodInDays;
    _termInDays = _termInDays || termInDays;
    await creditDesk.createCreditLine(_borrower, _limit, _interestApr, _minCollateralPercent, _paymentPeriodInDays,_termInDays, {from: underwriter});
  }

  // This factory function is here because in order to call the `setX` functions
  // which allow us to setup state to test specific scenarios, we have to call them from
  // the "owner" of the creditLine, which would normally be the credit desk.
  // The issue is we can't directly send transactions from the creditDesk because
  // web3 doesn't know about that account, and the account isn't "unlocked".
  // So instead we use this sort-of-hack, where we deploy a separate creditLine from the
  // 'owner', and transfer ownership to the creditDesk, where we can then call external methods
  // that manipulate this creditLine.
  let createAndSetCreditLineAttributes = async (balance, interestOwed, principalOwed, prepaymentBalance = 0, nextDueBlock) => {
    // 1000 is pretty high for test environments, and generally shouldn't be hit.
    nextDueBlock = nextDueBlock || 1000;
    const termInDays = 360;
    const termInBlocks = (await creditDesk.blocksPerDay()).mul(new BN(termInDays));
    const termEndBlock = (await time.latestBlock()).add(termInBlocks);

    creditLine = await CreditLine.new(borrower, bigVal(500), bigVal(3), 5, 10, termInDays, {from: owner});

    await Promise.all([
      creditLine.setBalance(bigVal(balance), {from: owner}),
      creditLine.setInterestOwed(bigVal(interestOwed), {from: owner}),
      creditLine.setPrincipalOwed(bigVal(principalOwed), {from: owner}),
      creditLine.receivePrepayment({from: owner, value: String(bigVal(prepaymentBalance))}),
      creditLine.setNextDueBlock(nextDueBlock, {from: owner}),
      creditLine.setTermEndBlock(termEndBlock, {from: owner}),
      creditLine.transferOwnership(creditDesk.address, {from: owner}),
    ]);

    return creditLine;
  }

  let initializeCreditDeskWithCreditLine = async (underwriter, borrower) => {
    underwriterLimit = bigVal(600);
    await creditDesk.setUnderwriterGovernanceLimit(underwriter, underwriterLimit, {from: owner});

    await createCreditLine();
    var ulCreditLines = await creditDesk.getUnderwriterCreditLines(underwriter);
    creditLine = await CreditLine.at(ulCreditLines[0]);
    return creditLine;
  }

  beforeEach(async () => {
    accounts = await web3.eth.getAccounts();
    [ owner, person2, person3 ] = accounts;
    creditDesk = await CreditDesk.new({from: owner});
    pool = await Pool.new({from: owner});
    await pool.transferOwnership(creditDesk.address, {from: owner});
    await pool.deposit({from: person2, value: String(bigVal(90))})
    await creditDesk.setPoolAddress(pool.address, {from: owner});
  })

  it('deployer is owner', async () => {
    expect(await creditDesk.owner()).to.equal(owner);
  });

  describe('setUnderwriterGovernanceLimit', () => {
    it('sets the correct limit', async () => {
      const amount = bigVal(537);
      await creditDesk.setUnderwriterGovernanceLimit(person2, amount, {from: owner});
      const underwriterLimit = await creditDesk.underwriters(person2);
      expect(underwriterLimit.eq(amount)).to.be.true;
    });
  });

  describe('createCreditLine', () => {
    let underwriterLimit;
    let underwriter;
    let borrower;
    let limit = new BN(500);
    let interestApr = new BN(5);
    let minCollateralPercent = new BN(10);
    let paymentPeriodInDays = new BN(30);
    let termInDays = new BN(365);

    let createCreditLine = async ({_borrower, _limit, _interestApr, _minCollateralPercent, _paymentPeriodInDays,_termInDays} = {}) => {
      _borrower = _borrower || person3;
      _limit = _limit || limit;
      _interestApr = _interestApr || interestApr;
      _minCollateralPercent = _minCollateralPercent || minCollateralPercent;
      _paymentPeriodInDays = _paymentPeriodInDays || paymentPeriodInDays;
      _termInDays = _termInDays || termInDays;
      await creditDesk.createCreditLine(_borrower, _limit, _interestApr, _minCollateralPercent, _paymentPeriodInDays, _termInDays, {from: underwriter});
    }
    beforeEach(async () => {
      underwriter = person2;
      borrower = person3;
      underwriterLimit = bigVal(600);
      await creditDesk.setUnderwriterGovernanceLimit(underwriter, underwriterLimit, {from: owner});
    })

    it('sets the CreditDesk as the owner', async () => {
      await createCreditLine();
      var ulCreditLines = await creditDesk.getUnderwriterCreditLines(underwriter);
      const creditLine = await CreditLine.at(ulCreditLines[0]);

      expect(await creditLine.owner()).to.equal(creditDesk.address);
    });

    it('should create and save a creditline', async () => {
      await createCreditLine({});

      var ulCreditLines = await creditDesk.getUnderwriterCreditLines(underwriter);
      const creditLine = await CreditLine.at(ulCreditLines[0]);

      expect(ulCreditLines.length).to.equal(1);
      expect(await creditLine.borrower()).to.equal(borrower);
      expect((await creditLine.limit()).eq(limit)).to.be.true;
      expect((await creditLine.interestApr()).eq(interestApr)).to.be.true;
      expect((await creditLine.minCollateralPercent()).eq(minCollateralPercent)).to.be.true;
      expect((await creditLine.paymentPeriodInDays()).eq(paymentPeriodInDays)).to.be.true;
      expect((await creditLine.termInDays()).eq(termInDays)).to.be.true;
    });

    it("should not let you create a credit line above your limit", async () => {
      const expectedErr = "The underwriter cannot create this credit line";
      try {
        await createCreditLine({_limit: bigVal(601)});
        throw("This test should have failed earlier");
      } catch(e) {
        expect(e.message).to.include(expectedErr);
      }
    });

    it("should not let you create a credit line above your limit, if the sum of your existing credit lines puts you over the limit", async () => {
      await createCreditLine({_limit: bigVal(300)})
      await createCreditLine({_limit: bigVal(300)})

      const expectedErr = "The underwriter cannot create this credit line";
      try {
        await createCreditLine({_limit: bigVal(1)});
        throw("This test should have failed earlier");
      } catch(e) {
        expect(e.message).to.include(expectedErr);
      }
    });

    describe("Creating the credit line with invalid data", async () => {
      // TOOD: Write more of these validations.
      it.skip("should enforce the limit is above zero", async () => {

      });
    });
  });

  describe('drawdown', async () => {
    let drawdown = async (amount, creditLineAddress) => {
      return await creditDesk.drawdown(amount, creditLineAddress, {from: borrower});
    }
    let creditLine;
    let blocksPerDay = 60 * 60 * 24 / 15;

    beforeEach(async () => {
      underwriter = person2;
      borrower = person3;
      underwriterLimit = bigVal(600);
      await creditDesk.setUnderwriterGovernanceLimit(underwriter, underwriterLimit, {from: owner});

      await createCreditLine();
      var ulCreditLines = await creditDesk.getUnderwriterCreditLines(underwriter);
      creditLine = await CreditLine.at(ulCreditLines[0]);
    });

    it('should set the termEndAt correctly', async () => {
      expect((await creditLine.termEndBlock()).eq(new BN(0))).to.be.true;

      await drawdown(bigVal(10), creditLine.address);
      currentBlock = await time.latestBlock();
      const blockLength = new BN(termInDays).mul(new BN(blocksPerDay));

      const expectedTermEndBlock = currentBlock.add(blockLength);
      expect((await creditLine.termEndBlock()).eq(expectedTermEndBlock)).to.be.true;
    });

    it('should set the nextDueAt correctly', async () => {
      expect((await creditLine.nextDueBlock()).eq(new BN(0))).to.be.true;

      await drawdown(bigVal(10), creditLine.address);
      currentBlock = await time.latestBlock();
      const blockLength = new BN(paymentPeriodInDays).mul(new BN(blocksPerDay));

      const expectedNextDueBlock = currentBlock.add(blockLength);
      expect((await creditLine.nextDueBlock())).to.bignumber.equal(expectedNextDueBlock);
    });

    it.skip('should fail and not change accounting values if the pool has insufficient funds', async () => {

    });
  });

  describe("calculateAnnuityPayment", async () => {
    var tests = [
      [10000, 12.000, 360, 30, "887719069147705830000"],
      [10000, 6.000, 360, 30, "860286563187360300000"],
      [2000000, 15.000, 360, 30, "180322762358335458000000"],
      [123456, 12.345, 1800, 30, "2757196297755729374016"],
      [50000, 10.000, 500, 10, "1071423534507233600000"],
      [50000, 1.000, 3600, 30, "437723402324420700000"],
      [1, 0.002, 3600, 30, "8334162127476676"],
      [71601, 13.672, 493, 17, "2711812617616937811069"],
      [10000, 0.0000, 360, 30, "833333333333333333333"],
      [10000, 12.000, 1, 1, "10003287671232875100000"],
      [0, 12.000, 360, 30, "0"],
    ]
    mochaEach(tests).it("should calculate things correctly", async (balance, interestApr, termInDays, paymentPeriodInDays, expected) => {
      var rateDecimals = 1000; // This is just for convenience so we can denominate rates in decimals
      var rateMultiplier = decimals.div(new BN(rateDecimals)).div(new BN(100));
      balance = bigVal(balance);
      interestApr = new BN(interestApr * rateDecimals).mul(rateMultiplier);
      termInDays = new BN(termInDays);
      paymentPeriodIndays = new BN(paymentPeriodInDays);
      expected = new BN(expected);

      const result = await creditDesk._calculateAnnuityPayment(balance, interestApr, termInDays, paymentPeriodInDays);
      expect(result.eq(expected)).to.be.true;
    });

    it("should gracefully handle extremely small, but > 0 interest rates", async () => {
      const balance = bigVal(10000)
      const interestApr = new BN(1);
      const termInDays = new BN(360);
      const paymentPeriodInDays = new BN(30);
      expected = new BN("833333333333333333333");
      const result = await creditDesk._calculateAnnuityPayment(balance, interestApr, termInDays, paymentPeriodInDays);
      expect(result.eq(expected)).to.be.true;
    });

    describe("with invalid data", async () => {
      // TODO: Consider if we need this.
    });
  });

  describe("prepayment", async () => {
    let makePrepayment = async (creditLineAddress, amount, from=borrower) => {
      return await creditDesk.prepay(creditLineAddress, {from: from, value: String(bigVal(amount))});
    }
    describe("with a valid creditline id", async () => {
      let creditLine;
      beforeEach(async () => {
        underwriter = person2;
        borrower = person2;
        creditLine = await initializeCreditDeskWithCreditLine(underwriter, borrower);
      })
      it("should increment the prepaid balance", async () => {
        const prepaymentAmount = 10;
        expect((await (await getBalance(creditLine.address)).eq(bigVal(0)))).to.be.true;
        await makePrepayment(creditLine.address, prepaymentAmount);
        expect((await getBalance(creditLine.address)).eq(bigVal(prepaymentAmount))).to.be.true;
        expect((await creditLine.prepaymentBalance()).eq(bigVal(prepaymentAmount))).to.be.true;

        let secondPrepayment = 15;
        let totalPrepayment = bigVal(prepaymentAmount).add(bigVal(secondPrepayment));
        await makePrepayment(creditLine.address, secondPrepayment);
        expect((await getBalance(creditLine.address)).eq(totalPrepayment)).to.be.true;
        expect((await creditLine.prepaymentBalance()).eq(totalPrepayment)).to.be.true;
      });
    });
  });

  describe("addCollateral", async () => {
    it.skip("Should add collateral", async () => {

    });
  });

  describe("payment", async () => {
    describe("with an outstanding credit line", async () => {
      beforeEach(async () => {
        borrower = person3;
      });

      it("should pay off interest first", async () => {
        const creditLine = await createAndSetCreditLineAttributes(10, 5, 3);
        const paymentAmount = 6;
        await creditDesk.pay(creditLine.address, {from: borrower, value: String(bigVal(paymentAmount))});

        // We use closeTo because several blocks may have passed between creating the creditLine and
        // making the payment, which accrues a very small amount of interest and principal. Also note
        // that 1e14 is actually a very small tolerance, since we use 1e18 as our decimals
        expect(await creditLine.interestOwed()).to.be.bignumber.closeTo(bigVal(0), tolerance);
        expect(await creditLine.principalOwed()).to.be.bignumber.closeTo(bigVal(2), tolerance);
        expect(await creditLine.balance()).to.be.bignumber.closeTo(bigVal(9), tolerance);
      });

      it("should send the payment to the pool", async() => {
        var originalPoolBalance = await getBalance(pool.address);

        const creditLine = await createAndSetCreditLineAttributes(10, 5, 3);
        const paymentAmount = 6;
        await creditDesk.pay(creditLine.address, {from: borrower, value: String(bigVal(paymentAmount))});

        var newPoolBalance = await getBalance(pool.address);
        var delta = newPoolBalance.sub(originalPoolBalance);
        expect(delta).to.be.bignumber.equal(bigVal(6));
      });

      it("should increase the share price of the pool only based on the paid interest (not principal)", async() => {
        var originalSharePrice = await pool.sharePrice();
        var originalTotalShares = await pool.totalShares();

        var interestAmount = 5;
        const paymentAmount = 7;
        await createAndSetCreditLineAttributes(10, interestAmount, 3);
        await creditDesk.pay(creditLine.address, {from: borrower, value: String(bigVal(paymentAmount))});

        var newSharePrice = await pool.sharePrice();
        var delta = newSharePrice.sub(originalSharePrice);
        var expectedDelta = bigVal(interestAmount).mul(decimals).div(originalTotalShares)

        expect(delta).to.bignumber.closeTo(expectedDelta, tolerance);
        expect(newSharePrice).to.bignumber.closeTo(originalSharePrice.add(expectedDelta), tolerance);
      });

      describe("with extra payment left over", async () => {
        it("should send the extra to the collateral of the credit line", async () => {
          var interestAmount = 1;
          const balance = 10;
          const paymentAmount = 15;
          await createAndSetCreditLineAttributes(balance, interestAmount, 3);
          await creditDesk.pay(creditLine.address, {from: borrower, value: String(bigVal(paymentAmount))});

          const expected = bigVal(paymentAmount).sub(bigVal(interestAmount)).sub(bigVal(balance));
          expect(await creditLine.collateralBalance()).to.bignumber.closeTo(expected, tolerance);
        });
      });
    });
  });

  describe("allocatePayment", async() => {
    const tests = [
      // payment, balance, totalInterestOwed, totalPrincipalOwed, expectedResults
      [10, 40, 10, 20, {interestPayment: 10, principalPayment: 0, additionalBalancePayment: 0}],
      [5, 40, 10, 20, {interestPayment: 5, principalPayment: 0, additionalBalancePayment: 0}],
      [15, 40, 10, 20, {interestPayment: 10, principalPayment: 5, additionalBalancePayment: 0}],
      [35, 40, 10, 20, {interestPayment: 10, principalPayment: 20, additionalBalancePayment: 5}],
      [55, 40, 10, 20, {interestPayment: 10, principalPayment: 20,  additionalBalancePayment: 20}],
      [0, 40, 10, 20, {interestPayment: 0, principalPayment: 0, additionalBalancePayment: 0}],
    ]
    mochaEach(tests).it("should calculate things correctly!", async(paymentAmount, balance, totalInterestOwed, totalPrincipalOwed, expected) => {
      var result = await creditDesk._allocatePayment(bigVal(paymentAmount), bigVal(balance), bigVal(totalInterestOwed), bigVal(totalPrincipalOwed));

      expect(result.interestPayment).to.be.bignumber.equals(bigVal(expected.interestPayment));
      expect(result.principalPayment).to.be.bignumber.equals(bigVal(expected.principalPayment));
      expect(result.additionalBalancePayment).to.be.bignumber.equals(bigVal(expected.additionalBalancePayment));
    });
  });

  describe("assessCreditLine", async () => {
    let latestBlock;
    beforeEach(async () => {
      borrower = person3;
      latestBlock = await time.latestBlock();
    });
    describe("when there is exactly enough prepaymentBalance", async() => {
      it("should successfully process the payment and correctly update all attributes", async () => {
        const prepaymentBalance = 8;
        const interestOwed = 5;
        var creditLine = await createAndSetCreditLineAttributes(10, interestOwed, 3, prepaymentBalance, latestBlock);
        const originalPoolBalance = await getBalance(pool.address);

        await creditDesk.assessCreditLine(creditLine.address);

        const newPoolBalance = await getBalance(pool.address);
        const expectedNextDueBlock = (await creditLine.paymentPeriodInDays()).mul(await creditDesk.blocksPerDay()).add(latestBlock);

        expect(await creditLine.prepaymentBalance()).to.bignumber.equal("0");
        expect(await creditLine.interestOwed()).to.bignumber.equal("0");
        expect(await creditLine.principalOwed()).to.bignumber.equal("0");
        const actualNextDueBlock = await creditLine.nextDueBlock();
        expect(actualNextDueBlock).to.bignumber.closeTo(expectedNextDueBlock, actualNextDueBlock.div(new BN(100))); // 1% tolerance;
        expect(newPoolBalance.sub(originalPoolBalance)).to.bignumber.equal(bigVal(8));
      });

      it("should only increase the share price from interest paid", async () => {
        const prepaymentBalance = 8;
        const interestOwed = 5;
        const originalSharePrice = await pool.sharePrice();
        var creditLine = await createAndSetCreditLineAttributes(10, interestOwed, 3, prepaymentBalance, latestBlock);

        await creditDesk.assessCreditLine(creditLine.address);

        const newSharePrice = await pool.sharePrice();
        const expectedSharePrice = bigVal(interestOwed).mul(decimals).div((await pool.totalShares())).add(originalSharePrice);
        expect(newSharePrice).to.bignumber.equal(expectedSharePrice);
      });
    });

    describe("when there is only enough to pay interest", async () => {
      it("should pay interest first", async() => {
        const prepaymentBalance = 5;
        const interestOwed = 5;
        const principalOwed = 3;
        var creditLine = await createAndSetCreditLineAttributes(10, interestOwed, principalOwed, prepaymentBalance, await time.latestBlock());
        const originalPoolBalance = await getBalance(pool.address);
        const originalSharePrice = await pool.sharePrice();

        await creditDesk.assessCreditLine(creditLine.address);

        const newPoolBalance = await getBalance(pool.address);

        expect(await creditLine.prepaymentBalance()).to.bignumber.equal("0");
        expect(await creditLine.interestOwed()).to.bignumber.equal("0");
        expect(await creditLine.principalOwed()).to.bignumber.equal(bigVal(principalOwed));
        expect(await pool.sharePrice()).to.bignumber.gt(originalSharePrice);
        expect(newPoolBalance.sub(originalPoolBalance)).to.bignumber.equal(bigVal(interestOwed));
      });
    });
  });
})
