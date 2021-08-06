/* global web3 */
import BN from "bn.js"
import {LEVERAGE_RATIO_DECIMALS, TRANCHES} from "../blockchain_scripts/deployHelpers"
import {GoldfinchConfig} from "../typechain/ethers"
import {
  DynamicLeverageRatioStrategyInstance,
  FixedLeverageRatioStrategyInstance,
  GoldfinchConfigInstance,
} from "../typechain/truffle"
import {expect} from "./testHelpers"
let accounts, borrower

type LeverageRatioStrategy = FixedLeverageRatioStrategyInstance | DynamicLeverageRatioStrategyInstance

export type LeverageRatioStrategyTestSetup<S extends LeverageRatioStrategy> = () => Promise<{
  goldfinchConfig: GoldfinchConfigInstance
  tranchedPool: any
  seniorPool: any
  strategy: S
  owner: any
  juniorInvestmentAmount: BN
}>

export function genLeverageRatioStrategyTests<S extends LeverageRatioStrategy>(
  setupTest: LeverageRatioStrategyTestSetup<S>,
  expectedLeverageRatio: BN,
  setLeverageRatio: (
    leverageRatio: BN,
    strategy: S,
    tranchedPool: any,
    config: GoldfinchConfig,
    owner: any
  ) => Promise<void>
): void {
  describe("LeverageRatioStrategy", () => {
    let goldfinchConfig, tranchedPool, seniorPool, strategy, owner, juniorInvestmentAmount

    beforeEach(async () => {
      accounts = await web3.eth.getAccounts()
      ;[owner] = accounts
      ;({goldfinchConfig, tranchedPool, seniorPool, strategy, owner, juniorInvestmentAmount} = await setupTest())
    })
    describe("estimateInvestment", () => {
      it("levers junior investment using the leverageRatio", async () => {
        const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
        expect(leverageRatio).to.bignumber.equal(expectedLeverageRatio)

        const amount = await strategy.estimateInvestment(seniorPool.address, tranchedPool.address)
        expect(amount).to.bignumber.equal(juniorInvestmentAmount.mul(leverageRatio).div(LEVERAGE_RATIO_DECIMALS))
      })

      it("correctly handles decimal places, for a fractional leverageRatio", async () => {
        const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
        expect(leverageRatio).to.bignumber.equal(expectedLeverageRatio)

        const expectedLeverageRatio2 = new BN(String(4.5e18))
        await setLeverageRatio(expectedLeverageRatio2, strategy, tranchedPool, goldfinchConfig, owner)

        const leverageRatio2 = await strategy.getLeverageRatio(tranchedPool.address)
        expect(leverageRatio2).to.bignumber.equal(expectedLeverageRatio2)

        const amount = await strategy.estimateInvestment(seniorPool.address, tranchedPool.address)
        // If the leverage ratio's decimals were handled incorrectly by `strategy.estimateInvestment()` --
        // i.e. if the adjustment by LEVERAGE_RATIO_DECIMALS were applied to the leverage ratio directly,
        // rather than to the product of the junior investment amount and the leverage ratio --, we'd expect
        // the effective multiplier to have been floored to 4, rather than be 4.5. So we check that the
        // effective multipler was indeed the fractional leverage ratio, i.e. 4.5.
        expect(amount).to.bignumber.equal(juniorInvestmentAmount.mul(leverageRatio2).div(LEVERAGE_RATIO_DECIMALS))
      })

      context("junior pool is not locked", () => {
        it("still returns investment amount", async () => {
          const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
          expect(leverageRatio).to.bignumber.equal(expectedLeverageRatio)

          const amount = await strategy.estimateInvestment(seniorPool.address, tranchedPool.address)
          expect(amount).to.bignumber.equal(juniorInvestmentAmount.mul(leverageRatio).div(LEVERAGE_RATIO_DECIMALS))
        })
      })

      context("pool is locked", () => {
        it("still returns investment amount", async () => {
          await tranchedPool.lockJuniorCapital({from: borrower})
          await tranchedPool.lockPool({from: borrower})

          const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
          expect(leverageRatio).to.bignumber.equal(expectedLeverageRatio)

          const amount = await strategy.estimateInvestment(seniorPool.address, tranchedPool.address)
          expect(amount).to.bignumber.equal(juniorInvestmentAmount.mul(leverageRatio).div(LEVERAGE_RATIO_DECIMALS))
        })
      })

      context("senior principal is already partially invested", () => {
        it("invests up to the levered amount", async () => {
          let existingSeniorPrincipal = juniorInvestmentAmount.add(new BN(10))
          await tranchedPool.deposit(TRANCHES.Senior, existingSeniorPrincipal)

          const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
          expect(leverageRatio).to.bignumber.equal(expectedLeverageRatio)

          const amount = await strategy.estimateInvestment(seniorPool.address, tranchedPool.address)
          expect(amount).to.bignumber.equal(
            juniorInvestmentAmount.mul(leverageRatio).div(LEVERAGE_RATIO_DECIMALS).sub(existingSeniorPrincipal)
          )
        })
      })

      context("senior principal already exceeds investment amount", () => {
        it("does not invest", async () => {
          const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
          expect(leverageRatio).to.bignumber.equal(expectedLeverageRatio)

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
        expect(leverageRatio).to.bignumber.equal(expectedLeverageRatio)

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
          expect(leverageRatio).to.bignumber.equal(expectedLeverageRatio)

          const amount = await strategy.invest(seniorPool.address, tranchedPool.address)
          expect(amount).to.bignumber.equal(
            juniorInvestmentAmount.mul(leverageRatio).div(LEVERAGE_RATIO_DECIMALS).sub(existingSeniorPrincipal)
          )
        })
      })

      context("senior principal already exceeds investment amount", () => {
        it("does not invest", async () => {
          const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
          expect(leverageRatio).to.bignumber.equal(expectedLeverageRatio)

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
