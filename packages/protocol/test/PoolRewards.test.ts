/* global web3 */
import BN from "bn.js"
import hre from "hardhat"
import {asNonNullable} from "@goldfinch-eng/utils"
const GoldfinchConfig = artifacts.require("GoldfinchConfig")
const PoolRewards = artifacts.require("PoolRewards")
import {
  ERC20Instance,
  GFIInstance,
  PoolRewardsInstance,
  SeniorPoolInstance,
  TranchedPoolInstance,
  PoolTokensInstance,
  GoldfinchFactoryInstance,
  GoldfinchConfigInstance,
} from "../typechain/truffle"
import {TRANCHES, interestAprAsBN, OWNER_ROLE} from "../blockchain_scripts/deployHelpers"
import {DepositMade} from "../typechain/truffle/TranchedPool"

const decimals = new BN(String(1e18))

import {
  deployAllContracts,
  bigVal,
  expect,
  createPoolWithCreditLine,
  usdcVal,
  erc20Approve,
  advanceTime,
  decodeLogs,
  getFirstLog,
  fiduToUSDC,
  ZERO_ADDRESS,
  erc20Transfer,
} from "./testHelpers"

const {deployments} = hre

describe("PoolRewards", () => {
  let owner: string,
    borrower: string,
    investor: string,
    anotherUser: string,
    anotherAnotherUser: string,
    goldfinchFactory: GoldfinchFactoryInstance,
    goldfinchConfig: GoldfinchConfigInstance,
    gfi: GFIInstance,
    usdc: ERC20Instance,
    poolRewards: PoolRewardsInstance,
    seniorPool: SeniorPoolInstance,
    tranchedPool: TranchedPoolInstance,
    poolTokens: PoolTokensInstance

  const testCalcAccRewardsPerPrincipalDollar = ({
    accRewardsPerPrincipalDollar = 0,
    interestPaymentAmount,
    maxInterestDollarsEligible,
    totalGFISupply,
    totalRewards,
    juniorTranchePrincipal,
    previousInterestReceived,
  }: {
    accRewardsPerPrincipalDollar?: number
    interestPaymentAmount: number
    maxInterestDollarsEligible: number
    totalGFISupply: number
    totalRewards: number
    juniorTranchePrincipal: number
    previousInterestReceived: number
  }) => {
    let newTotalInterest = previousInterestReceived + interestPaymentAmount
    if (newTotalInterest > maxInterestDollarsEligible) {
      newTotalInterest = maxInterestDollarsEligible
    }

    const sqrtNewTotalInterest = new BN(Math.sqrt(newTotalInterest * 10 ** 18))
    const sqrtOrigTotalInterest = new BN(Math.sqrt(previousInterestReceived * 10 ** 18))

    const percent = Math.round((totalRewards / totalGFISupply) * 100)

    const sqrtDiff = sqrtNewTotalInterest.sub(sqrtOrigTotalInterest)

    const sqrtMaxInterestDollarsEligible = new BN(Math.sqrt(maxInterestDollarsEligible * 10 ** 18))

    const testNewGrossRewards = sqrtDiff
      .mul(new BN(percent).mul(decimals))
      .div(sqrtMaxInterestDollarsEligible)
      .div(new BN(100))
      .mul(new BN(totalGFISupply))

    const testAccRewardsPerPrincipalDollar = new BN(accRewardsPerPrincipalDollar).add(
      testNewGrossRewards.mul(decimals).div(new BN(juniorTranchePrincipal).mul(decimals))
    )

    const testPoolTokenClaimableRewards = new BN(juniorTranchePrincipal)
      .mul(decimals)
      .mul(testAccRewardsPerPrincipalDollar)
      .div(decimals)

    return {testNewGrossRewards, testAccRewardsPerPrincipalDollar, testPoolTokenClaimableRewards}
  }

  const mintGFI = async (totalGFISupply = 100_000_000, from = owner) => {
    const gfiAmount = bigVal(totalGFISupply)
    await gfi.setCap(gfiAmount, {from: from})
    await gfi.mint(from, gfiAmount)
    await gfi.approve(from, gfiAmount)
  }

  const setupPoolRewardsContract = async ({
    totalGFISupply,
    maxInterestDollarsEligible,
    totalRewards,
    previousInterestReceived,
  }) => {
    await mintGFI(totalGFISupply)
    await poolRewards.setMaxInterestDollarsEligible(bigVal(maxInterestDollarsEligible))
    await poolRewards.setTotalRewards(bigVal(Math.round(totalRewards * 100)).div(new BN(100)))
    await poolRewards.setTotalInterestReceived(usdcVal(previousInterestReceived))
  }

  const testSetup = deployments.createFixture(async ({deployments, getNamedAccounts}) => {
    const [_owner, _borrower, _investor, _anotherUser, _anotherAnotherUser] = await web3.eth.getAccounts()
    const owner = asNonNullable(_owner)
    const investor = asNonNullable(_investor)
    const borrower = asNonNullable(_borrower)
    const anotherUser = asNonNullable(_anotherUser)
    const anotherAnotherUser = asNonNullable(_anotherAnotherUser)
    const {goldfinchConfig, gfi, poolRewards, usdc, goldfinchFactory, poolTokens} = await deployAllContracts(
      deployments
    )
    await goldfinchConfig.bulkAddToGoList([owner, investor, borrower, anotherUser, anotherAnotherUser])

    await erc20Transfer(usdc, [anotherUser], usdcVal(100_000), owner)
    await erc20Transfer(usdc, [anotherAnotherUser], usdcVal(100_000), owner)
    await erc20Transfer(usdc, [investor], usdcVal(100_000), owner)

    const limit = usdcVal(1_000_000)
    const interestApr = interestAprAsBN("5.00")
    const paymentPeriodInDays = new BN(30)
    const termInDays = new BN(365)
    const lateFeeApr = new BN(0)
    const juniorFeePercent = new BN(20)
    const {tranchedPool} = await createPoolWithCreditLine({
      people: {owner, borrower},
      goldfinchFactory,
      juniorFeePercent,
      limit,
      interestApr,
      paymentPeriodInDays,
      termInDays,
      lateFeeApr,
      usdc,
    })
    return {
      owner,
      goldfinchFactory,
      borrower,
      investor,
      anotherUser,
      anotherAnotherUser,
      goldfinchConfig,
      gfi,
      poolRewards,
      tranchedPool,
      seniorPool,
      usdc,
      poolTokens,
    }
  })

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({
      owner,
      borrower,
      investor,
      anotherUser,
      anotherAnotherUser,
      goldfinchFactory,
      gfi,
      poolRewards,
      tranchedPool,
      seniorPool,
      usdc,
      poolTokens,
    } = await testSetup())
  })

  describe("initialization", () => {
    beforeEach(async () => {
      goldfinchConfig = await GoldfinchConfig.new({from: owner})
      await goldfinchConfig.initialize(owner)

      poolRewards = await PoolRewards.new({from: owner})
      await poolRewards.__initialize__(owner, goldfinchConfig.address)
    })

    it("should not allow it to be called twice", async () => {
      return expect(poolRewards.__initialize__(owner, goldfinchConfig.address)).to.be.rejectedWith(
        /has already been initialized/
      )
    })

    describe("ownership", async () => {
      it("should be owned by the owner", async () => {
        expect(await poolRewards.hasRole(OWNER_ROLE, owner)).to.be.true
      })
    })
  })

  describe("setTotalRewards()", () => {
    it("properly sets totalRewards and totalRewardPercentOfTotalGFI", async () => {
      const totalGFISupply = 100_000_000
      const totalRewards = 1_000
      const maxInterestDollarsEligible = 1_000_000_000
      await setupPoolRewardsContract({
        totalGFISupply,
        maxInterestDollarsEligible,
        totalRewards,
        previousInterestReceived: 0,
      })
      expect(await poolRewards.totalRewards()).to.bignumber.equal(bigVal(totalRewards))
      expect(await poolRewards.totalRewardPercentOfTotalGFI()).to.bignumber.equal(
        bigVal(totalRewards).div(new BN(totalGFISupply)).mul(new BN(100))
      ) // 3*10^18
    })
  })

  describe("setMaxInterestDollarsEligible()", () => {
    it("properly sets maxInterestDollarsEligible", async () => {
      const maxInterestDollarsEligible = bigVal(1_000)
      await poolRewards.setMaxInterestDollarsEligible(maxInterestDollarsEligible)
      expect(await poolRewards.maxInterestDollarsEligible()).to.bignumber.equal(maxInterestDollarsEligible)
    })
  })

  describe("setTotalInterestReceived()", () => {
    it("properly sets setTotalInterestReceived", async () => {
      const totalInterestReceived = usdcVal(1_000)
      await poolRewards.setTotalInterestReceived(totalInterestReceived)
      expect(await poolRewards.totalInterestReceived()).to.bignumber.equal(totalInterestReceived)
    })
  })

  describe("allocateRewards()", () => {
    context("Invalid pool address", () => {
      const interestPaymentAmount = new BN(1_000)
      it("should error", async () => {
        await expect(poolRewards.allocateRewards(interestPaymentAmount)).to.be.rejectedWith(/Invalid pool!/)
      })
    })
  })

  describe("tranchedPool interest repayment", () => {
    // 100% repayment with all tokens distributed
    const maxRepaymentTestCases = [
      {
        juniorTranchePrincipal: 100_000,
        previousInterestReceived: 0,
        totalGFISupply: 100_000_000,
        maxInterestDollarsEligible: 100_000,
        totalRewards: 3_000_000,
        interestPaymentAmount: 5_000,
      },
      {
        juniorTranchePrincipal: 100_000,
        previousInterestReceived: 0,
        totalGFISupply: 114_285_714,
        maxInterestDollarsEligible: 100_000,
        totalRewards: 2_285_714.28,
        interestPaymentAmount: 5_000,
      },
    ]

    maxRepaymentTestCases.forEach(
      async ({
        juniorTranchePrincipal,
        previousInterestReceived,
        totalGFISupply,
        maxInterestDollarsEligible,
        totalRewards,
      }) => {
        it(`should handle a MAX 100% apy full repayment totalRewards:${totalRewards}, totalGFISupply:${totalGFISupply}`, async () => {
          await setupPoolRewardsContract({
            totalGFISupply,
            maxInterestDollarsEligible,
            totalRewards,
            previousInterestReceived,
          })
          const {tranchedPool: tranchedPoolMax} = await createPoolWithCreditLine({
            people: {owner, borrower},
            goldfinchFactory,
            juniorFeePercent: new BN(20),
            limit: usdcVal(100_000),
            interestApr: interestAprAsBN("100.00"),
            paymentPeriodInDays: new BN(30),
            termInDays: new BN(365),
            lateFeeApr: new BN(0),
            usdc,
          })
          const response = await tranchedPoolMax.deposit(TRANCHES.Junior, usdcVal(juniorTranchePrincipal))
          const logs = decodeLogs<DepositMade>(response.receipt.rawLogs, tranchedPoolMax, "DepositMade")
          const firstLog = getFirstLog(logs)
          const tokenId = firstLog.args.tokenId
          await tranchedPoolMax.lockJuniorCapital({from: borrower})
          await tranchedPoolMax.lockPool({from: borrower})
          await tranchedPoolMax.drawdown(usdcVal(juniorTranchePrincipal), {from: borrower})
          await advanceTime({days: new BN(365).toNumber()})
          const payAmount = usdcVal(juniorTranchePrincipal)
          await erc20Approve(usdc, tranchedPoolMax.address, payAmount, [borrower])
          await tranchedPoolMax.pay(payAmount, {from: borrower})

          const {testPoolTokenClaimableRewards} = testCalcAccRewardsPerPrincipalDollar({
            interestPaymentAmount: juniorTranchePrincipal,
            maxInterestDollarsEligible,
            totalRewards,
            totalGFISupply,
            juniorTranchePrincipal,
            previousInterestReceived,
          })

          const expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(tokenId)
          expect(expectedPoolTokenClaimableRewards).to.bignumber.equal(testPoolTokenClaimableRewards)
        })
      }
    )

    // set a pool to $1 below it's max interest dollar limit
    // have a $5000 interest payment come in
    // expect only the last $1 of gfi rewards earned
    it("should handle interest payments that exceed maxInterestDollarsEligible", async () => {
      const maxInterestDollarsEligible = 1_000_000_000
      const totalGFISupply = 100_000_000
      const totalRewards = 3_000_000 // 3% of 100m
      const previousInterestReceived = maxInterestDollarsEligible - 1

      await setupPoolRewardsContract({
        totalGFISupply,
        maxInterestDollarsEligible,
        totalRewards,
        previousInterestReceived,
      })

      const juniorTranchePrincipal = 100_000
      const response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(juniorTranchePrincipal))
      const logs = decodeLogs<DepositMade>(response.receipt.rawLogs, tranchedPool, "DepositMade")
      const firstLog = getFirstLog(logs)
      const tokenId = firstLog.args.tokenId
      await tranchedPool.lockJuniorCapital({from: borrower})
      await tranchedPool.lockPool({from: borrower})
      await tranchedPool.drawdown(usdcVal(juniorTranchePrincipal), {from: borrower})
      await advanceTime({days: new BN(365).toNumber()})
      const payAmount = usdcVal(juniorTranchePrincipal)
      await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
      await tranchedPool.pay(payAmount, {from: borrower})

      const {testPoolTokenClaimableRewards, testAccRewardsPerPrincipalDollar} = testCalcAccRewardsPerPrincipalDollar({
        interestPaymentAmount: 5000,
        maxInterestDollarsEligible,
        totalRewards,
        totalGFISupply,
        juniorTranchePrincipal,
        previousInterestReceived,
      })

      // verify accRewardsPerPrincipalDollar
      const accRewardsPerPrincipalDollar = await poolRewards.pools(tranchedPool.address)
      expect(accRewardsPerPrincipalDollar).to.bignumber.equal(testAccRewardsPerPrincipalDollar)

      // verify pool token principal
      const {principalAmount: poolTokenPrincipalAmount} = await poolTokens.getTokenInfo(tokenId)
      expect(poolTokenPrincipalAmount).to.bignumber.eq(usdcVal(juniorTranchePrincipal))

      // verify claimable rewards
      const expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(tokenId)
      expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(testPoolTokenClaimableRewards)
    })

    // Create a pool with $100,000
    // $5,000 interest payment comes in, $4500 to jr pool
    // previous protocol total interest received is 0
    const testCases = [
      {
        juniorTranchePrincipal: 100_000,
        previousInterestReceived: 0,
        percent: 3,
        totalGFISupply: 100_000_000,
        maxInterestDollarsEligible: 1_000_000_000,
        totalRewards: 3_000_000,
        interestPaymentAmount: 5_000,
      },
      {
        juniorTranchePrincipal: 100_000,
        previousInterestReceived: 5000,
        percent: 3,
        totalGFISupply: 100_000_000,
        maxInterestDollarsEligible: 1_000_000_000,
        totalRewards: 3_000_000,
        interestPaymentAmount: 5_000,
      },
      {
        juniorTranchePrincipal: 100_000,
        previousInterestReceived: 0,
        percent: 2,
        totalGFISupply: 114_285_714,
        maxInterestDollarsEligible: 1_000_000_000,
        totalRewards: 2_285_714.28,
        interestPaymentAmount: 5_000,
      },
      {
        juniorTranchePrincipal: 100_000,
        previousInterestReceived: 5_000,
        percent: 2,
        totalGFISupply: 114_285_714,
        maxInterestDollarsEligible: 1_000_000_000,
        totalRewards: 2_285_714.28,
        interestPaymentAmount: 5_000,
      },
      {
        juniorTranchePrincipal: 100_000,
        previousInterestReceived: 150_000,
        percent: 2,
        totalGFISupply: 114_285_714,
        maxInterestDollarsEligible: 1_000_000_000,
        totalRewards: 2_285_714.28,
        interestPaymentAmount: 5_000,
      },
    ]

    testCases.forEach(
      async ({
        juniorTranchePrincipal,
        previousInterestReceived,
        totalGFISupply,
        maxInterestDollarsEligible,
        totalRewards,
        interestPaymentAmount,
      }) => {
        it(`calculate accRewardsPerPrincipalDollar for protocol interest deposits totalGFISupply:${totalGFISupply}, totalRewards:${totalRewards}, previousInterestReceived:${previousInterestReceived}`, async () => {
          await setupPoolRewardsContract({
            totalGFISupply,
            maxInterestDollarsEligible,
            totalRewards,
            previousInterestReceived,
          })
          const response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(juniorTranchePrincipal))
          const logs = decodeLogs<DepositMade>(response.receipt.rawLogs, tranchedPool, "DepositMade")
          const firstLog = getFirstLog(logs)
          const tokenId = firstLog.args.tokenId
          await tranchedPool.lockJuniorCapital({from: borrower})
          await tranchedPool.lockPool({from: borrower})
          await tranchedPool.drawdown(usdcVal(juniorTranchePrincipal), {from: borrower})
          await advanceTime({days: new BN(365).toNumber()})
          const payAmount = usdcVal(juniorTranchePrincipal)
          await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
          await tranchedPool.pay(payAmount, {from: borrower})

          const {testPoolTokenClaimableRewards, testAccRewardsPerPrincipalDollar} =
            testCalcAccRewardsPerPrincipalDollar({
              interestPaymentAmount,
              maxInterestDollarsEligible,
              totalGFISupply,
              totalRewards,
              juniorTranchePrincipal,
              previousInterestReceived,
            })

          // verify accRewardsPerPrincipalDollar
          const accRewardsPerPrincipalDollar = await poolRewards.pools(tranchedPool.address)

          expect(accRewardsPerPrincipalDollar).to.bignumber.equal(testAccRewardsPerPrincipalDollar)

          // verify pool token principal
          const {principalAmount: poolTokenPrincipalAmount} = await poolTokens.getTokenInfo(tokenId)
          expect(poolTokenPrincipalAmount).to.bignumber.eq(usdcVal(juniorTranchePrincipal))

          // verify claimable rewards
          const expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(tokenId)
          expect(expectedPoolTokenClaimableRewards).to.bignumber.equal(testPoolTokenClaimableRewards)
        })
      }
    )

    it("should increment totalInterestReceived when a interest payment comes in", async () => {
      const maxInterestDollarsEligible = 1_000_000_000
      const totalGFISupply = 100_000_000
      const totalRewards = 3_000_000 // 3% of 100m
      const previousInterestReceived = 0

      await setupPoolRewardsContract({
        totalGFISupply,
        maxInterestDollarsEligible,
        totalRewards,
        previousInterestReceived,
      })
      const juniorTranchePrincipal = 100_000
      const totalInterestReceived = 0

      expect(await poolRewards.totalInterestReceived()).to.bignumber.equal(new BN(totalInterestReceived))
      await poolRewards.setTotalInterestReceived(fiduToUSDC(totalInterestReceived))
      expect(await poolRewards.totalInterestReceived()).to.bignumber.equal(fiduToUSDC(totalInterestReceived))

      await tranchedPool.deposit(TRANCHES.Junior, usdcVal(juniorTranchePrincipal))
      await tranchedPool.lockJuniorCapital({from: borrower})
      await tranchedPool.lockPool({from: borrower})
      await tranchedPool.drawdown(usdcVal(100_000), {from: borrower})
      await advanceTime({days: new BN(365).toNumber()})
      const payAmount = usdcVal(100_000)
      await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])

      await tranchedPool.pay(payAmount, {from: borrower})
      expect(await poolRewards.totalInterestReceived()).to.bignumber.equal(new BN(100_000 * 0.05 * 10 ** 6)) // 5% interest
    })

    context("All rewards exhausted", () => {
      // put the interest received at 999_999_999
      it("should succeed when maxInterestDollarsEligible-1", async () => {
        const maxInterestDollarsEligible = 1_000_000_000
        const totalRewards = 3_000_000 // 3% of 100m
        await mintGFI(totalRewards)
        const totalInterestReceived = maxInterestDollarsEligible - 1
        const juniorTranchePrincipal = 100_000
        await poolRewards.setTotalInterestReceived(fiduToUSDC(totalInterestReceived))
        await tranchedPool.deposit(TRANCHES.Junior, usdcVal(juniorTranchePrincipal))
        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})
        await tranchedPool.drawdown(usdcVal(20), {from: borrower})
        await advanceTime({days: new BN(365).toNumber()})
        const payAmount = usdcVal(20)
        await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
        await expect(tranchedPool.pay(payAmount, {from: borrower})).to.be.fulfilled

        // TODO: need to add a check to make sure only $1 of rewards got distributed
      })

      // borrow $20 for a $1 payback to push total interest received over threshold
      it("should return and make no changes when totalInterestReceived is >= maxInterestDollarsEligible", async () => {
        const maxInterestDollarsEligible = bigVal(1_000_000_000)
        await poolRewards.setMaxInterestDollarsEligible(maxInterestDollarsEligible)
        await poolRewards.setTotalInterestReceived(fiduToUSDC(maxInterestDollarsEligible))
        await tranchedPool.deposit(TRANCHES.Junior, usdcVal(100_000))
        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})
        await tranchedPool.drawdown(usdcVal(20), {from: borrower})
        await advanceTime({days: new BN(365).toNumber()})
        const payAmount = usdcVal(20)
        await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])

        const beforeAccRewardsPerPrincipalDollar = await poolRewards.pools(tranchedPool.address)
        const beforeTotalInterestReceived = await poolRewards.totalInterestReceived()

        await expect(tranchedPool.pay(payAmount, {from: borrower})).to.be.fulfilled

        const afterAccRewardsPerPrincipalDollar = await poolRewards.pools(tranchedPool.address)
        const afterTotalInterestReceived = await poolRewards.totalInterestReceived()

        expect(beforeAccRewardsPerPrincipalDollar).to.bignumber.equal(afterAccRewardsPerPrincipalDollar)
        expect(beforeTotalInterestReceived).to.bignumber.equal(afterTotalInterestReceived)
      })
    })
  })

  describe("poolTokenClaimableRewards()", () => {
    // two users each having 50% of the pool principal
    it("Distributes 50%/50% rewards", async () => {
      const maxInterestDollarsEligible = 1_000_000_000
      const totalGFISupply = 100_000_000
      const totalRewards = 3_000_000 // 3% of 100m
      const previousInterestReceived = 5000

      await setupPoolRewardsContract({
        totalGFISupply,
        maxInterestDollarsEligible,
        totalRewards,
        previousInterestReceived,
      })
      const juniorTranchePrincipal = 100_000

      let logs, firstLog
      await poolRewards.setTotalInterestReceived(usdcVal(previousInterestReceived))

      // AnotherUser deposits 50% of $100k
      await erc20Approve(usdc, tranchedPool.address, usdcVal(50_000), [anotherUser])
      const anotherUserResponse = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(50_000), {from: anotherUser})
      logs = decodeLogs<DepositMade>(anotherUserResponse.receipt.rawLogs, tranchedPool, "DepositMade")
      firstLog = getFirstLog(logs)
      const anotherUserTokenId = firstLog.args.tokenId

      // AnotherUser deposits 50% of $100k
      await erc20Approve(usdc, tranchedPool.address, usdcVal(50_000), [investor])
      const investorResponse = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(50_000), {from: investor})
      logs = decodeLogs<DepositMade>(investorResponse.receipt.rawLogs, tranchedPool, "DepositMade")
      firstLog = getFirstLog(logs)
      const investorTokenId = firstLog.args.tokenId

      await tranchedPool.lockJuniorCapital({from: borrower})
      await tranchedPool.lockPool({from: borrower})
      await tranchedPool.drawdown(usdcVal(juniorTranchePrincipal), {from: borrower})
      await advanceTime({days: new BN(365).toNumber()})
      const payAmount = usdcVal(juniorTranchePrincipal)
      await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
      await tranchedPool.pay(payAmount, {from: borrower})

      const {testPoolTokenClaimableRewards} = testCalcAccRewardsPerPrincipalDollar({
        interestPaymentAmount: 5000,
        maxInterestDollarsEligible: 1_000_000_000,
        totalRewards,
        totalGFISupply: 100_000_000,
        juniorTranchePrincipal,
        previousInterestReceived,
      })

      // ensure each user gets 50% of the pool
      // total rewards = 2,778.629048005770000000
      let expectedPoolTokenClaimableRewards
      expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(investorTokenId)
      expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(testPoolTokenClaimableRewards.div(new BN(2)))

      expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(anotherUserTokenId)
      expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(testPoolTokenClaimableRewards.div(new BN(2)))
    })

    // two users, one with 75k principal, the other with 25k principal
    it("Distributes 75%/25% rewards", async () => {
      const maxInterestDollarsEligible = 1_000_000_000
      const totalGFISupply = 100_000_000
      const totalRewards = 3_000_000 // 3% of 100m
      const previousInterestReceived = 5000

      await setupPoolRewardsContract({
        totalGFISupply,
        maxInterestDollarsEligible,
        totalRewards,
        previousInterestReceived,
      })
      const juniorTranchePrincipal = 100_000

      let logs, firstLog
      await poolRewards.setTotalInterestReceived(usdcVal(previousInterestReceived))

      await erc20Approve(usdc, tranchedPool.address, usdcVal(75_000), [anotherUser])
      const anotherUserResponse = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(75_000), {from: anotherUser})
      logs = decodeLogs<DepositMade>(anotherUserResponse.receipt.rawLogs, tranchedPool, "DepositMade")
      firstLog = getFirstLog(logs)
      const anotherUserTokenId = firstLog.args.tokenId

      await erc20Approve(usdc, tranchedPool.address, usdcVal(25_000), [investor])
      const investorResponse = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(25_000), {from: investor})
      logs = decodeLogs<DepositMade>(investorResponse.receipt.rawLogs, tranchedPool, "DepositMade")
      firstLog = getFirstLog(logs)
      const investorTokenId = firstLog.args.tokenId

      await tranchedPool.lockJuniorCapital({from: borrower})
      await tranchedPool.lockPool({from: borrower})
      await tranchedPool.drawdown(usdcVal(juniorTranchePrincipal), {from: borrower})
      await advanceTime({days: new BN(365).toNumber()})
      const payAmount = usdcVal(juniorTranchePrincipal)
      await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
      await tranchedPool.pay(payAmount, {from: borrower})

      const {testPoolTokenClaimableRewards} = testCalcAccRewardsPerPrincipalDollar({
        interestPaymentAmount: 5000,
        maxInterestDollarsEligible: 1_000_000_000,
        totalRewards,
        totalGFISupply: 100_000_000,
        juniorTranchePrincipal,
        previousInterestReceived,
      })

      // investor gets 25% of the pool
      // total rewards = 2,778.629048005770000000
      let expectedPoolTokenClaimableRewards
      expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(investorTokenId)
      expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(testPoolTokenClaimableRewards.div(new BN(4)))

      // anotherUser gets 75% of pool
      expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(anotherUserTokenId)
      expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(
        testPoolTokenClaimableRewards.div(new BN(4)).mul(new BN(3))
      )
    })

    it("Distributes 1%/99% rewards", async () => {
      const maxInterestDollarsEligible = 1_000_000_000
      const totalGFISupply = 100_000_000
      const totalRewards = 3_000_000 // 3% of 100m
      const previousInterestReceived = 5000

      await setupPoolRewardsContract({
        totalGFISupply,
        maxInterestDollarsEligible,
        totalRewards,
        previousInterestReceived,
      })
      const juniorTranchePrincipal = 100_000

      let logs, firstLog
      await poolRewards.setTotalInterestReceived(usdcVal(previousInterestReceived))

      await erc20Approve(usdc, tranchedPool.address, usdcVal(99_000), [anotherUser])
      const anotherUserResponse = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(99_000), {from: anotherUser})
      logs = decodeLogs<DepositMade>(anotherUserResponse.receipt.rawLogs, tranchedPool, "DepositMade")
      firstLog = getFirstLog(logs)
      const anotherUserTokenId = firstLog.args.tokenId

      await erc20Approve(usdc, tranchedPool.address, usdcVal(1_000), [investor])
      const investorResponse = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(1_000), {from: investor})
      logs = decodeLogs<DepositMade>(investorResponse.receipt.rawLogs, tranchedPool, "DepositMade")
      firstLog = getFirstLog(logs)
      const investorTokenId = firstLog.args.tokenId

      await tranchedPool.lockJuniorCapital({from: borrower})
      await tranchedPool.lockPool({from: borrower})
      await tranchedPool.drawdown(usdcVal(juniorTranchePrincipal), {from: borrower})
      await advanceTime({days: new BN(365).toNumber()})
      const payAmount = usdcVal(juniorTranchePrincipal)
      await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
      await tranchedPool.pay(payAmount, {from: borrower})

      const {testPoolTokenClaimableRewards} = testCalcAccRewardsPerPrincipalDollar({
        interestPaymentAmount: 5000,
        maxInterestDollarsEligible: 1_000_000_000,
        totalRewards,
        totalGFISupply: 100_000_000,
        juniorTranchePrincipal,
        previousInterestReceived,
      })

      // investor gets 1% of the pool
      let expectedPoolTokenClaimableRewards
      expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(investorTokenId)
      expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(
        testPoolTokenClaimableRewards.div(new BN(100))
      )

      // anotherUser gets 99% of pool
      expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(anotherUserTokenId)
      expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(
        testPoolTokenClaimableRewards.div(new BN(100)).mul(new BN(99))
      )
    })

    it("Distributes 33.3%/33.3%/33.3% rewards", async () => {
      const maxInterestDollarsEligible = 1_000_000_000
      const totalGFISupply = 100_000_000
      const totalRewards = 3_000_000 // 3% of 100m
      const previousInterestReceived = 5000
      const juniorTranchePrincipal = 99_999

      await setupPoolRewardsContract({
        totalGFISupply,
        maxInterestDollarsEligible,
        totalRewards,
        previousInterestReceived,
      })

      let logs, firstLog
      await poolRewards.setTotalInterestReceived(usdcVal(previousInterestReceived))

      await erc20Approve(usdc, tranchedPool.address, usdcVal(33_333), [anotherUser])
      const anotherUserResponse = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(33_333), {from: anotherUser})
      logs = decodeLogs<DepositMade>(anotherUserResponse.receipt.rawLogs, tranchedPool, "DepositMade")
      firstLog = getFirstLog(logs)
      const anotherUserTokenId = firstLog.args.tokenId

      await erc20Approve(usdc, tranchedPool.address, usdcVal(33_333), [anotherAnotherUser])
      const anotherAnotherUserResponse = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(33_333), {
        from: anotherAnotherUser,
      })
      logs = decodeLogs<DepositMade>(anotherAnotherUserResponse.receipt.rawLogs, tranchedPool, "DepositMade")
      firstLog = getFirstLog(logs)
      const anotherAnotherUserTokenId = firstLog.args.tokenId

      await erc20Approve(usdc, tranchedPool.address, usdcVal(33_333), [investor])
      const investorResponse = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(33_333), {from: investor})
      logs = decodeLogs<DepositMade>(investorResponse.receipt.rawLogs, tranchedPool, "DepositMade")
      firstLog = getFirstLog(logs)
      const investorTokenId = firstLog.args.tokenId

      await tranchedPool.lockJuniorCapital({from: borrower})
      await tranchedPool.lockPool({from: borrower})
      await tranchedPool.drawdown(usdcVal(juniorTranchePrincipal), {from: borrower})
      await advanceTime({days: new BN(365).toNumber()})
      const payAmount = usdcVal(juniorTranchePrincipal)
      await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
      await tranchedPool.pay(payAmount, {from: borrower})

      const {testPoolTokenClaimableRewards} = testCalcAccRewardsPerPrincipalDollar({
        interestPaymentAmount: juniorTranchePrincipal * 0.05,
        maxInterestDollarsEligible: 1_000_000_000,
        totalRewards,
        totalGFISupply: 100_000_000,
        juniorTranchePrincipal,
        previousInterestReceived,
      })

      // investor gets 33% of the pool
      let expectedPoolTokenClaimableRewards
      expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(investorTokenId)
      console.log("expectedPoolTokenClaimableRewards", expectedPoolTokenClaimableRewards.toString())
      console.log("testPoolTokenClaimableRewards", testPoolTokenClaimableRewards.toString())
      expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(testPoolTokenClaimableRewards.div(new BN(3)))

      // anotherUser gets 34% of pool
      expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(anotherUserTokenId)
      expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(testPoolTokenClaimableRewards.div(new BN(3)))

      // anotherAnotherUser gets 33% of pool
      expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(anotherAnotherUserTokenId)
      expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(testPoolTokenClaimableRewards.div(new BN(3)))
    })

    context("When tranche is oversubscribed", () => {
      it("Handles proportionately 50%/50%", async () => {
        const maxInterestDollarsEligible = 1_000_000_000
        const totalGFISupply = 100_000_000
        const totalRewards = 3_000_000 // 3% of 100m
        const previousInterestReceived = 5000

        await setupPoolRewardsContract({
          totalGFISupply,
          maxInterestDollarsEligible,
          totalRewards,
          previousInterestReceived,
        })
        const juniorTranchePrincipal = 100_000

        let logs, firstLog
        await poolRewards.setTotalInterestReceived(usdcVal(previousInterestReceived))

        await erc20Approve(usdc, tranchedPool.address, usdcVal(100_000), [anotherUser])
        const anotherUserResponse = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(100_000), {from: anotherUser})
        logs = decodeLogs<DepositMade>(anotherUserResponse.receipt.rawLogs, tranchedPool, "DepositMade")
        firstLog = getFirstLog(logs)
        const anotherUserTokenId = firstLog.args.tokenId

        await erc20Approve(usdc, tranchedPool.address, usdcVal(100_000), [investor])
        const investorResponse = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(100_000), {from: investor})
        logs = decodeLogs<DepositMade>(investorResponse.receipt.rawLogs, tranchedPool, "DepositMade")
        firstLog = getFirstLog(logs)
        const investorTokenId = firstLog.args.tokenId

        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})
        await tranchedPool.drawdown(usdcVal(juniorTranchePrincipal), {from: borrower})
        await advanceTime({days: new BN(365).toNumber()})
        const payAmount = usdcVal(juniorTranchePrincipal)
        await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
        await tranchedPool.pay(payAmount, {from: borrower})

        const {testPoolTokenClaimableRewards} = testCalcAccRewardsPerPrincipalDollar({
          interestPaymentAmount: 5000,
          maxInterestDollarsEligible: 1_000_000_000,
          totalRewards,
          totalGFISupply: 100_000_000,
          juniorTranchePrincipal,
          previousInterestReceived,
        })

        // investor gets 50% of the pool
        // total rewards = 2,778.629048005770000000
        let expectedPoolTokenClaimableRewards
        expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(investorTokenId)
        expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(
          testPoolTokenClaimableRewards.div(new BN(2))
        )

        // anotherUser gets 50% of pool
        expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(anotherUserTokenId)
        expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(
          testPoolTokenClaimableRewards.div(new BN(2))
        )
      })
    })
  })

  describe("withdraw()", () => {
    const maxInterestDollarsEligible = 1_000_000_000
    const totalGFISupply = 100_000_000
    const totalRewards = 3_000_000 // 3% of 100m
    const previousInterestReceived = 0

    beforeEach(async () => {
      await setupPoolRewardsContract({
        totalGFISupply,
        maxInterestDollarsEligible,
        totalRewards,
        previousInterestReceived,
      })
      // transfer GFI to PoolRewards contract
      await gfi.approve(poolRewards.address, bigVal(totalRewards))
      await erc20Transfer(gfi, [poolRewards.address], bigVal(totalRewards), owner)
    })

    context("Pool is paused", () => {
      // pause the pool after payment
      it("errors Pool withdraw paused", async () => {
        const previousInterestReceived = 5000
        const juniorTranchePrincipal = 100_000

        let logs, firstLog
        await poolRewards.setTotalInterestReceived(usdcVal(previousInterestReceived))

        await erc20Approve(usdc, tranchedPool.address, usdcVal(50_000), [anotherUser])
        const anotherUserResponse = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(50_000), {from: anotherUser})
        logs = decodeLogs<DepositMade>(anotherUserResponse.receipt.rawLogs, tranchedPool, "DepositMade")
        firstLog = getFirstLog(logs)
        const anotherUserTokenId = firstLog.args.tokenId

        await erc20Approve(usdc, tranchedPool.address, usdcVal(50_000), [investor])
        const investorResponse = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(50_000), {from: investor})
        logs = decodeLogs<DepositMade>(investorResponse.receipt.rawLogs, tranchedPool, "DepositMade")
        firstLog = getFirstLog(logs)
        const investorTokenId = firstLog.args.tokenId

        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})
        await tranchedPool.drawdown(usdcVal(juniorTranchePrincipal), {from: borrower})
        await advanceTime({days: new BN(365).toNumber()})
        const payAmount = usdcVal(juniorTranchePrincipal)
        await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
        await tranchedPool.pay(payAmount, {from: borrower})
        await tranchedPool.pause()

        const {testPoolTokenClaimableRewards} = testCalcAccRewardsPerPrincipalDollar({
          interestPaymentAmount: 5000,
          maxInterestDollarsEligible: 1_000_000_000,
          totalRewards,
          totalGFISupply: 100_000_000,
          juniorTranchePrincipal,
          previousInterestReceived,
        })

        // ensure each user gets 50% of the pool
        // total rewards = 2,778.629048005770000000
        let expectedPoolTokenClaimableRewards
        expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(investorTokenId)
        expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(
          testPoolTokenClaimableRewards.div(new BN(2))
        )

        expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(anotherUserTokenId)
        expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(
          testPoolTokenClaimableRewards.div(new BN(2))
        )

        await expect(poolRewards.withdraw(investorTokenId)).to.be.rejectedWith(/Pool withdraw paused/)
      })
    })

    context("Invalid Token id", () => {
      // pass in a zero address to withdraw
      it("errors Pool withdraw paused", async () => {
        const previousInterestReceived = 5000
        const juniorTranchePrincipal = 100_000

        let logs, firstLog
        await poolRewards.setTotalInterestReceived(usdcVal(previousInterestReceived))

        await erc20Approve(usdc, tranchedPool.address, usdcVal(50_000), [anotherUser])
        const anotherUserResponse = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(50_000), {from: anotherUser})
        logs = decodeLogs<DepositMade>(anotherUserResponse.receipt.rawLogs, tranchedPool, "DepositMade")
        firstLog = getFirstLog(logs)
        const anotherUserTokenId = firstLog.args.tokenId

        await erc20Approve(usdc, tranchedPool.address, usdcVal(50_000), [investor])
        const investorResponse = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(50_000), {from: investor})
        logs = decodeLogs<DepositMade>(investorResponse.receipt.rawLogs, tranchedPool, "DepositMade")
        firstLog = getFirstLog(logs)
        const investorTokenId = firstLog.args.tokenId

        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})
        await tranchedPool.drawdown(usdcVal(juniorTranchePrincipal), {from: borrower})
        await advanceTime({days: new BN(365).toNumber()})
        const payAmount = usdcVal(juniorTranchePrincipal)
        await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
        await tranchedPool.pay(payAmount, {from: borrower})

        const {testPoolTokenClaimableRewards} = testCalcAccRewardsPerPrincipalDollar({
          interestPaymentAmount: 5000,
          maxInterestDollarsEligible: 1_000_000_000,
          totalRewards,
          totalGFISupply: 100_000_000,
          juniorTranchePrincipal,
          previousInterestReceived,
        })

        // ensure each user gets 50% of the pool
        // total rewards = 2,778.629048005770000000
        let expectedPoolTokenClaimableRewards
        expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(investorTokenId)
        expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(
          testPoolTokenClaimableRewards.div(new BN(2))
        )

        expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(anotherUserTokenId)
        expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(
          testPoolTokenClaimableRewards.div(new BN(2))
        )

        await expect(poolRewards.withdraw(ZERO_ADDRESS)).to.be.rejectedWith(/Invalid tokenId/)
      })
    })

    context("Updates rewardsClaimed", () => {
      it("successfully updates claimed amount and transfers gfi", async () => {
        const previousInterestReceived = 5000
        const juniorTranchePrincipal = 100_000
        let logs, firstLog
        await poolRewards.setTotalInterestReceived(usdcVal(previousInterestReceived))

        // AnotherUser deposits 50% of $100k
        await erc20Approve(usdc, tranchedPool.address, usdcVal(50_000), [anotherUser])
        const anotherUserResponse = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(50_000), {from: anotherUser})
        logs = decodeLogs<DepositMade>(anotherUserResponse.receipt.rawLogs, tranchedPool, "DepositMade")
        firstLog = getFirstLog(logs)
        const anotherUserTokenId = firstLog.args.tokenId

        // Investor deposits 50% of $100k
        await erc20Approve(usdc, tranchedPool.address, usdcVal(50_000), [investor])
        const investorResponse = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(50_000), {from: investor})
        logs = decodeLogs<DepositMade>(investorResponse.receipt.rawLogs, tranchedPool, "DepositMade")
        firstLog = getFirstLog(logs)
        const investorTokenId = firstLog.args.tokenId

        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})
        await tranchedPool.drawdown(usdcVal(juniorTranchePrincipal), {from: borrower})
        await advanceTime({days: new BN(365).toNumber()})
        const payAmount = usdcVal(juniorTranchePrincipal)
        await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
        await tranchedPool.pay(payAmount, {from: borrower})

        const {testPoolTokenClaimableRewards} = testCalcAccRewardsPerPrincipalDollar({
          interestPaymentAmount: 5000,
          maxInterestDollarsEligible,
          totalRewards,
          totalGFISupply,
          juniorTranchePrincipal,
          previousInterestReceived,
        })

        let expectedPoolTokenClaimableRewards

        // ensure each user gets 50% of the pool
        // total rewards = 2,778.629048005770000000
        expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(investorTokenId)
        expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(
          testPoolTokenClaimableRewards.div(new BN(2))
        )

        expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(anotherUserTokenId)
        expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(
          testPoolTokenClaimableRewards.div(new BN(2))
        )

        const contractGfiBalanceBefore = await gfi.balanceOf(investor)
        expect(contractGfiBalanceBefore).to.bignumber.equal(new BN(0))

        // Investor: claim all of the token
        await expect(poolRewards.withdraw(investorTokenId)).to.be.fulfilled
        const investorTokens = await poolRewards.tokens(investorTokenId)
        const investorRewardsClaimed = investorTokens["rewardsClaimed"]
        await expect(investorRewardsClaimed).to.bignumber.equal(testPoolTokenClaimableRewards.div(new BN(2)))
        // make sure the gfi transferred
        expect(await gfi.balanceOf(investor)).to.bignumber.equal(testPoolTokenClaimableRewards.div(new BN(2)))
        // make sure investor has no more claimable tokens
        expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(investorTokenId)
        expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(new BN("0"))

        // AnotherUser: claim all of the tokens
        await expect(poolRewards.withdraw(anotherUserTokenId)).to.be.fulfilled
        const anotherUserTokens = await poolRewards.tokens(anotherUserTokenId)
        const anotherUserRewardsClaimed = await anotherUserTokens["rewardsClaimed"]
        expect(anotherUserRewardsClaimed).to.bignumber.equal(testPoolTokenClaimableRewards.div(new BN(2)))
        expect(await gfi.balanceOf(anotherUser)).to.bignumber.equal(testPoolTokenClaimableRewards.div(new BN(2)))
        // make sure anotherUser has no more claimable tokens
        expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(anotherUserTokenId)
        expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(new BN("0"))
      })
    })

    // TODO @sanjay - need to test multiple drawdowns w/ mint price changing
    context("Principal share price at deposit time is not zero", () => {
      it("properly handles calculating the difference in share price and share price at mint", async () => {
        // AnotherUser deposits 100% of $100k
        // Lock the pool and pay back full amount
        // unlock pool, raise more capital
        // Investor deposits 50% of $100k
      })
    })
  })

  context("Changing rewards or total supply gfi", () => {
    it("changing total rewards or max interest dollars after interest has been received", async () => {
      const maxInterestDollarsEligible = 1_000_000_000
      const totalGFISupply = 100_000_000
      const totalRewards = 3_000_000 // 3% of 100m
      const previousInterestReceived = 0
      const juniorTranchePrincipal = 100_000

      await setupPoolRewardsContract({
        totalGFISupply,
        maxInterestDollarsEligible,
        totalRewards,
        previousInterestReceived,
      })
      let response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(juniorTranchePrincipal))
      let logs = decodeLogs<DepositMade>(response.receipt.rawLogs, tranchedPool, "DepositMade")
      let firstLog = getFirstLog(logs)
      let tokenId = firstLog.args.tokenId
      await tranchedPool.lockJuniorCapital({from: borrower})
      await tranchedPool.lockPool({from: borrower})
      await tranchedPool.drawdown(usdcVal(juniorTranchePrincipal), {from: borrower})
      await advanceTime({days: new BN(365).toNumber()})
      let payAmount = usdcVal(juniorTranchePrincipal)
      await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
      await tranchedPool.pay(payAmount, {from: borrower})

      const {testPoolTokenClaimableRewards, testAccRewardsPerPrincipalDollar} = testCalcAccRewardsPerPrincipalDollar({
        interestPaymentAmount: 5000,
        maxInterestDollarsEligible,
        totalGFISupply,
        totalRewards,
        juniorTranchePrincipal,
        previousInterestReceived,
      })

      // verify accRewardsPerPrincipalDollar
      let accRewardsPerPrincipalDollar = await poolRewards.pools(tranchedPool.address)
      expect(accRewardsPerPrincipalDollar).to.bignumber.equal(testAccRewardsPerPrincipalDollar)

      // verify pool token principal
      const {principalAmount: poolTokenPrincipalAmount} = await poolTokens.getTokenInfo(tokenId)
      expect(poolTokenPrincipalAmount).to.bignumber.eq(usdcVal(juniorTranchePrincipal))

      // verify claimable rewards
      let expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(tokenId)
      expect(expectedPoolTokenClaimableRewards).to.bignumber.equal(testPoolTokenClaimableRewards)

      // update the supply and rewards
      const newTotalGFISupply = 114_285_714
      const newTotalRewards = 2_285_714.28

      // mint new gfi.
      await gfi.setCap(bigVal(114_285_714), {from: owner})
      await gfi.mint(owner, bigVal(114_285_714 - 100_000_000))
      await gfi.approve(owner, bigVal(114_285_714 - 100_000_000))

      await poolRewards.setTotalRewards(bigVal(Math.round(newTotalRewards * 100)).div(new BN(100)))

      // make a new trancehed pool & interest payment
      const {tranchedPool: tranchedPoolMax} = await createPoolWithCreditLine({
        people: {owner, borrower},
        goldfinchFactory,
        juniorFeePercent: new BN(20),
        limit: usdcVal(100_000),
        interestApr: interestAprAsBN("100.00"),
        paymentPeriodInDays: new BN(30),
        termInDays: new BN(365),
        lateFeeApr: new BN(0),
        usdc,
      })
      response = await tranchedPoolMax.deposit(TRANCHES.Junior, usdcVal(juniorTranchePrincipal))
      logs = decodeLogs<DepositMade>(response.receipt.rawLogs, tranchedPoolMax, "DepositMade")
      firstLog = getFirstLog(logs)
      tokenId = firstLog.args.tokenId
      await tranchedPoolMax.lockJuniorCapital({from: borrower})
      await tranchedPoolMax.lockPool({from: borrower})
      await tranchedPoolMax.drawdown(usdcVal(juniorTranchePrincipal), {from: borrower})
      await advanceTime({days: new BN(365).toNumber()})
      payAmount = usdcVal(juniorTranchePrincipal)
      await erc20Approve(usdc, tranchedPoolMax.address, payAmount, [borrower])
      await tranchedPoolMax.pay(payAmount, {from: borrower})

      const {
        testPoolTokenClaimableRewards: newTestPoolTokenClaimableRewards,
        testAccRewardsPerPrincipalDollar: newTestAccRewardsPerPrincipalDollar,
      } = testCalcAccRewardsPerPrincipalDollar({
        interestPaymentAmount: 100_000,
        maxInterestDollarsEligible,
        totalGFISupply: newTotalGFISupply,
        totalRewards: newTotalRewards,
        juniorTranchePrincipal,
        previousInterestReceived: 5000,
      })

      // verify accRewardsPerPrincipalDollar
      accRewardsPerPrincipalDollar = await poolRewards.pools(tranchedPoolMax.address)
      expect(accRewardsPerPrincipalDollar).to.bignumber.equal(newTestAccRewardsPerPrincipalDollar)

      // verify claimable rewards
      expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(tokenId)
      expect(expectedPoolTokenClaimableRewards).to.bignumber.equal(newTestPoolTokenClaimableRewards)
    })
  })
})
