/* global web3 */
const chai = require("chai")
const {artifacts} = require("hardhat")
chai.use(require("chai-as-promised"))
const expect = chai.expect
const mochaEach = require("mocha-each")
const BN = require("bn.js")
const {isTestEnv, USDCDecimals, interestAprAsBN} = require("../blockchain_scripts/deployHelpers")
const decimals = new BN(String(1e18))
const USDC_DECIMALS = new BN(String(1e6))
const BLOCKS_PER_DAY = new BN(5760)
const BLOCKS_PER_YEAR = BLOCKS_PER_DAY.mul(new BN(365))
chai.use(require("chai-bn")(BN))
const MAX_UINT = new BN("115792089237316195423570985008687907853269984665640564039457584007913129639935")
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const fiduTolerance = decimals.div(USDC_DECIMALS)
const CreditLine = artifacts.require("CreditLine")

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

async function createCreditLine({
  borrower,
  creditDesk,
  underwriter,
  paymentPeriodInDays = 30,
  limit = usdcVal(10000),
  interestApr = interestAprAsBN("15.0"),
  termInDays = 360,
  lateFeesApr = interestAprAsBN("3.0"),
} = {}) {
  if (typeof borrower !== "string") {
    throw new Error("Borrower address must be a string")
  }
  if (typeof underwriter !== "string") {
    throw new Error("Underwriter address must be a string")
  }
  await creditDesk.createCreditLine(borrower, limit, interestApr, paymentPeriodInDays, termInDays, lateFeesApr, {
    from: underwriter,
  })
  var ulCreditLines = await creditDesk.getUnderwriterCreditLines(underwriter)
  return CreditLine.at(ulCreditLines[0])
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
        } else if (expectation.to) {
          // It was not originally the number we expected, but then was changed to it
          expect(originalValues[i]).to.not.bignumber.eq(expectation.to)
          expect(newValues[i]).to.bignumber.eq(expectation.to)
        }
      })
    },
  }
}

async function deployAllContracts(deployments) {
  await deployments.fixture("base_deploy")
  const pool = await getDeployedAsTruffleContract(deployments, "Pool")
  const usdc = await getDeployedAsTruffleContract(deployments, "ERC20")
  const creditDesk = await getDeployedAsTruffleContract(deployments, "CreditDesk")
  const fidu = await getDeployedAsTruffleContract(deployments, "Fidu")
  const goldfinchConfig = await getDeployedAsTruffleContract(deployments, "GoldfinchConfig")
  const goldfinchFactory = await getDeployedAsTruffleContract(deployments, "CreditLineFactory")
  return {pool, usdc, creditDesk, fidu, goldfinchConfig, goldfinchFactory}
}

async function erc20Approve(erc20, accountToApprove, amount, fromAccounts) {
  for (const fromAccount of fromAccounts) {
    await erc20.approve(accountToApprove, amount, {from: fromAccount})
  }
}

async function erc20Transfer(erc20, toAccounts, amount, fromAccount) {
  for (const toAccount of toAccounts) {
    await erc20.transfer(toAccount, amount, {from: fromAccount})
  }
}

async function advanceTime(creditDesk, {days, blocks, toBlock}) {
  let blocksPassed, newBlock
  let currentBlock = await creditDesk.blockNumberForTest()

  if (days) {
    blocksPassed = BLOCKS_PER_DAY.mul(new BN(days))
    newBlock = currentBlock.add(blocksPassed)
  } else if (blocks) {
    blocksPassed = new BN(blocks)
    newBlock = currentBlock.add(blocksPassed)
  } else if (toBlock) {
    newBlock = new BN(toBlock)
  }
  // Cannot go backward
  expect(newBlock).to.bignumber.gt(currentBlock)
  await creditDesk._setBlockNumberForTest(newBlock)
  return newBlock
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
  deployAllContracts: deployAllContracts,
  erc20Approve: erc20Approve,
  erc20Transfer: erc20Transfer,
  advanceTime: advanceTime,
  createCreditLine: createCreditLine,
}
