/* global artifacts web3 */
const chai = require("chai")
chai.use(require("chai-as-promised"))
const expect = chai.expect
const mochaEach = require("mocha-each")
const BN = require("bn.js")
const {isTestEnv} = require("../blockchain_scripts/deployHelpers")
const decimals = new BN(String(1e18))
const USDC_DECIMALS = new BN(String(1e6))
chai.use(require("chai-bn")(BN))
const MAX_UINT = new BN("115792089237316195423570985008687907853269984665640564039457584007913129639935")

// Helper functions. These should be pretty generic.
function bigVal(number) {
  return new BN(number).mul(decimals)
}

function usdcVal(number) {
  return new BN(number).mul(USDC_DECIMALS)
}

const getDeployedAsTruffleContract = async (deployments, contractName) => {
  let deployment = await deployments.getOrNull(contractName)
  if (!deployment && isTestEnv()) {
    contractName = `Test${contractName}`
    deployment = await deployments.get(contractName)
  }
  return await artifacts.require(contractName).at(deployment.address)
}

const tolerance = usdcVal(1).div(new BN(1000)) // 0.001$

async function getBalance(address, erc20) {
  if (erc20) {
    return new BN(await erc20.balanceOf(address))
  }
  return new BN(await web3.eth.getBalance(address))
}

module.exports = {
  chai: chai,
  expect: expect,
  decimals: decimals,
  USDC_DECIMALS: USDC_DECIMALS,
  BN: BN,
  bigVal: bigVal,
  usdcVal: usdcVal,
  mochaEach: mochaEach,
  getBalance: getBalance,
  MAX_UINT: MAX_UINT,
  tolerance: tolerance,
  getDeployedAsTruffleContract: getDeployedAsTruffleContract,
}
