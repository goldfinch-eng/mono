/* global web3 */
import hre from "hardhat"
const {deployments, artifacts} = hre
import {expect, BN, deployAllContracts, usdcVal, createPoolWithCreditLine} from "./testHelpers"
import {
  interestAprAsBN,
  LEVERAGE_RATIO_DECIMALS,
  OWNER_ROLE,
  PAUSER_ROLE,
  LEVERAGE_RATIO_SETTER_ROLE,
  TRANCHES,
} from "../blockchain_scripts/deployHelpers"
import {CONFIG_KEYS} from "../blockchain_scripts/configKeys"
import { genLeverageRatioStrategyTests, LeverageRatioStrategyTestSetup } from "./leverageRatioStrategyHelpers"
const DynamicLeverageRatioStrategy = artifacts.require("DynamicLeverageRatioStrategy")
let accounts, borrower

describe("DynamicLeverageRatioStrategy", () => {
  let goldfinchConfig, tranchedPool, seniorPool, strategy, juniorInvestmentAmount, owner

  const setupTest: LeverageRatioStrategyTestSetup = deployments.createFixture(async ({deployments}) => {
    ;[owner, borrower] = await web3.eth.getAccounts()

    const {seniorPool, goldfinchConfig, goldfinchFactory, usdc} = await deployAllContracts(deployments, {
      fromAccount: owner,
    })

    await goldfinchConfig.bulkAddToGoList([owner, borrower])

    juniorInvestmentAmount = usdcVal(10000)
    let limit = juniorInvestmentAmount.mul(new BN(10))
    let interestApr = interestAprAsBN("5.00")
    let paymentPeriodInDays = new BN(30)
    let termInDays = new BN(365)
    let lateFeeApr = new BN(0)
    let juniorFeePercent = new BN(20)
    ;({tranchedPool} = await createPoolWithCreditLine({
      people: {owner, borrower},
      goldfinchFactory,
      juniorFeePercent: juniorFeePercent.toNumber(),
      limit,
      interestApr,
      paymentPeriodInDays,
      termInDays,
      lateFeeApr,
      usdc,
    }))

    const strategy = await DynamicLeverageRatioStrategy.new({from: owner})
    await strategy.initialize(owner, goldfinchConfig.address)

    await tranchedPool.deposit(TRANCHES.Junior, juniorInvestmentAmount)

    return {goldfinchConfig, tranchedPool, seniorPool, strategy, owner}
  })

  beforeEach(async () => {
    accounts = await web3.eth.getAccounts()
    ;[owner] = accounts
    ;({goldfinchConfig, tranchedPool, seniorPool, strategy, owner} = await setupTest())
  })

  describe("ownership", async () => {
    it("should be owned by the owner", async () => {
      expect(await goldfinchConfig.hasRole(OWNER_ROLE, owner)).to.be.true
    })
    it("should give owner the PAUSER_ROLE", async () => {
      expect(await goldfinchConfig.hasRole(PAUSER_ROLE, owner)).to.be.true
    })
    it("should give owner the LEVERAGE_RATIO_SETTER_ROLE", async () => {
      expect(await goldfinchConfig.hasRole(LEVERAGE_RATIO_SETTER_ROLE, owner)).to.be.true
    })
  })

  describe("getLeverageRatio", () => {
    it("should reject if the locked-until timestamp of the info in storage does not equal that of the junior tranche", () => {
      // TODO should be able to accomplish this by calling lockPool() after calling lockJuniorCapital()
      throw new Error()
    })
    it("should return the leverage ratio if the locked-until timestamp of the info in storage equals that of the junior tranche", () => {
      // TODO
      throw new Error()
    })
  })

  describe("setLeverageRatio", () => {
    it("should reject setting the leverage ratio to 0", () => {
      // TODO
      throw new Error()
    })
    it("should reject setting the leverage ratio with a locked-until timestamp of 0", () => {
      // TODO
      throw new Error()
    })
    it("should reject setting the leverage ratio with a locked-until timestamp that does not equal that of the junior tranche", () => {
      // TODO
      throw new Error()
    })
    it("should set the leverage ratio, for a locked-until timestamp that equals that of the junior tranche", () => {
      // TODO
      throw new Error()
    })
    it("should emit a LeverageRatioUpdated event", () => {
      // TODO
      throw new Error()
    })
    describe("onlySetterRole modifier", () => {
      it("should allow the owner, as the setter role, to set the leverage ratio", () => {
        // TODO
        throw new Error()
      })
      it("should allow a non-owner, as the setter role, to set the leverage ratio", () => {
        // TODO
        throw new Error()
      })
      it("should prohibit a non-owner who does not have the setter role from setting the leverage ratio", () => {
        // TODO
        throw new Error()
      })
    })
  })

  genLeverageRatioStrategyTests(setupTest)
})
