const {chai, expect, decimals, BN, bigVal, getBalance }  = require('./testHelpers.js');
let accounts;
let owner;
let person2;
const Pool = artifacts.require('TestPool');
const ERC20 = artifacts.require('TestERC20');

describe("Pool", () => {
  let pool;
  let erc20;
  const mantissa = new BN(1e6);
  let depositAmount = new BN(1).mul(mantissa).div(new BN(10));
  let withdrawAmount = new BN(2).mul(mantissa);
  let makeDeposit = async (person, amount) => {
    amount = amount || depositAmount;
    person = person || person2;
    await pool.deposit(String(amount), {from: person});
  }
  let makeWithdraw = async (person, amount) => {
    amount = amount || withdrawAmount;
    person = person || person2;
    await pool.withdraw(amount, {from: person});
  }

  beforeEach(async () => {
    // Pull in our unlocked accounts
    accounts = await web3.eth.getAccounts();
    [ owner, person2 ] = accounts;

    // Deploy the ERC20 and give person2 some balance to play with
    erc20 = await ERC20.new(new BN(10000).mul(mantissa), mantissa, { from: owner });
    await erc20.transfer(person2, new BN(1000).mul(mantissa), {from: owner});

    // Deploy and initialize a Pool for this ERC20
    pool = await Pool.new({ from: owner });
    pool.initialize(erc20.address, "USDC", mantissa, {from: owner});
  });

  describe('Pool', () => {
    it('deployer is owner', async () => {
      expect(await pool.owner()).to.equal(owner);
    });
  });

  describe('deposit', () => {
    describe("before you have approved the pool to transfer funds on your behalf", async() => {
      it("should fail", async () => {
        const expectedErr = "VM Exception while processing transaction: revert ERC20: transfer amount exceeds allowance"
        return expect(makeDeposit()).to.be.rejectedWith(expectedErr);
      });
    });

    describe.only("after you have approved the pool to transfer funds", async() => {
      beforeEach(async () => {
        await erc20.approve(pool.address, new BN(100000).mul(mantissa), {from: person2});
        await erc20.approve(pool.address, new BN(100000).mul(mantissa), {from: owner});
      });

      it('increases the pools balance of the ERC20 token when you call deposit', async () => {
        const balanceBefore = await getBalance(pool.address, erc20);
        await makeDeposit();
        const balanceAfter = await getBalance(pool.address, erc20);
        const delta = balanceAfter.sub(balanceBefore);
        expect(delta).to.bignumber.equal(depositAmount);
      });
      it('saves the sender in the depositor mapping', async() => {
        await makeDeposit();
        const shares = await pool.capitalProviders(person2);
        expect(shares.eq(depositAmount)).to.be.true;
      });

      it('increases the totalShares, even when two different people deposit', async () => {
        const secondDepositAmount = new BN(1).mul(mantissa);
        await makeDeposit();
        await makeDeposit(owner, secondDepositAmount);
        const totalShares = await pool.totalShares();
        const totalDeposited = depositAmount.add(secondDepositAmount);
        expect(totalShares.eq(totalDeposited)).to.be.true;
      });
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
    beforeEach(async () => {
      await erc20.approve(pool.address, new BN(100000).mul(mantissa), {from: person2});
      await erc20.approve(pool.address, new BN(100000).mul(mantissa), {from: owner});
    });

    it('withdraws value from the contract when you call withdraw', async () => {
      await makeDeposit();
      const balanceBefore = await getBalance(pool.address, erc20);
      await makeWithdraw();
      const balanceAfter = await getBalance(pool.address, erc20);
      const delta = balanceBefore.sub(balanceAfter);
      expect(delta.eq(withdrawAmount)).to.be.true;
    });

    it('sends the amount back to the address', async () => {
      await makeDeposit();
      const addressValueBefore = await getBalance(person2, erc20);
      await makeWithdraw();
      const addressValueAfter = await getBalance(person2, erc20);
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
      const expectedErr = /VM Exception while processing transaction: revert Amount requested is greater than the amount owned for this address/
      return expect(makeWithdraw()).to.be.rejectedWith(expectedErr)
    });

    it('it lets you withdraw your exact total holdings', async () => {
      await makeDeposit(person2, 123);
      await makeWithdraw(person2, 123);
      const sharesAfter = await pool.capitalProviders(person2);
      expect(sharesAfter.toNumber()).to.equal(0);
    });
  });
})
