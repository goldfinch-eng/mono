/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"
import hre, {deployments, getNamedAccounts} from "hardhat"
import {
  getProtocolOwner,
  getTruffleContract,
  getUSDCAddress,
  MAINNET_CHAIN_ID,
  MAX_UINT,
  OWNER_ROLE,
  SIGNER_ROLE,
  USDC_TO_GFI_MANTISSA,
  GFI_MANTISSA,
} from "packages/protocol/blockchain_scripts/deployHelpers"
import {assertIsString} from "packages/utils/src/type"

import {impersonateAccount} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/impersonateAccount"
import {TEST_TIMEOUT} from "../../../MainnetForking.test"
import {
  GoldfinchFactoryInstance,
  UniqueIdentityInstance,
  BackerRewardsInstance,
  CapitalLedgerInstance,
  ERC20Instance,
  GoInstance,
  ERC20SplitterInstance,
  FiduInstance,
  GFIInstance,
  GFILedgerInstance,
  GoldfinchConfigInstance,
  MembershipCollectorInstance,
  MembershipDirectorInstance,
  MembershipLedgerInstance,
  MembershipOrchestratorInstance,
  MembershipVaultInstance,
  PoolTokensInstance,
  RouterInstance,
  SeniorPoolInstance,
  StakingRewardsInstance,
  TranchedPoolInstance,
  AccessControlInstance,
  ContextInstance,
} from "@goldfinch-eng/protocol/typechain/truffle"
import {CONFIG_KEYS} from "@goldfinch-eng/protocol/blockchain_scripts/configKeys"
import {
  usdcVal,
  gfiVal,
  decodeAndGetFirstLog,
  getTruffleContractAtAddress,
  getNumShares,
  advanceTime,
  expectProxyOwner,
} from "../../../../testHelpers"
import BN from "bn.js"
import {
  MAINNET_GF_DEPLOYER,
  MAINNET_TRUSTED_SIGNER_ADDRESS,
  MAINNET_WARBLER_LABS_MULTISIG,
} from "@goldfinch-eng/protocol/blockchain_scripts/mainnetForkingHelpers"
import {
  setupPoolTokenPosition,
  setupStakedFiduPosition,
  setupAndDepositStakedFidu,
  setupAndDepositPoolToken,
  setupAndDepositGfi,
  DepositRequest,
  setupAndDepositMultiple,
  DepositType,
} from "@goldfinch-eng/protocol/test/util/membershipRewards"
import {GFIDeposit} from "@goldfinch-eng/protocol/typechain/truffle/contracts/protocol/core/membership/GFILedger"
import {CapitalERC721Deposit} from "@goldfinch-eng/protocol/typechain/truffle/contracts/interfaces/ICapitalLedger"
import bn from "bignumber.js"
import {routingIdOf} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers/routingIdOf"

const INITIALIZABLE_ERROR = "Initializable: contract is already initialized"
const EPOCH_LENGTH_IN_DAYS = 7

const MEMBERSHIP_SCORE_PRECISION_LOSS = GFI_MANTISSA.toString()

const bnSqrt = function sqrt(value: BN): BN {
  const stringRepOfSqrt = new bn(value.toString()).sqrt().toFixed().split(".")[0]!
  return new BN(stringRepOfSqrt)
}

const setupTest = deployments.createFixture(async () => {
  await deployments.fixture("baseDeploy", {keepExistingDeployments: true})

  const {gf_deployer} = await getNamedAccounts()
  const users = await hre.getUnnamedAccounts()

  assertIsString(gf_deployer)
  await fundWithWhales(["ETH"], [gf_deployer, MAINNET_TRUSTED_SIGNER_ADDRESS, ...users])
  await impersonateAccount(hre, await getProtocolOwner())
  await fundWithWhales(["USDC"], [await getProtocolOwner(), gf_deployer, MAINNET_TRUSTED_SIGNER_ADDRESS, ...users])
  await fundWithWhales(["GFI"], [await getProtocolOwner(), gf_deployer, MAINNET_TRUSTED_SIGNER_ADDRESS, ...users])

  const goldfinchConfig = await getTruffleContract<GoldfinchConfigInstance>("GoldfinchConfig")
  const go = await getTruffleContract<GoInstance>("Go")
  return {
    goldfinchConfig,
    go,
    accessControl: await getTruffleContract<AccessControlInstance>("contracts/cake/AccessControl.sol:AccessControl"),
    contextContract: await getTruffleContract<ContextInstance>("contracts/cake/Context.sol:Context"),
    erc20Splitter: await getTruffleContract<ERC20SplitterInstance>("ERC20Splitter"),
    goldfinchFactory: await getTruffleContract<GoldfinchFactoryInstance>("GoldfinchFactory"),
    usdcAddress: await goldfinchConfig.addresses(CONFIG_KEYS.USDC),
    usdc: await getTruffleContract<ERC20Instance>("ERC20", {at: getUSDCAddress(MAINNET_CHAIN_ID)}),
    poolTokens: await getTruffleContract<PoolTokensInstance>("PoolTokens"),
    backerRewards: await getTruffleContract<BackerRewardsInstance>("BackerRewards"),
    gfi: await getTruffleContract<GFIInstance>("GFI"),
    seniorPool: await getTruffleContract<SeniorPoolInstance>("SeniorPool"),
    stakingRewards: await getTruffleContract<StakingRewardsInstance>("StakingRewards"),
    fidu: await getTruffleContract<FiduInstance>("Fidu"),
    router: await getTruffleContract<RouterInstance>("Router"),
    uniqueIdentity: await getTruffleContract<UniqueIdentityInstance>("UniqueIdentity"),
    membershipOrchestrator: await getTruffleContract<MembershipOrchestratorInstance>("MembershipOrchestrator"),
    membershipDirector: await getTruffleContract<MembershipDirectorInstance>("MembershipDirector"),
    membershipVault: await getTruffleContract<MembershipVaultInstance>("MembershipVault"),
    capitalLedger: await getTruffleContract<CapitalLedgerInstance>("CapitalLedger"),
    gfiLedger: await getTruffleContract<GFILedgerInstance>("GFILedger"),
    legacyGoListGoldfinchConfig: await getTruffleContract<GoldfinchConfigInstance>("GoldfinchConfig", {
      at: await go.legacyGoList(),
    }),
    membershipLedger: await getTruffleContract<MembershipLedgerInstance>("MembershipLedger"),
    membershipCollector: await getTruffleContract<MembershipCollectorInstance>("MembershipCollector"),
    reserveSplitter: await getTruffleContract<ERC20SplitterInstance>("ERC20Splitter"),
    users,
  }
})

