/* global web3 ethers */
const chai = require("chai")
const {artifacts} = require("hardhat")
chai.use(require("chai-as-promised"))
const expect = chai.expect
const mochaEach = require("mocha-each")
const BN = require("bn.js")
const {isTestEnv, USDCDecimals, interestAprAsBN, ZERO_ADDRESS} = require("../blockchain_scripts/deployHelpers")
const decimals = new BN(String(1e18))
const USDC_DECIMALS = new BN(String(1e6))
const SECONDS_PER_DAY = new BN(86400)
const SECONDS_PER_YEAR = SECONDS_PER_DAY.mul(new BN(365))
chai.use(require("chai-bn")(BN))
const MAX_UINT = new BN("115792089237316195423570985008687907853269984665640564039457584007913129639935")
const fiduTolerance = decimals.div(USDC_DECIMALS)
const CreditLine = artifacts.require("CreditLine")
const EMPTY_DATA = "0x"

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
  return CreditLine.at(ulCreditLines[ulCreditLines.length - 1]) // Return the latest
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
      const actionPromise = action()
      if (actionPromise === undefined) {
        throw new Error("Expected a promise. Did you forget to return?")
      }
      await actionPromise
      const newValues = await Promise.all(items.map((i) => i()))
      if (debug) {
        console.log("New:     ", String(newValues))
      }
      expectations.forEach((expectation, i) => {
        if (expectation.by) {
          expect(newValues[i]).to.bignumber.equal(originalValues[i].add(expectation.by))
        } else if (expectation.byCloseTo) {
          const onePercent = expectation.byCloseTo.div(new BN(100))
          expect(newValues[i]).to.bignumber.closeTo(originalValues[i].add(expectation.byCloseTo), onePercent)
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

// This decodes longs for a single event type, and returns a decoded object in
// the same form truffle-contract uses on its receipts
// Mostly stolen from: https://github.com/OpenZeppelin/openzeppelin-test-helpers/blob/6e54db1e1f64a80c7632799776672297bbe543b3/src/expectEvent.js#L49
function decodeLogs(logs, abi, eventName) {
  let eventABI = abi.filter((x) => x.type === "event" && x.name === eventName)
  if (eventABI.length === 0) {
    throw new Error(`No ABI entry for event '${eventName}'`)
  } else if (eventABI.length > 1) {
    throw new Error(`Multiple ABI entries for event '${eventName}', only uniquely named events are supported`)
  }

  eventABI = eventABI[0]

  // The first topic will equal the hash of the event signature
  const eventSignature = `${eventName}(${eventABI.inputs.map((input) => input.type).join(",")})`
  const eventTopic = web3.utils.sha3(eventSignature)

  // Only decode events of type 'EventName'
  return logs
    .filter((log) => log.topics.length > 0 && log.topics[0] === eventTopic)
    .map((log) => web3.eth.abi.decodeLog(eventABI.inputs, log.data, log.topics.slice(1)))
    .map((decoded) => ({event: eventName, args: decoded}))
}

async function deployAllContracts(deployments, options = {}) {
  let {deployForwarder, fromAccount} = options
  await deployments.fixture("base_deploy")
  const pool = await getDeployedAsTruffleContract(deployments, "Pool")
  const seniorFund = await getDeployedAsTruffleContract(deployments, "SeniorFund")
  const seniorFundStrategy = await getDeployedAsTruffleContract(deployments, "FixedLeverageRatioStrategy")
  const usdc = await getDeployedAsTruffleContract(deployments, "ERC20")
  const creditDesk = await getDeployedAsTruffleContract(deployments, "CreditDesk")
  const fidu = await getDeployedAsTruffleContract(deployments, "Fidu")
  const seniorFundFidu = await getDeployedAsTruffleContract(deployments, "SeniorFundFidu")
  const goldfinchConfig = await getDeployedAsTruffleContract(deployments, "GoldfinchConfig")
  const goldfinchFactory = await getDeployedAsTruffleContract(deployments, "CreditLineFactory")
  const poolTokens = await getDeployedAsTruffleContract(deployments, "PoolTokens")
  let forwarder = null
  if (deployForwarder) {
    await deployments.deploy("TestForwarder", {from: fromAccount, gas: 4000000})
    forwarder = await getDeployedAsTruffleContract(deployments, "TestForwarder")
    await forwarder.registerDomainSeparator("Defender", "1")
  }
  let tranchedPool = await getDeployedAsTruffleContract(deployments, "TranchedPool")
  return {
    pool,
    seniorFund,
    seniorFundStrategy,
    seniorFundFidu,
    usdc,
    creditDesk,
    fidu,
    goldfinchConfig,
    goldfinchFactory,
    forwarder,
    poolTokens,
    tranchedPool,
  }
}

async function erc20Approve(erc20, accountToApprove, amount, fromAccounts) {
  if (typeof accountToApprove != "string") {
    throw new Error("Account to approve must be a string!")
  }
  for (const fromAccount of fromAccounts) {
    await erc20.approve(accountToApprove, amount, {from: fromAccount})
  }
}

async function erc20Transfer(erc20, toAccounts, amount, fromAccount) {
  for (const toAccount of toAccounts) {
    await erc20.transfer(toAccount, amount, {from: fromAccount})
  }
}

async function advanceTime(creditDeskOrCreditLine, {days, seconds, toSecond}) {
  let secondsPassed, newTimestamp
  let currentTimestamp = await creditDeskOrCreditLine.currentTimestamp()

  if (days) {
    secondsPassed = SECONDS_PER_DAY.mul(new BN(days))
    newTimestamp = currentTimestamp.add(secondsPassed)
  } else if (seconds) {
    secondsPassed = new BN(seconds)
    newTimestamp = currentTimestamp.add(secondsPassed)
  } else if (toSecond) {
    newTimestamp = new BN(toSecond)
  }
  // Cannot go backward
  expect(newTimestamp).to.bignumber.gt(currentTimestamp)
  if (creditDeskOrCreditLine) {
    await creditDeskOrCreditLine._setTimestampForTest(newTimestamp)
  }

  await ethers.provider.send("evm_setNextBlockTimestamp", [newTimestamp.toNumber()])
  return newTimestamp
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

const createPoolWithCreditLine = async ({
  people,
  goldfinchFactory,
  usdc,
  juniorFeePercent,
  interestApr,
  paymentPeriodInDays,
  termInDays,
  limit,
  lateFeeApr,
}) => {
  const CreditLine = artifacts.require("CreditLine")
  const TranchedPool = artifacts.require("TestTranchedPool")

  const thisOwner = people.owner
  const thisBorrower = people.borrower

  if (!thisBorrower) {
    throw new Error("No borrower is set. Set one in a beforeEach, or pass it in explicitly")
  }

  if (!thisOwner) {
    throw new Error("No owner is set. Please set one in a beforeEach or pass it in explicitly")
  }

  let result = await goldfinchFactory.createPool(
    thisBorrower,
    juniorFeePercent,
    limit,
    interestApr,
    paymentPeriodInDays,
    termInDays,
    lateFeeApr,
    {from: thisOwner}
  )
  let event = result.logs[result.logs.length - 1]
  let pool = await TranchedPool.at(event.args.pool)
  let creditLine = await CreditLine.at(await pool.creditLine())

  await erc20Approve(usdc, pool.address, usdcVal(100000), [thisOwner, thisBorrower])

  let tranchedPool = await artifacts.require("TestTranchedPool").at(pool.address)
  return {tranchedPool, creditLine}
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
  SECONDS_PER_DAY: SECONDS_PER_DAY,
  SECONDS_PER_YEAR: SECONDS_PER_YEAR,
  EMPTY_DATA: EMPTY_DATA,
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
  createPoolWithCreditLine: createPoolWithCreditLine,
  decodeLogs: decodeLogs,
}
