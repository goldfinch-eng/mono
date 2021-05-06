/* global web3 */
const hre = require("hardhat")
const {deployments, artifacts} = hre
const {expect, BN, deployAllContracts, usdcVal, createPoolWithCreditLine} = require("./testHelpers.js")
const {interestAprAsBN, TRANCHES} = require("../blockchain_scripts/deployHelpers")
let accounts, owner, borrower, underwriter

describe("FixedLeverageRatioStrategy", () => {
  let tranchedPool, seniorFund, strategy, juniorInvestmentAmount
  let leverageRatio = new BN(4)

  const setupTest = deployments.createFixture(async ({deployments}) => {
    ;[owner, borrower, underwriter] = await web3.eth.getAccounts()

    const {seniorFund, goldfinchConfig, creditDesk, usdc} = await deployAllContracts(deployments, {
      fromAccount: owner,
    })

    await goldfinchConfig.bulkAddToGoList([owner, borrower, underwriter])

    juniorInvestmentAmount = usdcVal(10000)
    let limit = juniorInvestmentAmount.mul(new BN(10))
    let interestApr = interestAprAsBN("5.00")
    let paymentPeriodInDays = new BN(30)
    let termInDays = new BN(365)
    let lateFeeApr = new BN(0)
    let juniorFeePercent = new BN(20)
    ;({tranchedPool} = await createPoolWithCreditLine({
      people: {owner, borrower, underwriter},
      creditDesk,
      limit,
      interestApr,
      paymentPeriodInDays,
      termInDays,
      lateFeeApr,
      juniorFeePercent,
      usdc,
    }))

    let contractName = "FixedLeverageRatioStrategy"
    const deployResult = await deployments.deploy(contractName, {
      from: owner,
      args: [leverageRatio.toString()],
    })
    const strategy = await artifacts.require(contractName).at(deployResult.address)

    await tranchedPool.deposit(TRANCHES.Junior, juniorInvestmentAmount)

    return {tranchedPool, seniorFund, strategy}
  })

  beforeEach(async () => {
    accounts = await web3.eth.getAccounts()
    ;[owner] = accounts
    ;({tranchedPool, seniorFund, strategy} = await setupTest())
  })

  describe("invest", () => {
    it("levers junior investment using the leverageRatio", async () => {
      await tranchedPool.lockJuniorCapital({from: underwriter})

      let amount = await strategy.invest(seniorFund.address, tranchedPool.address)

      await expect(amount).to.bignumber.equal(juniorInvestmentAmount.mul(leverageRatio))
    })

    context("junior pool is not locked", () => {
      it("does not invest", async () => {
        let amount = await strategy.invest(seniorFund.address, tranchedPool.address)

        await expect(amount).to.bignumber.equal(new BN(0))
      })
    })

    context("pool is locked", () => {
      it("does not invest", async () => {
        await tranchedPool.lockJuniorCapital({from: underwriter})
        await tranchedPool.lockPool({from: underwriter})

        let amount = await strategy.invest(seniorFund.address, tranchedPool.address)

        await expect(amount).to.bignumber.equal(new BN(0))
      })
    })

    context("senior principal is already partially invested", () => {
      it("invests up to the levered amount", async () => {
        let existingSeniorPrincipal = juniorInvestmentAmount.add(new BN(10))
        await tranchedPool.deposit(TRANCHES.Senior, existingSeniorPrincipal)
        await tranchedPool.lockJuniorCapital({from: underwriter})

        let amount = await strategy.invest(seniorFund.address, tranchedPool.address)

        await expect(amount).to.bignumber.equal(juniorInvestmentAmount.mul(leverageRatio).sub(existingSeniorPrincipal))
      })
    })

    context("senior principal already exceeds investment amount", () => {
      it("does not invest", async () => {
        let existingSeniorPrincipal = juniorInvestmentAmount.add(
          juniorInvestmentAmount.mul(leverageRatio).add(new BN(1))
        )
        await tranchedPool.deposit(TRANCHES.Senior, existingSeniorPrincipal)
        await tranchedPool.lockJuniorCapital({from: underwriter})

        let amount = await strategy.invest(seniorFund.address, tranchedPool.address)

        await expect(amount).to.bignumber.equal(new BN(0))
      })
    })
  })
})
