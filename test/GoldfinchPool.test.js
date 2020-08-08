const BN = require('bn.js');
const chai = require('chai');
chai.use(require("chai-as-promised"))
const expect = chai.expect
let accounts;
let owner;
let person2;
const GoldfinchPool = artifacts.require('TestGoldfinchPool');
let getBalance = async (address) => {
  return new BN((await web3.eth.getBalance(address)));
}

describe("GoldfinchPool", () => {
  let pool;
  const mantissa = 10e18;
  let depositAmount = new BN(web3.utils.toWei("4", "ether"));
  let withdrawAmount = new BN(web3.utils.toWei("2", "ether"));
  let makeDeposit = async (person, amount) => {
    amount = amount || depositAmount;
    person = person || person2;
    await pool.deposit({from: person, value: String(amount)});
  }
  let makeWithdraw = async (person, amount) => {
    amount = amount || withdrawAmount;
    person = person || person2;
    await pool.withdraw(amount, {from: person});
  }

  beforeEach(async () => {
    accounts = await web3.eth.getAccounts();
    [ owner, person2 ] = accounts;
    pool = await GoldfinchPool.new({ from: owner });
  });

  describe('GoldfinchPool', () => {
    it('deployer is owner', async () => {
      expect(await pool.owner()).to.equal(owner);
    });
  });

  describe('deposit', () => {
    it('adds value to the contract when you call deposit', async () => {
      const balanceBefore = await getBalance(pool.address);
      await makeDeposit();
      const balanceAfter = await getBalance(pool.address);
      const delta = balanceAfter.sub(balanceBefore);
      expect(delta.eq(depositAmount)).to.be.true;
    });

    it('saves the sender in the depositor mapping', async() => {
      await makeDeposit();
      const shares = await pool.capitalProviders(person2);
      expect(shares.eq(depositAmount)).to.be.true;
    });

    it('increases the totalShares', async () => {
      const secondDepositAmount = new BN(web3.utils.toWei("1.5", "ether"));
      await makeDeposit();
      await makeDeposit(owner, secondDepositAmount);
      const totalShares = await pool.totalShares();
      const totalDeposited = depositAmount.add(secondDepositAmount);
      expect(totalShares.eq(totalDeposited)).to.be.true;
    });
  });

  describe('getNumShares', () => {
    it('calculates correctly', async() => {
      const amount = 3000;
      const mantissa = 1000;
      const sharePrice = 2000;
      const numShares = await pool._getNumShares(amount, mantissa, sharePrice);
      expect(numShares.toNumber()).to.equal(1500)
    });
  });

  describe('withdraw', () => {
    it('withdraws value from the contract when you call withdraw', async () => {
      await makeDeposit();
      const balanceBefore = await getBalance(pool.address);
      await makeWithdraw();
      const balanceAfter = await getBalance(pool.address);
      const delta = balanceBefore.sub(balanceAfter);
      expect(delta.eq(withdrawAmount)).to.be.true;
    });

    it('sends the amount back to the address', async () => {
      await makeDeposit();
      const addressValueBefore = await getBalance(person2)
      await makeWithdraw();
      const addressValueAfter = await getBalance(person2)
      const delta = addressValueAfter.sub(addressValueBefore);
      const expMin = withdrawAmount * 0.999;
      const expMax = withdrawAmount * 1.001;
      expect(delta.gt(expMin) && delta.gt(expMax)).to.be.true;
    });

    it('reduces the shares by the withdraw amount', async () => {
      await makeDeposit();
      const sharesBefore = await pool.capitalProviders(person2);
      await makeWithdraw();
      const sharesAfter = await pool.capitalProviders(person2);
      const expectedShares = sharesBefore.sub(withdrawAmount);
      expect(sharesAfter.eq(expectedShares)).to.be.true;
    });

    it('decreases the totalShares', async () => {
      await makeDeposit();
      const sharesBefore = await pool.totalShares();
      await makeWithdraw();
      const sharesAfter = await pool.totalShares();
      const expectedShares = sharesBefore.sub(withdrawAmount);
      expect(sharesAfter.eq(expectedShares)).to.be.true;
    });

    it('prevents you from withdrawing more than you have', async () => {
      const expectedErr = "Amount requested is greater than the amount owned for this address"
      expect(makeWithdraw()).to.be.rejectedWith(expectedErr)
    });

    it('it lets you withdraw your exact total holdings', async () => {
      await makeDeposit(person2, 123);
      await makeWithdraw(person2, 123);
      const sharesAfter = await pool.capitalProviders(person2);
      expect(sharesAfter.toNumber()).to.equal(0);
    });
  });
})
