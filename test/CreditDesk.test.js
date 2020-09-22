const {chai, expect, MAX_UINT, decimals, BN, bigVal, mochaEach, getBalance } = require('./testHelpers.js');
const { time } = require('@openzeppelin/test-helpers');
const Accountant = artifacts.require('Accountant');
const CreditDesk = artifacts.require('CreditDesk');
const CreditLine = artifacts.require('CreditLine');
const Pool = artifacts.require('TestPool');
const ERC20 = artifacts.require('TestERC20');

let accounts, owner, person2, person3, creditDesk;
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

    creditLine = await CreditLine.new({from: owner});
    await creditLine.initialize(borrower, bigVal(500), bigVal(3), 5, 10, termInDays);

    await Promise.all([
      creditLine.setBalance(bigVal(balance), {from: owner}),
      creditLine.setInterestOwed(bigVal(interestOwed), {from: owner}),
      creditLine.setPrincipalOwed(bigVal(principalOwed), {from: owner}),
      erc20.transfer(creditLine.address, String(bigVal(prepaymentBalance)), {from: owner}),
      creditLine.setPrepaymentBalance(String(bigVal(prepaymentBalance)), {from: owner}),
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

  before(async () => {
    // Buidler will throw an error if this happens more than once
    // which is why put it in a before block, rather than beforeEach;
    const accountant = await Accountant.new({from: owner});
    CreditDesk.link(accountant);
  });

  beforeEach(async () => {
    accounts = await web3.eth.getAccounts();
    [ owner, person2, person3 ] = accounts;
    creditDesk = await CreditDesk.new({from: owner});

    // Deploy the ERC20 and give person2 some balance to play with
    erc20 = await ERC20.new(new BN(10000).mul(decimals), decimals, { from: owner });
    await erc20.transfer(person2, new BN(1000).mul(decimals), {from: owner});

    // Approve and initialize the pool
    pool = await Pool.new({from: owner});
    pool.initialize(erc20.address, "USDC", decimals, {from: owner});
    await pool.setTotalFundsLimit(1000000);
    await pool.setTransactionLimit(1000000);

    // Approve transfers for our test accounts
    await erc20.approve(pool.address, new BN(100000).mul(decimals), {from: person3});
    await erc20.approve(pool.address, new BN(100000).mul(decimals), {from: person2});
    await erc20.approve(pool.address, new BN(100000).mul(decimals), {from: owner});

    // Some housekeeping so we have a usable creditDesk for tests, and a pool with funds
    await pool.transferOwnership(creditDesk.address, {from: owner});
    await pool.deposit(String(bigVal(90)), {from: person2 })
    await creditDesk.initialize(pool.address, {from: owner});
  })

  it('deployer is owner', async () => {
    expect(await creditDesk.owner()).to.equal(owner);
  });

  describe("setPoolAddress", async () => {
    it("should emit an event when the pool address changes", async () => {
      // Approve and initialize the pool
      const newPool = await Pool.new({from: owner});
      newPool.initialize(erc20.address, "USDC", decimals, {from: owner});

      const response = await creditDesk.setPoolAddress(newPool.address, {from: owner});
      const event = response.logs[0];

      expect(event.event).to.equal("PoolAddressUpdated");
      expect(event.args.oldAddress).to.equal(pool.address);
      expect(event.args.newAddress).to.equal(newPool.address);
    });
  });

  describe('setUnderwriterGovernanceLimit', () => {
    let underwriter;
    beforeEach(() => {
      underwriter = person2;
    })
    it('sets the correct limit', async () => {
      const amount = bigVal(537);
      await creditDesk.setUnderwriterGovernanceLimit(underwriter, amount, {from: owner});
      const underwriterLimit = await creditDesk.underwriters(underwriter);
      expect(underwriterLimit).to.bignumber.equal(amount);
    });

    it('emits an event with the correct data', async () => {
      const amount = bigVal(537);
      const response = await creditDesk.setUnderwriterGovernanceLimit(underwriter, amount, {from: owner});
      const event = response.logs[0];

      expect(event.event).to.equal("GovernanceUpdatedUnderwriterLimit");
      expect(event.args.underwriter).to.equal(underwriter);
      expect(event.args.newLimit).to.bignumber.equal(amount);
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
      return await creditDesk.createCreditLine(_borrower, _limit, _interestApr, _minCollateralPercent, _paymentPeriodInDays, _termInDays, {from: underwriter});
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

    it('emits an event with the correct data', async () => {
      const response = await createCreditLine();
      // Note we pick the 1st index, because the 0th is OwnershipTransferred, which
      // also happens automatically when creating CreditLines, but we don't care about that.
      const event = response.logs[1];

      expect(event.event).to.equal("CreditLineCreated");
      expect(event.args.borrower).to.equal(borrower);
      expect(event.args.creditLine).to.not.be.empty;
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
      expect((await erc20.allowance(creditLine.address, pool.address))).to.bignumber.equal(MAX_UINT);
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

    it("should emit an event with the correct data", async () => {
      const response = await drawdown(bigVal(10), creditLine.address);
      const event = response.logs[0];

      expect(event.event).to.equal("DrawdownMade");
      expect(event.args.borrower).to.equal(borrower);
      expect(event.args.creditLine).to.equal(creditLine.address);
      expect(event.args.drawdownAmount).to.bignumber.equal(bigVal(10));
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

  describe("prepayment", async () => {
    let makePrepayment = async (creditLineAddress, amount, from) => {
      return await creditDesk.prepay(creditLineAddress, String(bigVal(amount)), {from: from});
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
        expect((await (await getBalance(creditLine.address, erc20)).eq(bigVal(0)))).to.be.true;
        await makePrepayment(creditLine.address, prepaymentAmount, borrower);
        expect((await getBalance(creditLine.address, erc20)).eq(bigVal(prepaymentAmount))).to.be.true;
        expect((await creditLine.prepaymentBalance()).eq(bigVal(prepaymentAmount))).to.be.true;

        let secondPrepayment = 15;
        let totalPrepayment = bigVal(prepaymentAmount).add(bigVal(secondPrepayment));
        await makePrepayment(creditLine.address, secondPrepayment, borrower);
        expect((await getBalance(creditLine.address, erc20))).to.bignumber.equal(totalPrepayment);
        expect((await creditLine.prepaymentBalance())).to.bignumber.equal(totalPrepayment);
      });

      it("should emit an event with the correct data", async () => {
        const prepaymentAmount = 10;
        const response = await makePrepayment(creditLine.address, prepaymentAmount, borrower);
        const event = response.logs[0];

        expect(event.event).to.equal("PrepaymentMade");
        expect(event.args.payer).to.equal(borrower);
        expect(event.args.creditLine).to.equal(creditLine.address);
        expect(event.args.prepaymentAmount).to.bignumber.closeTo(bigVal(10), tolerance);
      });
    });
  });

  describe("payment", async () => {
    describe("with an outstanding credit line", async () => {
      beforeEach(async () => {
        borrower = person3;
        erc20.transfer(borrower, bigVal(50), {from: owner});
      });

      it("should emit an event with the correct data", async () => {
        const creditLine = await createAndSetCreditLineAttributes(10, 5, 3);
        const paymentAmount = 6;
        const response = await creditDesk.pay(creditLine.address, String(bigVal(paymentAmount)), {from: borrower});
        const event = response.logs[0];
        expect(event.event).to.equal("PaymentMade");
        expect(event.args.payer).to.equal(borrower);
        expect(event.args.creditLine).to.equal(creditLine.address);
        expect(event.args.interestAmount).to.bignumber.closeTo(bigVal(5), tolerance);
        expect(event.args.principalAmount).to.bignumber.closeTo(bigVal(1), tolerance);
        expect(event.args.remainingAmount).to.bignumber.equal(bigVal(0));
      });


      it("should pay off interest first", async () => {
        const creditLine = await createAndSetCreditLineAttributes(10, 5, 3);
        const paymentAmount = 6;
        await creditDesk.pay(creditLine.address, String(bigVal(paymentAmount)), {from: borrower});

        // We use closeTo because several blocks may have passed between creating the creditLine and
        // making the payment, which accrues a very small amount of interest and principal. Also note
        // that 1e14 is actually a very small tolerance, since we use 1e18 as our decimals
        expect(await creditLine.interestOwed()).to.be.bignumber.closeTo(bigVal(0), tolerance);
        expect(await creditLine.principalOwed()).to.be.bignumber.closeTo(bigVal(2), tolerance);
        expect(await creditLine.balance()).to.be.bignumber.closeTo(bigVal(9), tolerance);
      });

      it("should send the payment to the pool", async() => {
        var originalPoolBalance = await getBalance(pool.address, erc20);

        const creditLine = await createAndSetCreditLineAttributes(10, 5, 3);
        const paymentAmount = 6;
        await creditDesk.pay(creditLine.address, String(bigVal(paymentAmount)), {from: borrower});

        var newPoolBalance = await getBalance(pool.address, erc20);
        var delta = newPoolBalance.sub(originalPoolBalance);
        expect(delta).to.be.bignumber.equal(bigVal(6));
      });

      it("should increase the share price of the pool only based on the paid interest (not principal)", async() => {
        var originalSharePrice = await pool.sharePrice();
        var originalTotalShares = await pool.totalShares();

        var interestAmount = 5;
        const paymentAmount = 7;
        await createAndSetCreditLineAttributes(10, interestAmount, 3);
        await creditDesk.pay(creditLine.address, String(bigVal(paymentAmount)), {from: borrower});

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
          await creditDesk.pay(creditLine.address, String(bigVal(paymentAmount)), {from: borrower});

          const expected = bigVal(paymentAmount).sub(bigVal(interestAmount)).sub(bigVal(balance));
          expect(await creditLine.collateralBalance()).to.bignumber.closeTo(expected, tolerance);
        });
      });
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
        const originalPoolBalance = await getBalance(pool.address, erc20);

        await creditDesk.assessCreditLine(creditLine.address);

        const newPoolBalance = await getBalance(pool.address, erc20);
        const expectedNextDueBlock = (await creditLine.paymentPeriodInDays()).mul(await creditDesk.blocksPerDay()).add(latestBlock);

        expect(await creditLine.prepaymentBalance()).to.bignumber.equal("0");
        expect(await creditLine.interestOwed()).to.bignumber.equal("0");
        expect(await creditLine.principalOwed()).to.bignumber.equal("0");
        const actualNextDueBlock = await creditLine.nextDueBlock();
        expect(actualNextDueBlock).to.bignumber.closeTo(expectedNextDueBlock, actualNextDueBlock.div(new BN(100))); // 1% tolerance;
        expect(newPoolBalance.sub(originalPoolBalance)).to.bignumber.equal(bigVal(8));
      });

      it("should emit an event with the correct data", async () => {
        const prepaymentBalance = 9;
        const interestOwed = 5;
        var creditLine = await createAndSetCreditLineAttributes(10, interestOwed, 3, prepaymentBalance, latestBlock);
        const response = await creditDesk.assessCreditLine(creditLine.address);
        const event = response.logs[0];

        expect(event.event).to.equal("PaymentMade");
        expect(event.args.payer).to.equal(borrower);
        expect(event.args.creditLine).to.equal(creditLine.address);
        expect(event.args.interestAmount).to.bignumber.closeTo(bigVal(5), tolerance);
        expect(event.args.principalAmount).to.bignumber.closeTo(bigVal(3), tolerance);
        expect(event.args.remainingAmount).to.bignumber.equal(bigVal(1));
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
        const originalPoolBalance = await getBalance(pool.address, erc20);
        const originalSharePrice = await pool.sharePrice();

        await creditDesk.assessCreditLine(creditLine.address);

        const newPoolBalance = await getBalance(pool.address, erc20);

        expect(await creditLine.prepaymentBalance()).to.bignumber.equal("0");
        expect(await creditLine.interestOwed()).to.bignumber.equal("0");
        expect(await creditLine.principalOwed()).to.bignumber.equal(bigVal(principalOwed));
        expect(await pool.sharePrice()).to.bignumber.gt(originalSharePrice);
        expect(newPoolBalance.sub(originalPoolBalance)).to.bignumber.equal(bigVal(interestOwed));
      });
    });

    describe("when there is more prepayment than total amount owed", async () => {
      it("should retain any extra as prepayment balance", async() => {
        const prepaymentBalance = 10;
        const interestOwed = 5;
        const principalOwed = 3;
        var creditLine = await createAndSetCreditLineAttributes(10, interestOwed, principalOwed, prepaymentBalance, await time.latestBlock());

        await creditDesk.assessCreditLine(creditLine.address);

        const expectedPrepaymentBalance = bigVal(prepaymentBalance).sub(bigVal(interestOwed)).sub(bigVal(principalOwed));
        expect(await creditLine.prepaymentBalance()).to.bignumber.equal(expectedPrepaymentBalance);
        expect(await creditLine.interestOwed()).to.bignumber.equal("0");
        expect(await creditLine.principalOwed()).to.bignumber.equal(bigVal("0"));
      });
    });
  });
})
