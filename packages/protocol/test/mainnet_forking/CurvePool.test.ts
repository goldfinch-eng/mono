import hre, {ethers, artifacts} from "hardhat"
import {
  FiduInstance,
  GoInstance,
  GoldfinchConfigInstance,
  GoldfinchFactoryInstance,
  ICurveLPInstance,
  IERC20Instance,
  SeniorPoolInstance,
  UniqueIdentityInstance,
} from "@goldfinch-eng/protocol/typechain/truffle"
import {
  expect,
  BN,
  getDeployedAsTruffleContract,
  toEthers,
  erc20Approve,
  MAX_UINT,
  usdcVal,
  bigVal,
} from "../testHelpers"
import {
  getTruffleContract,
  getUSDCAddress,
  MAINNET_CHAIN_ID,
  MAINNET_FIDU_USDC_CURVE_LP_ADDRESS,
} from "../../blockchain_scripts/deployHelpers"
import {UniqueIdentity} from "@goldfinch-eng/protocol/typechain/ethers"
import {asNonNullable, assertNonNullable} from "@goldfinch-eng/utils"
import {impersonateAccount} from "../../blockchain_scripts/helpers/impersonateAccount"
import {fundWithWhales} from "../../blockchain_scripts/helpers/fundWithWhales"
import {MAINNET_GOVERNANCE_MULTISIG} from "../../blockchain_scripts/mainnetForkingHelpers"
import {getExistingContracts} from "../../blockchain_scripts/deployHelpers/getExistingContracts"
import {JsonRpcSigner} from "@ethersproject/providers"
import {DeploymentsExtension} from "hardhat-deploy/types"
const {deployments, web3} = hre

/**
 * If the curve pool is very imbalanced, tests may start to fail in this file when the mainnet
 * forking block is updated.
 *
 * Instead of changing the tolerances, first look at updating the SEED_AMOUNT. This adds extra
 * liquidity to the curve pool, resulting in a lower price impact.
 */
const SEED_AMOUNT = 10_000_000 // USD value seeded to the curve pool before tests

const TEST_TIMEOUT = 180000 // 3 mins
const TOLERANCE = bigVal(1).mul(new BN(15)).div(new BN(100)) // 15%
const LARGE_TOLERANCE = TOLERANCE.mul(new BN(2)) // 30%

/**
 * These mainnet forking tests validate our assumptions
 * about how the Curve pool works.
 */
