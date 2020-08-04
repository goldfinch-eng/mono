const { accounts, contract, web3 } = require('@openzeppelin/test-environment');
const { BN, balance } = require('@openzeppelin/test-helpers');
const chai = require('chai');
chai.use(require("chai-as-promised"))
const expect = chai.expect

const [ owner, person2, person3 ] = accounts;
const CreditDesk = contract.fromArtifact('CreditDesk');
const CreditLine = contract.fromArtifact('CreditLine');
let creditDesk;

describe.only("CreditDesk", () => {
  beforeEach(async () => {
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
    beforeEach(async () => {
      underwriter = person2;
      underwriterLimit = new BN(537);
      await creditDesk.setUnderwriterGovernanceLimit(underwriter, underwriterLimit, {from: owner});
    })

    it('should create and save a creditline', async () => {
      let borrower = person3;
      let limit = new BN(500);
      let interestApr = new BN(5);
      let minCollateralPercent = new BN(10);
      let paymentPeriodInDays = new BN(30);
      let termInDays = new BN(365);

      await creditDesk.createCreditLine(
        borrower,
        limit,
        interestApr,
        minCollateralPercent,
        paymentPeriodInDays,
        termInDays,
        {from: underwriter}
      );

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
  });
})
