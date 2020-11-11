/* global artifacts web3 */
const hre = require("hardhat")
const {deployments} = hre
const {
  expect,
  decimals,
  BN,
  usdcVal,
  getBalance,
  getDeployedAsTruffleContract,
  BLOCKS_PER_DAY,
  BLOCKS_PER_YEAR,
} = require("./testHelpers.js")
const {interestAprAsBN, INTEREST_DECIMALS} = require("../blockchain_scripts/deployHelpers")
const {time} = require("@openzeppelin/test-helpers")
const CreditLine = artifacts.require("CreditLine")

// eslint-disable-next-line no-unused-vars
let accounts, owner, underwriter, borrower, person4, creditDesk, fidu, goldfinchConfig, reserve, usdc, pool, creditLine

describe("Goldfinch", async () => {
  const setupTest = deployments.createFixture(async ({deployments}) => {
    await deployments.fixture("base_deploy")
    pool = await getDeployedAsTruffleContract(deployments, "Pool")
    usdc = await getDeployedAsTruffleContract(deployments, "ERC20")
    creditDesk = await getDeployedAsTruffleContract(deployments, "CreditDesk")
    fidu = await getDeployedAsTruffleContract(deployments, "Fidu")
    goldfinchConfig = await getDeployedAsTruffleContract(deployments, "GoldfinchConfig")

    // Approve transfers for our test accounts
    await usdc.approve(pool.address, new BN(100000).mul(decimals), {from: owner})
    await usdc.approve(pool.address, new BN(100000).mul(decimals), {from: underwriter})
    await usdc.approve(pool.address, new BN(100000).mul(decimals), {from: borrower})

    // Some housekeeping so we have a usable creditDesk for tests, and a pool with funds
    await usdc.transfer(underwriter, String(usdcVal(10000)), {from: owner})
    await pool.deposit(String(usdcVal(10000)), {from: underwriter})
    // Set the reserve to a separate address for easier separation. The current owner account gets used for many things in tests.
    await goldfinchConfig.setTreasuryReserve(reserve)
    await creditDesk.setUnderwriterGovernanceLimit(underwriter, usdcVal(25000), {from: owner})
    return {pool, usdc, creditDesk, fidu, goldfinchConfig}
  })

  beforeEach(async () => {
    accounts = await web3.eth.getAccounts()
    ;[owner, underwriter, borrower, person4, reserve] = accounts
    const deployResult = await setupTest()

    usdc = deployResult.usdc
    pool = deployResult.pool
    creditDesk = deployResult.creditDesk
    fidu = deployResult.fidu
    goldfinchConfig = deployResult.goldfinchConfig
  })

  describe("functional test", async () => {
    async function advanceTime({days, blocks, toBlock}) {
      let blocksPassed, newBlock
      let currentBlock = await creditDesk.blockNumberForTest()

      if (days) {
        blocksPassed = BLOCKS_PER_DAY.mul(new BN(days))
        newBlock = currentBlock.add(blocksPassed)
      } else if (blocks) {
        blocksPassed = new BN(blocks)
        newBlock = currentBlock.add(blocksPassed)
      } else if (toBlock) {
        newBlock = new BN(toBlock)
      }
      // Cannot go backward
      expect(newBlock).to.bignumber.gt(currentBlock)
      await creditDesk._setBlockNumberForTest(newBlock)
      return newBlock
    }

    async function assertCreditLine(
      balance,
      interestOwed,
      collectedPayment,
      nextDueBlock,
      lastUpdatedBlock,
      lastFullPaymentBlock
    ) {
      expect(await creditLine.balance()).to.bignumber.equal(balance)
      expect(await creditLine.interestOwed()).to.bignumber.equal(interestOwed)
      expect(await creditLine.principalOwed()).to.bignumber.equal("0") // Principal owed is always 0
      expect(await getBalance(creditLine.address, usdc)).to.bignumber.equal(collectedPayment)
      expect(await creditLine.nextDueBlock()).to.bignumber.equal(new BN(nextDueBlock))
      expect(await creditLine.lastUpdatedBlock()).to.bignumber.equal(new BN(lastUpdatedBlock))
      expect(await creditLine.lastFullPaymentBlock()).to.bignumber.equal(new BN(lastFullPaymentBlock))
    }

    describe("interest rate works", async () => {
      let limit, interestApr, paymentPeriodInDays, termInDays, lateFeeApr, paymentPeriodInBlocks

      beforeEach(async () => {
        limit = usdcVal(10000)
        interestApr = interestAprAsBN(25)
        lateFeeApr = interestAprAsBN(0)
        paymentPeriodInDays = new BN(1)
        termInDays = new BN(365)
        paymentPeriodInBlocks = BLOCKS_PER_DAY.mul(paymentPeriodInDays)
      })

      async function createCreditLine() {
        await creditDesk.createCreditLine(borrower, limit, interestApr, paymentPeriodInDays, termInDays, lateFeeApr, {
          from: underwriter,
        })
        var ulCreditLines = await creditDesk.getUnderwriterCreditLines(underwriter)
        return CreditLine.at(ulCreditLines[0])
      }

      it("calculates interest correctly", async () => {
        let currentBlock = await advanceTime({days: 1})
        creditLine = await createCreditLine()

        let lastUpdatedBlock = await time.latestBlock()
        await assertCreditLine("0", "0", "0", 0, lastUpdatedBlock, 0)

        currentBlock = await advanceTime({days: 1})
        await creditDesk.drawdown(usdcVal(2000), creditLine.address, borrower, {from: borrower})

        var nextDueBlock = (await creditDesk.blockNumberForTest()).add(BLOCKS_PER_DAY.mul(paymentPeriodInDays))
        lastUpdatedBlock = currentBlock
        await assertCreditLine(usdcVal(2000), "0", "0", nextDueBlock, currentBlock, 0)

        currentBlock = await advanceTime({days: 1})

        await creditDesk.assessCreditLine(creditLine.address, {from: borrower})

        const totalInterestPerYear = usdcVal(2000).mul(interestApr).div(INTEREST_DECIMALS)
        let blocksPassed = nextDueBlock.sub(lastUpdatedBlock)
        let expectedInterest = totalInterestPerYear.mul(blocksPassed).div(BLOCKS_PER_YEAR)
        nextDueBlock = nextDueBlock.add(paymentPeriodInBlocks)

        expect(expectedInterest).to.bignumber.eq("1369863")

        await assertCreditLine(
          usdcVal(2000),
          expectedInterest,
          "0",
          nextDueBlock,
          nextDueBlock.sub(paymentPeriodInBlocks),
          0
        )

        currentBlock = await advanceTime({days: 1})
        expectedInterest = expectedInterest.mul(new BN(2)) // 2 days of interest
        nextDueBlock = nextDueBlock.add(paymentPeriodInBlocks)

        await creditDesk.assessCreditLine(creditLine.address, {from: borrower})

        await assertCreditLine(
          usdcVal(2000),
          expectedInterest,
          "0",
          nextDueBlock,
          nextDueBlock.sub(paymentPeriodInBlocks),
          0
        )
      })
    })
  })
})