describe("the FIDU-USDC Curve Pool", async function () {
  let resources: TestResources
  let goListedUser: string

  beforeEach(async () => {
    this.timeout(TEST_TIMEOUT)

    resources = await deployments.createFixture(setupResources)()
    await fundOwnerAccountAndGoList(resources)
    await setupSeniorPool(resources)
    await seedCurvePool(resources)

    goListedUser = await getGoListedUser(resources)
  })

  //==============================================================
  // START: Property assertions
  //==============================================================
  describe("coins", () => {
    it("returns fidu at index 0", async () => {
      const {curvePool, fidu} = resources
      expect(await curvePool.coins("0")).to.equal(fidu.address)
    })

    it("returns usdc at index 1", async () => {
      const {curvePool, usdc} = resources
      expect(await curvePool.coins("1")).to.equal(usdc.address)
    })
  })
  //==============================================================
  // END: Property assertions
  //==============================================================

  //==============================================================
  // START: Adding liquidity
  //==============================================================
  context("when double-sided liquidity is added to the pool", async () => {
    let fiduBalanceBefore: BN
    let totalSupplyBefore: BN
    let fiduDeposited: BN
    let curveLPTokensReceived: BN

    beforeEach(async () => {
      const {fidu, curvePool, curveLPToken} = resources

      fiduBalanceBefore = await curvePool.balances(0)
      totalSupplyBefore = await curveLPToken.totalSupply()

      await fundWithWhales(["USDC"], [goListedUser], 5_000_000)

      const {usdcAmountToDeposit, usdcAmountForFiduToDeposit} = await calculateBalancedDepositAmounts(
        usdcVal(5_000_000),
        resources
      )

      await depositToSeniorPool(usdcAmountForFiduToDeposit, resources, {from: goListedUser})

      fiduDeposited = await fidu.balanceOf(goListedUser)
      await addLiquidity(usdcAmountToDeposit, fiduDeposited, resources, {from: goListedUser})

      curveLPTokensReceived = await curveLPToken.balanceOf(goListedUser)
    })

    it("updates the total balance of FIDU in the Curve pool correctly", async () => {
      const {curvePool} = resources

      const fiduBalance = await curvePool.balances(0)
      expect(fiduBalance).to.bignumber.eq(fiduBalanceBefore.add(fiduDeposited))
    })

    it("updates the total supply of Curve LP tokens correctly", async () => {
      const {curveLPToken} = resources

      const totalSupply = await curveLPToken.totalSupply()
      expect(totalSupply).to.bignumber.eq(totalSupplyBefore.add(curveLPTokensReceived))
    })

    it("mints the correct number of Curve LP tokens to the depositor", async () => {
      expect(curveLPTokensReceived).to.bignumber.closeTo(fiduDeposited, fiduDeposited.mul(TOLERANCE).div(bigVal(1)))
    })
  })

  context("when single-sided USDC is added to the pool", async () => {
    let fiduBalanceBefore: BN
    let totalSupplyBefore: BN
    let curveLPTokensReceived: BN

    beforeEach(async () => {
      const {curvePool, curveLPToken} = resources

      fiduBalanceBefore = await curvePool.balances(0)
      totalSupplyBefore = await curveLPToken.totalSupply()

      await fundWithWhales(["USDC"], [goListedUser], 5_000_000)
      await addLiquidity(usdcVal(5_000_000), new BN(0), resources, {from: goListedUser})

      curveLPTokensReceived = await curveLPToken.balanceOf(goListedUser)
    })

    it("does not update the total balance of FIDU", async () => {
      const {curvePool} = resources

      const fiduBalance = await curvePool.balances(0)
      expect(fiduBalance).to.bignumber.eq(fiduBalanceBefore)
    })

    it("updates the total supply of Curve LP tokens correctly", async () => {
      const {curveLPToken} = resources

      const totalSupply = await curveLPToken.totalSupply()
      expect(totalSupply).to.bignumber.eq(totalSupplyBefore.add(curveLPTokensReceived))
    })

    it("mints the correct number of Curve LP tokens to the depositor", async () => {
      expect(curveLPTokensReceived).to.bignumber.lt(bigVal(2_500_000))
      expect(curveLPTokensReceived).to.bignumber.gt(bigVal(1_500_000))
    })
  })

  context("when single-sided FIDU is added to the pool", async () => {
    let fiduBalanceBefore: BN
    let totalSupplyBefore: BN
    let fiduDeposited: BN
    let curveLPTokensReceived: BN

    beforeEach(async () => {
      const {fidu, curvePool, curveLPToken} = resources

      fiduBalanceBefore = await curvePool.balances(0)
      totalSupplyBefore = await curveLPToken.totalSupply()

      await fundWithWhales(["USDC"], [goListedUser], 5_000_000)
      await depositToSeniorPool(usdcVal(5_000_000), resources, {from: goListedUser})

      fiduDeposited = await fidu.balanceOf(goListedUser)
      await addLiquidity(usdcVal(0), fiduDeposited, resources, {from: goListedUser})

      curveLPTokensReceived = await curveLPToken.balanceOf(goListedUser)
    })

    it("updates the total balance of FIDU in the Curve pool correctly", async () => {
      const {curvePool} = resources

      const fiduBalance = await curvePool.balances(0)
      expect(fiduBalance).to.bignumber.eq(fiduBalanceBefore.add(fiduDeposited))
    })

    it("updates the total supply of Curve LP tokens correctly", async () => {
      const {curveLPToken} = resources

      const totalSupply = await curveLPToken.totalSupply()
      expect(totalSupply).to.bignumber.eq(totalSupplyBefore.add(curveLPTokensReceived))
    })

    it("mints the correct number of Curve LP tokens to the depositor", async () => {
      expect(curveLPTokensReceived).to.bignumber.lt(bigVal(2_500_000))
      expect(curveLPTokensReceived).to.bignumber.gt(bigVal(1_500_000))
    })
  })

  //==============================================================
  // END: Adding liquidity
  //==============================================================

  //==============================================================
  // START: Removing liquidity
  //==============================================================

  context("when double-sided liquidity is removed from the pool", async () => {
    let fiduBalanceBefore: BN
    let totalLPTokenSupplyBefore: BN
    let fiduDeposited: BN
    let userLPTokensBefore: BN
    let lpTokensWithdrawn: BN

    beforeEach(async () => {
      const {fidu, curvePool, curveLPToken} = resources

      // First add liquidity
      await fundWithWhales(["USDC"], [goListedUser], 5_000_000)
      const {usdcAmountToDeposit, usdcAmountForFiduToDeposit} = await calculateBalancedDepositAmounts(
        usdcVal(5_000_000),
        resources
      )
      await depositToSeniorPool(usdcAmountForFiduToDeposit, resources, {from: goListedUser})
      fiduDeposited = await fidu.balanceOf(goListedUser)
      await addLiquidity(usdcAmountToDeposit, fiduDeposited, resources, {from: goListedUser})

      fiduBalanceBefore = await curvePool.balances(0)
      totalLPTokenSupplyBefore = await curveLPToken.totalSupply()
      userLPTokensBefore = await curveLPToken.balanceOf(goListedUser)

      // Then remove half of the supplied liquidity
      lpTokensWithdrawn = userLPTokensBefore.div(new BN(2))
      await curvePool.remove_liquidity(lpTokensWithdrawn.toString(10), [0, 0], {from: goListedUser})
    })

    it("returns the withdrawn FIDU to the user", async () => {
      const {fidu} = resources

      const userFiduBalance = await fidu.balanceOf(goListedUser)
      const expectedFiduWithdrawnAmount = fiduDeposited.div(new BN(2))
      expect(userFiduBalance).to.bignumber.closeTo(
        expectedFiduWithdrawnAmount,
        expectedFiduWithdrawnAmount.mul(TOLERANCE).div(bigVal(1))
      )
    })

    it("updates the total balance of FIDU in the Curve pool correctly", async () => {
      const {curvePool, fidu} = resources

      const userFiduBalance = await fidu.balanceOf(goListedUser)
      const fiduBalance = await curvePool.balances(0)
      expect(fiduBalance).to.bignumber.eq(fiduBalanceBefore.sub(userFiduBalance))
    })

    it("updates the total supply of Curve LP tokens correctly", async () => {
      const {curveLPToken} = resources

      const totalSupply = await curveLPToken.totalSupply()
      expect(totalSupply).to.bignumber.eq(totalLPTokenSupplyBefore.sub(lpTokensWithdrawn))
    })

    it("burns the correct number of Curve LP tokens from the withdrawer", async () => {
      const {curveLPToken} = resources

      const userLPTokens = await curveLPToken.balanceOf(goListedUser)
      expect(userLPTokens).to.bignumber.eq(userLPTokensBefore.sub(lpTokensWithdrawn))
    })
  })

  context("when single-sided USDC is removed from the pool", async () => {
    let fiduBalanceBefore: BN
    let usdcBalanceBefore: BN
    let totalLPTokenSupplyBefore: BN
    let usdcDeposited: BN
    let fiduDeposited: BN
    let userLPTokensBefore: BN
    let lpTokensWithdrawn: BN

    beforeEach(async () => {
      const {fidu, curvePool, curveLPToken} = resources

      // First add liquidity
      await fundWithWhales(["USDC"], [goListedUser], 5_000_000)
      const {usdcAmountToDeposit, usdcAmountForFiduToDeposit} = await calculateBalancedDepositAmounts(
        usdcVal(5_000_000),
        resources
      )
      await depositToSeniorPool(usdcAmountForFiduToDeposit, resources, {from: goListedUser})
      fiduDeposited = await fidu.balanceOf(goListedUser)
      usdcDeposited = usdcAmountToDeposit
      await addLiquidity(usdcAmountToDeposit, fiduDeposited, resources, {from: goListedUser})

      fiduBalanceBefore = await curvePool.balances(0)
      usdcBalanceBefore = await curvePool.balances(1)
      totalLPTokenSupplyBefore = await curveLPToken.totalSupply()
      userLPTokensBefore = await curveLPToken.balanceOf(goListedUser)

      // Then remove half of the supplied liquidity in USDC
      lpTokensWithdrawn = userLPTokensBefore.div(new BN(2))
      await curvePool.remove_liquidity_one_coin(lpTokensWithdrawn.toString(10), 1, 0, {from: goListedUser})
    })

    it("returns USDC to the user", async () => {
      const {usdc} = resources

      const userUsdcBalance = await usdc.balanceOf(goListedUser)
      expect(userUsdcBalance).to.bignumber.closeTo(usdcDeposited, usdcDeposited.mul(TOLERANCE).div(bigVal(1)))
    })

    it("does not return any FIDU to the user", async () => {
      const {fidu} = resources

      const userFiduBalance = await fidu.balanceOf(goListedUser)
      expect(userFiduBalance).to.bignumber.eq(new BN(0))
    })

    it("does not update the total balance of FIDU", async () => {
      const {curvePool} = resources

      const fiduBalance = await curvePool.balances(0)
      expect(fiduBalance).to.bignumber.eq(fiduBalanceBefore)
    })

    it("updates the total balance of USDC correctly", async () => {
      const {curvePool, usdc} = resources

      const usdcBalance = await curvePool.balances(1)
      const userUsdcBalance = await usdc.balanceOf(goListedUser)
      expect(usdcBalance).to.bignumber.closeTo(usdcBalanceBefore.sub(userUsdcBalance), new BN(3))
    })

    it("updates the total supply of Curve LP tokens correctly", async () => {
      const {curveLPToken} = resources

      const totalSupply = await curveLPToken.totalSupply()
      expect(totalSupply).to.bignumber.eq(totalLPTokenSupplyBefore.sub(lpTokensWithdrawn))
    })

    it("burns the correct number of Curve LP tokens to the withdrawer", async () => {
      const {curveLPToken} = resources

      const userLPTokens = await curveLPToken.balanceOf(goListedUser)
      expect(userLPTokens).to.bignumber.eq(userLPTokensBefore.sub(lpTokensWithdrawn))
    })
  })

  context("when single-sided FIDU is removed from the pool", async () => {
    let fiduBalanceBefore: BN
    let usdcBalanceBefore: BN
    let goListedUserUsdcBalanceBefore: BN
    let totalLPTokenSupplyBefore: BN
    let fiduDeposited: BN
    let userLPTokensBefore: BN
    let lpTokensWithdrawn: BN

    beforeEach(async () => {
      const {fidu, curvePool, curveLPToken, usdc} = resources

      goListedUserUsdcBalanceBefore = await usdc.balanceOf(goListedUser)

      // First add liquidity
      await fundWithWhales(["USDC"], [goListedUser], 5_000_000)
      const {usdcAmountToDeposit, usdcAmountForFiduToDeposit} = await calculateBalancedDepositAmounts(
        usdcVal(5_000_000),
        resources
      )
      await depositToSeniorPool(usdcAmountForFiduToDeposit, resources, {from: goListedUser})
      fiduDeposited = await fidu.balanceOf(goListedUser)
      await addLiquidity(usdcAmountToDeposit, fiduDeposited, resources, {from: goListedUser})

      fiduBalanceBefore = await curvePool.balances(0)
      usdcBalanceBefore = await curvePool.balances(1)
      totalLPTokenSupplyBefore = await curveLPToken.totalSupply()
      userLPTokensBefore = await curveLPToken.balanceOf(goListedUser)

      // Then remove half of the supplied liquidity in FIDU
      lpTokensWithdrawn = userLPTokensBefore.div(new BN(2))
      await curvePool.remove_liquidity_one_coin(lpTokensWithdrawn.toString(10), 0, 0, {from: goListedUser})
    })

    it("returns FIDU to the user", async () => {
      const {fidu} = resources

      const userFiduBalance = await fidu.balanceOf(goListedUser)
      expect(userFiduBalance).to.bignumber.closeTo(fiduDeposited, fiduDeposited.mul(TOLERANCE).div(bigVal(1)))
    })

    it("does not return any withdrawn USDC to the user", async () => {
      const {usdc} = resources

      const userUsdcBalance = await usdc.balanceOf(goListedUser)
      expect(userUsdcBalance).to.bignumber.closeTo(goListedUserUsdcBalanceBefore, new BN(3))
    })

    it("updates the total balance of FIDU in the Curve pool correctly", async () => {
      const {curvePool, fidu} = resources

      const fiduBalance = await curvePool.balances(0)
      const userFiduBalance = await fidu.balanceOf(goListedUser)
      expect(fiduBalance).to.bignumber.eq(fiduBalanceBefore.sub(userFiduBalance))
    })

    it("does not update the total balance of USDC in the Curve pool", async () => {
      const {curvePool} = resources

      const usdcBalance = await curvePool.balances(1)
      expect(usdcBalance).to.bignumber.eq(usdcBalanceBefore)
    })

    it("updates the total supply of Curve LP tokens correctly", async () => {
      const {curveLPToken} = resources

      const totalSupply = await curveLPToken.totalSupply()
      expect(totalSupply).to.bignumber.eq(totalLPTokenSupplyBefore.sub(lpTokensWithdrawn))
    })

    it("burns the correct number of Curve LP tokens to the withdrawer", async () => {
      const {curveLPToken} = resources

      const userLPTokens = await curveLPToken.balanceOf(goListedUser)
      expect(userLPTokens).to.bignumber.eq(userLPTokensBefore.sub(lpTokensWithdrawn))
    })
  })

  //==============================================================
  // END: Removing liquidity
  //==============================================================

  //==============================================================
  // START: Swaps
  //==============================================================

  context("when someone swaps USDC for FIDU in the pool", async () => {
    let fiduBalanceBefore: BN
    let usdcBalanceBefore: BN
    let totalLPTokenSupplyBefore: BN
    let usdcExchanged: BN

    beforeEach(async () => {
      const {usdc, curvePool, curveLPToken} = resources

      fiduBalanceBefore = await curvePool.balances(0)
      usdcBalanceBefore = await curvePool.balances(1)
      totalLPTokenSupplyBefore = await curveLPToken.totalSupply()

      await fundWithWhales(["USDC"], [goListedUser], 1_000_000)
      usdcExchanged = usdcVal(1_000_000)
      await erc20Approve(usdc, curvePool.address, usdcExchanged, [goListedUser])
      await curvePool.exchange(1, 0, usdcExchanged, new BN(0), {from: goListedUser})
    })

    it("returns FIDU to the user", async () => {
      const {fidu, seniorPool} = resources

      const sharePrice = await seniorPool.sharePrice()
      const userFiduBalance = await fidu.balanceOf(goListedUser)
      const expected = usdcExchanged.mul(bigVal(1)).div(usdcVal(1)).mul(bigVal(1)).div(sharePrice)

      expect(userFiduBalance).to.bignumber.closeTo(expected, expected.mul(LARGE_TOLERANCE).div(bigVal(1)))
    })

    it("updates the total balance of FIDU in the Curve pool correctly", async () => {
      const {curvePool, fidu} = resources

      const fiduBalance = await curvePool.balances(0)
      const userFiduBalance = await fidu.balanceOf(goListedUser)
      expect(fiduBalance).to.bignumber.eq(fiduBalanceBefore.sub(userFiduBalance))
    })

    it("updates the total balance of USDC in the Curve pool correctly", async () => {
      const {curvePool} = resources

      const usdcBalance = await curvePool.balances(1)
      expect(usdcBalance).to.bignumber.eq(usdcBalanceBefore.add(usdcExchanged))
    })

    it("does not update the total supply of Curve LP tokens", async () => {
      const {curveLPToken} = resources

      const curveLPTokens = await curveLPToken.totalSupply()
      expect(curveLPTokens).to.bignumber.eq(totalLPTokenSupplyBefore)
    })
  })

  context("when someone swaps FIDU for USDC in the pool", async () => {
    let fiduBalanceBefore: BN
    let usdcBalanceBefore: BN
    let totalLPTokenSupplyBefore: BN
    let fiduDeposited: BN

    beforeEach(async () => {
      const {curvePool, curveLPToken, fidu} = resources

      fiduBalanceBefore = await curvePool.balances(0)
      usdcBalanceBefore = await curvePool.balances(1)
      totalLPTokenSupplyBefore = await curveLPToken.totalSupply()

      await fundWithWhales(["USDC"], [goListedUser], 1_000_000)
      await depositToSeniorPool(usdcVal(1_000_000), resources, {from: goListedUser})
      fiduDeposited = await fidu.balanceOf(goListedUser)
      await erc20Approve(fidu, curvePool.address, fiduDeposited, [goListedUser])

      await curvePool.exchange(0, 1, fiduDeposited, 0, {from: goListedUser})
    })

    it("returns USDC to the user", async () => {
      const {usdc, seniorPool} = resources

      const userUsdcBalance = await usdc.balanceOf(goListedUser)
      const expectedUsdcAmount = fiduDeposited
        .mul(await seniorPool.sharePrice())
        .mul(usdcVal(1))
        .div(bigVal(1))
        .div(bigVal(1))
      expect(userUsdcBalance).to.bignumber.closeTo(
        expectedUsdcAmount,
        expectedUsdcAmount.mul(LARGE_TOLERANCE).div(bigVal(1))
      )
    })

    it("updates the total balance of FIDU in the Curve pool correctly", async () => {
      const {curvePool} = resources

      const fiduBalance = await curvePool.balances(0)
      expect(fiduBalance).to.bignumber.eq(fiduBalanceBefore.add(fiduDeposited))
    })

    it("updates the total balance of USDC in the Curve pool correctly", async () => {
      const {curvePool, usdc} = resources

      const usdcBalance = await curvePool.balances(1)
      const userUsdcBalance = await usdc.balanceOf(goListedUser)
      expect(usdcBalance).to.bignumber.eq(usdcBalanceBefore.sub(userUsdcBalance))
    })

    it("does not update the total supply of Curve LP tokens", async () => {
      const {curveLPToken} = resources

      const curveLPTokens = await curveLPToken.totalSupply()
      expect(curveLPTokens).to.bignumber.eq(totalLPTokenSupplyBefore)
    })
  })

  //==============================================================
  // END: Swaps
  //==============================================================
})

