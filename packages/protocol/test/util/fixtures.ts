import {getClContractName} from "@goldfinch-eng/protocol/blockchain_scripts/baseDeploy/deployClImplementation"
import {
  getProtocolOwner,
  getTruffleContract,
  interestAprAsBN,
  MAX_UINT,
  POOL_VERSION1,
  POOL_VERSION2,
  TRANCHES,
} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"
import {
  AccountantInstance,
  BorrowerInstance,
  CreditLineInstance,
  CreditLineV2Instance,
  ERC20Instance,
  GoldfinchFactoryInstance,
  TestAccountantInstance,
  TestGoldfinchConfigInstance,
  TestGoldfinchFactoryInstance,
  TestTranchedPoolInstance,
  TestTranchedPoolV2Instance,
  TranchedPoolImplementationRepositoryInstance,
  TranchedPoolInstance,
  TranchedPoolV2Instance,
} from "@goldfinch-eng/protocol/typechain/truffle"
import {TestCreditLineV2Instance} from "@goldfinch-eng/protocol/typechain/truffle/TestCreditLineV2"
import hre, {deployments, getNamedAccounts} from "hardhat"
import {FixtureFunc} from "hardhat-deploy/types"
import {HardhatRuntimeEnvironment} from "hardhat/types"
import {asNonNullable, assertNonNullable} from "packages/utils/src/type"
import {
  $TSFixMe,
  BN,
  deployAllContracts,
  DeployAllContractsOptions,
  erc20Approve,
  getDeployedAsTruffleContract,
  Numberish,
  usdcVal,
} from "../testHelpers"

type FixtureFuncWithOptions<T, O> = (hre: HardhatRuntimeEnvironment, options: O) => Promise<T>
export function createFixtureWithRequiredOptions<T, O>(func: FixtureFuncWithOptions<T, O>, id?: string) {
  return deployments.createFixture(func as FixtureFunc<T, O>, id)
}

/**
 * Deploy all contracts as a fixture
 *
 * Note: this is a re-usable fixture that creates a cached snapshot, calling
 *        this function multiple times results in reverting the EVM unless different parameters are given
 */
export const deployBaseFixture = deployments.createFixture(
  async ({deployments}, options?: DeployAllContractsOptions) => {
    const {gf_deployer: deployer} = await getNamedAccounts()
    assertNonNullable(deployer)
    const deployed = await deployAllContracts(deployments, options)

    await deployments.deploy("Accountant", {from: deployer})
    await deployments.deploy("TranchingLogic", {from: deployer})

    return deployed
  }
)

interface CreditLineParams {
  config: string
  owner: string
  borrower: string
  maxLimit: BN | string
  interestApr: BN | string
  paymentPeriodInDays: BN | string
  termInDays: BN | string
  lateFeeApr: BN | string
  principalGracePeriodInDays: BN | string
}

/**
 * Deploy a credit line without calling initialize
 *
 * Note: this is a re-usable fixture that creates a cached snapshot, calling
 *        this function multiple times results in reverting the EVM unless different parameters are given
 */
export const deployUninitializedCreditLineFixture = createFixtureWithRequiredOptions(
  async ({deployments, getNamedAccounts}) => {
    const {gf_deployer: deployer} = await getNamedAccounts()
    assertNonNullable(deployer)

    const accountantDeploy = await deployments.get("Accountant")

    await deployments.deploy("TestAccountant", {
      from: deployer,
      libraries: {["Accountant"]: accountantDeploy.address},
    })

    await deployments.deploy("CreditLine", {
      from: deployer,
      libraries: {["Accountant"]: accountantDeploy.address},
    })

    const creditLine = await getDeployedAsTruffleContract<CreditLineInstance>(deployments, "CreditLine")
    const testAccountant = await getDeployedAsTruffleContract<TestAccountantInstance>(deployments, "TestAccountant")
    const accountant = await getDeployedAsTruffleContract<AccountantInstance>(deployments, "Accountant")

    assertNonNullable(creditLine)
    assertNonNullable(testAccountant)
    assertNonNullable(accountant)

    return {
      creditLine,
      accountant,
      testAccountant,
    }
  }
)

/**
 * Deploy a credit line and call initialize on it
 *
 * Note: this is a re-usable fixture that creates a cached snapshot, calling
 *        this function multiple times results in reverting the EVM unless different parameters are given
 */
