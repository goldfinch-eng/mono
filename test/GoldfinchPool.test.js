const { accounts, contract, web3 } = require('@openzeppelin/test-environment');
const { BN, balance } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const [ owner, person2 ] = accounts;
const GoldfinchPool = contract.fromArtifact('TestGoldfinchPool');
let pool;

beforeEach(async () => {
  pool = await GoldfinchPool.new({ from: owner });
});

describe('GoldfinchPool', () => {
  it('deployer is owner', async () => {
    expect(await pool.owner()).to.equal(owner);
  });
});

describe('deposit', () => {
  let depositAmount = 10000;
  let makeDeposit = async (person, amount) => {
    amount = amount || depositAmount;
    person = person || person2;
    await pool.deposit({from: person, value: String(amount)});
  }

  it('adds value to the contract when you call deposit', async () => {
    const balanceBefore = await balance.current(pool.address);
    await makeDeposit();
    const balanceAfter = await balance.current(pool.address)
    const delta = balanceAfter.toNumber() - balanceBefore.toNumber()
    expect(delta).to.equal(depositAmount);
  });

  it('saves the sender in the depositor mapping', async() => {
    await makeDeposit();
    const shares = await pool.capitalProviders(person2);
    expect(shares.toNumber()).to.equal(depositAmount)
  });

  it('increases the totalShares', async () => {
    const secondDepositAmount = 15000;
    await makeDeposit();
    await makeDeposit(owner, secondDepositAmount);
    const totalShares = await pool.totalShares();
    expect(totalShares.toNumber()).to.equal(depositAmount + secondDepositAmount);
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