//==============================================================
// START: Test Setup
//==============================================================
type TestResources = GoldfinchResources & ERC20Resources & ExternalResources & AccountResources

type GoldfinchResources = {
  seniorPool: SeniorPoolInstance
  fidu: FiduInstance
  goldfinchConfig: GoldfinchConfigInstance
  legacyGoldfinchConfig: GoldfinchConfigInstance
  goldfinchFactory: GoldfinchFactoryInstance
  go: GoInstance
}

type ExternalResources = {
  curvePool: ICurveLPInstance
  curveLPToken: IERC20Instance
}

type ERC20Resources = {
  usdc: IERC20Instance
}

type AccountResources = {
  owner: string
  bwr: string
}

async function setupResources({deployments}: {deployments: DeploymentsExtension}): Promise<TestResources> {
  await deployments.fixture("baseDeploy", {keepExistingDeployments: true})

  const [owner, bwr] = await web3.eth.getAccounts()
  assertNonNullable(owner)
  assertNonNullable(bwr)

  await fundWithWhales(["ETH"], [owner, MAINNET_GOVERNANCE_MULTISIG])

  // Impersonate multisig
  await impersonateAccount(hre, MAINNET_GOVERNANCE_MULTISIG)
  const mainnetMultisigSigner = ethers.provider.getSigner(MAINNET_GOVERNANCE_MULTISIG)

  // Set up Goldfinch contracts
  const goldfinchContracts = await setupGoldfinchResources(mainnetMultisigSigner)

  // Set up ERC20 contracts
  const erc20Contracts = await setupERC20Resources()

  // Set up external contracts
  const externalContracts = await setupExternalResources()

  const uniqueIdentity = await getDeployedAsTruffleContract<UniqueIdentityInstance>(deployments, "UniqueIdentity")
  const ethersUniqueIdentity = await toEthers<UniqueIdentity>(uniqueIdentity)
  const signer = ethersUniqueIdentity.signer
  assertNonNullable(signer.provider, "Signer provider is null")

  return {
    ...goldfinchContracts,
    ...erc20Contracts,
    ...externalContracts,
    owner,
    bwr,
  }
}

