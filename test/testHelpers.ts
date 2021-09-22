import chai from "chai"
import {artifacts, web3, ethers} from "hardhat"
chai.use(require("chai-as-promised"))
const expect = chai.expect
import mochaEach from "mocha-each"
import {time} from "@openzeppelin/test-helpers"
import BN from "bn.js"
import {
  isTestEnv,
  USDCDecimals,
  interestAprAsBN,
  ZERO_ADDRESS,
  DISTRIBUTOR_ROLE,
  getContract,
  GetContractOptions,
  TRUFFLE_CONTRACT_PROVIDER,
} from "../blockchain_scripts/deployHelpers"
import {DeploymentsExtension} from "hardhat-deploy/dist/types"
import {
  CreditDeskInstance,
  ERC20Instance,
  FiduInstance,
  FixedLeverageRatioStrategyInstance,
  GoldfinchConfigInstance,
  GoldfinchFactoryInstance,
  PoolInstance,
  PoolTokensInstance,
  SeniorPoolInstance,
  CreditLineInstance,
  TestForwarderInstance,
  TranchedPoolInstance,
  TransferRestrictedVaultInstance,
  GFIInstance,
  StakingRewardsInstance,
  CommunityRewardsInstance,
  MerkleDistributorInstance,
} from "../typechain/truffle"
import {assertNonNullable} from "../utils/type"
import {DynamicLeverageRatioStrategyInstance} from "../typechain/truffle/DynamicLeverageRatioStrategy"
import {TestCommunityRewardsInstance} from "../typechain/truffle/TestCommunityRewards"
import {MerkleDistributor, TestCommunityRewards} from "../typechain/ethers"
const decimals = new BN(String(1e18))
const USDC_DECIMALS = new BN(String(1e6))
const SECONDS_PER_DAY = new BN(86400)
const SECONDS_PER_YEAR = SECONDS_PER_DAY.mul(new BN(365))
const UNIT_SHARE_PRICE = new BN("1000000000000000000") // Corresponds to share price of 100% (no interest or writedowns)
chai.use(require("chai-bn")(BN))

const MAX_UINT = new BN("115792089237316195423570985008687907853269984665640564039457584007913129639935")
const fiduTolerance = decimals.div(USDC_DECIMALS)
const CreditLine = artifacts.require("CreditLine")
const EMPTY_DATA = "0x"
const BLOCKS_PER_DAY = 5760
const ZERO = new BN(0)

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

const getDeployedAsTruffleContract = async <T extends Truffle.ContractInstance>(
  deployments: DeploymentsExtension,
  contractName: string
): Promise<T> => {
  let deployment = await deployments.getOrNull(contractName)
  if (!deployment && contractName === "GoldfinchFactory") {
    deployment = await deployments.getOrNull("CreditLineFactory")
  }
  if (!deployment && isTestEnv()) {
    contractName = `Test${contractName}`
    deployment = await deployments.get(contractName)
  }
  return getTruffleContract<T>(contractName, deployment!.address)
}