export const deployInitializedCreditLineFixture = createFixtureWithRequiredOptions(
  async (_hre, options: CreditLineParams) => {
    const {creditLine, ...others} = await deployUninitializedCreditLineFixture()
    assertNonNullable(options)
    const {
      config,
      owner,
      borrower,
      maxLimit,
      interestApr,
      paymentPeriodInDays,
      termInDays,
      lateFeeApr,
      principalGracePeriodInDays,
    } = options

    await creditLine.initialize(
      config,
      owner,
      borrower,
      maxLimit,
      interestApr,
      paymentPeriodInDays,
      termInDays,
      lateFeeApr,
      principalGracePeriodInDays
    )

    return {
      creditLine,
      ...others,
    }
  }
)

export interface TranchedPoolOptions {
  borrower: string
  juniorFeePercent?: Numberish
  limit?: Numberish
  interestApr?: Numberish
  paymentPeriodInDays?: Numberish
  termInDays?: Numberish
  lateFeeApr?: Numberish
  principalGracePeriodInDays?: Numberish
  fundableAt?: Numberish
  allowedUIDTypes?: Numberish[]
}

export async function getContractsFromPoolVersion(poolAddress: string, clAddress: string, version: string) {
  if (version === POOL_VERSION1) {
    // v1 contracts
    const tranchedPool = await getTruffleContract<TestTranchedPoolInstance>("TestTranchedPool", {at: poolAddress})
    const creditLine = await getTruffleContract<CreditLineInstance>("CreditLine", {at: clAddress})
    return {tranchedPool, creditLine}
  } else if (version === POOL_VERSION2) {
    // v2 contracts
    const tranchedPool = await getTruffleContract<TestTranchedPoolV2Instance>("TestTranchedPoolV2", {at: poolAddress})
    const creditLine = await getTruffleContract<TestCreditLineV2Instance>("TestCreditLineV2", {at: clAddress})
    return {tranchedPool, creditLine}
  } else {
    throw new Error(`Invalid TranchedPool ${version}`)
  }
}

/**
 * Deploy a tranched pool for a give borrower using the Goldfinch factory
 *
 * Note: this is a re-usable fixture that creates a cached snapshot, calling
 *        this function multiple times results in reverting the EVM unless different parameters are given
 *
 * @param hre hardhat runtime environment
 * @param params
 * @param params.borrower the user that will eb borrowing from the pool
 * @param params.juniorFeePercent the percentage of interest the junior tranche will have allocated
 * @param params.limt the credit limit
 * @param params.interestApr interest apr
 * @param params.paymentPeriodInDays number of days in a payment period
 * @param params.fundableAt when the pool will be fundable
 * @param params.allowedUIDTypes allowed UID types
 * @param params.usdcAddress address of usdc
 * @param params.id id of fixture, when a fixture function is called with the same `id`
 *            and the same parameters, it wil result in reverting the chain to
 *            the block the fixture was created in. If the this is done multiple
 *            times in the same test it can result in incorrect behavior. If you
 *            need to create two fixtures with the same parameters in the same
 *            test block, make sure they have different id fields.
 *
 * @returns a newly created tranched pool and credit line
 */