async function setupGoldfinchResources(mainnetMultisigSigner: JsonRpcSigner): Promise<GoldfinchResources> {
  const contractNames = ["SeniorPool", "Fidu", "GoldfinchFactory", "GoldfinchConfig", "Go"]
  const existingContracts = await getExistingContracts(contractNames, mainnetMultisigSigner)
  assertNonNullable(existingContracts.SeniorPool)
  assertNonNullable(existingContracts.Fidu)
  assertNonNullable(existingContracts.GoldfinchConfig)
  assertNonNullable(existingContracts.GoldfinchFactory)

  const seniorPool: SeniorPoolInstance = await artifacts
    .require("SeniorPool")
    .at(existingContracts.SeniorPool.ExistingContract.address)
  const fidu: FiduInstance = await artifacts.require("Fidu").at(existingContracts.Fidu.ExistingContract.address)
  const goldfinchConfig: GoldfinchConfigInstance = await artifacts
    .require("GoldfinchConfig")
    .at(existingContracts.GoldfinchConfig.ExistingContract.address)
  const goldfinchFactory: GoldfinchFactoryInstance = await artifacts
    .require("GoldfinchFactory")
    .at(existingContracts.GoldfinchFactory.ExistingContract.address)
  const go: GoInstance = await artifacts.require("Go").at(existingContracts.Go?.ExistingContract.address)
  const legacyGoldfinchConfig: GoldfinchConfigInstance = await artifacts
    .require("GoldfinchConfig")
    .at(await go.legacyGoList())

  return {seniorPool, fidu, goldfinchConfig, goldfinchFactory, go, legacyGoldfinchConfig}
}

