const chai = require('chai');
chai.use(require("chai-as-promised"))
const expect = chai.expect
const mochaEach = require('mocha-each');
const BN = require('bn.js');
const decimals = new BN(String(1e18));
chai.use(require('chai-bn')(BN));

// Helper functions. These should be pretty generic.
const bigVal = (number) => {
  return new BN(number).mul(decimals);
}

const getBalance = async (address) => {
  return new BN((await web3.eth.getBalance(address)));
}

module.exports = {
  chai: chai,
  expect: expect,
  decimals: decimals,
  BN: BN,
  bigVal: bigVal,
  mochaEach: mochaEach,
  getBalance: getBalance,
}