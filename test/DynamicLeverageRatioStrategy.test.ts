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
const DynamicLeverageRatioStrategy = artifacts.require("DynamicLeverageRatioStrategy")

const EXPECTED_LEVERAGE_RATIO: BN = new BN(String(4e18))
const LEVERAGE_RATIO_NOT_SET_REGEXP: RegExp = /Leverage ratio locked-until timestamp has not been set\./

const setupTest = deployments.createFixture(async ({deployments}) => {
  const [owner, borrower] = await web3.eth.getAccounts()

  const {seniorPool, goldfinchConfig, goldfinchFactory, usdc} = await deployAllContracts(deployments, {
    fromAccount: owner,
  })

  await goldfinchConfig.bulkAddToGoList([owner, borrower])

  const juniorInvestmentAmount = usdcVal(10000)
  let limit = juniorInvestmentAmount.mul(new BN(10))
  let interestApr = interestAprAsBN("5.00")
  let paymentPeriodInDays = new BN(30)
  let termInDays = new BN(365)
  let lateFeeApr = new BN(0)
  let juniorFeePercent = new BN(20)
  const {tranchedPool} = await createPoolWithCreditLine({
    people: {owner, borrower},
    goldfinchFactory,
    juniorFeePercent: juniorFeePercent.toNumber(),
    limit,
    interestApr,
    paymentPeriodInDays,
    termInDays,
    lateFeeApr,
    usdc,
  })

  const strategy = await DynamicLeverageRatioStrategy.new({from: owner})
  await strategy.initialize(owner)

  await tranchedPool.deposit(TRANCHES.Junior, juniorInvestmentAmount)

  return {goldfinchConfig, tranchedPool, seniorPool, strategy, owner, borrower, juniorInvestmentAmount}
})

const leverJuniorInvestment = async (
  tranchedPool: any,
  strategy: any,
  juniorInvestmentAmount: BN,
  owner: any,
  borrower: any,
  investmentFn: () => Promise<BN>
) => {
  const leverageRatioNotSet = strategy.getLeverageRatio(tranchedPool.address)
  expect(leverageRatioNotSet).to.be.rejectedWith(LEVERAGE_RATIO_NOT_SET_REGEXP)

  await tranchedPool.lockJuniorCapital({from: borrower})

  const juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
  const juniorTrancheLockedUntil = new BN(juniorTranche.lockedUntil)
  expect(juniorTrancheLockedUntil).to.be.bignumber.gt(new BN(0))
  await strategy.setLeverageRatio(
    tranchedPool.address,
    EXPECTED_LEVERAGE_RATIO,
    juniorTrancheLockedUntil,
    web3.utils.keccak256("DynamicLeverageRatioStrategy test version"),
    {from: owner}
  )

  const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
  expect(leverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)

  const amount = await investmentFn()
  expect(amount).to.bignumber.equal(usdcVal(40000))
  expect(amount).to.bignumber.equal(juniorInvestmentAmount.mul(leverageRatio).div(LEVERAGE_RATIO_DECIMALS))
}

const leverFractionally = async (
  tranchedPool: any,
  strategy: any,
  juniorInvestmentAmount: BN,
  owner: any,
  borrower: any,
  investmentFn: () => Promise<BN>
) => {
  const leverageRatioNotSet = strategy.getLeverageRatio(tranchedPool.address)
  expect(leverageRatioNotSet).to.be.rejectedWith(LEVERAGE_RATIO_NOT_SET_REGEXP)

  await tranchedPool.lockJuniorCapital({from: borrower})

  const juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
  const juniorTrancheLockedUntil = new BN(juniorTranche.lockedUntil)
  expect(juniorTrancheLockedUntil).to.be.bignumber.gt(new BN(0))
  await strategy.setLeverageRatio(
    tranchedPool.address,
    EXPECTED_LEVERAGE_RATIO,
    juniorTrancheLockedUntil,
    web3.utils.keccak256("DynamicLeverageRatioStrategy test version"),
    {from: owner}
  )

  const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
  expect(leverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)

  await strategy.setLeverageRatio(
    tranchedPool.address,
    new BN(String(4.5e18)),
    juniorTrancheLockedUntil,
    web3.utils.keccak256("DynamicLeverageRatioStrategy test version"),
    {from: owner}
  )

  const leverageRatio2 = await strategy.getLeverageRatio(tranchedPool.address)
  expect(leverageRatio2).to.bignumber.equal(new BN(String(4.5e18)))

  const amount = await investmentFn()
  // Analogous comment as in corresponding FixedLeverageRatioStrategy test.
  expect(amount).to.bignumber.equal(usdcVal(45000))
  expect(amount).to.bignumber.equal(juniorInvestmentAmount.mul(leverageRatio2).div(LEVERAGE_RATIO_DECIMALS))
}

