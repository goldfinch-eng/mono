/* global artifacts web3 */
const chai = require("chai")
chai.use(require("chai-as-promised"))
const expect = chai.expect
const mochaEach = require("mocha-each")
const BN = require("bn.js")
const {isTestEnv, USDCDecimals} = require("../blockchain_scripts/deployHelpers")
const decimals = new BN(String(1e18))
const USDC_DECIMALS = new BN(String(1e6))
const BLOCKS_PER_DAY = new BN(5760)
const BLOCKS_PER_YEAR = BLOCKS_PER_DAY.mul(new BN(365))
chai.use(require("chai-bn")(BN))
const MAX_UINT = new BN("115792089237316195423570985008687907853269984665640564039457584007913129639935")
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const fiduTolerance = decimals.div(USDC_DECIMALS)

// Helper functions. These should be pretty generic.
function bigVal(number) {
  return new BN(number).mul(decimals)
}

function usdcVal(number) {
  return new BN(number).mul(USDC_DECIMALS)
}

function usdcToFidu(number) {
  return number.mul(decimals.div(USDCDecimals))
}

function fiduToUSDC(number) {
  return number.div(decimals.div(USDCDecimals))
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

function expectAction(action, debug) {
  return {
    toChange: async (itemsAndExpectations) => {
      const items = itemsAndExpectations.map((pair) => pair[0])
      const expectations = itemsAndExpectations.map((pair) => pair[1])
      const originalValues = await Promise.all(items.map((i) => i()))
      if (debug) {
        console.log("Original:", String(originalValues))
      }
      await action()
      const newValues = await Promise.all(items.map((i) => i()))
      if (debug) {
        console.log("New:", String(newValues))
      }
      expectations.forEach((expectation, i) => {
        if (expectation.by) {
          expect(newValues[i].sub(expectation.by)).to.bignumber.equal(originalValues[i])
        } else if (expectation.fn) {
          expectation.fn(originalValues[i], newValues[i])
        } else if (expectation.increase) {
          expect(newValues[i]).to.bignumber.gt(originalValues[i])
        } else if (expectation.decrease) {
          expect(newValues[i]).to.bignumber.lt(originalValues[i])
        }
      })
    },
  }
}

async function getBalance(address, erc20) {
  if (typeof address !== "string") {
    throw new Error("Address must be a string")
  }
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
  MAX_UINT: MAX_UINT,
  tolerance: tolerance,
  fiduTolerance: fiduTolerance,
  ZERO_ADDRESS: ZERO_ADDRESS,
  BLOCKS_PER_DAY: BLOCKS_PER_DAY,
  BLOCKS_PER_YEAR: BLOCKS_PER_YEAR,
  bigVal: bigVal,
  usdcVal: usdcVal,
  mochaEach: mochaEach,
  getBalance: getBalance,
  getDeployedAsTruffleContract: getDeployedAsTruffleContract,
  fiduToUSDC: fiduToUSDC,
  usdcToFidu: usdcToFidu,
  expectAction: expectAction,
}
