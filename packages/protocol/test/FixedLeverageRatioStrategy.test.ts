/* global web3 */
import hre from "hardhat"
const {deployments, artifacts} = hre
import {expect, BN, usdcVal, createPoolWithCreditLine} from "./testHelpers"
import {interestAprAsBN, LEVERAGE_RATIO_DECIMALS, TRANCHES} from "../blockchain_scripts/deployHelpers"
import {CONFIG_KEYS} from "../blockchain_scripts/configKeys"
import {assertNonNullable} from "packages/utils/src/type"
import {expectEvent} from "@openzeppelin/test-helpers"
import {deployBaseFixture} from "./util/fixtures"
const FixedLeverageRatioStrategy = artifacts.require("FixedLeverageRatioStrategy")

const EXPECTED_LEVERAGE_RATIO: BN = new BN(String(4e18))

const setupTest = deployments.createFixture(async ({deployments}) => {
  const [owner, borrower] = await web3.eth.getAccounts()
  assertNonNullable(owner)
  assertNonNullable(borrower)

  const {seniorPool, goldfinchConfig, goldfinchFactory, usdc} = await deployBaseFixture()

  await goldfinchConfig.bulkAddToGoList([owner, borrower])

  const juniorInvestmentAmount = usdcVal(10000)
  const limit = juniorInvestmentAmount.mul(new BN(10))
  const interestApr = interestAprAsBN("5.00")
  const paymentPeriodInDays = new BN(30)
  const termInDays = new BN(365)
  const lateFeeApr = new BN(0)
  const juniorFeePercent = new BN(20)
  const {tranchedPool} = await createPoolWithCreditLine({
    people: {owner, borrower},
    goldfinchFactory,
    juniorFeePercent: juniorFeePercent,
    limit,
    interestApr,
    paymentPeriodInDays,
    termInDays,
    lateFeeApr,
    usdc,
  })

  const strategy = await FixedLeverageRatioStrategy.new({from: owner})
  await strategy.initialize(owner, goldfinchConfig.address)

  const seniorRole = await tranchedPool.SENIOR_ROLE()
  await tranchedPool.deposit(TRANCHES.Junior, juniorInvestmentAmount)
  await tranchedPool.grantRole(seniorRole, owner)

  return {goldfinchConfig, tranchedPool, seniorPool, strategy, owner, borrower, juniorInvestmentAmount}
})

