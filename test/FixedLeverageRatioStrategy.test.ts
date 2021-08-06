/* global web3 */
import BN from "bn.js"
import {BigNumber} from "ethers"
import hre from "hardhat"
import {CONFIG_KEYS} from "../blockchain_scripts/configKeys"
import {interestAprAsBN, TRANCHES} from "../blockchain_scripts/deployHelpers"
import {GoldfinchConfig} from "../typechain/ethers"
import {FixedLeverageRatioStrategyInstance} from "../typechain/truffle"
import {genLeverageRatioStrategyTests, LeverageRatioStrategyTestSetup} from "./leverageRatioStrategyHelpers"
import {createPoolWithCreditLine, deployAllContracts, expect, usdcVal} from "./testHelpers"
const {deployments, artifacts} = hre
const FixedLeverageRatioStrategy = artifacts.require("FixedLeverageRatioStrategy")
let accounts, borrower

const EXPECTED_LEVERAGE_RATIO: BN = new BN(String(4e18))

const setLeverageRatio = async (
  leverageRatio: BN,
  strategy: any,
  tranchedPool: any,
  config: GoldfinchConfig,
  owner: any
): Promise<void> => {
  await config.setNumber(CONFIG_KEYS.LeverageRatio, leverageRatio as unknown as BigNumber, {from: owner})
}

describe("FixedLeverageRatioStrategy", () => {
  let goldfinchConfig, tranchedPool, strategy, juniorInvestmentAmount, owner

  const setupTest: LeverageRatioStrategyTestSetup<FixedLeverageRatioStrategyInstance> = deployments.createFixture(
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

      const strategy = await FixedLeverageRatioStrategy.new({from: owner})
      await strategy.initialize(owner, goldfinchConfig.address)

      await tranchedPool.deposit(TRANCHES.Junior, juniorInvestmentAmount)

      return {goldfinchConfig, tranchedPool, seniorPool, strategy, owner, juniorInvestmentAmount}
    }
  )

  beforeEach(async () => {
    accounts = await web3.eth.getAccounts()
    ;[owner] = accounts
    ;({goldfinchConfig, tranchedPool, strategy, owner} = await setupTest())
  })

  describe("getLeverageRatio", () => {
    it("returns the leverage ratio maintained by Goldfinch config, unadjusted for the relevant number of decimal places", async () => {
      const configLeverageRatio = await goldfinchConfig.getNumber(CONFIG_KEYS.LeverageRatio)
      expect(configLeverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)

      const strategyLeverageRatio = await strategy.getLeverageRatio(tranchedPool.address)
      expect(strategyLeverageRatio).to.bignumber.equal(EXPECTED_LEVERAGE_RATIO)
    })
  })

  genLeverageRatioStrategyTests(setupTest, EXPECTED_LEVERAGE_RATIO, setLeverageRatio)
})
