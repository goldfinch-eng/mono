import {
  getProtocolOwner,
  getTruffleContract,
  interestAprAsBN,
  MAX_UINT,
  TRANCHES,
} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"
import {
  AccountantInstance,
  BorrowerInstance,
  CreditLineInstance,
  ERC20Instance,
  GoldfinchFactoryInstance,
  TestAccountantInstance,
  TranchedPoolInstance,
} from "@goldfinch-eng/protocol/typechain/truffle"
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
  usdcVal,
} from "../testHelpers"

type FixtureFuncWithOptions<T, O> = (hre: HardhatRuntimeEnvironment, options: O) => Promise<T>
export function createFixtureWithRequiredOptions<T, O>(func: FixtureFuncWithOptions<T, O>) {
  return deployments.createFixture(func as FixtureFunc<T, O>)
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

interface TranchedPoolOptions {
  borrower: string
  juniorFeePercent?: string | BN
  limit?: string | BN
  interestApr?: string | BN
  paymentPeriodInDays?: string | BN
  termInDays?: string | BN
  lateFeeApr?: string | BN
  principalGracePeriodInDays?: string | BN
  fundableAt?: string | BN
  allowedUIDTypes?: (string | BN | number)[]
  id: string
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
export const deployTranchedPoolWithGoldfinchFactoryFixture = createFixtureWithRequiredOptions(
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
      usdcAddress,
    }: TranchedPoolOptions & {usdcAddress: string}
  ) => {
    const {protocol_owner: owner} = await hre.getNamedAccounts()
    const usdc = await getTruffleContract("ERC20", {at: usdcAddress})
    const goldfinchFactoryDeployment = await deployments.get("GoldfinchFactory")
    const goldfinchFactory = await getTruffleContract<GoldfinchFactoryInstance>("GoldfinchFactory", {
      at: goldfinchFactoryDeployment.address,
    })
    const result = await goldfinchFactory.createPool(
      borrower,
      juniorFeePercent,
      limit,
      interestApr,
      paymentPeriodInDays,
      termInDays,
      lateFeeApr,
      principalGracePeriodInDays,
      fundableAt,
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

    return {tranchedPool, creditLine}
  }
)

/**
 * Deploy a tranched pool and borrower contracts for a given borrower address
 *
 * Note: this is a re-usable fixture that creates a cached snapshot, calling
 *        this function multiple times results in reverting the EVM unless
 *        different parameters are given.
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
 * @returns a newly created tranched pool, credit line, and borrower contract
 */
export const deployTranchedPoolAndBorrowerWithGoldfinchFactoryFixture = createFixtureWithRequiredOptions(
  async (
    hre,
    {
      borrower,
      usdcAddress,
      juniorFeePercent = new BN("20"),
      limit = usdcVal(10_000),
      interestApr = interestAprAsBN("15.0"),
      paymentPeriodInDays = new BN(30),
      termInDays = new BN(365),
      lateFeeApr = interestAprAsBN("3.0"),
      principalGracePeriodInDays = new BN(185),
      fundableAt = new BN(0),
      allowedUIDTypes = [0],
      id,
    }: TranchedPoolOptions & {usdcAddress: string}
  ) => {
    const {protocol_owner: owner} = await hre.getNamedAccounts()

    const goldfinchFactoryDeploy = await hre.deployments.get("GoldfinchFactory")
    const goldfinchFactory = await getTruffleContract<GoldfinchFactoryInstance>("GoldfinchFactory", {
      at: goldfinchFactoryDeploy.address,
    })

    const result = await goldfinchFactory.createBorrower(borrower, {from: owner})
    const event = result.logs[result.logs.length - 1] as $TSFixMe
    const borrowerContract = await getTruffleContract<BorrowerInstance>("Borrower", {at: event.args.borrower})

    const otherDeploys = await deployTranchedPoolWithGoldfinchFactoryFixture({
      usdcAddress: usdcAddress,
      borrower: borrowerContract.address,
      juniorFeePercent,
      limit,
      interestApr,
      paymentPeriodInDays,
      termInDays,
      lateFeeApr,
      principalGracePeriodInDays,
      fundableAt,
      allowedUIDTypes,
      id,
    })

    return {
      borrowerContract,
      ...otherDeploys,
    }
  }
)

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
    const goldfinchFactoryDeployment = await hre.deployments.get("GoldfinchFactory")
    const goldfinchFactory = await getTruffleContract<GoldfinchFactoryInstance>("GoldfinchFactory", {
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
    }: {
      usdcAddress: string
      borrower: string
      borrowerContractAddress: string
      seniorTrancheAmount?: BN
      juniorTrancheAmount?: BN
      id: string
    }
  ) => {
    const {protocol_owner: owner} = await hre.getNamedAccounts()
    assertNonNullable(owner)
    const {tranchedPool, creditLine} = await deployTranchedPoolWithGoldfinchFactoryFixture({
      borrower: borrowerContractAddress,
      usdcAddress,
      id,
    })

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
      tranchedPool,
      creditLine,
    }
  }
)