describe("DynamicLeverageRatioStrategy", () => {
  describe("ownership", async () => {
    let goldfinchConfig, owner

    beforeEach(async () => {
      ;({goldfinchConfig, owner} = await setupTest())
    })

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

  describe("estimateInvestment", () => {
    describe("calculation", () => {
      let tranchedPool, seniorPool, strategy, juniorInvestmentAmount, owner, borrower

      beforeEach(async () => {
        ;({tranchedPool, seniorPool, strategy, juniorInvestmentAmount, owner, borrower} = await setupTest())
      })

      it("levers junior investment using the leverageRatio", async () => {
        await leverJuniorInvestment(tranchedPool, strategy, juniorInvestmentAmount, owner, borrower, async () => {
          return await strategy.estimateInvestment(seniorPool.address, tranchedPool.address)
        })
      })

      it("correctly handles decimal places, for a fractional leverageRatio", async () => {
        await leverFractionally(tranchedPool, strategy, juniorInvestmentAmount, owner, borrower, async () => {
          return await strategy.estimateInvestment(seniorPool.address, tranchedPool.address)
        })
      })
    })

    describe("lifecycle / chronology", () => {
      context("junior tranche is not locked and senior tranche is not locked", () => {
        let tranchedPool, seniorPool, strategy

        beforeEach(async () => {
          ;({tranchedPool, seniorPool, strategy} = await setupTest())
        })

        it("does not return investment amount", async () => {
          const leverageRatioNotSet = strategy.getLeverageRatio(tranchedPool.address)
          expect(leverageRatioNotSet).to.be.rejectedWith(LEVERAGE_RATIO_NOT_SET_REGEXP)

          const juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
          const juniorTrancheLockedUntil = new BN(juniorTranche.lockedUntil)
          expect(juniorTrancheLockedUntil).to.be.bignumber.equal(new BN(0))

          const amount = strategy.estimateInvestment(seniorPool.address, tranchedPool.address)
          expect(amount).to.be.rejectedWith(LEVERAGE_RATIO_NOT_SET_REGEXP)
        })
      })

      context("junior tranche is locked and senior tranche is not locked", () => {
        context("leverage ratio has not been set", () => {
          let tranchedPool, seniorPool, strategy, borrower

          beforeEach(async () => {
            ;({tranchedPool, seniorPool, strategy, borrower} = await setupTest())
          })

          it("does not return investment amount", async () => {
            await tranchedPool.lockJuniorCapital({from: borrower})

            const leverageRatioNotSet = strategy.getLeverageRatio(tranchedPool.address)
            expect(leverageRatioNotSet).to.be.rejectedWith(LEVERAGE_RATIO_NOT_SET_REGEXP)

            const amount = strategy.estimateInvestment(seniorPool.address, tranchedPool.address)
            expect(amount).to.be.rejectedWith(LEVERAGE_RATIO_NOT_SET_REGEXP)
          })
        })
        context("leverage ratio has been set", () => {
          let tranchedPool, seniorPool, strategy, juniorInvestmentAmount, owner, borrower

          beforeEach(async () => {
            ;({tranchedPool, seniorPool, strategy, juniorInvestmentAmount, owner, borrower} = await setupTest())
          })

          it("returns investment amount", async () => {
            await tranchedPool.lockJuniorCapital({from: borrower})

            const juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
            const juniorTrancheLockedUntil = new BN(juniorTranche.lockedUntil)
            expect(juniorTrancheLockedUntil).to.be.bignumber.gt(new BN(0))
            await strategy.setLeverageRatio(
              tranchedPool.address,
              EXPECTED_LEVERAGE_RATIO,
              juniorTrancheLockedUntil,
              web3.utils.keccak256("DynamicLeverageRatioStrategy test version"),
              {from: owner}
            )

            const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
            expect(leverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)

            const amount = await strategy.estimateInvestment(seniorPool.address, tranchedPool.address)
            expect(amount).to.bignumber.equal(juniorInvestmentAmount.mul(leverageRatio).div(LEVERAGE_RATIO_DECIMALS))
          })
        })
      })

      context("junior tranche is locked and senior tranche is locked", () => {
        context("leverage ratio has not been set", () => {
          let tranchedPool, seniorPool, strategy, borrower

          beforeEach(async () => {
            ;({tranchedPool, seniorPool, strategy, borrower} = await setupTest())
          })

          it("does not return investment amount", async () => {
            await tranchedPool.lockJuniorCapital({from: borrower})
            await tranchedPool.lockPool({from: borrower})

            const leverageRatioNotSet = strategy.getLeverageRatio(tranchedPool.address)
            expect(leverageRatioNotSet).to.be.rejectedWith(LEVERAGE_RATIO_NOT_SET_REGEXP)

            const amount = strategy.estimateInvestment(seniorPool.address, tranchedPool.address)
            expect(amount).to.be.rejectedWith(LEVERAGE_RATIO_NOT_SET_REGEXP)
          })
        })
        context("leverage ratio has been set", () => {
          let tranchedPool, seniorPool, strategy, juniorInvestmentAmount, owner, borrower

          beforeEach(async () => {
            ;({tranchedPool, seniorPool, strategy, juniorInvestmentAmount, owner, borrower} = await setupTest())
          })

          it("returns investment amount", async () => {
            await tranchedPool.lockJuniorCapital({from: borrower})

            const juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
            const juniorTrancheLockedUntil = new BN(juniorTranche.lockedUntil)
            expect(juniorTrancheLockedUntil).to.be.bignumber.gt(new BN(0))
            await strategy.setLeverageRatio(
              tranchedPool.address,
              EXPECTED_LEVERAGE_RATIO,
              juniorTrancheLockedUntil,
              web3.utils.keccak256("DynamicLeverageRatioStrategy test version"),
              {from: owner}
            )

            const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
            expect(leverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)

            await tranchedPool.lockPool({from: borrower})

            const amount = await strategy.estimateInvestment(seniorPool.address, tranchedPool.address)
            expect(amount).to.bignumber.equal(juniorInvestmentAmount.mul(leverageRatio).div(LEVERAGE_RATIO_DECIMALS))
          })
        })
      })

      context("senior principal is already partially invested", () => {
        let tranchedPool, seniorPool, strategy, juniorInvestmentAmount, owner, borrower

        beforeEach(async () => {
          ;({tranchedPool, seniorPool, strategy, juniorInvestmentAmount, owner, borrower} = await setupTest())
        })

        it("would invest up to the levered amount", async () => {
          await tranchedPool.lockJuniorCapital({from: borrower})

          const juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
          const juniorTrancheLockedUntil = new BN(juniorTranche.lockedUntil)
          expect(juniorTrancheLockedUntil).to.be.bignumber.gt(new BN(0))
          await strategy.setLeverageRatio(
            tranchedPool.address,
            EXPECTED_LEVERAGE_RATIO,
            juniorTrancheLockedUntil,
            web3.utils.keccak256("DynamicLeverageRatioStrategy test version"),
            {from: owner}
          )

          const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
          expect(leverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)

          let existingSeniorPrincipal = juniorInvestmentAmount.add(new BN(10))
          await tranchedPool.deposit(TRANCHES.Senior, existingSeniorPrincipal)

          const amount = await strategy.estimateInvestment(seniorPool.address, tranchedPool.address)
          expect(amount).to.bignumber.equal(
            juniorInvestmentAmount.mul(leverageRatio).div(LEVERAGE_RATIO_DECIMALS).sub(existingSeniorPrincipal)
          )
        })
      })

      context("senior principal already exceeds investment amount", () => {
        let tranchedPool, seniorPool, strategy, juniorInvestmentAmount, owner, borrower

        beforeEach(async () => {
          ;({tranchedPool, seniorPool, strategy, juniorInvestmentAmount, owner, borrower} = await setupTest())
        })

        it("does not invest", async () => {
          await tranchedPool.lockJuniorCapital({from: borrower})

          const juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
          const juniorTrancheLockedUntil = new BN(juniorTranche.lockedUntil)
          expect(juniorTrancheLockedUntil).to.be.bignumber.gt(new BN(0))
          await strategy.setLeverageRatio(
            tranchedPool.address,
            EXPECTED_LEVERAGE_RATIO,
            juniorTrancheLockedUntil,
            web3.utils.keccak256("DynamicLeverageRatioStrategy test version"),
            {from: owner}
          )

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
  })

  describe("invest", () => {
    describe("calculation", () => {
      let tranchedPool, seniorPool, strategy, juniorInvestmentAmount, owner, borrower

      beforeEach(async () => {
        ;({tranchedPool, seniorPool, strategy, juniorInvestmentAmount, owner, borrower} = await setupTest())
      })

      it("levers junior investment using the leverageRatio", async () => {
        await leverJuniorInvestment(tranchedPool, strategy, juniorInvestmentAmount, owner, borrower, async () => {
          return await strategy.invest(seniorPool.address, tranchedPool.address)
        })
      })

      it("correctly handles decimal places, for a fractional leverageRatio", async () => {
        await leverFractionally(tranchedPool, strategy, juniorInvestmentAmount, owner, borrower, async () => {
          return await strategy.invest(seniorPool.address, tranchedPool.address)
        })
      })
    })

    describe("lifecycle / chronology", () => {
      context("junior tranche is not locked and senior tranche is not locked", () => {
        let tranchedPool, seniorPool, strategy

        beforeEach(async () => {
          ;({tranchedPool, seniorPool, strategy} = await setupTest())
        })

        it("does not invest", async () => {
          const amount = await strategy.invest(seniorPool.address, tranchedPool.address)
          expect(amount).to.bignumber.equal(new BN(0))
        })
      })

      context("junior tranche is locked and senior tranche is not locked", () => {
        context("leverage ratio has not been set", () => {
          let tranchedPool, seniorPool, strategy, borrower

          beforeEach(async () => {
            ;({tranchedPool, seniorPool, strategy, borrower} = await setupTest())
          })

          it("does not invest", async () => {
            await tranchedPool.lockJuniorCapital({from: borrower})

            const leverageRatioNotSet = strategy.getLeverageRatio(tranchedPool.address)
            expect(leverageRatioNotSet).to.be.rejectedWith(LEVERAGE_RATIO_NOT_SET_REGEXP)

            const amount = strategy.invest(seniorPool.address, tranchedPool.address)
            expect(amount).to.be.rejectedWith(LEVERAGE_RATIO_NOT_SET_REGEXP)
          })
        })
        context("leverage ratio has been set", () => {
          let tranchedPool, seniorPool, strategy, juniorInvestmentAmount, owner, borrower

          beforeEach(async () => {
            ;({tranchedPool, seniorPool, strategy, juniorInvestmentAmount, owner, borrower} = await setupTest())
          })

          it("invests", async () => {
            await tranchedPool.lockJuniorCapital({from: borrower})

            const juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
            const juniorTrancheLockedUntil = new BN(juniorTranche.lockedUntil)
            expect(juniorTrancheLockedUntil).to.be.bignumber.gt(new BN(0))
            await strategy.setLeverageRatio(
              tranchedPool.address,
              EXPECTED_LEVERAGE_RATIO,
              juniorTrancheLockedUntil,
              web3.utils.keccak256("DynamicLeverageRatioStrategy test version"),
              {from: owner}
            )

            const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
            expect(leverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)

            const amount = await strategy.invest(seniorPool.address, tranchedPool.address)
            expect(amount).to.bignumber.equal(juniorInvestmentAmount.mul(leverageRatio).div(LEVERAGE_RATIO_DECIMALS))
          })
        })
      })

      context("junior tranche is locked and senior tranche is locked", () => {
        context("leverage ratio has not been set", () => {
          let tranchedPool, seniorPool, strategy, borrower

          beforeEach(async () => {
            ;({tranchedPool, seniorPool, strategy, borrower} = await setupTest())
          })

          it("does not invest", async () => {
            await tranchedPool.lockJuniorCapital({from: borrower})
            await tranchedPool.lockPool({from: borrower})

            const leverageRatioNotSet = strategy.getLeverageRatio(tranchedPool.address)
            expect(leverageRatioNotSet).to.be.rejectedWith(LEVERAGE_RATIO_NOT_SET_REGEXP)

            const amount = await strategy.invest(seniorPool.address, tranchedPool.address)
            expect(amount).to.bignumber.equal(new BN(0))
          })
        })
        context("leverage ratio has been set", () => {
          let tranchedPool, seniorPool, strategy, owner, borrower

          beforeEach(async () => {
            ;({tranchedPool, seniorPool, strategy, owner, borrower} = await setupTest())
          })

          it("does not invest", async () => {
            await tranchedPool.lockJuniorCapital({from: borrower})

            const juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
            const juniorTrancheLockedUntil = new BN(juniorTranche.lockedUntil)
            expect(juniorTrancheLockedUntil).to.be.bignumber.gt(new BN(0))
            await strategy.setLeverageRatio(
              tranchedPool.address,
              EXPECTED_LEVERAGE_RATIO,
              juniorTrancheLockedUntil,
              web3.utils.keccak256("DynamicLeverageRatioStrategy test version"),
              {from: owner}
            )

            const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
            expect(leverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)

            await tranchedPool.lockPool({from: borrower})

            const amount = await strategy.invest(seniorPool.address, tranchedPool.address)
            expect(amount).to.bignumber.equal(new BN(0))
          })
        })
      })

      context("senior principal is already partially invested", () => {
        let tranchedPool, seniorPool, strategy, juniorInvestmentAmount, owner, borrower

        beforeEach(async () => {
          ;({tranchedPool, seniorPool, strategy, juniorInvestmentAmount, owner, borrower} = await setupTest())
        })

        it("invests up to the levered amount", async () => {
          let existingSeniorPrincipal = juniorInvestmentAmount.add(new BN(10))
          await tranchedPool.deposit(TRANCHES.Senior, existingSeniorPrincipal)
          await tranchedPool.lockJuniorCapital({from: borrower})

          const juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
          const juniorTrancheLockedUntil = new BN(juniorTranche.lockedUntil)
          expect(juniorTrancheLockedUntil).to.be.bignumber.gt(new BN(0))
          await strategy.setLeverageRatio(
            tranchedPool.address,
            EXPECTED_LEVERAGE_RATIO,
            juniorTrancheLockedUntil,
            web3.utils.keccak256("DynamicLeverageRatioStrategy test version"),
            {from: owner}
          )

          const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
          expect(leverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)

          const amount = await strategy.invest(seniorPool.address, tranchedPool.address)
          expect(amount).to.bignumber.equal(
            juniorInvestmentAmount.mul(leverageRatio).div(LEVERAGE_RATIO_DECIMALS).sub(existingSeniorPrincipal)
          )
        })
      })

      context("senior principal already exceeds investment amount", () => {
        let tranchedPool, seniorPool, strategy, juniorInvestmentAmount, owner, borrower

        beforeEach(async () => {
          ;({tranchedPool, seniorPool, strategy, juniorInvestmentAmount, owner, borrower} = await setupTest())
        })

        it("does not invest", async () => {
          let existingSeniorPrincipal = juniorInvestmentAmount.add(
            juniorInvestmentAmount.mul(EXPECTED_LEVERAGE_RATIO).div(LEVERAGE_RATIO_DECIMALS).add(new BN(1))
          )
          await tranchedPool.deposit(TRANCHES.Senior, existingSeniorPrincipal)
          await tranchedPool.lockJuniorCapital({from: borrower})

          const juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
          const juniorTrancheLockedUntil = new BN(juniorTranche.lockedUntil)
          expect(juniorTrancheLockedUntil).to.be.bignumber.gt(new BN(0))
          await strategy.setLeverageRatio(
            tranchedPool.address,
            EXPECTED_LEVERAGE_RATIO,
            juniorTrancheLockedUntil,
            web3.utils.keccak256("DynamicLeverageRatioStrategy test version"),
            {from: owner}
          )

          const leverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
          expect(leverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)

          const amount = await strategy.invest(seniorPool.address, tranchedPool.address)
          expect(amount).to.bignumber.equal(new BN(0))
        })
      })
    })
  })
})
