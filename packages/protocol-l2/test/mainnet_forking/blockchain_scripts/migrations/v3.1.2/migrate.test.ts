import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"
import hre, {deployments, getNamedAccounts} from "hardhat"
import {asNonNullable, assertIsString} from "@goldfinch-eng/utils"
import {
  getProtocolOwner,
  getTruffleContract,
  getUSDCAddress,
  MAINNET_CHAIN_ID,
  SIGNER_ROLE,
} from "packages/protocol/blockchain_scripts/deployHelpers"

import {TEST_TIMEOUT} from "../../../MainnetForking.test"
import {
  advanceTime,
  expectAction,
  getCurrentTimestamp,
  mineBlock,
  SECONDS_PER_DAY,
  usdcVal,
} from "@goldfinch-eng/protocol/test/testHelpers"
import {
  GoldfinchConfigInstance,
  GoldfinchFactoryInstance,
  MembershipOrchestratorInstance,
  PoolTokensInstance,
  CapitalLedgerInstance,
  UniqueIdentityInstance,
  GoInstance,
  FiduInstance,
  SeniorPoolInstance,
  StakingRewardsInstance,
  GFIInstance,
  RouterInstance,
  ERC20Instance,
  TranchedPoolInstance,
  BackerRewardsInstance,
} from "@goldfinch-eng/protocol/typechain/truffle"
import {routingIdOf} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers/routingIdOf"
import {setupAndDepositPoolToken, setupAndDepositStakedFidu} from "@goldfinch-eng/protocol/test/util/membershipRewards"
import {
  MAINNET_TRUSTED_SIGNER_ADDRESS,
  MAINNET_WARBLER_LABS_MULTISIG,
} from "@goldfinch-eng/protocol/blockchain_scripts/mainnetForkingHelpers"
import {impersonateAccount} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/impersonateAccount"
import {burn} from "@goldfinch-eng/protocol/test/uniqueIdentityHelpers"
import {BN} from "bn.js"
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers"

const setupTest = deployments.createFixture(async () => {
  await deployments.fixture("pendingMainnetMigrations", {keepExistingDeployments: true})

  const {gf_deployer} = await getNamedAccounts()

  assertIsString(gf_deployer)
  await fundWithWhales(["ETH"], [gf_deployer, MAINNET_TRUSTED_SIGNER_ADDRESS])
  await impersonateAccount(hre, await getProtocolOwner())
  await fundWithWhales(["USDC"], [await getProtocolOwner(), gf_deployer, MAINNET_TRUSTED_SIGNER_ADDRESS])
  await fundWithWhales(["GFI"], [await getProtocolOwner(), gf_deployer, MAINNET_TRUSTED_SIGNER_ADDRESS])

  const [_owner, _user, _otherUser, _borrowerAddress] = await web3.eth.getAccounts()
  const owner = asNonNullable(_owner)
  const user = asNonNullable(_user)
  const otherUser = asNonNullable(_otherUser)
  const borrower = asNonNullable(_borrowerAddress)

  const data = {
    membershipOrchestrator: await getTruffleContract<any>("MembershipOrchestrator"),
    capitalLedger: await getTruffleContract<any>("CapitalLedger"),
    router: await getTruffleContract<any>("Router"),
    go: await getTruffleContract<any>("Go"),
    goldfinchFactory: await getTruffleContract<any>("GoldfinchFactory"),
    goldfinchConfig: await getTruffleContract<any>("GoldfinchConfig"),
    usdc: await getTruffleContract<any>("ERC20", {at: getUSDCAddress(MAINNET_CHAIN_ID)}),
    seniorPool: await getTruffleContract<any>("SeniorPool"),
    stakingRewards: await getTruffleContract<any>("StakingRewards"),
    fidu: await getTruffleContract<any>("Fidu"),
    uniqueIdentity: await getTruffleContract<any>("UniqueIdentity"),
    poolTokens: await getTruffleContract<any>("PoolTokens"),
    backerRewards: await getTruffleContract<any>("BackerRewards"),
    gfi: await getTruffleContract<any>("GFI"),
    protocolOwner: await getProtocolOwner(),
    owner,
    borrower,
    user,
    otherUser,
  }

  await fundWithWhales(["USDC", "BUSD", "USDT", "ETH"], [owner, user, otherUser])

  return data
})