export const deployTranchedPoolWithGoldfinchFactoryFixture = (fixtureId?: string) =>
  createFixtureWithRequiredOptions(
    async (
      hre,
      {
        borrower,
        juniorFeePercent = new BN("20"),
        limit = usdcVal(10_000),
        interestApr = interestAprAsBN("15.0"),
        paymentPeriodInDays = new BN(30),
        termInDays = new BN(365),
        lateFeeApr = interestAprAsBN("3.0"),
        principalGracePeriodInDays = new BN(185),
        fundableAt = new BN(0),
        allowedUIDTypes = [0],
        version = POOL_VERSION1,
        usdcAddress,
      }: TranchedPoolOptions & {usdcAddress: string; version?: string}
    ) => {
      const {protocol_owner: owner} = await hre.getNamedAccounts()
      const usdc = await getTruffleContract("ERC20", {at: usdcAddress})
      const goldfinchFactoryDeployment = await deployments.get("TestGoldfinchFactory")
      const goldfinchFactory = await getTruffleContract<TestGoldfinchFactoryInstance>("TestGoldfinchFactory", {
        at: goldfinchFactoryDeployment.address,
      })

      // Set the credit line implementation to point to the correct version
      const goldfinchConfig = await getDeploymentFor<TestGoldfinchConfigInstance>("TestGoldfinchConfig")
      const creditLineContractName = getClContractName(version)
      const creditLineDeployment = await deployments.get(creditLineContractName)
      await goldfinchConfig.setCreditLineImplementation(creditLineDeployment.address)

      const result = await goldfinchFactory.createPoolForLineage(
        borrower,
        poolVersionToLineageId[version],
        [
          juniorFeePercent,
          limit,
          interestApr,
          paymentPeriodInDays,
          termInDays,
          lateFeeApr,
          principalGracePeriodInDays,
          fundableAt,
        ],
        allowedUIDTypes,
        {from: owner}
      )
      assertNonNullable(result.logs)
      const event = result.logs[result.logs.length - 1] as $TSFixMe
      const pool = await getTruffleContract<TranchedPoolInstance>("TranchedPool", {at: event.args.pool})
      const creditLine = await getTruffleContract<CreditLineInstance>("CreditLine", {at: await pool.creditLine()})
      const tranchedPool = await getTruffleContract<TranchedPoolInstance>("TestTranchedPool", {at: pool.address})

      expect(await pool.creditLine()).to.be.eq(creditLine.address)

      await erc20Approve(usdc, tranchedPool.address, MAX_UINT, [owner])

      // Only approve if borrower is an EOA (could be a borrower contract)
      if ((await web3.eth.getCode(borrower)) === "0x") {
        await erc20Approve(usdc, tranchedPool.address, MAX_UINT, [borrower])
      }

      // Return the addresses. It's up to the caller to cast to the type that corresponds to the
      // version
      return {poolAddress: tranchedPool.address, clAddress: creditLine.address}
    },
    fixtureId
  )

export const poolVersionToLineageId = {
  "0.1.0": "1",
  "1.0.0": "2",
}

type Input = {
  hre: HardhatRuntimeEnvironment
  options: TranchedPoolOptions
  usdcAddress: string
  version: [string, string, string]
  owner?: string
}

export async function getDeploymentFor<T extends Truffle.ContractInstance>(contractName: string) {
  const deployment = await deployments.get(contractName)
  return getTruffleContract<T>(contractName, {at: deployment.address})
}

/**
 * Deploy an tranched pool without calling `initialize` on it. This can also be thought of as an "invalid pool"
 */
export const deployUninitializedTranchedPoolFixture = deployments.createFixture(async (hre) => {
  const {protocol_owner: owner} = await hre.getNamedAccounts()
  assertNonNullable(owner)

  const accountant = await hre.deployments.get("Accountant")
  const tranchingLogic = await hre.deployments.get("TranchingLogic")
  const tranchedPoolResult = await hre.deployments.deploy("TranchedPool", {
    from: owner,
    libraries: {
      ["TranchingLogic"]: tranchingLogic.address,
      ["Accountant"]: accountant.address,
    },
  })
  const pool = await getTruffleContract<TranchedPoolInstance>("TranchedPool", {at: tranchedPoolResult.address})
  const tranchedPool = await getTruffleContract<TranchedPoolInstance>("TestTranchedPool", {
    at: pool.address,
  })

  return {
    tranchedPool,
  }
})

export const deployUninitializedV2TranchedPoolFixture = deployments.createFixture(async (hre) => {
  const {protocol_owner: owner} = await hre.getNamedAccounts()
  assertNonNullable(owner)

  const accountant = await hre.deployments.get("Accountant")
  const tranchingLogic = await hre.deployments.get("TranchingLogic")
  const tranchedPoolResult = await hre.deployments.deploy("TranchedPoolV2", {
    from: owner,
    libraries: {
      ["TranchingLogic"]: tranchingLogic.address,
      ["Accountant"]: accountant.address,
    },
  })
  const pool = await getTruffleContract<TranchedPoolV2Instance>("TranchedPoolV2", {at: tranchedPoolResult.address})
  const tranchedPool = await getTruffleContract<TranchedPoolV2Instance>("TestTranchedPoolV2", {
    at: pool.address,
  })

  return {
    tranchedPool,
  }
})

/**
 * Deploy a borrower contract for a given borrower
 *
 * Note: this is a re-usable fixture that creates a cached snapshot, calling
 *        this function multiple times results in reverting the EVM unless
 *        different parameters are given. The `id` parameter is provided
 *        as a simple way to do this. If you need multiple of this fixture
 *        in the same test, provide different `id` values for each fixture.
 *
 * @param hre hardhat runtime environment
 * @param params
 * @param params.borrower address of the borrower
 * @param usdcAddress address of usdc
 * @param params.id id of fixture, when a fixture function is called with the same `id`
 *            and the same parameters, it wil result in reverting the chain to
 *            the block the fixture was created in. If the this is done multiple
 *            times in the same test it can result in incorrect behavior. If you
 *            need to create two fixtures with the same parameters in the same
 *            test block, make sure they have different id fields.
 */