describe.skip("v2.8.0", async function () {
  let accessControl: AccessControlInstance

  let gfi: GFIInstance
  let poolTokens: PoolTokensInstance
  let usdc: ERC20Instance
  let seniorPool: SeniorPoolInstance
  let stakingRewards: StakingRewardsInstance
  let fidu: FiduInstance
  let erc20Splitter: ERC20SplitterInstance
  let capitalLedger: CapitalLedgerInstance
  let gfiLedger: GFILedgerInstance
  let go: GoInstance
  let goldfinchConfig: GoldfinchConfigInstance
  let legacyGoListGoldfinchConfig: GoldfinchConfigInstance
  let goldfinchFactory: GoldfinchFactoryInstance
  let membershipCollector: MembershipCollectorInstance
  let membershipDirector: MembershipDirectorInstance
  let membershipLedger: MembershipLedgerInstance
  let membershipOrchestrator: MembershipOrchestratorInstance
  let membershipVault: MembershipVaultInstance
  let uniqueIdentity: UniqueIdentityInstance
  let router: RouterInstance
  let protocolOwner: string
  let mainUser: string
  let signer: string
  let users: string[]

  let quickSetupStakedFiduPosition: (
    ownerAddress: string,
    usdcDepositAmount: BN
  ) => Promise<{stakedFiduTokenId: BN; amountOfStakedFidu: BN}>
  let quickSetupPoolTokenPosition: (
    borrowerAddress: string,
    ownerAddress: string,
    usdcDepositAmount: BN
  ) => Promise<{poolTokenId: BN; tranchedPoolAddress: string}>
  let quickSetupAndDepositGfi: (
    ownerAddress: string,
    gfiDepositAmount: BN
  ) => Promise<{positionId: BN; depositResult: Truffle.TransactionResponse<any>}>
  let quickSetupAndDepositStakedFidu: (
    ownerAddress: string,
    usdcDepositAmount: BN
  ) => Promise<{
    stakedFiduTokenId: BN
    amountOfStakedFidu: BN
    positionId: BN
    depositResult: Truffle.TransactionResponse<any>
  }>
  let quickSetupAndDepositPoolToken: (
    borrowerAddress: string,
    ownerAddress: string,
    usdcDepositAmount: BN
  ) => Promise<{
    poolTokenId: BN
    tranchedPoolAddress: string
    positionId: BN
    depositResult: Truffle.TransactionResponse<any>
  }>
  let quickSetupAndDepositMultiple: (
    ownerAddress: string,
    borrowerAddress: string,
    depositRequests: DepositRequest[]
  ) => Promise<
    {
      depositType: DepositType
      positionId: BN
      assetTokenId?: BN
      depositAmount?: BN
      depositResult: Truffle.TransactionResponse<any>
    }[]
  >
  this.timeout(TEST_TIMEOUT)

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({
      accessControl,
      usdc,
      poolTokens,
      gfi,
      poolTokens,
      seniorPool,
      stakingRewards,
      fidu,
      erc20Splitter,
      go,
      goldfinchConfig,
      goldfinchFactory,
      capitalLedger,
      gfiLedger,
      legacyGoListGoldfinchConfig,
      membershipCollector,
      membershipDirector,
      membershipLedger,
      membershipOrchestrator,
      membershipVault,
      uniqueIdentity,
      users,
      router,
    } = await setupTest())

    protocolOwner = await getProtocolOwner()
    mainUser = users[0]!

    const allSigners = await hre.ethers.getSigners()
    signer = await allSigners[0]!.getAddress()

    impersonateAccount(hre, MAINNET_WARBLER_LABS_MULTISIG)
    await uniqueIdentity.grantRole(SIGNER_ROLE, signer, {from: MAINNET_WARBLER_LABS_MULTISIG})
    quickSetupAndDepositMultiple = async (
      ownerAddress: string,
      borrowerAddress: string,
      depositRequests: DepositRequest[]
    ) => {
      return await setupAndDepositMultiple({
        depositRequests,
        borrowerAddress,
        ownerAddress,
        protocolOwner,
        signer,
        capitalLedger,
        go,
        goldfinchConfig,
        goldfinchFactory,
        membershipOrchestrator,
        poolTokens,
        uniqueIdentity,
        usdc,
        hre,
        gfi,
        gfiLedger,
        fidu,
        seniorPool,
        stakingRewards,
      })
    }
    quickSetupAndDepositGfi = async (ownerAddress: string, gfiDepositAmount: BN) => {
      return await setupAndDepositGfi({
        ownerAddress,
        gfiDepositAmount,
        gfi,
        gfiLedger,
        fidu,
        membershipOrchestrator,
      })
    }
    quickSetupAndDepositStakedFidu = async (ownerAddress: string, usdcDepositAmount: BN) => {
      return await setupAndDepositStakedFidu({
        ownerAddress,
        signer,
        usdcDepositAmount,
        capitalLedger,
        fidu,
        membershipOrchestrator,
        seniorPool,
        stakingRewards,
        uniqueIdentity,
        usdc,
        hre,
      })
    }
    quickSetupAndDepositPoolToken = async (borrowerAddress: string, ownerAddress: string, usdcDepositAmount: BN) => {
      return await setupAndDepositPoolToken({
        borrowerAddress,
        ownerAddress,
        protocolOwner,
        signer,
        usdcDepositAmount,
        capitalLedger,
        go,
        goldfinchConfig,
        goldfinchFactory,
        membershipOrchestrator,
        poolTokens,
        uniqueIdentity,
        usdc,
        hre,
      })
    }
    quickSetupStakedFiduPosition = async (ownerAddress: string, usdcDepositAmount: BN) => {
      return await setupStakedFiduPosition({
        ownerAddress,
        signer,
        usdcDepositAmount,
        fidu,
        seniorPool,
        stakingRewards,
        uniqueIdentity,
        usdc,
        hre,
      })
    }

    quickSetupPoolTokenPosition = async (borrowerAddress: string, ownerAddress: string, usdcDepositAmount: BN) => {
      return await setupPoolTokenPosition({
        borrowerAddress,
        ownerAddress,
        protocolOwner,
        signer,
        usdcDepositAmount,
        go,
        goldfinchConfig,
        goldfinchFactory,
        poolTokens,
        uniqueIdentity,
        usdc,
        hre,
      })
    }
  })

  expectProxyOwner({
    toBe: async () => getProtocolOwner(),
    forContracts: [
      "Go",
      "ERC20Splitter",
      "AccessControl",
      "Router",
      "Context",
      "MembershipOrchestrator",
      "MembershipVault",
      "CapitalLedger",
      "GFILedger",
      "MembershipLedger",
      "MembershipCollector",
    ],
  })

  it("should expose supportsInterface on MembershipVault", async () => {
    expect(await membershipVault.supportsInterface("0x80ac58cd")).to.be.true
    expect(await membershipVault.supportsInterface("0x780e9d63")).to.be.true
    expect(await membershipVault.supportsInterface("0x01ffc9a7")).to.be.true
    expect(await membershipVault.supportsInterface("0x00000000")).to.be.false
    expect(await membershipVault.supportsInterface("0x11111111")).to.be.false
  })

  context("External/public functions should be properly protected with AccessControl accessibility modifiers", () => {
    let randoUser
    let cakeSuperAdmin

    // Use "any" type for initializer to avoid having to define all the properties
    // Actually expect Truffle.ContractInstance with `initialize` function.
    const verifyInitialization = async (initializeArgs: Array<any>, contract: Truffle.ContractInstance | any) => {
      await expect(contract.initialize(...initializeArgs, {from: randoUser})).to.be.rejectedWith(INITIALIZABLE_ERROR)
      await expect(contract.initialize(...initializeArgs, {from: users[3]!})).to.be.rejectedWith(INITIALIZABLE_ERROR)

      await expect(contract.initialize(...initializeArgs, {from: users[3]!})).to.be.rejectedWith(INITIALIZABLE_ERROR)
      await expect(contract.initialize(...initializeArgs, {from: protocolOwner})).to.be.rejectedWith(
        INITIALIZABLE_ERROR
      )
    }

    beforeEach(async () => {
      randoUser = users[5]!
      cakeSuperAdmin = protocolOwner
    })

    context("AccessControl", () => {
      it("should allow only calling intialize once", async () => {
        await verifyInitialization([randoUser], accessControl)
      })
    })

    context("MembershipLedger", () => {
      it("should allow only Cake operators to call resetRewards and allocateAwardsTo", async () => {
        await expect(membershipLedger.resetRewards(users[4]!, {from: users[3]!})).to.be.rejectedWith("RequiresOperator")
        await expect(membershipLedger.resetRewards(users[4]!, {from: randoUser})).to.be.rejectedWith("RequiresOperator")

        await expect(membershipLedger.allocateRewardsTo(users[4]!, 100, {from: users[3]!})).to.be.rejectedWith(
          "RequiresOperator"
        )
        await expect(membershipLedger.allocateRewardsTo(users[4]!, 100, {from: randoUser})).to.be.rejectedWith(
          "RequiresOperator"
        )
      })

      it("should allow only a MembershipLedger admin to call setAlpha", async () => {
        await expect(membershipLedger.setAlpha(9, 18, {from: randoUser})).to.be.rejectedWith("RequiresAdmin")
        await expect(membershipLedger.setAlpha(9, 18, {from: users[3]!})).to.be.rejectedWith("RequiresAdmin")

        await expect(membershipLedger.setAlpha(9, 18, {from: users[3]!})).to.be.rejectedWith("RequiresAdmin")

        await accessControl.setAdmin(membershipLedger.address, cakeSuperAdmin, {from: protocolOwner})
        await membershipLedger.setAlpha(9, 18, {from: protocolOwner})
      })

      it("should not be able to call initialize a second time (no matter role)", async () => {
        await verifyInitialization([], membershipLedger)
      })
    })

    context("GfiLedger", () => {
      it("should allow only Cake operators to call deposit, withdraw(1) and withdraw(2)", async () => {
        await expect(gfiLedger.deposit(users[4]!, 100, {from: randoUser})).to.be.rejectedWith("RequiresOperator")
        await expect(gfiLedger.methods["withdraw(uint256)"](1, {from: randoUser})).to.be.rejectedWith(
          "RequiresOperator"
        )
        await expect(gfiLedger.methods["withdraw(uint256,uint256)"](1, 100, {from: randoUser})).to.be.rejectedWith(
          "RequiresOperator"
        )
        // Success cases are tested in deposit/withdraw integration tests.
      })
    })

    context("CapitalLedger", () => {
      it("should allow only Cake operators to call depositERC721 and withdraw", async () => {
        await expect(
          capitalLedger.depositERC721(users[4]!, poolTokens.address, 1, {from: randoUser})
        ).to.be.rejectedWith("RequiresOperator")
        await expect(capitalLedger.withdraw(1, {from: randoUser})).to.be.rejectedWith("RequiresOperator")
        // Success cases are tested in deposit/withdraw integration tests.
      })
    })

    context("MembershipCollector", () => {
      // NOTE: Membership Collector revert strings stopped being recognized in Hardhat as of last deploy.
      //       Latest
      //       The revert strings are recognized in Tenderly, see linked simulated transactions.
      it("should allow only Cake operators to call distributeFiduTo and finalizeEpochs", async () => {
        // Same test passes in Mainnet fork simulation.
        // https:dashboard.tenderly.co/goldfinch/goldfinch-protocol/simulator/f3d33728-a225-4318-ac4a-ce0afefd7909
        // await expect(membershipCollector.distributeFiduTo(randoUser, 10000, {from: randoUser})).to.be.rejectedWith(
        //   "RequiresOperator"
        // )
        await expect(membershipCollector.distributeFiduTo(randoUser, 10000, {from: randoUser})).to.be.rejected
        // Same test passes in Mainnet fork simulation.
        // https://dashboard.tenderly.co/goldfinch/goldfinch-protocol/simulator/934869c0-2fbd-4546-bf03-d4f612eaade6
        // await expect(membershipCollector.finalizeEpochs({from: randoUser})).to.be.rejectedWith("RequiresOperator")
        await expect(membershipCollector.finalizeEpochs({from: randoUser})).to.be.rejected
      })

      it("prevent non reserveSplitters from calling onReceive", async () => {
        // Same test passes in Mainnet fork simulation.
        // https://dashboard.tenderly.co/goldfinch/goldfinch-protocol/simulator/d994adef-55fd-4805-9576-4b4db0afc054
        // await expect(membershipCollector.onReceive(10000, {from: randoUser})).to.be.rejectedWith("InvalidReceiveCaller")
        await expect(membershipCollector.onReceive(10000, {from: randoUser})).to.be.rejected
      })
    })

    context("ERC20Splitter", () => {
      it("should allow only an ERC20Splitter admin to call replacePayees", async () => {
        await expect(
          erc20Splitter.replacePayees([randoUser, users[6]], [50, 50], {from: randoUser})
        ).to.be.rejectedWith("RequiresAdmin")
        impersonateAccount(hre, MAINNET_GF_DEPLOYER)
        await expect(
          erc20Splitter.replacePayees([randoUser, users[6]], [50, 50], {from: MAINNET_GF_DEPLOYER})
        ).to.be.rejectedWith("RequiresAdmin")
        await erc20Splitter.replacePayees([randoUser, users[6]], [50, 50], {from: protocolOwner})
      })
    })

    context("MembershipDirector", () => {
      it("should allow only Cake operators to call consumeHoldingsAdjustment and collectRewards", async () => {
        await expect(membershipDirector.consumeHoldingsAdjustment(randoUser, {from: randoUser})).to.be.rejectedWith(
          "RequiresOperator"
        )
        await expect(membershipDirector.collectRewards(randoUser, {from: randoUser})).to.be.rejectedWith(
          "RequiresOperator"
        )
      })
    })

    context("MembershipVault", () => {
      it("should allow only Cake operators to call adjustHoldings, and checkpoint", async () => {
        await expect(
          membershipVault.adjustHoldings(randoUser, new BN(100), new BN(100), {from: randoUser})
        ).to.be.rejectedWith("RequiresOperator")
        await expect(membershipVault.checkpoint(randoUser, {from: randoUser})).to.be.rejectedWith("RequiresOperator")
      })

      it("should not be able to call initialize a second time (no matter role)", async () => {
        await verifyInitialization([], membershipVault)
      })
    })
  })

  context("Reserve splitter & usdc inflows", () => {
    const applicablePoolAddresses = [
      "0x89d7c618a4eef3065da8ad684859a547548e6169",
      "0xefeb69edf6b6999b0e3f2fa856a2acf3bdea4ab5",
      "0xaa2ccc5547f64c5dffd0a624eb4af2543a67ba65",
      "0xc9bdd0d3b80cc6efe79a82d850f44ec9b55387ae",
      "0xe6c30756136e07eb5268c3232efbfbe645c1ba5a",
      "0x1d596d28a7923a22aa013b0e7082bba23daa656b",
      "0x418749e294cabce5a714efccc22a8aade6f9db57",
      "0x00c27fc71b159a346e179b4a1608a0865e8a7470",
      "0xd09a57127bc40d680be7cb061c2a6629fe71abef",
      "0xb26b42dd5771689d0a7faeea32825ff9710b9c11",
      "0x759f097f3153f5d62ff1c2d82ba78b6350f223e3",
    ]
    const usdcPaymentVal = usdcVal(100)
    let expectCorrectDistributions: () => Promise<void>

    beforeEach(async () => {
      for (const poolAddress of applicablePoolAddresses) {
        const tranchedPool = await getTruffleContractAtAddress<TranchedPoolInstance>("TranchedPool", poolAddress)
        await usdc.approve(poolAddress, usdcPaymentVal, {from: mainUser})
        await tranchedPool.methods["pay(uint256)"](usdcPaymentVal, {from: mainUser})
      }
      expectCorrectDistributions = async () => {
        const originalErc20SplitterBalance = await usdc.balanceOf(erc20Splitter.address)
        const halfSplitterBalance = originalErc20SplitterBalance.div(new BN(2))
        const originalMembershipCollectorUsdcBalance = await usdc.balanceOf(membershipCollector.address)

        const originalMembershipCollectorFiduBalance = await fidu.balanceOf(membershipCollector.address)
        const fiduEquivalentOfMembershipCollectorTotal = originalMembershipCollectorFiduBalance.add(
          getNumShares(originalMembershipCollectorUsdcBalance.add(halfSplitterBalance), await seniorPool.sharePrice())
        )
        const originalProtocolOwnerBalance = await usdc.balanceOf(protocolOwner)

        await erc20Splitter.distribute()
        expect(await usdc.balanceOf(erc20Splitter.address)).to.bignumber.closeTo(new BN(0), usdcVal(1))
        expect(await usdc.balanceOf(membershipCollector.address)).to.bignumber.equal(new BN(0))
        expect(await fidu.balanceOf(membershipCollector.address)).to.bignumber.equal(
          fiduEquivalentOfMembershipCollectorTotal
        )
        expect(await usdc.balanceOf(protocolOwner)).to.bignumber.equal(
          originalProtocolOwnerBalance.add(halfSplitterBalance)
        )
      }
    })

    it("distributed funds during migration", async () => {
      const firstRewardEpoch = 2760
      const lastFinalizedEpoch = await membershipCollector.lastFinalizedEpoch()

      expect(lastFinalizedEpoch.gte(new BN(firstRewardEpoch - 1))).to.be.true
    })

    it("properly accounts for inflows from TranchedPool#pay", async () => {
      // NOTE: #pay is called in beforeEach
      await expectCorrectDistributions()
    })

    it("properly accounts for inflows from TranchedPool#emergencyShutdown", async () => {
      for (const poolAddress of applicablePoolAddresses) {
        const tranchedPool = await getTruffleContractAtAddress<TranchedPoolInstance>("TranchedPool", poolAddress)
        const poolOwnerAdmin = await tranchedPool.getRoleMember(OWNER_ROLE, 0)
        await impersonateAccount(hre, poolOwnerAdmin)
        await tranchedPool.emergencyShutdown({from: poolOwnerAdmin})
      }
      await expectCorrectDistributions()
    })

    it("properly accounts for inflows from TranchedPool#assess", async () => {
      await advanceTime({days: 365})
      for (const poolAddress of applicablePoolAddresses) {
        const tranchedPool = await getTruffleContractAtAddress<TranchedPoolInstance>("TranchedPool", poolAddress)
        await tranchedPool.assess()
      }
      await expectCorrectDistributions()
    })

    it("properly accounts for inflows from seniorPool#withdraw", async () => {
      for (const userAddress of users) {
        await usdc.approve(seniorPool.address, usdcPaymentVal, {from: userAddress})
        await legacyGoListGoldfinchConfig.addToGoList(userAddress, {from: protocolOwner})
        await seniorPool.deposit(usdcPaymentVal, {from: userAddress})
        await seniorPool.withdraw(usdcPaymentVal, {from: userAddress})
      }
      await expectCorrectDistributions()
    })

    it("properly accounts for inflows from seniorPool#withdrawInFidu", async () => {
      const fiduEquivalentPaymentVal = getNumShares(usdcPaymentVal, await seniorPool.sharePrice())
      for (const userAddress of users) {
        await usdc.approve(seniorPool.address, usdcPaymentVal, {from: userAddress})
        await legacyGoListGoldfinchConfig.addToGoList(userAddress, {from: protocolOwner})
        await seniorPool.deposit(usdcPaymentVal, {from: userAddress})
        await seniorPool.withdrawInFidu(fiduEquivalentPaymentVal, {from: userAddress})
      }
      await expectCorrectDistributions()
    })
  })

  context("Asset deposit", async () => {
    it("should allow depositing a single GFI position", async () => {
      const originalUserGfiBalance = await gfi.balanceOf(mainUser)
      const originalLedgerGfiBalance = await gfi.balanceOf(gfiLedger.address)
      const gfiAmount = gfiVal(10000)
      const {depositResult} = await quickSetupAndDepositGfi(mainUser, gfiAmount)
      const gfiHeldByOwner = await membershipOrchestrator.totalGFIHeldBy(mainUser)
      const event = decodeAndGetFirstLog<GFIDeposit>(depositResult.receipt.rawLogs, gfiLedger, "GFIDeposit")
      expect(event.args.amount).to.bignumber.to.eq(gfiAmount)
      expect(event.args.owner).to.eq(mainUser)

      expect(gfiHeldByOwner[0].toString()).to.equal("0")
      expect(gfiHeldByOwner[1].toString()).to.equal(gfiAmount.toString())

      expect(await gfi.balanceOf(mainUser)).to.bignumber.closeTo(originalUserGfiBalance.sub(gfiAmount), new BN(1))
      expect(await gfi.balanceOf(gfiLedger.address)).to.bignumber.closeTo(
        originalLedgerGfiBalance.add(gfiAmount),
        new BN(1)
      )
    })

    it("should allow depositing multiple GFI positions", async () => {
      const originalUserGfiBalance = await gfi.balanceOf(mainUser)
      const originalLedgerGfiBalance = await gfi.balanceOf(gfiLedger.address)
      const gfiAmount = gfiVal(10000)
      const {depositResult: depositResult1} = await quickSetupAndDepositGfi(mainUser, gfiAmount.div(new BN(2)))
      const {depositResult: depositResult2} = await quickSetupAndDepositGfi(mainUser, gfiAmount.div(new BN(2)))

      const gfiHeldByOwner = await membershipOrchestrator.totalGFIHeldBy(mainUser)
      const event1 = decodeAndGetFirstLog<GFIDeposit>(depositResult1.receipt.rawLogs, gfiLedger, "GFIDeposit")
      const event2 = decodeAndGetFirstLog<GFIDeposit>(depositResult2.receipt.rawLogs, gfiLedger, "GFIDeposit")

      expect(event1.args.amount).to.bignumber.to.eq(gfiAmount.div(new BN(2)))
      expect(event1.args.owner).to.eq(mainUser)

      expect(event2.args.amount).to.bignumber.to.eq(gfiAmount.div(new BN(2)))
      expect(event2.args.owner).to.eq(mainUser)

      expect(gfiHeldByOwner[0].toString()).to.equal("0")
      expect(gfiHeldByOwner[1].toString()).to.equal(gfiAmount.toString())

      expect(await gfi.balanceOf(mainUser)).to.bignumber.closeTo(originalUserGfiBalance.sub(gfiAmount), new BN(1))
      expect(await gfi.balanceOf(gfiLedger.address)).to.bignumber.closeTo(
        originalLedgerGfiBalance.add(gfiAmount),
        new BN(1)
      )
    })

    it("should throw when attempting to deposit more GFI than is available", async () => {
      const tooMuchGfi = (await gfi.balanceOf(mainUser)).mul(new BN(2))
      await gfi.approve(membershipOrchestrator.address, tooMuchGfi, {from: mainUser})
      await expect(
        membershipOrchestrator.deposit({gfi: String(tooMuchGfi), capitalDeposits: []}, {from: mainUser})
      ).to.be.rejectedWith("ERC20: transfer amount exceeds balance")
    })

    it("should allow depositing StakedFidu", async () => {
      const usdcDepositAmount = usdcVal(1000)
      const {stakedFiduTokenId} = await quickSetupStakedFiduPosition(mainUser, usdcDepositAmount)
      await stakingRewards.approve(membershipOrchestrator.address, stakedFiduTokenId, {from: mainUser})
      const depositResult = await membershipOrchestrator.deposit(
        {
          gfi: "0",
          capitalDeposits: [{assetAddress: stakingRewards.address, id: String(stakedFiduTokenId)}],
        },
        {from: mainUser}
      )
      const depositEvent = decodeAndGetFirstLog<CapitalERC721Deposit>(
        depositResult.receipt.rawLogs,
        capitalLedger,
        "CapitalERC721Deposit"
      )

      const {0: eligibleCapitalAmount, 1: totalCapitalAmount} = await membershipOrchestrator.totalCapitalHeldBy(
        mainUser
      )

      expect(depositEvent.args.assetAddress).to.to.eq(stakingRewards.address)
      expect(depositEvent.args.assetTokenId).to.bignumber.to.eq(stakedFiduTokenId)
      expect(depositEvent.args.owner).to.eq(mainUser)

      expect(eligibleCapitalAmount.toString()).to.equal("0")
      expect(totalCapitalAmount).to.bignumber.closeTo(usdcDepositAmount, new BN(1))

      expect(await stakingRewards.ownerOf(stakedFiduTokenId)).to.eq(capitalLedger.address)
    })

    it("should allow depositing multiple StakedFidu positions", async () => {
      const usdcDepositAmount = usdcVal(1000)
      const {stakedFiduTokenId} = await quickSetupStakedFiduPosition(mainUser, usdcDepositAmount)
      await stakingRewards.approve(membershipOrchestrator.address, stakedFiduTokenId, {from: mainUser})
      const depositResult = await membershipOrchestrator.deposit(
        {
          gfi: "0",
          capitalDeposits: [{assetAddress: stakingRewards.address, id: String(stakedFiduTokenId)}],
        },
        {from: mainUser}
      )
      const depositEvent = decodeAndGetFirstLog<CapitalERC721Deposit>(
        depositResult.receipt.rawLogs,
        capitalLedger,
        "CapitalERC721Deposit"
      )

      const {0: eligibleCapitalAmount, 1: totalCapitalAmount} = await membershipOrchestrator.totalCapitalHeldBy(
        mainUser
      )

      expect(depositEvent.args.assetAddress).to.to.eq(stakingRewards.address)
      expect(depositEvent.args.assetTokenId).to.bignumber.to.eq(stakedFiduTokenId)
      expect(depositEvent.args.owner).to.eq(mainUser)

      expect(eligibleCapitalAmount.toString()).to.equal("0")
      expect(totalCapitalAmount).to.bignumber.closeTo(usdcDepositAmount, new BN(1))

      expect(await stakingRewards.ownerOf(stakedFiduTokenId)).to.eq(capitalLedger.address)
    })

    it("should allow depositing PoolTokens", async () => {
      const usdcDepositAmount = usdcVal(100000)
      const {poolTokenId} = await quickSetupPoolTokenPosition(users[1]!, mainUser, usdcDepositAmount)

      await poolTokens.approve(membershipOrchestrator.address, poolTokenId, {from: mainUser})
      const depositResult = await membershipOrchestrator.deposit(
        {gfi: "0", capitalDeposits: [{assetAddress: poolTokens.address, id: String(poolTokenId)}]},
        {
          from: mainUser,
        }
      )
      const depositEvent = decodeAndGetFirstLog<CapitalERC721Deposit>(
        depositResult.receipt.rawLogs,
        capitalLedger,
        "CapitalERC721Deposit"
      )

      const {0: eligibleCapitalAmount, 1: totalCapitalAmount} = await membershipOrchestrator.totalCapitalHeldBy(
        mainUser
      )

      expect(depositEvent.args.assetAddress).to.to.eq(poolTokens.address)
      expect(depositEvent.args.assetTokenId).to.eq(poolTokenId)
      expect(depositEvent.args.owner).to.eq(mainUser)

      expect(eligibleCapitalAmount.toString()).to.equal("0")
      expect(totalCapitalAmount.toString()).to.equal(String(usdcDepositAmount))

      expect(await poolTokens.ownerOf(poolTokenId)).to.eq(capitalLedger.address)
    })

    it("should allow depositing a sequence of assets and gfi", async () => {
      const originalUserGfiBalance = await gfi.balanceOf(mainUser)
      const originalLedgerGfiBalance = await gfi.balanceOf(gfiLedger.address)

      // Deposit GFI
      const gfiAmount = gfiVal(100000)
      await gfi.approve(membershipOrchestrator.address, String(gfiAmount), {from: mainUser})
      await membershipOrchestrator.deposit({gfi: String(gfiAmount), capitalDeposits: []}, {from: mainUser})

      const gfiHeldByOwner = await membershipOrchestrator.totalGFIHeldBy(mainUser)

      expect(gfiHeldByOwner[0].toString()).to.equal("0")
      expect(gfiHeldByOwner[1].toString()).to.equal(gfiAmount.toString())

      expect(await gfi.balanceOf(mainUser)).to.bignumber.closeTo(originalUserGfiBalance.sub(gfiAmount), new BN(1))
      expect(await gfi.balanceOf(gfiLedger.address)).to.bignumber.closeTo(
        originalLedgerGfiBalance.add(gfiAmount),
        new BN(1)
      )

      // Deposit StakedFidu
      const stakedFiduUsdcDepositAmount = usdcVal(1000)
      const {stakedFiduTokenId} = await quickSetupStakedFiduPosition(mainUser, stakedFiduUsdcDepositAmount)
      await stakingRewards.approve(membershipOrchestrator.address, stakedFiduTokenId, {from: mainUser})
      await membershipOrchestrator.deposit(
        {gfi: "0", capitalDeposits: [{assetAddress: stakingRewards.address, id: String(stakedFiduTokenId)}]},
        {from: mainUser}
      )

      let {0: eligibleCapitalAmount, 1: totalCapitalAmount} = await membershipOrchestrator.totalCapitalHeldBy(mainUser)
      expect(eligibleCapitalAmount.toString()).to.equal("0")
      expect(totalCapitalAmount).to.bignumber.closeTo(stakedFiduUsdcDepositAmount, new BN(1))

      expect(await stakingRewards.ownerOf(stakedFiduTokenId)).to.eq(capitalLedger.address)

      // Deposit PoolToken
      const poolTokenUsdcDepositAmount = usdcVal(100000)
      const {poolTokenId} = await quickSetupPoolTokenPosition(users[1]!, mainUser, poolTokenUsdcDepositAmount)

      await poolTokens.approve(membershipOrchestrator.address, poolTokenId, {from: mainUser})
      await membershipOrchestrator.deposit(
        {gfi: "0", capitalDeposits: [{assetAddress: poolTokens.address, id: String(poolTokenId)}]},
        {from: mainUser}
      )

      expect(await poolTokens.ownerOf(poolTokenId)).to.eq(capitalLedger.address)

      const updatedCapitalAmounts = await membershipOrchestrator.totalCapitalHeldBy(mainUser)
      eligibleCapitalAmount = updatedCapitalAmounts[0]
      totalCapitalAmount = updatedCapitalAmounts[1]
      expect(eligibleCapitalAmount.toString()).to.equal("0")
      expect(totalCapitalAmount).to.bignumber.closeTo(
        poolTokenUsdcDepositAmount.add(stakedFiduUsdcDepositAmount),
        // Margin of error should be numDeposits * 1 (atomic unit of USDC)
        new BN(2)
      )
    })

    it("should throw when attempting to deposit unowned Staked Fidu", async () => {
      const usdcDepositAmount = usdcVal(100000)
      const {stakedFiduTokenId} = await setupStakedFiduPosition({
        ownerAddress: mainUser,
        signer,
        usdcDepositAmount,
        fidu,
        seniorPool,
        stakingRewards,
        uniqueIdentity,
        usdc,
        hre,
      })
      await stakingRewards.approve(membershipOrchestrator.address, stakedFiduTokenId, {from: mainUser})
      await expect(
        membershipOrchestrator.deposit(
          {gfi: "0", capitalDeposits: [{assetAddress: stakingRewards.address, id: String(stakedFiduTokenId)}]},
          {from: users[1]!}
        )
      ).to.be.rejectedWith("ERC721: transfer of token that is not own")
    })

    it("should throw when attempting to deposit unowned PoolTokens", async () => {
      const usdcDepositAmount = usdcVal(100000)
      const {poolTokenId} = await quickSetupPoolTokenPosition(users[2]!, mainUser, usdcDepositAmount)
      await poolTokens.approve(membershipOrchestrator.address, poolTokenId, {from: mainUser})
      await expect(
        membershipOrchestrator.deposit(
          {gfi: "0", capitalDeposits: [{assetAddress: poolTokens.address, id: String(poolTokenId)}]},
          {from: users[1]!}
        )
      ).to.be.rejectedWith("ERC721: transfer of token that is not own")
    })

    it("should allow depositing a combination of gfi and stakedFidu with deposit", async () => {
      const originalUserGfiBalance = await gfi.balanceOf(mainUser)
      const originalLedgerGfiBalance = await gfi.balanceOf(gfiLedger.address)

      const gfiAmount = gfiVal(100000)
      await gfi.approve(membershipOrchestrator.address, String(gfiAmount), {from: mainUser})

      const usdcDepositAmount = usdcVal(1000)
      const {stakedFiduTokenId} = await quickSetupStakedFiduPosition(mainUser, usdcDepositAmount)
      await stakingRewards.approve(membershipOrchestrator.address, stakedFiduTokenId, {from: mainUser})

      await membershipOrchestrator.deposit(
        {
          gfi: String(gfiAmount),
          capitalDeposits: [{assetAddress: stakingRewards.address, id: String(stakedFiduTokenId)}],
        },
        {from: mainUser}
      )

      const gfiHeldByOwner = await membershipOrchestrator.totalGFIHeldBy(mainUser)

      expect(gfiHeldByOwner[0].toString()).to.equal("0")
      expect(gfiHeldByOwner[1].toString()).to.equal(gfiAmount.toString())

      const {0: eligibleCapitalAmount, 1: totalCapitalAmount} = await membershipOrchestrator.totalCapitalHeldBy(
        mainUser
      )
      expect(eligibleCapitalAmount.toString()).to.equal("0")
      expect(totalCapitalAmount).to.bignumber.closeTo(usdcDepositAmount, new BN(1))

      expect(await stakingRewards.ownerOf(stakedFiduTokenId)).to.eq(capitalLedger.address)

      expect(await gfi.balanceOf(mainUser)).to.bignumber.closeTo(originalUserGfiBalance.sub(gfiAmount), new BN(1))
      expect(await gfi.balanceOf(gfiLedger.address)).to.bignumber.closeTo(
        originalLedgerGfiBalance.add(gfiAmount),
        new BN(1)
      )
    })

    it("should allow depositing a combination of GFI and poolTokens with deposit", async () => {
      const originalUserGfiBalance = await gfi.balanceOf(mainUser)
      const originalLedgerGfiBalance = await gfi.balanceOf(gfiLedger.address)

      const gfiAmount = gfiVal(100000)
      await gfi.approve(membershipOrchestrator.address, String(gfiAmount), {from: mainUser})

      const usdcDepositAmount = usdcVal(100000)
      const {poolTokenId} = await quickSetupPoolTokenPosition(users[1]!, mainUser, usdcDepositAmount)

      await poolTokens.approve(membershipOrchestrator.address, poolTokenId, {from: mainUser})
      await membershipOrchestrator.deposit(
        {
          gfi: String(gfiAmount),
          capitalDeposits: [{assetAddress: poolTokens.address, id: String(poolTokenId)}],
        },
        {from: mainUser}
      )

      const gfiHeldByOwner = await membershipOrchestrator.totalGFIHeldBy(mainUser)

      expect(gfiHeldByOwner[0].toString()).to.equal("0")
      expect(gfiHeldByOwner[1].toString()).to.equal(gfiAmount.toString())
      const {0: eligibleCapitalAmount, 1: totalCapitalAmount} = await membershipOrchestrator.totalCapitalHeldBy(
        mainUser
      )

      expect(eligibleCapitalAmount.toString()).to.equal("0")
      expect(totalCapitalAmount).to.bignumber.closeTo(usdcDepositAmount, new BN(1))

      expect(await poolTokens.ownerOf(poolTokenId)).to.eq(capitalLedger.address)

      expect(await gfi.balanceOf(mainUser)).to.bignumber.closeTo(originalUserGfiBalance.sub(gfiAmount), new BN(1))
      expect(await gfi.balanceOf(gfiLedger.address)).to.bignumber.closeTo(
        originalLedgerGfiBalance.add(gfiAmount),
        new BN(1)
      )
    })

    it("should allow depositing StakedFidu and PoolTokens with deposit", async () => {
      const stakedFiduUsdcDepositAmount = usdcVal(1000)
      const {stakedFiduTokenId} = await quickSetupStakedFiduPosition(mainUser, stakedFiduUsdcDepositAmount)

      await stakingRewards.approve(membershipOrchestrator.address, stakedFiduTokenId, {from: mainUser})

      const poolTokenUsdcDepositAmount = usdcVal(100000)
      const {poolTokenId} = await quickSetupPoolTokenPosition(users[1]!, mainUser, poolTokenUsdcDepositAmount)

      await poolTokens.approve(membershipOrchestrator.address, poolTokenId, {from: mainUser})

      await membershipOrchestrator.deposit(
        {
          gfi: "0",
          capitalDeposits: [
            {assetAddress: stakingRewards.address, id: String(stakedFiduTokenId)},
            {assetAddress: poolTokens.address, id: String(poolTokenId)},
          ],
        },
        {from: mainUser}
      )

      const gfiHeldByOwner = await membershipOrchestrator.totalGFIHeldBy(mainUser)

      expect(gfiHeldByOwner[0].toString()).to.equal("0")
      expect(gfiHeldByOwner[1].toString()).to.equal("0")

      const {0: eligibleCapitalAmount, 1: totalCapitalAmount} = await membershipOrchestrator.totalCapitalHeldBy(
        mainUser
      )
      expect(eligibleCapitalAmount.toString()).to.equal("0")
      expect(totalCapitalAmount).to.bignumber.closeTo(
        stakedFiduUsdcDepositAmount.add(poolTokenUsdcDepositAmount),
        // Margin of error should be numDeposits * 1 (atomic unit of USDC)
        new BN(2)
      )
    })

    it("should allow depositing StakedFidu, PoolTokens and GFI with deposit", async () => {
      const originalUserGfiBalance = await gfi.balanceOf(mainUser)
      const originalLedgerGfiBalance = await gfi.balanceOf(gfiLedger.address)

      const gfiAmount = gfiVal(100000)
      await gfi.approve(membershipOrchestrator.address, String(gfiAmount), {from: mainUser})

      const stakedFiduUsdcDepositAmount = usdcVal(1000)
      const {stakedFiduTokenId} = await quickSetupStakedFiduPosition(mainUser, stakedFiduUsdcDepositAmount)
      await stakingRewards.approve(membershipOrchestrator.address, stakedFiduTokenId, {from: mainUser})

      const poolTokenUsdcDepositAmount = usdcVal(100000)
      const {poolTokenId} = await quickSetupPoolTokenPosition(users[1]!, mainUser, poolTokenUsdcDepositAmount)
      await poolTokens.approve(membershipOrchestrator.address, poolTokenId, {from: mainUser})

      await membershipOrchestrator.deposit(
        {
          gfi: String(gfiAmount),
          capitalDeposits: [
            {assetAddress: stakingRewards.address, id: String(stakedFiduTokenId)},
            {assetAddress: poolTokens.address, id: String(poolTokenId)},
          ],
        },
        {from: mainUser}
      )

      const gfiHeldByOwner = await membershipOrchestrator.totalGFIHeldBy(mainUser)

      expect(gfiHeldByOwner[0].toString()).to.equal("0")
      expect(gfiHeldByOwner[1].toString()).to.equal(String(gfiAmount))

      const {0: eligibleCapitalAmount, 1: totalCapitalAmount} = await membershipOrchestrator.totalCapitalHeldBy(
        mainUser
      )
      expect(eligibleCapitalAmount.toString()).to.equal("0")
      expect(totalCapitalAmount).to.bignumber.closeTo(
        stakedFiduUsdcDepositAmount.add(poolTokenUsdcDepositAmount),
        new BN(1)
      )

      expect(await stakingRewards.ownerOf(stakedFiduTokenId)).to.eq(capitalLedger.address)
      expect(await poolTokens.ownerOf(poolTokenId)).to.eq(capitalLedger.address)

      expect(await gfi.balanceOf(mainUser)).to.bignumber.closeTo(originalUserGfiBalance.sub(gfiAmount), new BN(1))
      expect(await gfi.balanceOf(gfiLedger.address)).to.bignumber.closeTo(
        originalLedgerGfiBalance.add(gfiAmount),
        new BN(1)
      )
    })

    it("should allow depositing multiple StakedFidu, PoolTokens and GFI positions with deposit", async () => {
      const originalUserGfiBalance = await gfi.balanceOf(mainUser)
      const originalLedgerGfiBalance = await gfi.balanceOf(gfiLedger.address)

      const gfiAmount = gfiVal(100000)
      await gfi.approve(membershipOrchestrator.address, String(gfiAmount), {from: mainUser})

      const stakedFiduUsdcDepositAmount = usdcVal(1000)
      const {stakedFiduTokenId: stakedFiduTokenId1} = await quickSetupStakedFiduPosition(
        mainUser,
        stakedFiduUsdcDepositAmount
      )
      const {stakedFiduTokenId: stakedFiduTokenId2} = await quickSetupStakedFiduPosition(
        mainUser,
        stakedFiduUsdcDepositAmount
      )
      await stakingRewards.approve(membershipOrchestrator.address, stakedFiduTokenId1, {from: mainUser})
      await stakingRewards.approve(membershipOrchestrator.address, stakedFiduTokenId2, {from: mainUser})

      const poolTokenUsdcDepositAmount = usdcVal(1000)
      const {poolTokenId: poolTokenId1} = await quickSetupPoolTokenPosition(
        users[1]!,
        mainUser,
        poolTokenUsdcDepositAmount
      )
      const {poolTokenId: poolTokenId2} = await quickSetupPoolTokenPosition(
        users[1]!,
        mainUser,
        poolTokenUsdcDepositAmount
      )

      await poolTokens.approve(membershipOrchestrator.address, poolTokenId1, {from: mainUser})
      await poolTokens.approve(membershipOrchestrator.address, poolTokenId2, {from: mainUser})

      await membershipOrchestrator.deposit(
        {
          gfi: String(gfiAmount),
          capitalDeposits: [
            {assetAddress: stakingRewards.address, id: String(stakedFiduTokenId1)},
            {assetAddress: stakingRewards.address, id: String(stakedFiduTokenId2)},
            {assetAddress: poolTokens.address, id: String(poolTokenId1)},
            {assetAddress: poolTokens.address, id: String(poolTokenId2)},
          ],
        },
        {from: mainUser}
      )

      const gfiHeldByOwner = await membershipOrchestrator.totalGFIHeldBy(mainUser)

      expect(gfiHeldByOwner[0].toString()).to.equal("0")
      expect(gfiHeldByOwner[1].toString()).to.equal(String(gfiAmount))

      const {0: eligibleCapitalAmount, 1: totalCapitalAmount} = await membershipOrchestrator.totalCapitalHeldBy(
        mainUser
      )
      expect(eligibleCapitalAmount.toString()).to.equal("0")
      expect(totalCapitalAmount).to.bignumber.closeTo(
        stakedFiduUsdcDepositAmount.add(poolTokenUsdcDepositAmount).mul(new BN(2)),
        new BN(2)
      )

      expect(await stakingRewards.ownerOf(stakedFiduTokenId1)).to.eq(capitalLedger.address)
      expect(await stakingRewards.ownerOf(stakedFiduTokenId2)).to.eq(capitalLedger.address)
      expect(await poolTokens.ownerOf(poolTokenId1)).to.eq(capitalLedger.address)
      expect(await poolTokens.ownerOf(poolTokenId2)).to.eq(capitalLedger.address)

      expect(await gfi.balanceOf(mainUser)).to.bignumber.closeTo(originalUserGfiBalance.sub(gfiAmount), new BN(1))
      expect(await gfi.balanceOf(gfiLedger.address)).to.bignumber.closeTo(
        originalLedgerGfiBalance.add(gfiAmount),
        new BN(1)
      )
    })

    it("should prevent deposit if any of the specified assets are not owned in full by the msg sender", async () => {
      const otherUser = users[2]!
      const gfiAmount = gfiVal(100000)
      await gfi.approve(membershipOrchestrator.address, String(gfiAmount), {from: mainUser})

      const stakedFiduUsdcDepositAmount = usdcVal(1000)
      const {stakedFiduTokenId} = await quickSetupStakedFiduPosition(mainUser, stakedFiduUsdcDepositAmount)
      await stakingRewards.approve(membershipOrchestrator.address, stakedFiduTokenId, {from: mainUser})

      const {stakedFiduTokenId: otherUserStakedFiduTokenId} = await quickSetupStakedFiduPosition(
        otherUser,
        stakedFiduUsdcDepositAmount
      )
      await stakingRewards.approve(membershipOrchestrator.address, otherUserStakedFiduTokenId, {from: otherUser})

      const poolTokenUsdcDepositAmount = usdcVal(100000)
      const {poolTokenId} = await quickSetupPoolTokenPosition(users[1]!, mainUser, poolTokenUsdcDepositAmount)
      await poolTokens.approve(membershipOrchestrator.address, poolTokenId, {from: mainUser})

      const {poolTokenId: otherUserPoolTokenId} = await quickSetupPoolTokenPosition(
        users[1]!,
        otherUser,
        poolTokenUsdcDepositAmount
      )
      await poolTokens.approve(membershipOrchestrator.address, otherUserPoolTokenId, {from: otherUser})

      await stakingRewards.approve(membershipOrchestrator.address, stakedFiduTokenId, {from: mainUser})

      // Insufficient GFI
      await expect(
        membershipOrchestrator.deposit(
          {
            gfi: String((await gfi.balanceOf(mainUser)).mul(new BN(2))),
            capitalDeposits: [
              {assetAddress: stakingRewards.address, id: String(stakedFiduTokenId)},
              {assetAddress: poolTokens.address, id: String(poolTokenId)},
            ],
          },
          {from: mainUser}
        )
      ).to.be.rejectedWith("ERC20: transfer amount exceeds balance")

      // Unowned StakedFidu
      await expect(
        membershipOrchestrator.deposit(
          {
            gfi: String(gfiAmount),
            capitalDeposits: [
              {assetAddress: stakingRewards.address, id: String(otherUserStakedFiduTokenId)},
              {assetAddress: poolTokens.address, id: String(poolTokenId)},
            ],
          },
          {from: mainUser}
        )
      ).to.be.rejectedWith("ERC721: transfer of token that is not own")

      // Unowned PoolToken
      await expect(
        membershipOrchestrator.deposit(
          {
            gfi: String(gfiAmount),
            capitalDeposits: [
              {assetAddress: stakingRewards.address, id: String(stakedFiduTokenId)},
              {assetAddress: poolTokens.address, id: String(otherUserPoolTokenId)},
            ],
          },
          {from: mainUser}
        )
      ).to.be.rejectedWith("ERC721: transfer of token that is not own")
    })
  })

  context("Asset withdrawal", async () => {
    it("should prevent withdrawing a non-existent capital position", async () => {
      await expect(
        membershipOrchestrator.withdraw({gfiPositions: [], capitalPositions: [String(MAX_UINT)]}, {from: users[4]!})
      ).to.be.rejectedWith("MustWithdrawSomething")
    })

    it("should prevent withdrawing a non-existent GFI position", async () => {
      await expect(
        membershipOrchestrator.withdraw(
          {gfiPositions: [{id: String(MAX_UINT), amount: "1000"}], capitalPositions: []},
          {from: users[4]!}
        )
      ).to.be.rejectedWith("MustWithdrawSomething")
    })

    context("with a single PoolToken position", async () => {
      let positionId

      beforeEach(async () => {
        // eslint-disable-next-line @typescript-eslint/no-extra-semi
        ;({positionId} = await quickSetupAndDepositPoolToken(users[3]!, mainUser, usdcVal(1000)))
      })

      it("should prevent withdrawing a PoolToken position that is not yours", async () => {
        await expect(
          membershipOrchestrator.withdraw({gfiPositions: [], capitalPositions: [positionId]}, {from: users[4]!})
        ).to.be.rejectedWith("CannotWithdrawUnownedAsset")
      })
      it("should allow withdrawing a solitary PoolTokens position", async () => {
        await membershipOrchestrator.withdraw({gfiPositions: [], capitalPositions: [positionId]}, {from: mainUser})
      })
    })

    context("with a single StakedFidu position", async () => {
      let positionId
      const usdcDepositAmount = usdcVal(1000)
      beforeEach(async () => {
        // eslint-disable-next-line @typescript-eslint/no-extra-semi
        ;({positionId} = await quickSetupAndDepositStakedFidu(mainUser, usdcDepositAmount))
      })

      it("should prevent withdrawing a StakedFidu position that is not yours", async () => {
        await expect(
          membershipOrchestrator.withdraw({gfiPositions: [], capitalPositions: [positionId]}, {from: users[4]!})
        ).to.be.rejectedWith("CannotWithdrawUnownedAsset")
      })

      it("should allow withdrawing a solitary StakedFidu position", async () => {
        membershipOrchestrator.withdraw({gfiPositions: [], capitalPositions: [positionId]}, {from: mainUser})
        const {0: eligibleCapitalAmount, 1: totalCapitalAmount} = await membershipOrchestrator.totalCapitalHeldBy(
          mainUser
        )
        expect(eligibleCapitalAmount.toString()).to.equal("0")
        expect(totalCapitalAmount).to.bignumber.closeTo(usdcDepositAmount, new BN(1))
      })
    })

    context("with a single GFI position", async () => {
      let positionId
      const gfiDepositAmount = usdcVal(1000)
      beforeEach(async () => {
        // eslint-disable-next-line @typescript-eslint/no-extra-semi
        ;({positionId} = await quickSetupAndDepositGfi(mainUser, gfiDepositAmount))
      })

      it("should prevent withdrawing a GFI position that is not yours", async () => {
        await expect(
          membershipOrchestrator.withdraw(
            {gfiPositions: [{id: positionId, amount: String(gfiDepositAmount)}], capitalPositions: []},
            {from: users[4]!}
          )
        ).to.be.rejectedWith("CannotWithdrawUnownedAsset")
      })

      it("should allow withdrawing a solitary GFI position", async () => {
        const originalUserGfiBalance = await gfi.balanceOf(mainUser)
        const originalLedgerGfiBalance = await gfi.balanceOf(gfiLedger.address)

        await membershipOrchestrator.withdraw(
          {gfiPositions: [{id: positionId, amount: String(gfiDepositAmount)}], capitalPositions: []},
          {from: mainUser}
        )
        const {0: eligibleCapitalAmount, 1: totalCapitalAmount} = await membershipOrchestrator.totalCapitalHeldBy(
          mainUser
        )

        expect(eligibleCapitalAmount.toString()).to.equal("0")
        expect(totalCapitalAmount).to.bignumber.closeTo(new BN(0), new BN(1))

        expect(await gfi.balanceOf(mainUser)).to.bignumber.eq(originalUserGfiBalance.add(gfiDepositAmount))
        expect(await gfi.balanceOf(gfiLedger.address)).to.bignumber.eq(originalLedgerGfiBalance.sub(gfiDepositAmount))
      })
    })

    context("with many PoolToken positions", async () => {
      let poolTokenId1, poolTokenId2, poolTokenId3
      let poolTokenPositionId1, poolTokenPositionId2, poolTokenPositionId3
      const position1UsdcDepositAmount = usdcVal(1000)
      const position2UsdcDepositAmount = usdcVal(2000)
      const position3UsdcDepositAmount = usdcVal(10000)

      beforeEach(async () => {
        const depositResults = await quickSetupAndDepositMultiple(mainUser, users[4]!, [
          {depositType: DepositType.PoolToken, amount: position1UsdcDepositAmount},
          {depositType: DepositType.PoolToken, amount: position2UsdcDepositAmount},
          {depositType: DepositType.PoolToken, amount: position3UsdcDepositAmount},
        ])

        ;[poolTokenPositionId1, poolTokenPositionId2, poolTokenPositionId3] = depositResults.map(
          (result) => result.positionId!
        )
        ;[poolTokenId1, poolTokenId2, poolTokenId3] = depositResults.map((result) => result.assetTokenId!)
      })

      it("should allow withdrawing one of many PoolToken positions", async () => {
        const {1: preWithdrawalTotalCapitalAmount} = await membershipOrchestrator.totalCapitalHeldBy(mainUser)
        await expect(
          membershipOrchestrator.withdraw(
            {gfiPositions: [], capitalPositions: [poolTokenPositionId1]},
            {from: users[4]!}
          )
        ).to.be.rejectedWith("CannotWithdrawUnownedAsset")
        await membershipOrchestrator.withdraw(
          {gfiPositions: [], capitalPositions: [poolTokenPositionId1]},
          {from: mainUser}
        )
        const {0: eligibleCapitalAmount, 1: totalCapitalAmount} = await membershipOrchestrator.totalCapitalHeldBy(
          mainUser
        )
        expect(eligibleCapitalAmount.toString()).to.equal("0")
        expect(totalCapitalAmount).to.bignumber.closeTo(
          preWithdrawalTotalCapitalAmount.sub(position1UsdcDepositAmount),
          new BN(1)
        )

        expect(await poolTokens.ownerOf(poolTokenId1)).to.equal(mainUser)
        expect(await poolTokens.ownerOf(poolTokenId2)).to.equal(capitalLedger.address)
        expect(await poolTokens.ownerOf(poolTokenId3)).to.equal(capitalLedger.address)
      })

      it("should allow withdrawing many of many StakedFidu positions", async () => {
        await expect(
          membershipOrchestrator.withdraw(
            {gfiPositions: [], capitalPositions: [poolTokenPositionId1, poolTokenPositionId2, poolTokenPositionId3]},
            {from: users[4]!}
          )
        ).to.be.rejectedWith("CannotWithdrawUnownedAsset")
        await membershipOrchestrator.withdraw(
          {gfiPositions: [], capitalPositions: [poolTokenPositionId1, poolTokenPositionId2, poolTokenPositionId3]},
          {from: mainUser}
        )
        const {0: eligibleCapitalAmount, 1: totalCapitalAmount} = await membershipOrchestrator.totalCapitalHeldBy(
          mainUser
        )
        expect(eligibleCapitalAmount.toString()).to.equal("0")
        expect(totalCapitalAmount).to.bignumber.equal(new BN(0))

        expect(await poolTokens.ownerOf(poolTokenId1)).to.equal(mainUser)
        expect(await poolTokens.ownerOf(poolTokenId2)).to.equal(mainUser)
        expect(await poolTokens.ownerOf(poolTokenId3)).to.equal(mainUser)
      })
    })

    context("with many StakedFidu positions", async () => {
      let stakedFiduTokenId1, stakedFiduTokenId2, stakedFiduTokenId3
      let stakedFiduPositionId1, stakedFiduPositionId2, stakedFiduPositionId3
      const position1UsdcDepositAmount = usdcVal(1000)
      const position2UsdcDepositAmount = usdcVal(2000)
      const position3UsdcDepositAmount = usdcVal(5000)

      beforeEach(async () => {
        const depositResults = await quickSetupAndDepositMultiple(mainUser, users[4]!, [
          {depositType: DepositType.StakedFidu, amount: position1UsdcDepositAmount},
          {depositType: DepositType.StakedFidu, amount: position2UsdcDepositAmount},
          {depositType: DepositType.StakedFidu, amount: position3UsdcDepositAmount},
        ])

        ;[stakedFiduPositionId1, stakedFiduPositionId2, stakedFiduPositionId3] = depositResults.map(
          (depositResult) => depositResult.positionId
        )
        ;[stakedFiduTokenId1, stakedFiduTokenId2, stakedFiduTokenId3] = depositResults.map(
          (depositResult) => depositResult.assetTokenId
        )
      })

      it("should allow withdrawing one of many StakedFidu positions", async () => {
        const {1: preWithdrawalTotalCapitalAmount} = await membershipOrchestrator.totalCapitalHeldBy(mainUser)
        await expect(
          membershipOrchestrator.withdraw(
            {gfiPositions: [], capitalPositions: [stakedFiduPositionId1]},
            {from: users[4]!}
          )
        ).to.be.rejectedWith("CannotWithdrawUnownedAsset")
        await membershipOrchestrator.withdraw(
          {gfiPositions: [], capitalPositions: [stakedFiduPositionId1]},
          {from: mainUser}
        )
        const {0: eligibleCapitalAmount, 1: totalCapitalAmount} = await membershipOrchestrator.totalCapitalHeldBy(
          mainUser
        )
        expect(eligibleCapitalAmount.toString()).to.equal("0")
        expect(totalCapitalAmount).to.bignumber.closeTo(
          preWithdrawalTotalCapitalAmount.sub(position1UsdcDepositAmount),
          new BN(3)
        )

        expect(await stakingRewards.ownerOf(stakedFiduTokenId1)).to.equal(mainUser)
        expect(await stakingRewards.ownerOf(stakedFiduTokenId2)).to.equal(capitalLedger.address)
        expect(await stakingRewards.ownerOf(stakedFiduTokenId3)).to.equal(capitalLedger.address)
      })

      it("should allow withdrawing many of many StakedFidu positions", async () => {
        await expect(
          membershipOrchestrator.withdraw(
            {gfiPositions: [], capitalPositions: [stakedFiduPositionId1, stakedFiduPositionId2, stakedFiduPositionId3]},
            {from: users[4]!}
          )
        ).to.be.rejectedWith("CannotWithdrawUnownedAsset")
        await membershipOrchestrator.withdraw(
          {gfiPositions: [], capitalPositions: [stakedFiduPositionId1, stakedFiduPositionId2, stakedFiduPositionId3]},
          {from: mainUser}
        )
        const {0: eligibleCapitalAmount, 1: totalCapitalAmount} = await membershipOrchestrator.totalCapitalHeldBy(
          mainUser
        )
        expect(eligibleCapitalAmount.toString()).to.equal("0")
        expect(totalCapitalAmount).to.bignumber.equal(new BN(0))

        expect(await stakingRewards.ownerOf(stakedFiduTokenId1)).to.equal(mainUser)
        expect(await stakingRewards.ownerOf(stakedFiduTokenId2)).to.equal(mainUser)
        expect(await stakingRewards.ownerOf(stakedFiduTokenId3)).to.equal(mainUser)
      })
    })

    context("with many GFI positions", async () => {
      let gfiPositionId1, gfiPositionId2, gfiPositionId3
      const gfiDepositAmount1 = gfiVal(1000)
      const gfiDepositAmount2 = gfiVal(2000)
      const gfiDepositAmount3 = gfiVal(10000)

      let originalUserGfiBalance
      let originalLedgerGfiBalance

      beforeEach(async () => {
        const depositResults = await quickSetupAndDepositMultiple(mainUser, users[4]!, [
          {depositType: DepositType.GFI, amount: gfiDepositAmount1},
          {depositType: DepositType.GFI, amount: gfiDepositAmount2},
          {depositType: DepositType.GFI, amount: gfiDepositAmount3},
        ])
        ;[gfiPositionId1, gfiPositionId2, gfiPositionId3] = depositResults.map((result) => result.positionId)
        originalUserGfiBalance = await gfi.balanceOf(mainUser)
        originalLedgerGfiBalance = await gfi.balanceOf(gfiLedger.address)
      })

      it("should allow withdrawing one of many Gfi positions", async () => {
        const {1: preWithdrawalTotalGfiAmount} = await membershipOrchestrator.totalGFIHeldBy(mainUser)
        await expect(
          membershipOrchestrator.withdraw(
            {gfiPositions: [{id: gfiPositionId1, amount: String(gfiDepositAmount1)}], capitalPositions: []},
            {from: users[4]!}
          )
        ).to.be.rejectedWith("CannotWithdrawUnownedAsset")
        await membershipOrchestrator.withdraw(
          {gfiPositions: [{id: gfiPositionId1, amount: String(gfiDepositAmount1)}], capitalPositions: []},
          {from: mainUser}
        )
        const {0: eligibleGfiAmount, 1: totalGfiAmount} = await membershipOrchestrator.totalGFIHeldBy(mainUser)
        expect(eligibleGfiAmount.toString()).to.equal("0")
        expect(totalGfiAmount).to.bignumber.closeTo(preWithdrawalTotalGfiAmount.sub(gfiDepositAmount1), new BN(1))
        expect(await gfi.balanceOf(mainUser)).to.bignumber.eq(originalUserGfiBalance.add(gfiDepositAmount1))
        expect(await gfi.balanceOf(gfiLedger.address)).to.bignumber.eq(originalLedgerGfiBalance.sub(gfiDepositAmount1))
      })

      it("should allow withdrawing many of many Gfi positions", async () => {
        await expect(
          membershipOrchestrator.withdraw(
            {
              gfiPositions: [
                {
                  id: gfiPositionId1,
                  amount: String(gfiDepositAmount1),
                },
                {
                  id: gfiPositionId2,
                  amount: String(gfiDepositAmount2),
                },
                {
                  id: gfiPositionId3,
                  amount: String(gfiDepositAmount3),
                },
              ],
              capitalPositions: [],
            },
            {from: users[4]!}
          )
        ).to.be.rejectedWith("CannotWithdrawUnownedAsset")
        await membershipOrchestrator.withdraw(
          {
            gfiPositions: [
              {
                id: gfiPositionId1,
                amount: String(gfiDepositAmount1),
              },
              {
                id: gfiPositionId2,
                amount: String(gfiDepositAmount2),
              },
              {
                id: gfiPositionId3,
                amount: String(gfiDepositAmount3),
              },
            ],
            capitalPositions: [],
          },
          {from: mainUser}
        )
        const {0: eligibleGfiAmount, 1: totalGfiAmount} = await membershipOrchestrator.totalGFIHeldBy(mainUser)
        expect(eligibleGfiAmount.toString()).to.equal("0")
        expect(totalGfiAmount).to.bignumber.equal(new BN(0))
        expect(await gfi.balanceOf(mainUser)).to.bignumber.eq(
          originalUserGfiBalance.add(gfiDepositAmount1).add(gfiDepositAmount2).add(gfiDepositAmount3)
        )
        expect(await gfi.balanceOf(gfiLedger.address)).to.bignumber.eq(
          originalLedgerGfiBalance.sub(gfiDepositAmount1).sub(gfiDepositAmount2).sub(gfiDepositAmount3)
        )
      })
    })

    context("with combinations of GFI, StakedFidu and PoolToken positions", async () => {
      let stakedFiduTokenId1, stakedFiduTokenId2, stakedFiduTokenId3
      let stakedFiduPositionId1, stakedFiduPositionId2, stakedFiduPositionId3
      const stakedFiduDepositAmount1 = usdcVal(1000)
      const stakedFiduDepositAmount2 = usdcVal(2000)
      const stakedFiduDepositAmount3 = usdcVal(5000)

      let poolTokenId1, poolTokenId2, poolTokenId3
      let poolTokenPositionId1, poolTokenPositionId2, poolTokenPositionId3
      const poolTokenDepositAmount1 = usdcVal(1000)
      const poolTokenDepositAmount2 = usdcVal(2000)
      const poolTokenDepositAmount3 = usdcVal(5000)

      let gfiPositionId1, gfiPositionId2, gfiPositionId3
      const gfiDepositAmount1 = gfiVal(1000)
      const gfiDepositAmount2 = gfiVal(2000)
      const gfiDepositAmount3 = gfiVal(10000)

      let originalUserGfiBalance
      let originalLedgerGfiBalance

      beforeEach(async () => {
        const gfiDepositResults = await quickSetupAndDepositMultiple(mainUser, users[4]!, [
          {depositType: DepositType.GFI, amount: gfiDepositAmount1},
          {depositType: DepositType.GFI, amount: gfiDepositAmount2},
          {depositType: DepositType.GFI, amount: gfiDepositAmount3},
        ])
        ;[gfiPositionId1, gfiPositionId2, gfiPositionId3] = gfiDepositResults.map((result) => result.positionId)

        const stakedFiduDepositResults = await quickSetupAndDepositMultiple(mainUser, users[4]!, [
          {depositType: DepositType.StakedFidu, amount: stakedFiduDepositAmount1},
          {depositType: DepositType.StakedFidu, amount: stakedFiduDepositAmount2},
          {depositType: DepositType.StakedFidu, amount: stakedFiduDepositAmount3},
        ])
        ;[stakedFiduPositionId1, stakedFiduPositionId2, stakedFiduPositionId3] = stakedFiduDepositResults.map(
          (result) => result.positionId
        )
        ;[stakedFiduTokenId1, stakedFiduTokenId2, stakedFiduTokenId3] = stakedFiduDepositResults.map(
          (result) => result.assetTokenId
        )

        const poolTokenDepositResults = await quickSetupAndDepositMultiple(mainUser, users[4]!, [
          {depositType: DepositType.PoolToken, amount: poolTokenDepositAmount1},
          {depositType: DepositType.PoolToken, amount: poolTokenDepositAmount2},
          {depositType: DepositType.PoolToken, amount: poolTokenDepositAmount3},
        ])
        ;[poolTokenPositionId1, poolTokenPositionId2, poolTokenPositionId3] = poolTokenDepositResults.map(
          (result) => result.positionId
        )
        ;[poolTokenId1, poolTokenId2, poolTokenId3] = poolTokenDepositResults.map((result) => result.assetTokenId)

        originalUserGfiBalance = await gfi.balanceOf(mainUser)
        originalLedgerGfiBalance = await gfi.balanceOf(gfiLedger.address)
      })

      it("allows withdrawing a collection of varied positions", async () => {
        await expect(
          membershipOrchestrator.withdraw(
            {
              gfiPositions: [
                {id: gfiPositionId2, amount: String(gfiDepositAmount2.div(new BN(2)))},
                {id: gfiPositionId3, amount: String(gfiDepositAmount3.div(new BN(2)))},
              ],
              capitalPositions: [
                poolTokenPositionId2,
                poolTokenPositionId3,
                stakedFiduPositionId2,
                stakedFiduPositionId3,
              ],
            },
            {from: users[4]!}
          )
        ).to.be.rejectedWith("CannotWithdrawUnownedAsset")

        const halfDeposit2 = gfiDepositAmount2.div(new BN(2))
        const halfDeposit3 = gfiDepositAmount3.div(new BN(2))

        // Withdraw most of the assets
        await membershipOrchestrator.withdraw(
          {
            gfiPositions: [
              {id: gfiPositionId2, amount: String(halfDeposit2)},
              {id: gfiPositionId3, amount: String(halfDeposit3)},
            ],
            capitalPositions: [
              poolTokenPositionId2,
              poolTokenPositionId3,
              stakedFiduPositionId2,
              stakedFiduPositionId3,
            ],
          },
          {from: mainUser}
        )
        let {0: eligibleGfiAmount, 1: totalGfiAmount} = await membershipOrchestrator.totalGFIHeldBy(mainUser)
        expect(eligibleGfiAmount.toString()).to.equal("0")
        expect(totalGfiAmount).to.bignumber.eq(gfiDepositAmount1.add(halfDeposit2).add(halfDeposit3))

        expect(await gfi.balanceOf(mainUser)).to.bignumber.eq(
          originalUserGfiBalance.add(halfDeposit2).add(halfDeposit3)
        )
        expect(await gfi.balanceOf(gfiLedger.address)).to.bignumber.eq(
          originalLedgerGfiBalance.sub(halfDeposit2).sub(halfDeposit3)
        )

        let {0: eligibleCapitalAmount, 1: totalCapitalAmount} = await membershipOrchestrator.totalCapitalHeldBy(
          mainUser
        )
        expect(eligibleCapitalAmount.toString()).to.equal("0")
        expect(totalCapitalAmount).to.bignumber.closeTo(
          poolTokenDepositAmount1.add(stakedFiduDepositAmount1),
          new BN(1)
        )

        expect(await stakingRewards.ownerOf(stakedFiduTokenId1)).to.eq(capitalLedger.address)
        expect(await stakingRewards.ownerOf(stakedFiduTokenId2)).to.eq(mainUser)
        expect(await stakingRewards.ownerOf(stakedFiduTokenId3)).to.eq(mainUser)

        expect(await poolTokens.ownerOf(poolTokenId1)).to.eq(capitalLedger.address)
        expect(await poolTokens.ownerOf(poolTokenId2)).to.eq(mainUser)
        expect(await poolTokens.ownerOf(poolTokenId3)).to.eq(mainUser)

        // Withdraw the rest
        await expect(
          membershipOrchestrator.withdraw(
            {
              gfiPositions: [
                {id: gfiPositionId1, amount: String(gfiDepositAmount1)},
                {id: gfiPositionId2, amount: String(gfiDepositAmount2.div(new BN(2)))},
                {id: gfiPositionId3, amount: String(gfiDepositAmount3.div(new BN(2)))},
              ],
              capitalPositions: [poolTokenPositionId1, stakedFiduPositionId1],
            },
            {from: users[4]!}
          )
        ).to.be.rejectedWith("CannotWithdrawUnownedAsset")
        await membershipOrchestrator.withdraw(
          {
            gfiPositions: [
              {id: gfiPositionId1, amount: String(gfiDepositAmount1)},
              {id: gfiPositionId2, amount: String(gfiDepositAmount2.div(new BN(2)))},
              {id: gfiPositionId3, amount: String(gfiDepositAmount3.div(new BN(2)))},
            ],
            capitalPositions: [poolTokenPositionId1, stakedFiduPositionId1],
          },
          {from: mainUser}
        )
        ;({0: eligibleGfiAmount, 1: totalGfiAmount} = await membershipOrchestrator.totalGFIHeldBy(mainUser))
        expect(eligibleGfiAmount.toString()).to.equal("0")
        expect(totalGfiAmount).to.bignumber.equal(new BN(0))
        expect(await gfi.balanceOf(mainUser)).to.bignumber.eq(
          originalUserGfiBalance.add(gfiDepositAmount1).add(gfiDepositAmount2).add(gfiDepositAmount3)
        )
        expect(await gfi.balanceOf(gfiLedger.address)).to.bignumber.eq(
          originalLedgerGfiBalance.sub(gfiDepositAmount1).sub(gfiDepositAmount2).sub(gfiDepositAmount3)
        )
        ;({0: eligibleCapitalAmount, 1: totalCapitalAmount} = await membershipOrchestrator.totalCapitalHeldBy(mainUser))
        expect(eligibleCapitalAmount.toString()).to.equal("0")
        expect(totalCapitalAmount).to.bignumber.eq(new BN(0))

        expect(await stakingRewards.ownerOf(stakedFiduTokenId1)).to.eq(mainUser)
        expect(await stakingRewards.ownerOf(stakedFiduTokenId2)).to.eq(mainUser)
        expect(await stakingRewards.ownerOf(stakedFiduTokenId3)).to.eq(mainUser)

        expect(await poolTokens.ownerOf(poolTokenId1)).to.eq(mainUser)
        expect(await poolTokens.ownerOf(poolTokenId2)).to.eq(mainUser)
        expect(await poolTokens.ownerOf(poolTokenId3)).to.eq(mainUser)
      })

      it("allows withdrawing all positions", async () => {
        await expect(
          membershipOrchestrator.withdraw(
            {
              gfiPositions: [
                {id: gfiPositionId1, amount: String(gfiDepositAmount1)},
                {id: gfiPositionId2, amount: String(gfiDepositAmount2)},
                {id: gfiPositionId3, amount: String(gfiDepositAmount3)},
              ],
              capitalPositions: [
                poolTokenPositionId1,
                poolTokenPositionId2,
                poolTokenPositionId3,
                stakedFiduPositionId1,
                stakedFiduPositionId2,
                stakedFiduPositionId3,
              ],
            },
            {from: users[4]!}
          )
        ).to.be.rejectedWith("CannotWithdrawUnownedAsset")
        await membershipOrchestrator.withdraw(
          {
            gfiPositions: [
              {id: gfiPositionId1, amount: String(gfiDepositAmount1)},
              {id: gfiPositionId2, amount: String(gfiDepositAmount2)},
              {id: gfiPositionId3, amount: String(gfiDepositAmount3)},
            ],
            capitalPositions: [
              poolTokenPositionId1,
              poolTokenPositionId2,
              poolTokenPositionId3,
              stakedFiduPositionId1,
              stakedFiduPositionId2,
              stakedFiduPositionId3,
            ],
          },
          {from: mainUser}
        )

        const {0: eligibleGfiAmount, 1: totalGfiAmount} = await membershipOrchestrator.totalGFIHeldBy(mainUser)
        expect(eligibleGfiAmount.toString()).to.equal("0")
        expect(totalGfiAmount).to.bignumber.equal(new BN(0))
        expect(await gfi.balanceOf(mainUser)).to.bignumber.eq(
          originalUserGfiBalance.add(gfiDepositAmount1).add(gfiDepositAmount2).add(gfiDepositAmount3)
        )
        expect(await gfi.balanceOf(gfiLedger.address)).to.bignumber.eq(
          originalLedgerGfiBalance.sub(gfiDepositAmount1).sub(gfiDepositAmount2).sub(gfiDepositAmount3)
        )
        const {0: eligibleCapitalAmount, 1: totalCapitalAmount} = await membershipOrchestrator.totalCapitalHeldBy(
          mainUser
        )
        expect(eligibleCapitalAmount.toString()).to.equal("0")
        expect(totalCapitalAmount).to.bignumber.eq(new BN(0))

        expect(await stakingRewards.ownerOf(stakedFiduTokenId1)).to.eq(mainUser)
        expect(await stakingRewards.ownerOf(stakedFiduTokenId2)).to.eq(mainUser)
        expect(await stakingRewards.ownerOf(stakedFiduTokenId3)).to.eq(mainUser)

        expect(await poolTokens.ownerOf(poolTokenId1)).to.eq(mainUser)
        expect(await poolTokens.ownerOf(poolTokenId2)).to.eq(mainUser)
        expect(await poolTokens.ownerOf(poolTokenId3)).to.eq(mainUser)
      })

      it("prevents withdrawing another user's positions, even if some positions are valid", async () => {
        const otherUser = users[5]!
        const otherUserGfiPositionVal = gfiVal(100)
        const otherUserOriginalGfiVal = await gfi.balanceOf(otherUser)
        const capitalDepositResults = await quickSetupAndDepositMultiple(otherUser, users[4]!, [
          {depositType: DepositType.PoolToken, amount: usdcVal(100)},
          {depositType: DepositType.StakedFidu, amount: usdcVal(100)},
        ])

        const {positionId: validGfiPositionId} = await quickSetupAndDepositGfi(otherUser, otherUserGfiPositionVal)

        const validCapitalPositionIds = capitalDepositResults.map((result) => result.positionId)
        const validCapitalAssetTokenIds = capitalDepositResults.map((result) => result.assetTokenId)

        // Attempt withdraw one valid capital position
        await expect(
          membershipOrchestrator.withdraw(
            {
              gfiPositions: [{id: gfiPositionId1, amount: String(gfiDepositAmount1)}],
              capitalPositions: [poolTokenPositionId1, validCapitalPositionIds[0]],
            },
            {from: otherUser}
          )
        ).to.be.rejectedWith("CannotWithdraw")

        // Attempt withdraw one valid gfi position
        await expect(
          membershipOrchestrator.withdraw(
            {
              gfiPositions: [{id: validGfiPositionId, amount: String(otherUserGfiPositionVal)}],
              capitalPositions: [poolTokenPositionId1, stakedFiduPositionId1],
            },
            {from: otherUser}
          )
        ).to.be.rejectedWith("CannotWithdraw")

        // Attempt withdraw all valid but one capital position
        await expect(
          membershipOrchestrator.withdraw(
            {
              gfiPositions: [{id: validGfiPositionId, amount: String(otherUserGfiPositionVal)}],
              capitalPositions: [validCapitalPositionIds[1]!, stakedFiduPositionId1],
            },
            {from: otherUser}
          )
        ).to.be.rejectedWith("CannotWithdraw")

        // Attempt withdraw all valid but one gfi position
        await expect(
          membershipOrchestrator.withdraw(
            {
              gfiPositions: [{id: gfiPositionId1, amount: String(gfiDepositAmount1)}],
              capitalPositions: [validCapitalPositionIds[0]!, validCapitalPositionIds[1]!],
            },
            {from: otherUser}
          )
        ).to.be.rejectedWith("CannotWithdraw")

        // Attempt to withdraw all valid positions
        await membershipOrchestrator.withdraw(
          {
            gfiPositions: [{id: validGfiPositionId, amount: String(otherUserGfiPositionVal)}],
            capitalPositions: validCapitalPositionIds,
          },
          {from: otherUser}
        )

        // Verify main user's balances are still correct.
        const mainUserTotal = gfiDepositAmount1.add(gfiDepositAmount2).add(gfiDepositAmount3)
        let {0: eligibleGfiAmount, 1: totalGfiAmount} = await membershipOrchestrator.totalGFIHeldBy(mainUser)
        expect(eligibleGfiAmount.toString()).to.equal("0")
        expect(totalGfiAmount).to.bignumber.equal(mainUserTotal)
        expect(await gfi.balanceOf(mainUser)).to.bignumber.eq(originalUserGfiBalance)

        let {0: eligibleCapitalAmount, 1: totalCapitalAmount} = await membershipOrchestrator.totalCapitalHeldBy(
          mainUser
        )
        expect(eligibleCapitalAmount.toString()).to.equal("0")
        expect(totalCapitalAmount).to.bignumber.closeTo(
          poolTokenDepositAmount1
            .add(poolTokenDepositAmount2)
            .add(poolTokenDepositAmount3)
            .add(stakedFiduDepositAmount1)
            .add(stakedFiduDepositAmount2)
            .add(stakedFiduDepositAmount3),
          new BN(3)
        )

        // Verify other user's membership balances are correct.
        ;({0: eligibleGfiAmount, 1: totalGfiAmount} = await membershipOrchestrator.totalGFIHeldBy(otherUser))
        expect(eligibleGfiAmount.toString()).to.equal("0")
        expect(totalGfiAmount).to.bignumber.equal(new BN(0))
        ;({0: eligibleCapitalAmount, 1: totalCapitalAmount} = await membershipOrchestrator.totalCapitalHeldBy(
          otherUser
        ))
        expect(eligibleCapitalAmount.toString()).to.equal("0")
        expect(totalCapitalAmount).to.bignumber.eq(new BN(0))

        // Verify other user's asset balances
        expect(await gfi.balanceOf(otherUser)).to.bignumber.eq(otherUserOriginalGfiVal)
        expect(await poolTokens.ownerOf(validCapitalAssetTokenIds[0]!)).to.eq(otherUser)
        expect(await stakingRewards.ownerOf(validCapitalAssetTokenIds[1]!)).to.eq(otherUser)

        // Verify ledger's asset balances.
        expect(await gfi.balanceOf(gfiLedger.address)).to.bignumber.eq(originalLedgerGfiBalance)

        expect(await stakingRewards.ownerOf(stakedFiduTokenId1)).to.eq(capitalLedger.address)
        expect(await stakingRewards.ownerOf(stakedFiduTokenId2)).to.eq(capitalLedger.address)
        expect(await stakingRewards.ownerOf(stakedFiduTokenId3)).to.eq(capitalLedger.address)

        expect(await poolTokens.ownerOf(poolTokenId1)).to.eq(capitalLedger.address)
        expect(await poolTokens.ownerOf(poolTokenId2)).to.eq(capitalLedger.address)
        expect(await poolTokens.ownerOf(poolTokenId3)).to.eq(capitalLedger.address)
      })
    })
  })

  context("Rewards", async () => {
    let gfiStakedFiduPairUser, gfiPoolTokenPairUser, manyPositionsUser
    let setupGfiStakedFiduPairUser, setupGfiPoolTokenPairUser, setupManyPositionsUser
    let zeroScoreUsers
    let expectZeroScoreUsersAccounting
    let gfiOnlyUser, poolTokenOnlyUser, stakedFiduOnlyUser, capitalOnlyUser, noPositionsUser

    const gfiNormalized100Usdc = usdcVal(100).mul(new BN(USDC_TO_GFI_MANTISSA))
    const gfiNormalized600Usdc = usdcVal(600).mul(new BN(USDC_TO_GFI_MANTISSA))

    const pairScore = bnSqrt(gfiVal(100).mul(gfiNormalized100Usdc))
    const largeScore = bnSqrt(gfiVal(300).mul(gfiNormalized600Usdc))

    beforeEach(async () => {
      // eslint-disable-next-line @typescript-eslint/no-extra-semi
      ;[gfiOnlyUser, poolTokenOnlyUser, stakedFiduOnlyUser, capitalOnlyUser, noPositionsUser] = users.slice(4, 12)
      zeroScoreUsers = [gfiOnlyUser, poolTokenOnlyUser, stakedFiduOnlyUser, capitalOnlyUser, noPositionsUser]
      ;[gfiStakedFiduPairUser, gfiPoolTokenPairUser, manyPositionsUser] = users.slice(13, 16)

      await quickSetupAndDepositGfi(gfiOnlyUser!, gfiVal(100))
      await quickSetupAndDepositPoolToken(users[3]!, poolTokenOnlyUser!, usdcVal(100))
      await quickSetupAndDepositStakedFidu(stakedFiduOnlyUser!, usdcVal(100))
      await quickSetupAndDepositStakedFidu(capitalOnlyUser!, usdcVal(100))

      setupGfiStakedFiduPairUser = () =>
        quickSetupAndDepositMultiple(gfiStakedFiduPairUser!, users[3]!, [
          {depositType: DepositType.GFI, amount: gfiVal(100)},
          {depositType: DepositType.StakedFidu, amount: usdcVal(100)},
        ])

      setupGfiPoolTokenPairUser = () =>
        quickSetupAndDepositMultiple(gfiPoolTokenPairUser!, users[3]!, [
          {depositType: DepositType.GFI, amount: gfiVal(100)},
          {depositType: DepositType.StakedFidu, amount: usdcVal(100)},
        ])

      setupManyPositionsUser = () =>
        quickSetupAndDepositMultiple(manyPositionsUser!, users[3]!, [
          {depositType: DepositType.GFI, amount: gfiVal(100)},
          {depositType: DepositType.GFI, amount: gfiVal(100)},
          {depositType: DepositType.GFI, amount: gfiVal(100)},
          {depositType: DepositType.StakedFidu, amount: usdcVal(100)},
          {depositType: DepositType.StakedFidu, amount: usdcVal(100)},
          {depositType: DepositType.StakedFidu, amount: usdcVal(100)},
          {depositType: DepositType.PoolToken, amount: usdcVal(100)},
          {depositType: DepositType.PoolToken, amount: usdcVal(100)},
          {depositType: DepositType.PoolToken, amount: usdcVal(100)},
        ])

      expectZeroScoreUsersAccounting = async () => {
        expect(await membershipOrchestrator.votingPower(gfiOnlyUser)).to.bignumber.eq(gfiVal(100))
        expect(await membershipOrchestrator.votingPower(poolTokenOnlyUser)).to.bignumber.eq(new BN(0))
        expect(await membershipOrchestrator.votingPower(stakedFiduOnlyUser)).to.bignumber.eq(new BN(0))
        expect(await membershipOrchestrator.votingPower(capitalOnlyUser)).to.bignumber.eq(new BN(0))
        expect(await membershipOrchestrator.votingPower(noPositionsUser)).to.bignumber.eq(new BN(0))
        for (const user of zeroScoreUsers) {
          expect(await membershipOrchestrator.claimableRewards(user)).to.bignumber.eq(new BN(0))
          const userScore = await membershipOrchestrator.memberScoreOf(user)
          expect(userScore[0]).to.bignumber.to.equal(new BN(0))
          expect(userScore[1]).to.bignumber.to.equal(new BN(0))
        }
      }
    })

    context("with a collection of users with 0 total membership score", () => {
      it("gives each user accurate membership scores, voting power and capital amounts", async () => {
        const advanceEpochAndEnsureZeroScoreUsersAccounting = async () => {
          await expectZeroScoreUsersAccounting()

          // Claim non-existent rewards
          for (const user of zeroScoreUsers) {
            await membershipOrchestrator.collectRewards({from: user})
          }

          // All balances should remain the same.
          await expectZeroScoreUsersAccounting()

          // Distribute would-be rewards which zero-score users are ineligible for.
          await usdc.transfer(erc20Splitter.address, usdcVal(100), {from: mainUser})
          await erc20Splitter.distribute()

          // Claim non-existent rewards
          for (const user of zeroScoreUsers) {
            await membershipOrchestrator.collectRewards({from: user})
          }

          // All balances should remain the same.
          await expectZeroScoreUsersAccounting()

          await advanceTime({days: EPOCH_LENGTH_IN_DAYS})
        }
        await advanceEpochAndEnsureZeroScoreUsersAccounting()
        await advanceEpochAndEnsureZeroScoreUsersAccounting()
        await advanceEpochAndEnsureZeroScoreUsersAccounting()
      })
    })

    context("with users with eligible membership scores & available rewards", () => {
      let expectEligibleRewardsToNotBeReady, expectEligibleRewardsToBeReady, expectVotingPowerIsStatic
      let existingTotalScore
      let expectedTotalFiduReward

      beforeEach(async () => {
        // Finalize any elapsed epochs
        await membershipOrchestrator.finalizeEpochs()

        // Make distribution
        const originalFiduAmount = await fidu.balanceOf(membershipCollector.address)
        existingTotalScore = await membershipOrchestrator.totalMemberScores()

        await setupGfiStakedFiduPairUser()
        await setupGfiPoolTokenPairUser()
        await setupManyPositionsUser()

        // Distribute rewards to MembershipCollector
        await usdc.transfer(erc20Splitter.address, usdcVal(100), {from: mainUser})
        await erc20Splitter.distribute()
        const afterDistributionFiduAmount = await fidu.balanceOf(membershipCollector.address)
        expectedTotalFiduReward = originalFiduAmount.add(getNumShares(usdcVal(50), await seniorPool.sharePrice()))
        expect(expectedTotalFiduReward).to.bignumber.eq(afterDistributionFiduAmount)

        expectVotingPowerIsStatic = async () => {
          expect(await membershipOrchestrator.votingPower(gfiStakedFiduPairUser)).to.bignumber.eq(gfiVal(100))
          expect(await membershipOrchestrator.votingPower(gfiPoolTokenPairUser)).to.bignumber.eq(gfiVal(100))
          expect(await membershipOrchestrator.votingPower(manyPositionsUser)).to.bignumber.eq(gfiVal(300))
        }

        expectEligibleRewardsToNotBeReady = async () => {
          for (const user of [gfiStakedFiduPairUser, gfiPoolTokenPairUser, manyPositionsUser]) {
            expect(await membershipOrchestrator.claimableRewards(user)).to.bignumber.eq(new BN(0))
            expect((await membershipOrchestrator.memberScoreOf(user))[0]).to.bignumber.to.equal(new BN(0))
          }

          const gfiStakedFiduPairTotalScore = (await membershipOrchestrator.memberScoreOf(gfiStakedFiduPairUser))[1]
          const gfiPoolTokenPairTotalScore = (await membershipOrchestrator.memberScoreOf(gfiPoolTokenPairUser))[1]
          const manyPositionsTotalScore = (await membershipOrchestrator.memberScoreOf(manyPositionsUser))[1]

          expect(gfiStakedFiduPairTotalScore).to.bignumber.closeTo(pairScore, new BN(MEMBERSHIP_SCORE_PRECISION_LOSS))
          expect(gfiPoolTokenPairTotalScore).to.bignumber.closeTo(pairScore, new BN(MEMBERSHIP_SCORE_PRECISION_LOSS))
          expect(manyPositionsTotalScore).to.bignumber.closeTo(largeScore, new BN(MEMBERSHIP_SCORE_PRECISION_LOSS))
        }
        expectEligibleRewardsToBeReady = async () => {
          const gfiStakedFiduPairScores = await membershipOrchestrator.memberScoreOf(gfiStakedFiduPairUser)
          const gfiPoolTokenPairScores = await membershipOrchestrator.memberScoreOf(gfiPoolTokenPairUser)
          const manyPositionsScores = await membershipOrchestrator.memberScoreOf(manyPositionsUser)

          expect(gfiStakedFiduPairScores[0]).to.bignumber.closeTo(pairScore, new BN(MEMBERSHIP_SCORE_PRECISION_LOSS))
          expect(gfiStakedFiduPairScores[0]).to.bignumber.eq(gfiStakedFiduPairScores[1])
          expect(gfiPoolTokenPairScores[0]).to.bignumber.closeTo(pairScore, new BN(MEMBERSHIP_SCORE_PRECISION_LOSS))
          expect(gfiPoolTokenPairScores[0]).to.bignumber.eq(gfiPoolTokenPairScores[1])
          expect(manyPositionsScores[0]).to.bignumber.closeTo(largeScore, new BN(MEMBERSHIP_SCORE_PRECISION_LOSS))
          expect(manyPositionsScores[0]).to.bignumber.eq(manyPositionsScores[1])
        }
      })

      it("should return zero eligible scores for all users", async () => {
        await expectZeroScoreUsersAccounting()
        await expectVotingPowerIsStatic()
        await expectEligibleRewardsToNotBeReady()

        // Attempt to collect non-existent rewards
        for (const user of [gfiStakedFiduPairUser, gfiPoolTokenPairUser, manyPositionsUser]) {
          await membershipOrchestrator.collectRewards({from: user})
        }

        // Distribute would-be rewards (again)
        await usdc.transfer(erc20Splitter.address, usdcVal(100), {from: mainUser})
        await erc20Splitter.distribute()

        // Expect users with ineligible scores (0 gfi or 0 capital) to get no rewards
        await expectZeroScoreUsersAccounting()
        await expectVotingPowerIsStatic()
        await expectEligibleRewardsToNotBeReady()
      })

      context("after an epoch has passed since an inflow of USDC", () => {
        beforeEach(async () => {
          await advanceTime({days: EPOCH_LENGTH_IN_DAYS})
        })

        it("should correctly account users' positions, and not distribute any rewards to users since they are all ineligible", async () => {
          const eligiblePositionUsers = [gfiStakedFiduPairUser, gfiPoolTokenPairUser, manyPositionsUser]
          const originalFiduBalancesSF = await fidu.balanceOf(gfiStakedFiduPairUser)
          const originalFiduBalancesPT = await fidu.balanceOf(gfiPoolTokenPairUser)
          const originalFiduBalancesMP = await fidu.balanceOf(manyPositionsUser)

          await expectZeroScoreUsersAccounting()
          await expectVotingPowerIsStatic()
          await expectEligibleRewardsToNotBeReady()

          for (const user of eligiblePositionUsers) {
            await membershipOrchestrator.collectRewards({from: user})
          }

          // Distribute would-be rewards which zero-score users are ineligible for.
          await usdc.transfer(erc20Splitter.address, usdcVal(100), {from: mainUser})
          await erc20Splitter.distribute()

          // Expect users with ineligible scores (0 gfi or 0 capital) to get no rewards
          await expectZeroScoreUsersAccounting()
          await expectVotingPowerIsStatic()

          // Expect latest rewards to be ready.
          await expectEligibleRewardsToBeReady()

          for (const user of eligiblePositionUsers) {
            expect(await membershipOrchestrator.claimableRewards(user)).to.bignumber.eq(new BN(0))
          }

          expect(originalFiduBalancesSF).to.bignumber.eq(await fidu.balanceOf(gfiStakedFiduPairUser))
          expect(originalFiduBalancesPT).to.bignumber.eq(await fidu.balanceOf(gfiPoolTokenPairUser))
          expect(originalFiduBalancesMP).to.bignumber.eq(await fidu.balanceOf(manyPositionsUser))
        })
      })

      context("after two epochs passed since an inflow of USDC", () => {
        beforeEach(async () => {
          await advanceTime({days: EPOCH_LENGTH_IN_DAYS})
          await membershipOrchestrator.finalizeEpochs()

          await advanceTime({days: EPOCH_LENGTH_IN_DAYS})
          await membershipOrchestrator.finalizeEpochs()
        })

        it("should properly distribute claimable rewards", async () => {
          const eligiblePositionUsers = [gfiStakedFiduPairUser, gfiPoolTokenPairUser, manyPositionsUser]
          const originalFiduBalancesSF = await fidu.balanceOf(gfiStakedFiduPairUser)
          const originalFiduBalancesPT = await fidu.balanceOf(gfiPoolTokenPairUser)
          const originalFiduBalancesMP = await fidu.balanceOf(manyPositionsUser)

          await expectVotingPowerIsStatic()
          await expectZeroScoreUsersAccounting()

          const expectedTotalScore = existingTotalScore[1].add(pairScore).add(pairScore).add(largeScore)
          const totalMemberScores = await membershipOrchestrator.totalMemberScores()
          const gfiStakedFiduPairScores = await membershipOrchestrator.memberScoreOf(gfiStakedFiduPairUser)
          const gfiPoolTokenPairScores = await membershipOrchestrator.memberScoreOf(gfiPoolTokenPairUser)
          const manyPositionsScores = await membershipOrchestrator.memberScoreOf(manyPositionsUser)

          expect(gfiStakedFiduPairScores[1]).to.bignumber.closeTo(pairScore, new BN(MEMBERSHIP_SCORE_PRECISION_LOSS))
          expect(gfiPoolTokenPairScores[1]).to.bignumber.closeTo(pairScore, new BN(MEMBERSHIP_SCORE_PRECISION_LOSS))
          expect(manyPositionsScores[1]).to.bignumber.closeTo(largeScore, new BN(MEMBERSHIP_SCORE_PRECISION_LOSS))
          expect(totalMemberScores[1]).to.bignumber.closeTo(expectedTotalScore, new BN(MEMBERSHIP_SCORE_PRECISION_LOSS))

          // Eligible scores have not been checkpointed for individual users yet.
          expect(gfiStakedFiduPairScores[0]).to.bignumber.eq(new BN(0))
          expect(gfiPoolTokenPairScores[0]).to.bignumber.eq(new BN(0))
          expect(manyPositionsScores[0]).to.bignumber.eq(new BN(0))

          // TOTAL eligible score has been checkpointed already
          expect(totalMemberScores[0]).to.bignumber.eq(totalMemberScores[1])

          const expectedRewardsSF = gfiStakedFiduPairScores[1].mul(expectedTotalFiduReward).div(totalMemberScores[1])
          const expectedRewardsPT = gfiPoolTokenPairScores[1].mul(expectedTotalFiduReward).div(totalMemberScores[1])
          const expectedRewardsMP = manyPositionsScores[1].mul(expectedTotalFiduReward).div(totalMemberScores[1])

          const totalRewardsForEpoch = await membershipOrchestrator.estimateRewardsFor(
            await membershipCollector.lastFinalizedEpoch()
          )
          expect(totalRewardsForEpoch).to.bignumber.eq(expectedTotalFiduReward)
          expect(await membershipOrchestrator.claimableRewards(gfiStakedFiduPairUser)).to.bignumber.eq(
            expectedRewardsSF
          )
          expect(await membershipOrchestrator.claimableRewards(gfiPoolTokenPairUser)).to.bignumber.eq(expectedRewardsPT)
          expect(await membershipOrchestrator.claimableRewards(manyPositionsUser)).to.bignumber.eq(expectedRewardsMP)

          // Collect rewards
          for (const user of [gfiStakedFiduPairUser, gfiPoolTokenPairUser, manyPositionsUser]) {
            await membershipOrchestrator.collectRewards({from: user})
          }

          // Re-assert invariable balances
          await expectEligibleRewardsToBeReady()
          await expectVotingPowerIsStatic()
          await expectZeroScoreUsersAccounting()

          // Claimable rewards should have been reduced to zero after claim
          for (const user of eligiblePositionUsers) {
            expect(await membershipOrchestrator.claimableRewards(user)).to.bignumber.eq(new BN(0))
          }

          // Fidu rewards should have been properly distributed
          expect(await fidu.balanceOf(gfiStakedFiduPairUser)).to.bignumber.eq(
            originalFiduBalancesSF.add(expectedRewardsSF)
          )
          expect(await fidu.balanceOf(gfiPoolTokenPairUser)).to.bignumber.eq(
            originalFiduBalancesPT.add(expectedRewardsPT)
          )

          expect(await fidu.balanceOf(manyPositionsUser)).to.bignumber.eq(originalFiduBalancesMP.add(expectedRewardsMP))
        })
      })
    })
  })
  context("Router addresses", async () => {
    it("sets core protocol addresses", async () => {
      expect(await router.contracts(routingIdOf("GFI"))).to.eq("0xdab396cCF3d84Cf2D07C4454e10C8A6F5b008D2b")
      expect(await router.contracts(routingIdOf("PoolTokens"))).to.eq("0x57686612C601Cb5213b01AA8e80AfEb24BBd01df")
      expect(await router.contracts(routingIdOf("SeniorPool"))).to.eq("0x8481a6EbAf5c7DABc3F7e09e44A89531fd31F822")
      expect(await router.contracts(routingIdOf("StakingRewards"))).to.eq("0xFD6FF39DA508d281C2d255e9bBBfAb34B6be60c3")
      expect(await router.contracts(routingIdOf("FIDU"))).to.eq("0x6a445E9F40e0b97c92d0b8a3366cEF1d67F700BF")
      expect(await router.contracts(routingIdOf("USDC"))).to.eq("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
      expect(await router.contracts(routingIdOf("ProtocolAdmin"))).to.eq("0xBEb28978B2c755155f20fd3d09Cb37e300A6981f")
      expect(await router.contracts(routingIdOf("PauserAdmin"))).to.eq("0x061e0B0087a01127554FFef8f9C4C6e9447Ad9dD")
    })
  })
})
