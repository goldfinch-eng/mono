import chai from "chai"
import hardhat, {artifacts, web3, ethers, getNamedAccounts, deployments} from "hardhat"
import AsPromised from "chai-as-promised"
chai.use(AsPromised)
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
  OWNER_ROLE,
  getTruffleContract,
  getProtocolOwner,
  isMainnetForking,
} from "../blockchain_scripts/deployHelpers"

import {DeploymentsExtension} from "hardhat-deploy/types"
import {
  ERC20Instance,
  FiduInstance,
  FixedLeverageRatioStrategyInstance,
  GoldfinchConfigInstance,
  GoldfinchFactoryInstance,
  SeniorPoolInstance,
  CreditLineInstance,
  TranchedPoolInstance,
  GFIInstance,
  CommunityRewardsInstance,
  MerkleDistributorInstance,
  GoInstance,
  TestUniqueIdentityInstance,
  MerkleDirectDistributorInstance,
  BackerRewardsInstance,
  ZapperInstance,
  TestFiduUSDCCurveLPInstance,
  TestStakingRewardsInstance,
  TestPoolTokensInstance,
  StakingRewardsInstance,
  WithdrawalRequestTokenInstance,
  TestSeniorPoolCallerInstance,
  MembershipCollectorInstance,
  ERC20SplitterInstance,
  TestGoldfinchConfigInstance,
  MonthlyScheduleRepoInstance,
} from "../typechain/truffle"
import {assertNonNullable} from "@goldfinch-eng/utils"
import "./types"
const decimals = new BN(String(1e18))
const USDC_DECIMALS = new BN(String(1e6))
const FIDU_DECIMALS = new BN(String(1e18))
const GFI_DECIMALS = new BN(String(1e18))
const SECONDS_PER_DAY = new BN(86400)
const SECONDS_PER_YEAR = SECONDS_PER_DAY.mul(new BN(365))
const UNIT_SHARE_PRICE = new BN("1000000000000000000") // Corresponds to share price of 100% (no interest or writedowns)
const HALF_CENT = usdcVal(1).div(new BN(200))
const HALF_DOLLAR = HALF_CENT.mul(new BN(100))
import ChaiBN from "chai-bn"
import {BaseContract, BigNumber, ContractReceipt, ContractTransaction, PopulatedTransaction} from "ethers"
import {TestBackerRewardsInstance} from "../typechain/truffle/contracts/test/TestBackerRewards"
import {getDeploymentFor} from "./util/fixtures"
import {CONFIG_KEYS_BY_TYPE} from "../blockchain_scripts/configKeys"
chai.use(ChaiBN(BN))

const MAX_UINT = new BN("115792089237316195423570985008687907853269984665640564039457584007913129639935")
const fiduTolerance = decimals.div(USDC_DECIMALS)
const EMPTY_DATA = "0x"
const BLOCKS_PER_DAY = 5760
const ZERO = new BN(0)

export type $TSFixMe = any

// Helper functions. These should be pretty generic.
function bigVal(number): BN {
  return new BN(number).mul(decimals)
}

// Helper functions. These should be pretty generic.
function gfiVal(number): BN {
  return new BN(number).mul(GFI_DECIMALS)
}

function usdcVal(number) {
  return new BN(number).mul(USDC_DECIMALS)
}

function fiduVal(number) {
  return new BN(number).mul(FIDU_DECIMALS)
}

function usdcToFidu(number: BN | number) {
  if (!(number instanceof BN)) {
    number = new BN(number)
  }
  return number.mul(decimals.div(USDCDecimals))
}

function fiduToUSDC(number: BN | number) {
  if (!(number instanceof BN)) {
    number = new BN(number)
  }
  return number.div(decimals.div(USDCDecimals))
}

function getNumShares(usdcAmount: BN, sharePrice: BN) {
  return usdcToFidu(usdcAmount).mul(FIDU_DECIMALS).div(sharePrice)
}

function usdcFromShares(fiduAmount: BN, sharePrice: BN) {
  return fiduToUSDC(fiduAmount.mul(sharePrice)).div(FIDU_DECIMALS)
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
  assertNonNullable(deployment)
  return getTruffleContractAtAddress<T>(contractName, deployment.address)
}