async function setupERC20Resources(): Promise<ERC20Resources> {
  const usdc = await artifacts.require("IERC20withDec").at(getUSDCAddress(MAINNET_CHAIN_ID) as string)
  return {usdc}
}

async function setupExternalResources(): Promise<ExternalResources> {
  const curvePool: ICurveLPInstance = await artifacts.require("ICurveLP").at(MAINNET_FIDU_USDC_CURVE_LP_ADDRESS)
  const curveLPToken: IERC20Instance = await artifacts.require("IERC20withDec").at((await curvePool.token()) as string)

  return {curvePool, curveLPToken}
}

async function fundOwnerAccountAndGoList(resources: TestResources) {
  const {legacyGoldfinchConfig, owner, bwr} = resources

  await legacyGoldfinchConfig.bulkAddToGoList([owner, bwr], {from: MAINNET_GOVERNANCE_MULTISIG})
}

async function setupSeniorPool(resources: TestResources) {
  const {usdc, seniorPool, owner, goldfinchConfig, legacyGoldfinchConfig} = resources

  await fundWithWhales(["USDC"], [owner], 10000)

  // Increase the Senior Pool limit so we can perform large deposits
  await goldfinchConfig.setNumber(1, new BN(400000000000000), {from: MAINNET_GOVERNANCE_MULTISIG})
  await legacyGoldfinchConfig.setNumber(1, new BN(400000000000000), {from: MAINNET_GOVERNANCE_MULTISIG})

  await erc20Approve(usdc, seniorPool.address, MAX_UINT, [owner])
  await seniorPool.deposit(usdcVal(10000), {from: owner})
}