describe("FixedLeverageRatioStrategy", () => {
  describe("getLeverageRatio", () => {
    let goldfinchConfig, tranchedPool, strategy

    beforeEach(async () => {
      // eslint-disable-next-line @typescript-eslint/no-extra-semi
      ;({goldfinchConfig, tranchedPool, strategy} = await setupTest())
    })

    it("returns the leverage ratio maintained by Goldfinch config, unadjusted for the relevant number of decimal places", async () => {
      const configLeverageRatio = await goldfinchConfig.getNumber(CONFIG_KEYS.LeverageRatio)
      expect(configLeverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)

      const strategyLeverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
      expect(strategyLeverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)
    })
  })

  describe("estimateInvestment", () => {
    describe("calculation", () => {
      let goldfinchConfig, tranchedPool, seniorPool, strategy, owner, juniorInvestmentAmount

      beforeEach(async () => {
        // eslint-disable-next-line @typescript-eslint/no-extra-semi
        ;({goldfinchConfig, tranchedPool, seniorPool, strategy, owner, juniorInvestmentAmount} = await setupTest())
      })

      it("levers junior investment using the leverageRatio", async () => {
        const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
        expect(leverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)

        const amount = await strategy.estimateInvestment(seniorPool.address, tranchedPool.address)
        expect(amount).to.bignumber.equal(usdcVal(40000))
        expect(amount).to.bignumber.equal(juniorInvestmentAmount.mul(leverageRatio).div(LEVERAGE_RATIO_DECIMALS))
      })

      it("correctly handles decimal places, for a fractional leverageRatio", async () => {
        const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
        expect(leverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)

        await goldfinchConfig.setNumber(CONFIG_KEYS.LeverageRatio, new BN(String(4.5e18)), {from: owner})

        const leverageRatio2 = await strategy.getLeverageRatio(tranchedPool.address)
        expect(leverageRatio2).to.bignumber.equal(new BN(String(4.5e18)))

        const amount = await strategy.estimateInvestment(seniorPool.address, tranchedPool.address)
        // If the leverage ratio's decimals were handled incorrectly by `strategy.estimateInvestment()` --
        // i.e. if the adjustment by LEVERAGE_RATIO_DECIMALS were applied to the leverage ratio directly,
        // rather than to the product of the junior investment amount and the leverage ratio --, we'd expect
        // the effective multiplier to have been floored to 4, rather than be 4.5. So we check that the
        // effective multipler was indeed 4.5.
        expect(amount).to.bignumber.equal(usdcVal(45000))
        expect(amount).to.bignumber.equal(juniorInvestmentAmount.mul(leverageRatio2).div(LEVERAGE_RATIO_DECIMALS))
      })
    })

    describe("lifecycle / chronology", () => {
      context("junior tranche is not locked and senior tranche is not locked", () => {
        let tranchedPool, seniorPool, strategy, juniorInvestmentAmount

        beforeEach(async () => {
          // eslint-disable-next-line @typescript-eslint/no-extra-semi
          ;({tranchedPool, seniorPool, strategy, juniorInvestmentAmount} = await setupTest())
        })

        it("returns investment amount", async () => {
          const juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
          const juniorTrancheLockedUntil = new BN(juniorTranche.lockedUntil)
          expect(juniorTrancheLockedUntil).to.be.bignumber.equal(new BN(0))

          const seniorTranche = await tranchedPool.getTranche(TRANCHES.Senior)
          const seniorTrancheLockedUntil = new BN(seniorTranche.lockedUntil)
          expect(seniorTrancheLockedUntil).to.be.bignumber.equal(new BN(0))

          const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
          expect(leverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)

          const amount = await strategy.estimateInvestment(seniorPool.address, tranchedPool.address)
          expect(amount).to.bignumber.equal(juniorInvestmentAmount.mul(leverageRatio).div(LEVERAGE_RATIO_DECIMALS))
        })
      })

      context("junior tranche is locked and senior tranche is not locked", () => {
        context("base", () => {
          let tranchedPool, seniorPool, strategy, borrower, juniorInvestmentAmount

          beforeEach(async () => {
            // eslint-disable-next-line @typescript-eslint/no-extra-semi
            ;({tranchedPool, seniorPool, strategy, borrower, juniorInvestmentAmount} = await setupTest())
          })

          it("returns investment amount", async () => {
            await tranchedPool.lockJuniorCapital({from: borrower})

            const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
            expect(leverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)

            const amount = await strategy.estimateInvestment(seniorPool.address, tranchedPool.address)
            expect(amount).to.bignumber.equal(juniorInvestmentAmount.mul(leverageRatio).div(LEVERAGE_RATIO_DECIMALS))
          })
        })

        context("senior principal is already partially invested", () => {
          let tranchedPool, seniorPool, strategy, juniorInvestmentAmount, borrower

          beforeEach(async () => {
            // eslint-disable-next-line @typescript-eslint/no-extra-semi
            ;({tranchedPool, seniorPool, strategy, juniorInvestmentAmount, borrower} = await setupTest())
          })

          it("would invest up to the levered amount", async () => {
            await tranchedPool.lockJuniorCapital({from: borrower})

            const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
            expect(leverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)

            const existingSeniorPrincipal = juniorInvestmentAmount.add(new BN(10))
            await tranchedPool.deposit(TRANCHES.Senior, existingSeniorPrincipal)

            const amount = await strategy.estimateInvestment(seniorPool.address, tranchedPool.address)
            expect(amount).to.bignumber.equal(
              juniorInvestmentAmount.mul(leverageRatio).div(LEVERAGE_RATIO_DECIMALS).sub(existingSeniorPrincipal)
            )
          })
        })

        context("senior principal already exceeds investment amount", () => {
          let tranchedPool, seniorPool, strategy, juniorInvestmentAmount, borrower

          beforeEach(async () => {
            // eslint-disable-next-line @typescript-eslint/no-extra-semi
            ;({tranchedPool, seniorPool, strategy, juniorInvestmentAmount, borrower} = await setupTest())
          })

          it("would not invest", async () => {
            await tranchedPool.lockJuniorCapital({from: borrower})

            const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
            expect(leverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)

            const existingSeniorPrincipal = juniorInvestmentAmount.add(
              juniorInvestmentAmount.mul(leverageRatio).div(LEVERAGE_RATIO_DECIMALS).add(new BN(1))
            )
            await tranchedPool.deposit(TRANCHES.Senior, existingSeniorPrincipal)

            const amount = await strategy.estimateInvestment(seniorPool.address, tranchedPool.address)
            expect(amount).to.bignumber.equal(new BN(0))
          })
        })
      })

      context("junior tranche is locked and senior tranche is locked", () => {
        let tranchedPool, seniorPool, strategy, borrower, juniorInvestmentAmount

        beforeEach(async () => {
          // eslint-disable-next-line @typescript-eslint/no-extra-semi
          ;({tranchedPool, seniorPool, strategy, borrower, juniorInvestmentAmount} = await setupTest())
        })

        it("returns investment amount", async () => {
          await tranchedPool.lockJuniorCapital({from: borrower})
          await tranchedPool.lockPool({from: borrower})

          const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
          expect(leverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)

          const amount = await strategy.estimateInvestment(seniorPool.address, tranchedPool.address)
          expect(amount).to.bignumber.equal(juniorInvestmentAmount.mul(leverageRatio).div(LEVERAGE_RATIO_DECIMALS))
        })
      })
    })
  })

  describe("invest", () => {
    describe("calculation", () => {
      let goldfinchConfig, tranchedPool, seniorPool, strategy, owner, borrower, juniorInvestmentAmount

      beforeEach(async () => {
        // eslint-disable-next-line @typescript-eslint/no-extra-semi
        ;({goldfinchConfig, tranchedPool, seniorPool, strategy, owner, borrower, juniorInvestmentAmount} =
          await setupTest())
      })

      it("levers junior investment using the leverageRatio", async () => {
        await tranchedPool.lockJuniorCapital({from: borrower})

        const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
        expect(leverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)

        const amount = await strategy.invest(seniorPool.address, tranchedPool.address)
        expect(amount).to.bignumber.equal(juniorInvestmentAmount.mul(leverageRatio).div(LEVERAGE_RATIO_DECIMALS))
      })

      it("correctly handles decimal places, for a fractional leverageRatio", async () => {
        await tranchedPool.lockJuniorCapital({from: borrower})

        const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
        expect(leverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)

        await goldfinchConfig.setNumber(CONFIG_KEYS.LeverageRatio, new BN(String(4.5e18)), {from: owner})

        const leverageRatio2 = await strategy.getLeverageRatio(tranchedPool.address)
        expect(leverageRatio2).to.bignumber.equal(new BN(String(4.5e18)))

        const amount = await strategy.invest(seniorPool.address, tranchedPool.address)
        expect(amount).to.bignumber.equal(usdcVal(45000))
        expect(amount).to.bignumber.equal(juniorInvestmentAmount.mul(leverageRatio2).div(LEVERAGE_RATIO_DECIMALS))
      })
    })

    describe("lifecycle / chronology", () => {
      context("junior tranche is not locked and senior tranche is not locked", () => {
        let tranchedPool, seniorPool, strategy

        beforeEach(async () => {
          // eslint-disable-next-line @typescript-eslint/no-extra-semi
          ;({tranchedPool, seniorPool, strategy} = await setupTest())
        })

        it("does not invest", async () => {
          const juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
          const juniorTrancheLockedUntil = new BN(juniorTranche.lockedUntil)
          expect(juniorTrancheLockedUntil).to.be.bignumber.equal(new BN(0))

          const seniorTranche = await tranchedPool.getTranche(TRANCHES.Senior)
          const seniorTrancheLockedUntil = new BN(seniorTranche.lockedUntil)
          expect(seniorTrancheLockedUntil).to.be.bignumber.equal(new BN(0))

          const amount = await strategy.invest(seniorPool.address, tranchedPool.address)
          expect(amount).to.bignumber.equal(new BN(0))
        })
      })

      context("junior tranche is locked and senior tranche is not locked", () => {
        context("base", () => {
          let tranchedPool, seniorPool, strategy, borrower, juniorInvestmentAmount

          beforeEach(async () => {
            // eslint-disable-next-line @typescript-eslint/no-extra-semi
            ;({tranchedPool, seniorPool, strategy, borrower, juniorInvestmentAmount} = await setupTest())
          })

          it("invests", async () => {
            await tranchedPool.lockJuniorCapital({from: borrower})

            const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
            expect(leverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)

            const amount = await strategy.invest(seniorPool.address, tranchedPool.address)
            expect(amount).to.bignumber.equal(juniorInvestmentAmount.mul(leverageRatio).div(LEVERAGE_RATIO_DECIMALS))
          })
        })

        context("senior principal is already partially invested", () => {
          let tranchedPool, seniorPool, strategy, borrower, juniorInvestmentAmount

          beforeEach(async () => {
            // eslint-disable-next-line @typescript-eslint/no-extra-semi
            ;({tranchedPool, seniorPool, strategy, borrower, juniorInvestmentAmount} = await setupTest())
          })

          it("invests up to the levered amount", async () => {
            await tranchedPool.lockJuniorCapital({from: borrower})

            const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
            expect(leverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)

            const existingSeniorPrincipal = juniorInvestmentAmount.add(new BN(10))
            await tranchedPool.deposit(TRANCHES.Senior, existingSeniorPrincipal)

            const amount = await strategy.invest(seniorPool.address, tranchedPool.address)
            expect(amount).to.bignumber.equal(
              juniorInvestmentAmount.mul(leverageRatio).div(LEVERAGE_RATIO_DECIMALS).sub(existingSeniorPrincipal)
            )
          })
        })

        context("senior principal already exceeds investment amount", () => {
          let tranchedPool, seniorPool, strategy, borrower, juniorInvestmentAmount

          beforeEach(async () => {
            // eslint-disable-next-line @typescript-eslint/no-extra-semi
            ;({tranchedPool, seniorPool, strategy, borrower, juniorInvestmentAmount} = await setupTest())
          })

          it("does not invest", async () => {
            await tranchedPool.lockJuniorCapital({from: borrower})

            const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
            expect(leverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)

            const existingSeniorPrincipal = juniorInvestmentAmount.add(
              juniorInvestmentAmount.mul(leverageRatio).div(LEVERAGE_RATIO_DECIMALS).add(new BN(1))
            )
            await tranchedPool.deposit(TRANCHES.Senior, existingSeniorPrincipal)

            const amount = await strategy.invest(seniorPool.address, tranchedPool.address)
            expect(amount).to.bignumber.equal(new BN(0))
          })
        })
      })

      context("junior tranche is locked and senior tranche is locked", () => {
        let tranchedPool, seniorPool, strategy, borrower

        beforeEach(async () => {
          // eslint-disable-next-line @typescript-eslint/no-extra-semi
          ;({tranchedPool, seniorPool, strategy, borrower} = await setupTest())
        })

        it("does not invest", async () => {
          await tranchedPool.lockJuniorCapital({from: borrower})
          await tranchedPool.lockPool({from: borrower})

          const amount = await strategy.invest(seniorPool.address, tranchedPool.address)
          expect(amount).to.bignumber.equal(new BN(0))
        })
      })
    })
  })
})
