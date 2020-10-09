const chai = require("chai")
chai.use(require("chai-as-promised"))
const expect = chai.expect
const mochaEach = require("mocha-each")
const BN = require("bn.js")
const decimals = new BN(String(1e18))
chai.use(require("chai-bn")(BN))

const MAX_UINT = new BN("115792089237316195423570985008687907853269984665640564039457584007913129639935")

// Helper functions. These should be pretty generic.
const bigVal = (number) => {
  return new BN(number).mul(decimals)
}

const getBalance = async (address, erc20) => {
  if (erc20) {
    return new BN(await erc20.balanceOf(address))
  }
  return new BN(await web3.eth.getBalance(address))
}

module.exports = {
  chai: chai,
  expect: expect,
  decimals: decimals,
  BN: BN,
  bigVal: bigVal,
  mochaEach: mochaEach,
  getBalance: getBalance,
  MAX_UINT: MAX_UINT,
}