async function seedCurvePool(resources: TestResources) {
  const {usdc, fidu, seniorPool, curvePool, owner} = resources

  await fundWithWhales(["USDC"], [owner], SEED_AMOUNT)

  await erc20Approve(usdc, curvePool.address, MAX_UINT, [owner])
  await erc20Approve(fidu, curvePool.address, MAX_UINT, [owner])

  const {usdcAmountToDeposit, usdcAmountForFiduToDeposit} = await calculateBalancedDepositAmounts(
    usdcVal(SEED_AMOUNT),
    resources
  )

  await seniorPool.deposit(usdcAmountForFiduToDeposit, {from: owner})
  const fiduBalance = await fidu.balanceOf(owner)

  await curvePool.add_liquidity([fiduBalance, usdcAmountToDeposit], new BN(0), false, owner, {
    from: owner,
  })
}

async function getGoListedUser(resources: TestResources) {
  const {go} = resources
  const [, , , , maybeUser] = await hre.getUnnamedAccounts()
  const goListedUser = asNonNullable(maybeUser)

  const legacyGoList = await go.legacyGoList()
  const goldfinchConfigWithGoList = await getTruffleContract<GoldfinchConfigInstance>("GoldfinchConfig", {
    at: legacyGoList,
  })

  await goldfinchConfigWithGoList.addToGoList(goListedUser)
  return goListedUser
}