async function getTruffleContractAtAddress<T extends Truffle.ContractInstance>(
  name: string,
  address: string
): Promise<T> {
  return (await artifacts.require(name).at(address)) as T
}

async function setupBackerRewards(
  gfi: GFIInstance,
  backerRewards: BackerRewardsInstance,
  stakingRewards: StakingRewardsInstance,
  owner: string
) {
  const gfiAmount = bigVal(100_000_000) // 100M
  await gfi.setCap(gfiAmount)
  await gfi.mint(owner, gfiAmount)
  await backerRewards.setMaxInterestDollarsEligible(bigVal(1_000_000_000)) // 1B
  await backerRewards.setTotalRewards(bigVal(3_000_000)) // 3% of 100M, 3M

  // Seed stakings rewards with GFI. This brings the test state closer to what's
  // actually on mainnet. See this https://goldfinchhq.slack.com/archives/C01BGB0Q753/p1655239486314729
  // discussion for why this is important
  const targetCapacity = bigVal(1000)
  const maxRate = bigVal(1000)
  const minRate = bigVal(100)
  const maxRateAtPercent = new BN(5).mul(new BN(String(1e17))) // 50%
  const minRateAtPercent = new BN(3).mul(new BN(String(1e18))) // 300%
  await stakingRewards.setRewardsParameters(targetCapacity, minRate, maxRate, minRateAtPercent, maxRateAtPercent)
  await gfi.approve(stakingRewards.address, bigVal(1000), {from: owner})
  await stakingRewards.loadRewards(bigVal(1000), {from: owner})
}

const tolerance = usdcVal(1).div(new BN(1000)) // 0.001$

type Expectation<T> =
  | {by: Numberish}
  | {byCloseTo: Numberish; threshold?: Numberish}
  | {toCloseTo: Numberish; threshold?: Numberish}
  | {fn: (originalValue: T, newValue: T) => any}
  | {increase: boolean}
  | {decrease: boolean}
  | {to: T; bignumber?: boolean}
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
        const errorMsg = `expectation ${i} failed`
        if ("by" in expectation) {
          expect(newValues[i].sub(originalValues[i])).to.bignumber.equal(expectation.by, errorMsg)
        } else if ("byCloseTo" in expectation) {
          const onePercent = new BN(expectation.byCloseTo).div(new BN(100)).abs()
          const threshold = expectation.threshold ? new BN(expectation.threshold) : onePercent
          expect(newValues[i].sub(originalValues[i])).to.bignumber.closeTo(
            new BN(expectation.byCloseTo),
            threshold,
            `${errorMsg} - '${newValues[i].sub(originalValues[i])}' not within '${threshold}' of '${new BN(
              expectation.byCloseTo
            )}'`
          )
        } else if ("fn" in expectation) {
          expectation.fn(originalValues[i], newValues[i])
        } else if ("increase" in expectation) {
          expect(newValues[i]).to.bignumber.gt(originalValues[i], errorMsg)
        } else if ("decrease" in expectation) {
          expect(newValues[i]).to.bignumber.lt(originalValues[i], errorMsg)
        } else if ("to" in expectation) {
          if (expectation.bignumber === false) {
            // It was not originally the number we expected, but then was changed to it
            expect(originalValues[i]).to.not.eq(expectation.to, errorMsg)
            expect(newValues[i]).to.eq(expectation.to, errorMsg)
          } else {
            // It was not originally the number we expected, but then was changed to it
            expect(originalValues[i]).to.not.bignumber.eq(expectation.to, errorMsg)
            expect(newValues[i]).to.bignumber.eq(expectation.to, errorMsg)
          }
        } else if ("toCloseTo" in expectation) {
          // It was not originally the number we expected, but then was changed to it
          const onePercent = new BN(expectation.toCloseTo).div(new BN(100)).abs()
          const threshold = expectation.threshold ? new BN(expectation.threshold) : onePercent
          expect(originalValues[i]).to.not.bignumber.eq(new BN(expectation.toCloseTo), errorMsg)
          expect(newValues[i]).to.bignumber.closeTo(
            new BN(expectation.toCloseTo),
            threshold,
            `${errorMsg} - '${newValues[i]}' not within '${threshold}' of '${expectation.toCloseTo}'`
          )
        } else if ("unchanged" in expectation) {
          expect(newValues[i]).to.bignumber.eq(originalValues[i], errorMsg)
        } else if ("beDifferent" in expectation) {
          expect(String(originalValues[i])).to.not.eq(String(newValues[i]), errorMsg)
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
  const abi = emitter.abi
  const address = emitter.address
  const eventAbis = abi.filter((x) => x.type === "event" && x.name === eventName)
  if (eventAbis.length === 0) {
    throw new Error(`No ABI entry for event '${eventName}'`)
  } else if (eventAbis.length > 1) {
    throw new Error(`Multiple ABI entries for event '${eventName}', only uniquely named events are supported`)
  }

  const eventAbi = eventAbis[0]

  // The first topic will equal the hash of the event signature
  // If the signature isn't present (for example if a deployments file was passed)
  // generate it.
  const eventTopic = eventAbi.signature || web3.eth.abi.encodeEventSignature(eventAbi)

  // Only decode events of type 'EventName'
  return logs
    .filter((log) => log.topics.length > 0 && log.topics[0] === eventTopic && (!address || log.address === address))
    .map((log) => web3.eth.abi.decodeLog(eventAbi.inputs, log.data, log.topics.slice(1)))
    .map((decoded) => ({event: eventName, args: decoded}))
}