export const deployBorrowerWithGoldfinchFactoryFixture = createFixtureWithRequiredOptions(
  async (hre, {borrower, usdcAddress}: {borrower: string; usdcAddress: string; id: string}) => {
    const {protocol_owner: owner} = await hre.getNamedAccounts()
    assertNonNullable(owner)
    const goldfinchFactoryDeployment = await hre.deployments.get("TestGoldfinchFactory")
    const goldfinchFactory = await getTruffleContract<TestGoldfinchFactoryInstance>("TestGoldfinchFactory", {
      at: goldfinchFactoryDeployment.address,
    })
    const usdc = await getTruffleContract<ERC20Instance>("ERC20", {at: asNonNullable(usdcAddress)})

    const result = await goldfinchFactory.createBorrower(borrower, {from: owner})
    const event = result.logs[result.logs.length - 1] as $TSFixMe
    const borrowerContract = await getTruffleContract<BorrowerInstance>("Borrower", {at: event.args.borrower})
    await usdc.approve(borrowerContract.address, MAX_UINT, {from: borrower})

    return {borrowerContract}
  }
)

/**
 * Deploy a funded tranched pool for a given borrower
 *
 * Note: this is a re-usable fixture that creates a cached snapshot, calling
 *        this function multiple times results in reverting the EVM unless
 *        different parameters are given. The `id` parameter is provided
 *        as a simple way to do this. If you need multiple of this fixture
 *        in the same test, provide different `id` values for each fixture.
 *
 * @param hre hardhat runtime environment
 * @param params
 * @param juniorTrancheAmount amount of USDC to deposit into the junior tranche
 * @param seniorTrancheAmount amount of USDC to deposit into the senior tranche
 * @param usdcAddress address of USDC contract
 * @param borrower address of borrower
 * @param borrowerContractAddress address of borrower contract
 * @param params.id id of fixture, when a fixture function is called with the same `id`
 *            and the same parameters, it wil result in reverting the chain to
 *            the block the fixture was created in. If the this is done multiple
 *            times in the same test it can result in incorrect behavior. If you
 *            need to create two fixtures with the same parameters in the same
 *            test block, make sure they have different id fields.
 *
 * @returns a funded tranched pool and credit line
 */
export const deployFundedTranchedPool = createFixtureWithRequiredOptions(
  async (
    hre,
    {
      seniorTrancheAmount = usdcVal(8_000),
      juniorTrancheAmount = usdcVal(2_000),
      usdcAddress,
      borrower,
      borrowerContractAddress,
      id,
      version,
    }: {
      usdcAddress: string
      borrower: string
      borrowerContractAddress: string
      seniorTrancheAmount?: BN
      juniorTrancheAmount?: BN
      id: string
      version: string
    }
  ) => {
    const {protocol_owner: owner} = await hre.getNamedAccounts()
    assertNonNullable(owner)

    const {poolAddress, clAddress} = await deployTranchedPoolWithGoldfinchFactoryFixture(id)({
      borrower: borrowerContractAddress,
      usdcAddress,
      version,
    })

    // Instantiate a v1 contract to fund and deposit the pool (the implementation is not necessarily) a
    // v1 contract, but we assume all version have the grantRole, revokeRole, deposit, and lockPool functions
    const tranchedPool = await getTruffleContract<TranchedPoolInstance>("TranchedPool", {at: poolAddress})

    const borrowerContract = await getTruffleContract<BorrowerInstance>("Borrower", {at: borrowerContractAddress})
    const usdc = await getTruffleContract<ERC20Instance>("ERC20", {at: usdcAddress})

    await erc20Approve(usdc, tranchedPool.address, MAX_UINT, [owner])

    const seniorRole = await tranchedPool.SENIOR_ROLE()
    await tranchedPool.grantRole(seniorRole, owner)
    await tranchedPool.deposit(TRANCHES.Junior, juniorTrancheAmount)
    await borrowerContract.lockJuniorCapital(tranchedPool.address, {from: borrower})
    await tranchedPool.deposit(TRANCHES.Senior, seniorTrancheAmount)
    await borrowerContract.lockPool(tranchedPool.address, {from: borrower})
    await tranchedPool.revokeRole(seniorRole, owner) // clean up

    return {
      poolAddress,
      clAddress,
    }
  }
)
