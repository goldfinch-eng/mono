/* global web3 */
import { CONFIG_KEYS } from "../blockchain_scripts/configKeys"
import { LEVERAGE_RATIO_DECIMALS, TRANCHES } from "../blockchain_scripts/deployHelpers"
import { GoldfinchConfigInstance } from "../typechain/truffle"
import { BN, expect, usdcVal } from "./testHelpers"
let accounts, borrower

const EXPECTED_LEVERAGE_RATIO: BN = new BN(String(4e18))

export type LeverageRatioStrategyTestSetup = () => Promise<{
  goldfinchConfig: GoldfinchConfigInstance
  tranchedPool: any
  seniorPool: any
  strategy: any
  owner: any
}>

export function genLeverageRatioStrategyTests(
  setupTest: LeverageRatioStrategyTestSetup
): void {
  describe("LeverageRatioStrategy", () => {
    let goldfinchConfig, tranchedPool, seniorPool, strategy, juniorInvestmentAmount, owner

    beforeEach(async () => {
      accounts = await web3.eth.getAccounts()
      ;[owner] = accounts
      ;({goldfinchConfig, tranchedPool, seniorPool, strategy, owner} = await setupTest())
    })
    describe("estimateInvestment", () => {
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

      context("junior pool is not locked", () => {
        it("still returns investment amount", async () => {
          const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
          expect(leverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)

          const amount = await strategy.estimateInvestment(seniorPool.address, tranchedPool.address)
          expect(amount).to.bignumber.equal(juniorInvestmentAmount.mul(leverageRatio).div(LEVERAGE_RATIO_DECIMALS))
        })
      })

      context("pool is locked", () => {
        it("still returns investment amount", async () => {
          await tranchedPool.lockJuniorCapital({from: borrower})
          await tranchedPool.lockPool({from: borrower})

          const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
          expect(leverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)

          const amount = await strategy.estimateInvestment(seniorPool.address, tranchedPool.address)
          expect(amount).to.bignumber.equal(juniorInvestmentAmount.mul(leverageRatio).div(LEVERAGE_RATIO_DECIMALS))
        })
      })

      context("senior principal is already partially invested", () => {
        it("invests up to the levered amount", async () => {
          let existingSeniorPrincipal = juniorInvestmentAmount.add(new BN(10))
          await tranchedPool.deposit(TRANCHES.Senior, existingSeniorPrincipal)

          const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
          expect(leverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)

          const amount = await strategy.estimateInvestment(seniorPool.address, tranchedPool.address)
          expect(amount).to.bignumber.equal(
            juniorInvestmentAmount.mul(leverageRatio).div(LEVERAGE_RATIO_DECIMALS).sub(existingSeniorPrincipal)
          )
        })
      })

      context("senior principal already exceeds investment amount", () => {
        it("does not invest", async () => {
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

    describe("invest", () => {
      it("levers junior investment using the leverageRatio", async () => {
        await tranchedPool.lockJuniorCapital({from: borrower})

        const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
        expect(leverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)

        const amount = await strategy.invest(seniorPool.address, tranchedPool.address)
        expect(amount).to.bignumber.equal(juniorInvestmentAmount.mul(leverageRatio).div(LEVERAGE_RATIO_DECIMALS))
      })

      context("junior pool is not locked", () => {
        it("does not invest", async () => {
          const amount = await strategy.invest(seniorPool.address, tranchedPool.address)
          expect(amount).to.bignumber.equal(new BN(0))
        })
      })

      context("pool is locked", () => {
        it("does not invest", async () => {
          await tranchedPool.lockJuniorCapital({from: borrower})
          await tranchedPool.lockPool({from: borrower})

          const amount = await strategy.invest(seniorPool.address, tranchedPool.address)
          expect(amount).to.bignumber.equal(new BN(0))
        })
      })

      context("senior principal is already partially invested", () => {
        it("invests up to the levered amount", async () => {
          let existingSeniorPrincipal = juniorInvestmentAmount.add(new BN(10))
          await tranchedPool.deposit(TRANCHES.Senior, existingSeniorPrincipal)
          await tranchedPool.lockJuniorCapital({from: borrower})

          const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
          expect(leverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)

          const amount = await strategy.invest(seniorPool.address, tranchedPool.address)
          expect(amount).to.bignumber.equal(
            juniorInvestmentAmount.mul(leverageRatio).div(LEVERAGE_RATIO_DECIMALS).sub(existingSeniorPrincipal)
          )
        })
      })

      context("senior principal already exceeds investment amount", () => {
        it("does not invest", async () => {
          const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
          expect(leverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)

          let existingSeniorPrincipal = juniorInvestmentAmount.add(
            juniorInvestmentAmount.mul(leverageRatio).div(LEVERAGE_RATIO_DECIMALS).add(new BN(1))
          )
          await tranchedPool.deposit(TRANCHES.Senior, existingSeniorPrincipal)
          await tranchedPool.lockJuniorCapital({from: borrower})

          const amount = await strategy.invest(seniorPool.address, tranchedPool.address)
          expect(amount).to.bignumber.equal(new BN(0))
        })
      })
    })
  })
}