async function getTruffleContract<T extends Truffle.ContractInstance>(name: string, address: string): Promise<T> {
  return (await artifacts.require(name).at(address)) as T
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
}: {
  borrower?: string
  creditDesk?: any
  underwriter?: string
  paymentPeriodInDays?: any
  limit?: BN
  interestApr?: BN
  termInDays?: number | BN
  lateFeesApr?: BN
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

type Expectation<T> =
  | {by: Numberish}
  | {byCloseTo: Numberish}
  | {fn: (originalValue: T, newValue: T) => any}
  | {increase: boolean}
  | {decrease: boolean}
  | {to: T; bignumber?: boolean}
  | {toCloseTo: Numberish}
  | {unchanged: boolean}
  | {beDifferent: boolean}

type ItemsAndExpectations<T = any> = Array<[() => T, Expectation<T>]>
function expectAction(action: () => any, debug?: boolean) {
  return {
    toChange: async (itemsAndExpectations: ItemsAndExpectations) => {
      const items = itemsAndExpectations.map((pair) => pair[0])
      const expectations = itemsAndExpectations.map((pair) => pair[1])
      const originalValues = (await Promise.all(items.map((i) => i()))) as any
      if (debug) {
        console.log("Original:", String(originalValues))
      }
      const actionPromise = action()
      if (actionPromise === undefined) {
        throw new Error("Expected a promise. Did you forget to return?")
      }
      await actionPromise
      const newValues = (await Promise.all(items.map((i) => i()))) as any
      if (debug) {
        console.log("New:     ", String(newValues))
      }
      expectations.forEach((expectation, i) => {
        try {
          if ("by" in expectation) {
            expect(newValues[i].sub(originalValues[i])).to.bignumber.equal(expectation.by)
          } else if ("byCloseTo" in expectation) {
            const onePercent = new BN(expectation.byCloseTo).div(new BN(100)).abs()
            expect(newValues[i].sub(originalValues[i])).to.bignumber.closeTo(new BN(expectation.byCloseTo), onePercent)
          } else if ("fn" in expectation) {
            expectation.fn(originalValues[i], newValues[i])
          } else if ("increase" in expectation) {
            expect(newValues[i]).to.bignumber.gt(originalValues[i])
          } else if ("decrease" in expectation) {
            expect(newValues[i]).to.bignumber.lt(originalValues[i])
          } else if ("to" in expectation) {
            if (expectation.bignumber === false) {
              // It was not originally the number we expected, but then was changed to it
              expect(originalValues[i]).to.not.eq(expectation.to)
              expect(newValues[i]).to.eq(expectation.to)
            } else {
              // It was not originally the number we expected, but then was changed to it
              expect(originalValues[i]).to.not.bignumber.eq(expectation.to)
              expect(newValues[i]).to.bignumber.eq(expectation.to)
            }
          } else if ("toCloseTo" in expectation) {
            // It was not originally the number we expected, but then was changed to it
            const onePercent = new BN(expectation.toCloseTo).div(new BN(100)).abs()
            expect(originalValues[i]).to.not.bignumber.eq(new BN(expectation.toCloseTo))
            expect(newValues[i]).to.bignumber.closeTo(new BN(expectation.toCloseTo), onePercent)
          } else if ("unchanged" in expectation) {
            expect(newValues[i]).to.bignumber.eq(originalValues[i])
          } else if ("beDifferent" in expectation) {
            expect(String(originalValues[i])).to.not.eq(String(newValues[i]))
          }
        } catch (error) {
          console.log("Expectation", i, "failed")
          throw error
        }
      })
    },
  }
}

type DecodedLog<T extends Truffle.AnyEvent> = {
  event: T["name"]
  args: T["args"]
}

// This decodes logs for a single event type, and returns a decoded object in
// the same form truffle-contract uses on its receipts
// Mostly stolen from: https://github.com/OpenZeppelin/openzeppelin-test-helpers/blob/6e54db1e1f64a80c7632799776672297bbe543b3/src/expectEvent.js#L49
function decodeLogs<T extends Truffle.AnyEvent>(logs, emitter, eventName): DecodedLog<T>[] {
  let abi = emitter.abi
  let address = emitter.address
  let eventABI = abi.filter((x) => x.type === "event" && x.name === eventName)
  if (eventABI.length === 0) {
    throw new Error(`No ABI entry for event '${eventName}'`)
  } else if (eventABI.length > 1) {
    throw new Error(`Multiple ABI entries for event '${eventName}', only uniquely named events are supported`)
  }

  eventABI = eventABI[0]

  // The first topic will equal the hash of the event signature
  const eventTopic = eventABI.signature

  // Only decode events of type 'EventName'
  return logs
    .filter((log) => log.topics.length > 0 && log.topics[0] === eventTopic && (!address || log.address === address))
    .map((log) => web3.eth.abi.decodeLog(eventABI.inputs, log.data, log.topics.slice(1)))
    .map((decoded) => ({event: eventName, args: decoded}))
}

function getFirstLog<T extends Truffle.AnyEvent>(logs: DecodedLog<T>[]): DecodedLog<T> {
  const firstLog = logs[0]
  assertNonNullable(firstLog)
  return firstLog
}
function getOnlyLog<T extends Truffle.AnyEvent>(logs: DecodedLog<T>[]): DecodedLog<T> {
  expect(logs.length).to.equal(1)
  return getFirstLog(logs)
}

type DeployAllContractsOptions = {
  deployForwarder?: {
    fromAccount: string
  }
  deployMerkleDistributor?: {
    fromAccount: string
    root: string
  }
}

async function deployAllContracts(
  deployments: DeploymentsExtension,
  options: DeployAllContractsOptions = {}
): Promise<{
  pool: PoolInstance
  seniorPool: SeniorPoolInstance
  seniorPoolFixedStrategy: FixedLeverageRatioStrategyInstance
  seniorPoolDynamicStrategy: DynamicLeverageRatioStrategyInstance
  usdc: ERC20Instance
  creditDesk: CreditDeskInstance
  fidu: FiduInstance
  goldfinchConfig: GoldfinchConfigInstance
  goldfinchFactory: GoldfinchFactoryInstance
  forwarder: TestForwarderInstance | null
  poolTokens: PoolTokensInstance
  tranchedPool: TranchedPoolInstance
  transferRestrictedVault: TransferRestrictedVaultInstance
  gfi: GFIInstance
  stakingRewards: StakingRewardsInstance
  communityRewards: TestCommunityRewardsInstance
  merkleDistributor: MerkleDistributorInstance | null
}> {
  await deployments.fixture("base_deploy")
  const pool = await getDeployedAsTruffleContract<PoolInstance>(deployments, "Pool")
  const seniorPool = await getDeployedAsTruffleContract<SeniorPoolInstance>(deployments, "SeniorPool")
  const seniorPoolFixedStrategy = await getDeployedAsTruffleContract<FixedLeverageRatioStrategyInstance>(
    deployments,
    "FixedLeverageRatioStrategy"
  )
  const seniorPoolDynamicStrategy = await getDeployedAsTruffleContract<DynamicLeverageRatioStrategyInstance>(
    deployments,
    "DynamicLeverageRatioStrategy"
  )
  const usdc = await getDeployedAsTruffleContract<ERC20Instance>(deployments, "ERC20")
  const creditDesk = await getDeployedAsTruffleContract<CreditDeskInstance>(deployments, "CreditDesk")
  const fidu = await getDeployedAsTruffleContract<FiduInstance>(deployments, "Fidu")
  const goldfinchConfig = await getDeployedAsTruffleContract<GoldfinchConfigInstance>(deployments, "GoldfinchConfig")
  const goldfinchFactory = await getDeployedAsTruffleContract<GoldfinchFactoryInstance>(deployments, "GoldfinchFactory")
  const poolTokens = await getDeployedAsTruffleContract<PoolTokensInstance>(deployments, "PoolTokens")
  let forwarder: TestForwarderInstance | null = null
  if (options.deployForwarder) {
    await deployments.deploy("TestForwarder", {from: options.deployForwarder.fromAccount, gasLimit: 4000000})
    forwarder = await getDeployedAsTruffleContract<TestForwarderInstance>(deployments, "TestForwarder")
    await forwarder!.registerDomainSeparator("Defender", "1")
  }
  let tranchedPool = await getDeployedAsTruffleContract<TranchedPoolInstance>(deployments, "TranchedPool")
  const transferRestrictedVault = await getDeployedAsTruffleContract<TransferRestrictedVaultInstance>(
    deployments,
    "TransferRestrictedVault"
  )
  const gfi = await getDeployedAsTruffleContract<GFIInstance>(deployments, "GFI")
  const stakingRewards = await getDeployedAsTruffleContract<StakingRewardsInstance>(deployments, "StakingRewards")
  const communityRewards = await getContract<TestCommunityRewards, TestCommunityRewardsInstance>(
    "TestCommunityRewards",
    TRUFFLE_CONTRACT_PROVIDER
  )
  let merkleDistributor: MerkleDistributorInstance | null = null
  if (options.deployMerkleDistributor) {
    await deployments.deploy("MerkleDistributor", {
      args: [communityRewards.address, options.deployMerkleDistributor.root],
      from: options.deployMerkleDistributor.fromAccount,
      gasLimit: 4000000,
    })
    merkleDistributor = await getContract<MerkleDistributor, MerkleDistributorInstance>(
      "MerkleDistributor",
      TRUFFLE_CONTRACT_PROVIDER
    )
    await communityRewards.grantRole(DISTRIBUTOR_ROLE, merkleDistributor.address)
  }
  return {
    pool,
    seniorPool,
    seniorPoolFixedStrategy,
    seniorPoolDynamicStrategy,
    usdc,
    creditDesk,
    fidu,
    goldfinchConfig,
    goldfinchFactory,
    forwarder,
    poolTokens,
    tranchedPool,
    transferRestrictedVault,
    gfi,
    stakingRewards,
    communityRewards,
    merkleDistributor,
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

async function getCurrentTimestamp(): Promise<BN> {
  return await time.latest()
}

type Numberish = BN | string | number
async function advanceTime({days, seconds, toSecond}: {days?: Numberish; seconds?: Numberish; toSecond?: Numberish}) {
  let secondsPassed, newTimestamp
  const currentTimestamp = await getCurrentTimestamp()

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
  juniorFeePercent = 20,
  interestApr = interestAprAsBN("15.0"),
  paymentPeriodInDays = new BN(30),
  termInDays = new BN(365),
  limit = usdcVal(10000),
  lateFeeApr = interestAprAsBN("3.0"),
}): Promise<{tranchedPool: TranchedPoolInstance; creditLine: CreditLineInstance}> => {
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
  let pool = await getTruffleContract<TranchedPoolInstance>("TranchedPool", event.args.pool)
  let creditLine = await getTruffleContract<CreditLineInstance>("CreditLine", await pool.creditLine())

  await erc20Approve(usdc, pool.address, usdcVal(100000), [thisOwner])

  // Only approve if borrower is an EOA (could be a borrower contract)
  if ((await web3.eth.getCode(thisBorrower)) === "0x") {
    await erc20Approve(usdc, pool.address, usdcVal(100000), [thisBorrower])
  }

  let tranchedPool = await getTruffleContract<TranchedPoolInstance>("TestTranchedPool", pool.address)
  return {tranchedPool, creditLine}
}

async function toTruffle(
  address: Truffle.ContractInstance | string,
  contractName,
  opts?: {}
): Promise<Truffle.ContractInstance> {
  let truffleContract = await artifacts.require(contractName)
  address = typeof address === "string" ? address : address.address
  if (opts) {
    truffleContract.defaults(opts)
  }
  return truffleContract.at(address)
}

const genDifferentHexString = (hex: string): string => `${hex.slice(0, -1)}${hex[hex.length - 1] === "1" ? "2" : "1"}`

export {
  chai,
  expect,
  decimals,
  USDC_DECIMALS,
  BN,
  MAX_UINT,
  tolerance,
  fiduTolerance,
  ZERO_ADDRESS,
  SECONDS_PER_DAY,
  SECONDS_PER_YEAR,
  EMPTY_DATA,
  BLOCKS_PER_DAY,
  UNIT_SHARE_PRICE,
  ZERO,
  bigVal,
  usdcVal,
  mochaEach,
  getBalance,
  getDeployedAsTruffleContract,
  getTruffleContract,
  fiduToUSDC,
  usdcToFidu,
  expectAction,
  deployAllContracts,
  erc20Approve,
  erc20Transfer,
  getCurrentTimestamp,
  advanceTime,
  createCreditLine,
  createPoolWithCreditLine,
  decodeLogs,
  getFirstLog,
  getOnlyLog,
  toTruffle,
  genDifferentHexString,
}
