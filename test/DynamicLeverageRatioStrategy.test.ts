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
import {genLeverageRatioStrategyTests, LeverageRatioStrategyTestSetup} from "./leverageRatioStrategyHelpers"
import {GoldfinchConfig} from "../typechain/ethers"
import {DynamicLeverageRatioStrategyInstance} from "../typechain/truffle"
const DynamicLeverageRatioStrategy = artifacts.require("DynamicLeverageRatioStrategy")
let accounts, borrower

const EXPECTED_LEVERAGE_RATIO: BN = new BN(String(4e18))

const setLeverageRatio = async (
  leverageRatio: BN,
  strategy: DynamicLeverageRatioStrategyInstance,
  tranchedPool: any,
  config: GoldfinchConfig,
  owner: any
): Promise<void> => {
  // We expect the junior tranche to have been locked by this point. So we just
  // confirm that, and obtain the locked-until timestamp needed for setting the
  // leverage ratio.
  const juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
  const juniorTrancheLockedUntil = new BN(juniorTranche.lockedUntil)
  expect(juniorTrancheLockedUntil).to.be.bignumber.gt(new BN(0))

  await strategy.setLeverageRatio(
    tranchedPool.address,
    leverageRatio,
    juniorTrancheLockedUntil,
    "DynamicLeverageRatioStrategy test",
    {from: owner}
  )
}

describe("DynamicLeverageRatioStrategy", () => {
  let goldfinchConfig, tranchedPool, seniorPool, strategy, juniorInvestmentAmount, owner

  const setupTest: LeverageRatioStrategyTestSetup<DynamicLeverageRatioStrategyInstance> = deployments.createFixture(
    async ({deployments}) => {
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
      await strategy.initialize(owner)

      await tranchedPool.deposit(TRANCHES.Junior, juniorInvestmentAmount)

      await tranchedPool.lockJuniorCapital()
      const juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
      const juniorTrancheLockedUntil = new BN(juniorTranche.lockedUntil)
      await strategy.setLeverageRatio(
        tranchedPool.address,
        EXPECTED_LEVERAGE_RATIO,
        juniorTrancheLockedUntil,
        web3.utils.keccak256("DynamicLeverageRatioStrategy test version"),
        {from: owner}
      )

      return {goldfinchConfig, tranchedPool, seniorPool, strategy, owner, juniorInvestmentAmount}
    }
  )

  beforeEach(async () => {
    accounts = await web3.eth.getAccounts()
    ;[owner] = accounts
    ;({goldfinchConfig, tranchedPool, seniorPool, strategy, owner} = await setupTest())
  })

  describe("ownership", async () => {
    it("should be owned by the owner", async () => {
      expect(await strategy.hasRole(OWNER_ROLE, owner)).to.be.true
    })
    it("should give owner the PAUSER_ROLE", async () => {
      expect(await strategy.hasRole(PAUSER_ROLE, owner)).to.be.true
    })
    it("should give owner the LEVERAGE_RATIO_SETTER_ROLE", async () => {
      expect(await strategy.hasRole(LEVERAGE_RATIO_SETTER_ROLE, owner)).to.be.true
    })
  })

  describe("getLeverageRatio", () => {
    it("should reject if the locked-until timestamp of the info in storage does not equal that of the junior tranche", () => {
      // TODO should be able to accomplish this by calling lockPool() after calling lockJuniorCapital()
      expect(false).to.be.true
    })
    it("should return the leverage ratio if the locked-until timestamp of the info in storage equals that of the junior tranche", () => {
      // TODO
      expect(false).to.be.true
    })
  })

  describe("setLeverageRatio", () => {
    it("should reject setting the leverage ratio to 0", () => {
      // TODO
      expect(false).to.be.true
    })
    it("should reject setting the leverage ratio with a locked-until timestamp of 0", () => {
      // TODO
      expect(false).to.be.true
    })
    it("should reject setting the leverage ratio with a locked-until timestamp that does not equal that of the junior tranche", () => {
      // TODO
      expect(false).to.be.true
    })
    it("should set the leverage ratio, for a locked-until timestamp that equals that of the junior tranche", () => {
      // TODO
      expect(false).to.be.true
    })
    it("should emit a LeverageRatioUpdated event", () => {
      // TODO
      expect(false).to.be.true
    })
    describe("onlySetterRole modifier", () => {
      it("should allow the owner, as the setter role, to set the leverage ratio", () => {
        // TODO
        expect(false).to.be.true
      })
      it("should allow a non-owner, as the setter role, to set the leverage ratio", () => {
        // TODO
        expect(false).to.be.true
      })
      it("should prohibit a non-owner who does not have the setter role from setting the leverage ratio", () => {
        // TODO
        expect(false).to.be.true
      })
    })
  })

  genLeverageRatioStrategyTests(setupTest, EXPECTED_LEVERAGE_RATIO, setLeverageRatio)
})