function decodeAndGetFirstLog<T extends Truffle.AnyEvent>(logs, emitter, eventName): DecodedLog<T> {
  return getFirstLog<T>(decodeLogs<T>(logs, emitter, eventName))
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

export type DeployAllContractsOptions = {
  deployMerkleDistributor?: {
    fromAccount: string
    root: string
  }
  deployMerkleDirectDistributor?: {
    fromAccount: string
    root: string
  }
}

async function deployAllContracts(
  deployments: DeploymentsExtension,
  options: DeployAllContractsOptions = {}
): Promise<{
  seniorPool: SeniorPoolInstance
  seniorPoolCaller: TestSeniorPoolCallerInstance
  seniorPoolFixedStrategy: FixedLeverageRatioStrategyInstance
  usdc: ERC20Instance
  fidu: FiduInstance
  fiduUSDCCurveLP: TestFiduUSDCCurveLPInstance
  goldfinchConfig: GoldfinchConfigInstance
  goldfinchFactory: GoldfinchFactoryInstance
  poolTokens: TestPoolTokensInstance
  tranchedPool: TranchedPoolInstance
  gfi: GFIInstance
  stakingRewards: TestStakingRewardsInstance
  backerRewards: TestBackerRewardsInstance
  communityRewards: CommunityRewardsInstance
  merkleDistributor: MerkleDistributorInstance | null
  merkleDirectDistributor: MerkleDirectDistributorInstance | null
  uniqueIdentity: TestUniqueIdentityInstance
  go: GoInstance
  zapper: ZapperInstance
  withdrawalRequestToken: WithdrawalRequestTokenInstance
  reserveSplitter: ERC20SplitterInstance
  membershipCollector: MembershipCollectorInstance
}> {
  await deployments.fixture("baseDeploy")
  const seniorPool = await getDeployedAsTruffleContract<SeniorPoolInstance>(deployments, "SeniorPool")
  const seniorPoolFixedStrategy = await getDeployedAsTruffleContract<FixedLeverageRatioStrategyInstance>(
    deployments,
    "FixedLeverageRatioStrategy"
  )
  const usdc = await getDeployedAsTruffleContract<ERC20Instance>(deployments, "ERC20")
  const fidu = await getDeployedAsTruffleContract<FiduInstance>(deployments, "Fidu")
  const fiduUSDCCurveLP = await getDeployedAsTruffleContract<TestFiduUSDCCurveLPInstance>(
    deployments,
    "FiduUSDCCurveLP"
  )
  const goldfinchConfig = await getDeployedAsTruffleContract<GoldfinchConfigInstance>(deployments, "GoldfinchConfig")
  const goldfinchFactory = await getDeployedAsTruffleContract<GoldfinchFactoryInstance>(deployments, "GoldfinchFactory")
  const poolTokens = await getDeployedAsTruffleContract<TestPoolTokensInstance>(deployments, "PoolTokens")
  const tranchedPool = await getDeployedAsTruffleContract<TranchedPoolInstance>(deployments, "TranchedPool")
  const gfi = await getDeployedAsTruffleContract<GFIInstance>(deployments, "GFI")
  const stakingRewards = await getDeployedAsTruffleContract<TestStakingRewardsInstance>(deployments, "StakingRewards")
  const backerRewards = await getDeployedAsTruffleContract<TestBackerRewardsInstance>(deployments, "BackerRewards")

  const communityRewards = await getTruffleContract<CommunityRewardsInstance>("CommunityRewards")
  let merkleDistributor: MerkleDistributorInstance | null = null
  if (options.deployMerkleDistributor) {
    await deployments.deploy("MerkleDistributor", {
      args: [communityRewards.address, options.deployMerkleDistributor.root],
      from: options.deployMerkleDistributor.fromAccount,
      gasLimit: 4000000,
    })
    merkleDistributor = await getTruffleContract<MerkleDistributorInstance>("MerkleDistributor")
    await communityRewards.grantRole(DISTRIBUTOR_ROLE, merkleDistributor.address)
  }

  let merkleDirectDistributor: MerkleDirectDistributorInstance | null = null
  if (options.deployMerkleDirectDistributor) {
    const {protocol_owner} = await getNamedAccounts()
    assertNonNullable(protocol_owner)
    await deployments.deploy("MerkleDirectDistributor", {
      from: options.deployMerkleDirectDistributor.fromAccount,
      gasLimit: 4000000,
      proxy: {
        owner: protocol_owner,
        execute: {
          init: {
            methodName: "initialize",
            args: [protocol_owner, gfi.address, options.deployMerkleDirectDistributor.root],
          },
        },
      },
    })
    merkleDirectDistributor = await getTruffleContract<MerkleDirectDistributorInstance>("MerkleDirectDistributor")
  }

  await deployments.deploy("TestSeniorPoolCaller", {
    from: await getProtocolOwner(),
    args: [seniorPool.address, usdc.address, fidu.address],
  })
  const seniorPoolCaller = await getTruffleContract<TestSeniorPoolCallerInstance>("TestSeniorPoolCaller")

  const uniqueIdentity = await getTruffleContract<TestUniqueIdentityInstance>("TestUniqueIdentity")
  const go = await getTruffleContract<GoInstance>("Go")

  const zapper = await getTruffleContract<ZapperInstance>("Zapper")

  const reserveSplitter = await getTruffleContract<ERC20SplitterInstance>("ERC20Splitter")
  const membershipCollector = await getTruffleContract<MembershipCollectorInstance>("MembershipCollector")

  const withdrawalRequestToken = await getTruffleContract<WithdrawalRequestTokenInstance>("WithdrawalRequestToken")

  return {
    seniorPool,
    seniorPoolCaller,
    seniorPoolFixedStrategy,
    usdc,
    fidu,
    fiduUSDCCurveLP,
    goldfinchConfig,
    goldfinchFactory,
    poolTokens,
    tranchedPool,
    gfi,
    stakingRewards,
    communityRewards,
    merkleDistributor,
    merkleDirectDistributor,
    uniqueIdentity,
    go,
    backerRewards,
    zapper,
    reserveSplitter,
    membershipCollector,
    withdrawalRequestToken,
  }
}

async function erc721Approve(erc721: any, accountToApprove: string, tokenId: BN, fromAccounts: (string | undefined)[]) {
  for (const fromAccount of fromAccounts) {
    await erc721.approve(accountToApprove, tokenId, {from: fromAccount})
  }
}

async function erc20Approve(erc20: any, accountToApprove: string, amount: BN, fromAccounts: (string | undefined)[]) {
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

export type Numberish = BN | string | number
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

async function mineBlock(): Promise<void> {
  await ethers.provider.send("evm_mine", [])
}

async function advanceAndMineBlock({
  days,
  seconds,
  toSecond,
}: {
  days?: Numberish
  seconds?: Numberish
  toSecond?: Numberish
}): Promise<void> {
  await advanceTime({days, seconds, toSecond})
  await mineBlock()
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

export async function getTranchedPoolAndCreditLine(poolAddress: string, clAddress: string) {
  const tranchedPool = await getTruffleContract<TranchedPoolInstance>("TranchedPool", {at: poolAddress})
  const creditLine = await getTruffleContract<CreditLineInstance>("CreditLine", {at: clAddress})
  return {tranchedPool, creditLine}
}

const getDefaultMonthlySchedule = async (goldfinchConfig: GoldfinchConfigInstance) => {
  return getMonthlySchedule(goldfinchConfig, "12", "1", "12", "0")
}

const getMonthlySchedule = async (
  goldfinchConfig: GoldfinchConfigInstance,
  periodsInTerm: Numberish,
  periodsPerInterestPeriod: Numberish,
  periodsPerPrincipalPeriod: Numberish,
  gracePrincipalPeriods: Numberish
) => {
  const scheduleRepoAddress = await goldfinchConfig.getAddress(CONFIG_KEYS_BY_TYPE.addresses.MonthlyScheduleRepo)
  const scheduleRepo = await getTruffleContractAtAddress<MonthlyScheduleRepoInstance>(
    "MonthlyScheduleRepo",
    scheduleRepoAddress
  )
  await scheduleRepo.createSchedule(
    periodsInTerm,
    periodsPerPrincipalPeriod,
    periodsPerInterestPeriod,
    gracePrincipalPeriods
  )
  return await scheduleRepo.getSchedule(
    periodsInTerm,
    periodsPerPrincipalPeriod,
    periodsPerInterestPeriod,
    gracePrincipalPeriods
  )
}

const createPoolWithCreditLine = async ({
  people,
  usdc,
  juniorFeePercent = new BN("20"),
  interestApr = interestAprAsBN("15.0"),
  limit = usdcVal(10000),
  lateFeeApr = interestAprAsBN("3.0"),
  fundableAt = new BN(0),
  allowedUIDTypes = [0],
}: {
  people: {owner: string; borrower: string}
  usdc: ERC20Instance
  juniorFeePercent?: Numberish
  interestApr?: Numberish
  termInDays?: Numberish
  limit?: Numberish
  lateFeeApr?: Numberish
  principalGracePeriodInDays?: Numberish
  fundableAt?: Numberish
  allowedUIDTypes?: Numberish[]
}): Promise<{tranchedPool: TranchedPoolInstance; creditLine: CreditLineInstance}> => {
  const thisOwner = people.owner
  const thisBorrower = people.borrower

  if (!thisBorrower) {
    throw new Error("No borrower is set. Set one in a beforeEach, or pass it in explicitly")
  }

  if (!thisOwner) {
    throw new Error("No owner is set. Please set one in a beforeEach or pass it in explicitly")
  }

  const goldfinchConfig = isMainnetForking()
    ? await getDeploymentFor<GoldfinchConfigInstance>("GoldfinchConfig")
    : await getDeploymentFor<TestGoldfinchConfigInstance>("TestGoldfinchConfig")

  const creditLineDeployment = await deployments.get("CreditLine")
  await goldfinchConfig.setCreditLineImplementation(creditLineDeployment.address)

  const goldfinchFactory = await getDeploymentFor<GoldfinchFactoryInstance>("GoldfinchFactory")
  const scheduleAddress = await getDefaultMonthlySchedule(goldfinchConfig)

  const result = await goldfinchFactory.createPool(
    thisBorrower,
    juniorFeePercent,
    limit,
    interestApr,
    scheduleAddress,
    lateFeeApr,
    fundableAt,
    allowedUIDTypes,
    {from: thisOwner}
  )

  const event = result.logs[result.logs.length - 1] as $TSFixMe
  const tranchedPool = await getTruffleContractAtAddress<TranchedPoolInstance>("TranchedPool", event.args.pool)
  const creditLine = await getTruffleContractAtAddress<CreditLineInstance>(
    "CreditLine",
    await tranchedPool.creditLine()
  )

  await erc20Approve(usdc, tranchedPool.address, usdcVal(100000), [thisOwner])

  // Only approve if borrower is an EOA (could be a borrower contract)
  if ((await web3.eth.getCode(thisBorrower)) === "0x") {
    await erc20Approve(usdc, tranchedPool.address, usdcVal(100000), [thisBorrower])
  }

  return {tranchedPool, creditLine}
}

async function toTruffle<T extends Truffle.ContractInstance = Truffle.ContractInstance>(
  address: Truffle.ContractInstance | BaseContract | string,
  contractName: string,
  opts?: {}
): Promise<T> {
  const truffleContract = await artifacts.require(contractName)
  address = typeof address === "string" ? address : address.address
  if (opts) {
    truffleContract.defaults(opts)
  }
  return truffleContract.at(address)
}

const genDifferentHexString = (hex: string): string => `${hex.slice(0, -1)}${hex[hex.length - 1] === "1" ? "2" : "1"}`

async function toEthers<T>(truffleContract: Truffle.ContractInstance): Promise<T> {
  return (await ethers.getContractAt(truffleContract.abi, truffleContract.address)) as unknown as T
}

async function fundWithEthFromLocalWhale(userToFund: string, amount: BN) {
  const [protocol_owner] = await ethers.getSigners()
  assertNonNullable(protocol_owner)
  await protocol_owner.sendTransaction({
    to: userToFund,
    value: ethers.utils.parseEther(amount.toString()),
  })
}

export function expectProxyOwner({toBe, forContracts}: {toBe: () => Promise<string>; forContracts: string[]}) {
  describe("proxy owners", async () => {
    forContracts.forEach((contractName) => {
      it(`sets the correct proxy owner for ${contractName}`, async () => {
        const proxyDeployment = await hardhat.deployments.get(`${contractName}_Proxy`)
        const proxyContract = await ethers.getContractAt(proxyDeployment.abi, proxyDeployment.address)
        expect(await proxyContract.owner()).to.eq(await toBe())
      })
    })
  })
}

export type RoleExpectation = {contractName: string; roles: string[]; address: () => Promise<string>}
export function expectRoles(expectations: RoleExpectation[]) {
  describe("roles", async () => {
    for (const {contractName, roles, address} of expectations) {
      for (const role of roles) {
        it(`assigns the ${role} role`, async () => {
          const addr = await address()
          const deployment = await hardhat.deployments.get(contractName)
          const contract = await ethers.getContractAt(deployment.abi, deployment.address)

          expect(await contract.hasRole(role, addr)).to.be.true
        })
      }
    }
  })
}

export function expectOwnerRole({toBe, forContracts}: {toBe: () => Promise<string>; forContracts: string[]}) {
  const expectations: RoleExpectation[] = forContracts.map((contract) => ({
    contractName: contract,
    roles: [OWNER_ROLE],
    address: toBe,
  }))
  expectRoles(expectations)
}

/**
 * Mine multiple transactions in the same block, returning the receipts
 *
 * NOTE (READ!!!): if your transactions are timing out, and you're passing many
 *                  the reason is that most likely there isn't enough block space
 *                  given the transactions you're trying to mine. In the current
 *                  state of the code this will happen if there are more than 15
 *                  because we hardcode the gas limit.
 *
 * @param txs populated transactions to mine
 * @param timeout time(ms) to wait before throwing an error
 * @returns transactions receipts
 */
export async function mineInSameBlock(txs: PopulatedTransaction[], timeout = 5_000): Promise<ContractReceipt[]> {
  const numberOfTransactionsThatCanFitWithHardcodedGasLimit = 15
  if (txs.length > numberOfTransactionsThatCanFitWithHardcodedGasLimit) {
    throw new Error(
      `too many transcations! limit = ${numberOfTransactionsThatCanFitWithHardcodedGasLimit}, found = ${txs.length}`
    )
  }

  let handle

  const error = new Error(
    `Failed to mine transactions under ${timeout} ms. Is your tx using too much gas for one block?`
  )
  const rejectAfterTimeout = new Promise((_resolve, reject) => {
    handle = setTimeout(() => reject(error), timeout)
  })

  try {
    // disable automine so that the transactions all enter the mempool
    await ethers.provider.send("evm_setAutomine", [false])
    const receipts: ContractTransaction[] = []
    for (let tx of txs) {
      const signer = await ethers.getSigner(tx.from as string)

      // Ethers gas estimation is horrible, and calling ethers.provider.estimateGas is
      // _insanely_ slow. So instead we're giving each transaction a very comfortable gas
      // limit
      tx = {
        ...tx,
        gasLimit: BigNumber.from("2000000"),
      }

      const receipt = await signer.sendTransaction(tx)
      receipts.push(receipt)
    }
    await ethers.provider.send("evm_mine", [])
    const values = await Promise.race([Promise.all(receipts.map((tx) => tx.wait())), rejectAfterTimeout])
    clearTimeout(handle)
    return values as ContractReceipt[]
  } finally {
    // we need to make sure we turn auto mining back on in case of a failure
    // otherwise it'll make every transaction globally timeout
    await ethers.provider.send("evm_setAutomine", [true])
  }
}

export function amountLessProtocolFee(usdcAmount: BN) {
  return usdcAmount.mul(new BN(995)).div(new BN(1000))
}

export function protocolFee(usdcAmount: BN) {
  return usdcAmount.mul(new BN(5)).div(new BN(1000))
}

export function dbg<T>(x: T): T {
  console.trace(x)
  return x
}

// Some staked fidu holders that can be used in mainnet forking tests
export const stakedFiduHolders = [
  // ~452 FIDU
  {
    address: "0x4f59359C1010E47dAEaFab784dCfd13866DcB221",
    stakingRewardsTokenId: 2119,
  },
  // ~19k FIDU
  {
    address: "0x7AdC457434e8C57737AD2aCE768a863865f2AaBc",
    stakingRewardsTokenId: 2123,
  },
  // ~111 FIDU
  {
    address: "0x9Fdf83188afBCa0b4b41960337Fb83aA1F3eE28a",
    stakingRewardsTokenId: 2102,
  },
]

// Some active borrower/pool info that can be used in mainnet forking tests
export const borrowers = [
  {
    // nextDueTime is Oct 19th
    name: "Stratos",
    poolAddress: "0x00c27FC71b159a346e179b4A1608a0865e8A7470",
    poolToken: 613,
  },
  {
    // nextDueTime is Oct 23rd
    name: "Addem",
    poolAddress: "0x89d7C618a4EeF3065DA8ad684859a547548E6169",
    poolToken: 738,
  },
  {
    // nextDueTime is Nov 6th
    name: "Cauris",
    poolAddress: "0xc9BDd0D3B80CC6EfE79a82d850f44EC9B55387Ae",
    poolToken: 179,
  },
]

export {
  hardhat,
  chai,
  expect,
  decimals,
  USDC_DECIMALS,
  FIDU_DECIMALS,
  GFI_DECIMALS,
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
  HALF_CENT,
  HALF_DOLLAR,
  ZERO,
  bigVal,
  gfiVal,
  usdcVal,
  fiduVal,
  usdcFromShares,
  mochaEach,
  getBalance,
  getDeployedAsTruffleContract,
  getTruffleContractAtAddress,
  fiduToUSDC,
  usdcToFidu,
  getNumShares,
  expectAction,
  deployAllContracts,
  erc721Approve,
  erc20Approve,
  erc20Transfer,
  getCurrentTimestamp,
  advanceTime,
  mineBlock,
  advanceAndMineBlock,
  createPoolWithCreditLine,
  decodeLogs,
  getFirstLog,
  decodeAndGetFirstLog,
  getOnlyLog,
  toTruffle,
  genDifferentHexString,
  toEthers,
  fundWithEthFromLocalWhale,
  setupBackerRewards,
  getMonthlySchedule,
  getDefaultMonthlySchedule,
}