describe("v3.1.2", async function () {
  this.timeout(TEST_TIMEOUT)

  let signer: any,
    borrower: string,
    user: string,
    otherUser: string,
    protocolOwner: string,
    membershipOrchestrator: MembershipOrchestratorInstance,
    capitalLedger: CapitalLedgerInstance,
    router: RouterInstance,
    go: GoInstance,
    goldfinchFactory: GoldfinchFactoryInstance,
    goldfinchConfig: GoldfinchConfigInstance,
    poolTokens: PoolTokensInstance,
    backerRewards: BackerRewardsInstance,
    uniqueIdentity: UniqueIdentityInstance,
    fidu: FiduInstance,
    gfi: GFIInstance,
    stakingRewards: StakingRewardsInstance,
    seniorPool: SeniorPoolInstance,
    usdc: ERC20Instance
  let poolTokenDeposit: (
    borrowerAddress: string,
    ownerAddress: string,
    usdcDepositAmount: BN
  ) => Promise<{
    poolTokenId: BN
    tranchedPoolAddress: string
    positionId: BN
    depositResult: Truffle.TransactionResponse<any>
  }>
  let stakedFiduDeposit: (
    ownerAddress: string,
    usdcDepositAmount: BN
  ) => Promise<{
    stakedFiduTokenId: BN
    amountOfStakedFidu: BN
    positionId: BN
    depositResult: Truffle.TransactionResponse<any>
  }>

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({
      membershipOrchestrator,
      capitalLedger,
      router,
      uniqueIdentity,
      go,
      gfi,
      fidu,
      seniorPool,
      poolTokens,
      stakingRewards,
      backerRewards,
      goldfinchConfig,
      goldfinchFactory,
      usdc,
      borrower,
      user,
      otherUser,
      protocolOwner,
    } = await setupTest())

    const allSigners = (await hre.ethers.getSigners()) as [SignerWithAddress]
    signer = await allSigners[0].getAddress()

    await fundWithWhales(["ETH"], [MAINNET_WARBLER_LABS_MULTISIG])

    impersonateAccount(hre, MAINNET_WARBLER_LABS_MULTISIG)
    await uniqueIdentity.grantRole(SIGNER_ROLE, signer, {from: MAINNET_WARBLER_LABS_MULTISIG})

    poolTokenDeposit = async (borrowerAddress: string, ownerAddress: string, usdcDepositAmount: BN) => {
      return await setupAndDepositPoolToken({
        borrowerAddress,
        ownerAddress,
        protocolOwner,
        signer,
        usdcDepositAmount,
        capitalLedger: capitalLedger,
        go: go,
        goldfinchConfig: goldfinchConfig,
        goldfinchFactory: goldfinchFactory,
        membershipOrchestrator: membershipOrchestrator,
        poolTokens: poolTokens,
        uniqueIdentity: uniqueIdentity,
        usdc,
        hre,
      })
    }
    stakedFiduDeposit = async (ownerAddress: string, usdcDepositAmount: BN) => {
      return await setupAndDepositStakedFidu({
        ownerAddress,
        signer,
        usdcDepositAmount,
        capitalLedger: capitalLedger,
        fidu: fidu,
        membershipOrchestrator: membershipOrchestrator,
        seniorPool: seniorPool,
        stakingRewards: stakingRewards,
        uniqueIdentity: uniqueIdentity,
        usdc,
        hre,
      })
    }
  })

  describe("harvest", () => {
    it("harvests a pool token", async () => {
      const {positionId, poolTokenId, tranchedPoolAddress} = await poolTokenDeposit(borrower, user, usdcVal(100))

      const tranchedPool = (await getTruffleContract<any>("TranchedPool", {
        at: tranchedPoolAddress,
      })) as TranchedPoolInstance
      await tranchedPool.drawdown(usdcVal(10), {from: borrower})
      await advanceTime({days: 30})
      await tranchedPool.pay(usdcVal(5), {from: borrower})

      const expectedGFI = (await backerRewards.stakingRewardsEarnedSinceLastWithdraw(poolTokenId)).add(
        await backerRewards.poolTokenClaimableRewards(poolTokenId)
      )

      await expectAction(async () => await membershipOrchestrator.harvest([positionId], {from: user})).toChange([
        [async () => await gfi.balanceOf(user), {by: expectedGFI}],
        [async () => await usdc.balanceOf(user), {by: new BN("94987672")}],
      ])
    })

    it("harvests a staked fidu position", async () => {
      const {positionId, stakedFiduTokenId} = await stakedFiduDeposit(user, usdcVal(100))

      // harvest before time change so we get consistent results
      await membershipOrchestrator.harvest([positionId], {from: user})
      await advanceTime({days: 30})
      await mineBlock() // must mine a block to apply time advance

      const expectedGFI = await stakingRewards.optimisticClaimable(stakedFiduTokenId)

      await expectAction(async () => await membershipOrchestrator.harvest([positionId], {from: user})).toChange([
        [async () => await gfi.balanceOf(user), {byCloseTo: expectedGFI}],
      ])
    })

    it("harvests both a pool token and staked fidu position", async () => {
      const {positionId: fiduPositionId, stakedFiduTokenId} = await stakedFiduDeposit(user, usdcVal(100))
      // harvest before time change so we get consistent results
      await membershipOrchestrator.harvest([fiduPositionId], {from: user})

      const {
        positionId: poolPositionId,
        poolTokenId,
        tranchedPoolAddress,
      } = await poolTokenDeposit(borrower, user, usdcVal(100))

      const tranchedPool = (await getTruffleContract<any>("TranchedPool", {
        at: tranchedPoolAddress,
      })) as TranchedPoolInstance
      await tranchedPool.drawdown(usdcVal(10), {from: borrower})
      await advanceTime({days: 30})
      await tranchedPool.pay(usdcVal(5), {from: borrower})

      const expectedGFI = (await backerRewards.stakingRewardsEarnedSinceLastWithdraw(poolTokenId))
        .add(await backerRewards.poolTokenClaimableRewards(poolTokenId))
        .add(await stakingRewards.optimisticClaimable(stakedFiduTokenId))

      await expectAction(
        async () => await membershipOrchestrator.harvest([poolPositionId, fiduPositionId], {from: user})
      ).toChange([
        [async () => await gfi.balanceOf(user), {byCloseTo: expectedGFI}],
        [async () => await usdc.balanceOf(user), {by: new BN("94987672")}],
      ])
    })

    it("does not harvest 0 positions", async () => {
      await expect(membershipOrchestrator.harvest([], {from: user})).to.be.rejected
    })

    it("does not harvest an unowned position", async () => {
      const {positionId: stakedFiduId} = await stakedFiduDeposit(otherUser, usdcVal(100))

      await expect(membershipOrchestrator.harvest([stakedFiduId], {from: user})).to.be.rejected
    })

    it("does not harvest if not golisted", async () => {
      const {positionId: poolTokenId} = await poolTokenDeposit(borrower, user, usdcVal(100))

      {
        // Revoke UID after staking & depositing
        const nonce = await uniqueIdentity.nonces(user)
        const expiresAt = (await getCurrentTimestamp()).add(SECONDS_PER_DAY)
        await burn(hre, uniqueIdentity, user, new BN(0), expiresAt, nonce, signer, undefined, user)
      }

      await expect(membershipOrchestrator.harvest([poolTokenId], {from: user})).to.be.rejected
    })

    it("still harvests interest on a late pool", async () => {
      const {positionId, tranchedPoolAddress} = await poolTokenDeposit(borrower, user, usdcVal(100))

      const tranchedPool = (await getTruffleContract<any>("TranchedPool", {
        at: tranchedPoolAddress,
      })) as TranchedPoolInstance
      await tranchedPool.drawdown(usdcVal(10), {from: borrower})
      await advanceTime({days: 30})
      await tranchedPool.pay(usdcVal(5), {from: borrower})

      // Make the pool late
      await advanceTime({days: 60})

      await expectAction(async () => await membershipOrchestrator.harvest([positionId], {from: user})).toChange([
        [async () => await gfi.balanceOf(user), {by: new BN("0")}],
        [async () => await usdc.balanceOf(user), {by: new BN("94987672")}],
      ])
    })
  })

  describe("router", () => {
    it("set the backer rewards address", async () => {
      expect(await router.contracts(routingIdOf("BackerRewards"))).to.eq("0x384860F14B39CcD9C89A73519c70cD5f5394D0a6")
    })

    it("set go address", async () => {
      expect(await router.contracts(routingIdOf("Go"))).to.eq("0x84AC02474c4656C88d4e08FCA63ff73070787C3d")
    })
  })

  describe("go list", () => {
    it("added capital ledger to golist", async () => {
      expect(await go.go(capitalLedger.address)).to.be.true
    })
  })
})