//==============================================================
// END: Test Setup
//==============================================================

//==============================================================
// START: Senior Pool and Curve helpers
//==============================================================
async function depositToSeniorPool(usdcAmount: BN, resources: TestResources, options: {from: string}) {
  const {usdc, seniorPool} = resources

  await erc20Approve(usdc, seniorPool.address, usdcAmount, [options.from])
  await seniorPool.deposit(usdcAmount, {from: options.from})
}

type CurveDepositAmounts = {
  usdcAmountToDeposit: BN
  usdcAmountForFiduToDeposit: BN
}

// Given a total USDC amount, returns the amount of USDC to deposit into Curve and the USDC needed to purchase FIDU
// at sharePrice() in order to perform a balanced Curve deposit.
async function calculateBalancedDepositAmounts(usdcAmount: BN, resources: TestResources): Promise<CurveDepositAmounts> {
  const {seniorPool} = resources
  const fiduPrice = await seniorPool.sharePrice()

  const divider = bigVal(1).add(fiduPrice)
  const usdcAmountToDeposit = usdcAmount.mul(bigVal(1)).div(divider)
  const usdcAmountForFiduToDeposit = usdcAmountToDeposit.mul(fiduPrice).div(bigVal(1))

  return {
    usdcAmountToDeposit,
    usdcAmountForFiduToDeposit,
  }
}

async function addLiquidity(
  usdcAmount: BN,
  fiduAmount: BN,
  resources: TestResources,
  options: {from: string}
): Promise<void> {
  const {usdc, fidu, curvePool} = resources

  await erc20Approve(usdc, curvePool.address, usdcAmount, [options.from])
  await erc20Approve(fidu, curvePool.address, fiduAmount, [options.from])

  await curvePool.add_liquidity([fiduAmount.toString(10), usdcAmount.toString(10)], 0, false, options.from, options)
}

//==============================================================
// END: Senior Pool and Curve helpers
//==============================================================
