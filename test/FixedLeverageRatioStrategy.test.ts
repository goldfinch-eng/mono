/* global web3 */
import hre from "hardhat"
const {deployments, artifacts} = hre
import {expect, BN, deployAllContracts, usdcVal, createPoolWithCreditLine} from "./testHelpers"
import {interestAprAsBN, TRANCHES} from "../blockchain_scripts/deployHelpers"
import { CONFIG_KEYS } from "../blockchain_scripts/configKeys"
const FixedLeverageRatioStrategy = artifacts.require("FixedLeverageRatioStrategy")
let accounts, owner, borrower

describe("FixedLeverageRatioStrategy", () => {
  let tranchedPool, seniorFund, goldfinchConfig, strategy, juniorInvestmentAmount

  const setupTest = deployments.createFixture(async ({deployments}) => {
    ;[owner, borrower] = await web3.eth.getAccounts()

    const {seniorFund, goldfinchConfig, goldfinchFactory, usdc} = await deployAllContracts(deployments, {
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

    const strategy = await FixedLeverageRatioStrategy.new({from: owner})
    await strategy.initialize(
      owner,
      goldfinchConfig.address,
    )

    await tranchedPool.deposit(TRANCHES.Junior, juniorInvestmentAmount)

    return {tranchedPool, seniorFund, strategy}
  })

  beforeEach(async () => {
    accounts = await web3.eth.getAccounts()
    ;[owner] = accounts
    ;({tranchedPool, seniorFund, strategy} = await setupTest())
  })

  describe("getLeverageRatio", () => {
    it("returns the leverage ratio maintained by Goldfinch config, adjusted for the relevant number of decimal places", async () => {
      const configLeverageRatio = await goldfinchConfig.getNumber(CONFIG_KEYS.LeverageRatio)
      expect(configLeverageRatio).to.bignumber.equal(new BN(4e18))

      const strategyLeverageRatio = await strategy.getLeverageRatio()
      expect(strategyLeverageRatio).to.bignumber.equal(new BN(4))
    })
  })

  describe("estimateInvestment", () => {
    it("levers junior investment using the leverageRatio", async () => {
      const leverageRatio = await strategy.getLeverageRatio()
      expect(leverageRatio).to.bignumber.equal(new BN(4))

      const amount = await strategy.estimateInvestment(seniorFund.address, tranchedPool.address)
      expect(amount).to.bignumber.equal(juniorInvestmentAmount.mul(leverageRatio))
    })

    context("junior pool is not locked", () => {
      it("still returns investment amount", async () => {
        const leverageRatio = await strategy.getLeverageRatio()
        expect(leverageRatio).to.bignumber.equal(new BN(4))

        const amount = await strategy.estimateInvestment(seniorFund.address, tranchedPool.address)
        expect(amount).to.bignumber.equal(juniorInvestmentAmount.mul(leverageRatio))
      })
    })

    context("pool is locked", () => {
      it("still returns investment amount", async () => {
        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})

        const leverageRatio = await strategy.getLeverageRatio()
        expect(leverageRatio).to.bignumber.equal(new BN(4))

        const amount = await strategy.estimateInvestment(seniorFund.address, tranchedPool.address)
        expect(amount).to.bignumber.equal(juniorInvestmentAmount.mul(leverageRatio))
      })
    })

    context("senior principal is already partially invested", () => {
      it("invests up to the levered amount", async () => {
        let existingSeniorPrincipal = juniorInvestmentAmount.add(new BN(10))
        await tranchedPool.deposit(TRANCHES.Senior, existingSeniorPrincipal)

        const leverageRatio = await strategy.getLeverageRatio()
        expect(leverageRatio).to.bignumber.equal(new BN(4))

        const amount = await strategy.estimateInvestment(seniorFund.address, tranchedPool.address)
        expect(amount).to.bignumber.equal(juniorInvestmentAmount.mul(leverageRatio).sub(existingSeniorPrincipal))
      })
    })

    context("senior principal already exceeds investment amount", () => {
      it("does not invest", async () => {
        const leverageRatio = await strategy.getLeverageRatio()
        expect(leverageRatio).to.bignumber.equal(new BN(4))

        const existingSeniorPrincipal = juniorInvestmentAmount.add(
          juniorInvestmentAmount.mul(leverageRatio).add(new BN(1))
        )
        await tranchedPool.deposit(TRANCHES.Senior, existingSeniorPrincipal)

        const amount = await strategy.estimateInvestment(seniorFund.address, tranchedPool.address)
        expect(amount).to.bignumber.equal(new BN(0))
      })
    })
  })

  describe("invest", () => {
    it("levers junior investment using the leverageRatio", async () => {
      await tranchedPool.lockJuniorCapital({from: borrower})

      const leverageRatio = await strategy.getLeverageRatio()
      expect(leverageRatio).to.bignumber.equal(new BN(4))

      const amount = await strategy.invest(seniorFund.address, tranchedPool.address)
      expect(amount).to.bignumber.equal(juniorInvestmentAmount.mul(leverageRatio))
    })

    context("junior pool is not locked", () => {
      it("does not invest", async () => {
        const amount = await strategy.invest(seniorFund.address, tranchedPool.address)
        expect(amount).to.bignumber.equal(new BN(0))
      })
    })

    context("pool is locked", () => {
      it("does not invest", async () => {
        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})

        const amount = await strategy.invest(seniorFund.address, tranchedPool.address)
        expect(amount).to.bignumber.equal(new BN(0))
      })
    })

    context("senior principal is already partially invested", () => {
      it("invests up to the levered amount", async () => {
        let existingSeniorPrincipal = juniorInvestmentAmount.add(new BN(10))
        await tranchedPool.deposit(TRANCHES.Senior, existingSeniorPrincipal)
        await tranchedPool.lockJuniorCapital({from: borrower})

        const leverageRatio = await strategy.getLeverageRatio()
        expect(leverageRatio).to.bignumber.equal(new BN(4))

        const amount = await strategy.invest(seniorFund.address, tranchedPool.address)
        expect(amount).to.bignumber.equal(juniorInvestmentAmount.mul(leverageRatio).sub(existingSeniorPrincipal))
      })
    })

    context("senior principal already exceeds investment amount", () => {
      it("does not invest", async () => {
        const leverageRatio = await strategy.getLeverageRatio()
        expect(leverageRatio).to.bignumber.equal(new BN(4))

        let existingSeniorPrincipal = juniorInvestmentAmount.add(
          juniorInvestmentAmount.mul(leverageRatio).add(new BN(1))
        )
        await tranchedPool.deposit(TRANCHES.Senior, existingSeniorPrincipal)
        await tranchedPool.lockJuniorCapital({from: borrower})

        const amount = await strategy.invest(seniorFund.address, tranchedPool.address)
        expect(amount).to.bignumber.equal(new BN(0))
      })
    })
  })
})
