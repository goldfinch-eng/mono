const BN = require('bn.js');
const chai = require('chai');
chai.use(require("chai-as-promised"))
const expect = chai.expect
let accounts;
let owner
let person2
let person3;
const CreditDesk = artifacts.require('CreditDesk');
const CreditLine = artifacts.require('CreditLine');
let creditDesk;

describe("CreditDesk", () => {
  beforeEach(async () => {
    accounts = await web3.eth.getAccounts();
    [ owner, person2, person3 ] = accounts;
    creditDesk = await CreditDesk.new({from: owner});
  })

  it('deployer is owner', async () => {
    expect(await creditDesk.owner()).to.equal(owner);
  });

  describe('setUnderwriterGovernanceLimit', () => {
    it('sets the correct limit', async () => {
      const amount = new BN(537);
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
      underwriterLimit = new BN(600);
      borrower = person3;
      await creditDesk.setUnderwriterGovernanceLimit(underwriter, underwriterLimit, {from: owner});
    })

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
        await createCreditLine({_limit: new BN(601)});
        throw("This test should have failed earlier");
      } catch(e) {
        expect(e.message).to.include(expectedErr);
      }
    });
    it("should not let you create a credit line above your limit, if the sum of your existing credit lines puts you over the limit", async () => {
      const expectedErr = "The underwriter cannot create this credit line";

      await createCreditLine({_limit: new BN(300)})
      await createCreditLine({_limit: new BN(300)})

      try {
        await createCreditLine({_limit: new BN(1)});
        throw("This test should have failed earlier");
      } catch(e) {
        expect(e.message).to.include(expectedErr);
      }
    });
  });
})
