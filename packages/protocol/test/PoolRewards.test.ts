/* global web3 */
import BN from "bn.js"
import hre from "hardhat"
import {asNonNullable} from "@goldfinch-eng/utils"
import {
  ERC20Instance,
  GFIInstance,
  PoolRewardsInstance,
  SeniorPoolInstance,
  TranchedPoolInstance,
  PoolTokensInstance,
  GoldfinchFactoryInstance,
} from "../typechain/truffle"
import {TRANCHES, interestAprAsBN} from "../blockchain_scripts/deployHelpers"
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
    goldfinchFactory: GoldfinchFactoryInstance,
    gfi: GFIInstance,
    usdc: ERC20Instance,
    poolRewards: PoolRewardsInstance,
    seniorPool: SeniorPoolInstance,
    tranchedPool: TranchedPoolInstance,
    poolTokens: PoolTokensInstance

  const testSetup = deployments.createFixture(async ({deployments, getNamedAccounts}) => {
    const [_owner, _borrower, _investor, _anotherUser] = await web3.eth.getAccounts()
    const owner = asNonNullable(_owner)
    const investor = asNonNullable(_investor)
    const borrower = asNonNullable(_borrower)
    const anotherUser = asNonNullable(_anotherUser)
    const {goldfinchConfig, gfi, poolRewards, usdc, goldfinchFactory, poolTokens} = await deployAllContracts(
      deployments
    )
    await goldfinchConfig.bulkAddToGoList([owner, investor, borrower, anotherUser])

    await erc20Transfer(usdc, [anotherUser], usdcVal(100_000), owner)
    await erc20Transfer(usdc, [investor], usdcVal(100_000), owner)

    // mint GFI
    await gfi.setCap(bigVal(100_000_000), {from: owner})
    const gfiAmount = bigVal(100_000_000)
    await gfi.mint(owner, gfiAmount)
    await gfi.approve(owner, gfiAmount)

    // create two tranched pools
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
      goldfinchFactory,
      gfi,
      poolRewards,
      tranchedPool,
      seniorPool,
      usdc,
      poolTokens,
    } = await testSetup())
  })

  describe("setTotalRewards()", () => {
    it("properly sets totalRewards and totalRewardPercentOfTotalGFI", async () => {
      const totalRewards = bigVal(1_000)
      const totalGFISupply = new BN(100_000_000)
      await poolRewards.setTotalRewards(totalRewards)
      expect(await poolRewards.totalRewards()).to.bignumber.equal(totalRewards)
      expect(await poolRewards.totalRewardPercentOfTotalGFI()).to.bignumber.equal(
        totalRewards.div(totalGFISupply).mul(new BN(100))
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
    const maxInterestDollarsEligible = bigVal(1_000_000_000)
    const totalRewards = bigVal(3_000_000) // 3% of 100m

    beforeEach(async () => {
      await poolRewards.setMaxInterestDollarsEligible(maxInterestDollarsEligible)
      await poolRewards.setTotalRewards(totalRewards)
    })

    context("Invalid pool address", () => {
      const interestPaymentAmount = new BN(1_000)
      it("should error", async () => {
        await expect(poolRewards.allocateRewards(interestPaymentAmount)).to.be.rejectedWith(/Invalid pool!/)
      })
    })
  })

  describe("tranchedPool interest repayment", () => {
    const maxInterestDollarsEligible = bigVal(1_000_000_000)
    const totalRewards = bigVal(3_000_000) // 3% of 100m

    beforeEach(async () => {
      await poolRewards.setMaxInterestDollarsEligible(maxInterestDollarsEligible)
      await poolRewards.setTotalRewards(totalRewards)
    })

    // 100% repayment with all tokens distributed
    it("should handle a MAX full repayment", async () => {
      await poolRewards.setTotalInterestReceived(usdcVal(0))
      await poolRewards.setMaxInterestDollarsEligible(100_000)
      const limit = usdcVal(100_000)
      const interestApr = interestAprAsBN("100.00")
      const paymentPeriodInDays = new BN(30)
      const termInDays = new BN(365)
      const lateFeeApr = new BN(0)
      const juniorFeePercent = new BN(20)
      const {tranchedPool: tranchedPoolMax} = await createPoolWithCreditLine({
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
      const response = await tranchedPoolMax.deposit(TRANCHES.Junior, usdcVal(100_000))
      const logs = decodeLogs<DepositMade>(response.receipt.rawLogs, tranchedPoolMax, "DepositMade")
      const firstLog = getFirstLog(logs)
      const tokenId = firstLog.args.tokenId
      await tranchedPoolMax.lockJuniorCapital({from: borrower})
      await tranchedPoolMax.lockPool({from: borrower})
      await tranchedPoolMax.drawdown(usdcVal(100_000), {from: borrower})
      await advanceTime({days: new BN(365).toNumber()})
      const payAmount = usdcVal(100_000)
      await erc20Approve(usdc, tranchedPoolMax.address, payAmount, [borrower])
      await tranchedPoolMax.pay(payAmount, {from: borrower})

      const expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(tokenId)
      expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(new BN("3000000000000000000000000"))
    })

    // set a pool to $1 below it's max interest dollar limit
    // have a $5000 interest payment come in
    // expect only the last $1 of gfi rewards earned
    it("should handle interest payments that exceed maxInterestDollarsEligible", async () => {
      await poolRewards.setTotalInterestReceived(fiduToUSDC(maxInterestDollarsEligible).sub(usdcVal(1)))
      const response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(100_000))
      const logs = decodeLogs<DepositMade>(response.receipt.rawLogs, tranchedPool, "DepositMade")
      const firstLog = getFirstLog(logs)
      const tokenId = firstLog.args.tokenId
      await tranchedPool.lockJuniorCapital({from: borrower})
      await tranchedPool.lockPool({from: borrower})
      await tranchedPool.drawdown(usdcVal(100_000), {from: borrower})
      await advanceTime({days: new BN(365).toNumber()})
      const payAmount = usdcVal(100_000)
      await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
      await tranchedPool.pay(payAmount, {from: borrower})

      const expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(tokenId)
      expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(new BN("1499963100000000")) // spreadsheet is 1500000374875240
    })

    // Create a pool with $100,000
    // $5,000 interest payment comes in, $4500 to jr pool
    // previous protocol total interest received is 0
    it("should calculate accRewardsPerPrincipalShare for first ever interest deposit", async () => {
      const juniorTranchePrincipal = 100_000
      const previousInterestReceived = 0
      await poolRewards.setTotalInterestReceived(usdcVal(previousInterestReceived))
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

      // verify the redeemable interest of jr pool
      const juniorTrancheInterestAmount = usdcVal("4500")
      const availableToWithdraw = await tranchedPool.availableToWithdraw(tokenId)
      expect(juniorTrancheInterestAmount).to.bignumber.equal(availableToWithdraw[0])

      // javascript recalculate the new gross rewards & accRewardsPerPrincipalShare
      const interestPaymentAmount = 5000
      const maxInterestDollarsEligible = 1_000_000_000
      const percent = 3
      const totalGFISupply = 100_000_000
      const a = new BN(Math.sqrt(previousInterestReceived + interestPaymentAmount * 10 ** 18))
      const b = new BN(percent).mul(decimals)
      const c = new BN(Math.sqrt(maxInterestDollarsEligible * 10 ** 18))
      const testNewGrossRewards = a.mul(b).div(c).div(new BN(100)).mul(new BN(totalGFISupply))

      const testaccRewardsPerPrincipalShare = testNewGrossRewards
        .mul(decimals)
        .div(new BN(juniorTranchePrincipal).mul(decimals))
      const accRewardsPerPrincipalShare = await poolRewards.pools(tranchedPool.address)
      expect(accRewardsPerPrincipalShare).to.bignumber.equal(testaccRewardsPerPrincipalShare)

      // verify pool token principal
      const {principalAmount: poolTokenPrincipalAmount} = await poolTokens.getTokenInfo(tokenId)
      expect(poolTokenPrincipalAmount).to.bignumber.eq(usdcVal(100_000))

      // make sure pool token has correct amount of claimable rewards
      const testPoolTokenClaimableRewards = new BN(juniorTranchePrincipal)
        .mul(decimals)
        .mul(testaccRewardsPerPrincipalShare)
        .div(decimals)
      const expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(tokenId)
      expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(testPoolTokenClaimableRewards)
    })

    // Create a pool with $100,000
    // $5,000 interest payment comes in
    // previous protocol total interest received is already $5000
    it("second 5k payment", async () => {
      await poolRewards.setTotalInterestReceived(usdcVal(5000))
      const response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(100_000))
      const logs = decodeLogs<DepositMade>(response.receipt.rawLogs, tranchedPool, "DepositMade")
      const firstLog = getFirstLog(logs)
      const tokenId = firstLog.args.tokenId
      await tranchedPool.lockJuniorCapital({from: borrower})
      await tranchedPool.lockPool({from: borrower})
      await tranchedPool.drawdown(usdcVal(100_000), {from: borrower})
      await advanceTime({days: new BN(365).toNumber()})
      const payAmount = usdcVal(100_000)
      await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
      await tranchedPool.pay(payAmount, {from: borrower})

      const expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(tokenId)
      expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(new BN("2778629048067900000000")) // spreadsheet 2,778.629048005770000000
    })

    it("should increment totalInterestReceived", async () => {
      expect(await poolRewards.totalInterestReceived()).to.bignumber.equal(new BN(0))
      await poolRewards.setTotalInterestReceived(fiduToUSDC(maxInterestDollarsEligible).sub(usdcVal(1)))
      expect(await poolRewards.totalInterestReceived()).to.bignumber.equal(
        fiduToUSDC(maxInterestDollarsEligible).sub(usdcVal(1))
      )
      await tranchedPool.deposit(TRANCHES.Junior, usdcVal(100_000))
      await tranchedPool.lockJuniorCapital({from: borrower})
      await tranchedPool.lockPool({from: borrower})
      await tranchedPool.drawdown(usdcVal(20), {from: borrower})
      await advanceTime({days: new BN(365).toNumber()})
      const payAmount = usdcVal(20)
      await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
      await expect(tranchedPool.pay(payAmount, {from: borrower})).to.be.fulfilled
      expect(await poolRewards.totalInterestReceived()).to.bignumber.equal(fiduToUSDC(maxInterestDollarsEligible))
    })

    context("All rewards exhausted", () => {
      it("should succeed when maxInterestDollarsEligible-1", async () => {
        await poolRewards.setTotalInterestReceived(fiduToUSDC(maxInterestDollarsEligible).sub(usdcVal(1)))
        await tranchedPool.deposit(TRANCHES.Junior, usdcVal(100_000))
        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})
        await tranchedPool.drawdown(usdcVal(20), {from: borrower})
        await advanceTime({days: new BN(365).toNumber()})
        const payAmount = usdcVal(20)
        await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
        await expect(tranchedPool.pay(payAmount, {from: borrower})).to.be.fulfilled
      })

      // borrow $20 for a $1 payback to push total interest received over threshold
      it("should error when totalInterestReceived is >= maxInterestDollarsEligible", async () => {
        await poolRewards.setTotalInterestReceived(fiduToUSDC(maxInterestDollarsEligible))
        await tranchedPool.deposit(TRANCHES.Junior, usdcVal(100_000))
        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})
        await tranchedPool.drawdown(usdcVal(20), {from: borrower})
        await advanceTime({days: new BN(365).toNumber()})
        const payAmount = usdcVal(20)
        await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
        await expect(tranchedPool.pay(payAmount, {from: borrower})).to.be.rejectedWith(/All rewards exhausted/)
      })
    })
  })

  describe("poolTokenClaimableRewards()", () => {
    const maxInterestDollarsEligible = bigVal(1_000_000_000)
    const totalRewards = bigVal(3_000_000) // 3% of 100m

    beforeEach(async () => {
      await poolRewards.setMaxInterestDollarsEligible(maxInterestDollarsEligible)
      await poolRewards.setTotalRewards(totalRewards)
    })
    it("Distributes 50%/50% rewards", async () => {
      let logs, firstLog
      await poolRewards.setTotalInterestReceived(usdcVal(5000))

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
      await tranchedPool.drawdown(usdcVal(100_000), {from: borrower})
      await advanceTime({days: new BN(365).toNumber()})
      const payAmount = usdcVal(100_000)
      await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
      await tranchedPool.pay(payAmount, {from: borrower})

      // ensure each user gets 50% of the pool
      // total rewards = 2,778.629048005770000000
      let expectedPoolTokenClaimableRewards
      expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(investorTokenId)
      expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(new BN("1389314524033950000000"))

      expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(anotherUserTokenId)
      expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(new BN("1389314524033950000000"))
    })

    it("Distributes 75%/25% rewards", async () => {
      let logs, firstLog
      await poolRewards.setTotalInterestReceived(usdcVal(5000))

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
      await tranchedPool.drawdown(usdcVal(100_000), {from: borrower})
      await advanceTime({days: new BN(365).toNumber()})
      const payAmount = usdcVal(100_000)
      await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
      await tranchedPool.pay(payAmount, {from: borrower})

      // ensure each user gets 75% of the pool
      // total rewards = 2,778.629048005770000000
      let expectedPoolTokenClaimableRewards
      expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(investorTokenId)
      expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(new BN("694657262016975000000"))

      // user gets 25% of pool
      expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(anotherUserTokenId)
      expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(new BN("2083971786050925000000"))
    })
  })

  describe("withdraw", () => {
    const maxInterestDollarsEligible = bigVal(1_000_000_000)
    const totalRewards = bigVal(3_000_000) // 3% of 100m

    beforeEach(async () => {
      await poolRewards.setMaxInterestDollarsEligible(maxInterestDollarsEligible)
      await poolRewards.setTotalRewards(totalRewards)
      // transfer GFI to PoolRewards contract
      await gfi.approve(poolRewards.address, totalRewards)
      await erc20Transfer(gfi, [poolRewards.address], totalRewards, owner)
    })

    context("Pool is paused", () => {
      // pause the pool after payment
      it("errors Pool withdraw paused", async () => {
        let logs, firstLog
        await poolRewards.setTotalInterestReceived(usdcVal(5000))

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
        await tranchedPool.drawdown(usdcVal(100_000), {from: borrower})
        await advanceTime({days: new BN(365).toNumber()})
        const payAmount = usdcVal(100_000)
        await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
        await tranchedPool.pay(payAmount, {from: borrower})

        await tranchedPool.pause()

        // ensure each user gets 50% of the pool
        // total rewards = 2,778.629048005770000000
        let expectedPoolTokenClaimableRewards
        expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(investorTokenId)
        expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(new BN("1389314524033950000000"))

        expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(anotherUserTokenId)
        expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(new BN("1389314524033950000000"))

        await expect(poolRewards.withdraw(investorTokenId, expectedPoolTokenClaimableRewards)).to.be.rejectedWith(
          /Pool withdraw paused/
        )
      })
    })

    context("Invalid Token id", () => {
      // pass in a zero address to withdraw
      it("errors Pool withdraw paused", async () => {
        let logs, firstLog
        await poolRewards.setTotalInterestReceived(usdcVal(5000))

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
        await tranchedPool.drawdown(usdcVal(100_000), {from: borrower})
        await advanceTime({days: new BN(365).toNumber()})
        const payAmount = usdcVal(100_000)
        await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
        await tranchedPool.pay(payAmount, {from: borrower})

        // ensure each user gets 50% of the pool
        // total rewards = 2,778.629048005770000000
        let expectedPoolTokenClaimableRewards
        expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(investorTokenId)
        expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(new BN("1389314524033950000000"))

        expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(anotherUserTokenId)
        expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(new BN("1389314524033950000000"))

        await expect(poolRewards.withdraw(ZERO_ADDRESS, expectedPoolTokenClaimableRewards)).to.be.rejectedWith(
          /Invalid tokenId/
        )
      })
    })

    context("Overdraw", () => {
      // try to withdraw too much
      it("errors Pool withdraw paused", async () => {
        let logs, firstLog
        await poolRewards.setTotalInterestReceived(usdcVal(5000))

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
        await tranchedPool.drawdown(usdcVal(100_000), {from: borrower})
        await advanceTime({days: new BN(365).toNumber()})
        const payAmount = usdcVal(100_000)
        await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
        await tranchedPool.pay(payAmount, {from: borrower})

        // ensure each user gets 50% of the pool
        // total rewards = 2,778.629048005770000000
        let expectedPoolTokenClaimableRewards
        expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(investorTokenId)
        expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(new BN("1389314524033950000000"))

        expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(anotherUserTokenId)
        expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(new BN("1389314524033950000000"))

        await expect(poolRewards.withdraw(investorTokenId, new BN("1389314524033950000001"))).to.be.rejectedWith(
          /Rewards overwithdraw attempt/
        )

        await expect(poolRewards.withdraw(anotherUserTokenId, new BN("1389314524033950000001"))).to.be.rejectedWith(
          /Rewards overwithdraw attempt/
        )
      })
    })

    context("Updates rewardsClaimed", () => {
      it("successfully updates claimed amount and transfers gfi", async () => {
        let logs, firstLog
        await poolRewards.setTotalInterestReceived(usdcVal(5000))

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
        await tranchedPool.drawdown(usdcVal(100_000), {from: borrower})
        await advanceTime({days: new BN(365).toNumber()})
        const payAmount = usdcVal(100_000)
        await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
        await tranchedPool.pay(payAmount, {from: borrower})

        let expectedPoolTokenClaimableRewards

        // ensure each user gets 50% of the pool
        // total rewards = 2,778.629048005770000000
        expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(investorTokenId)
        expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(new BN("1389314524033950000000"))

        expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(anotherUserTokenId)
        expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(new BN("1389314524033950000000"))

        const contractGfiBalanceBefore = await gfi.balanceOf(investor)
        expect(contractGfiBalanceBefore).to.bignumber.equal(new BN(0))

        // Investor: claim all of the token
        await expect(poolRewards.withdraw(investorTokenId, new BN("1389314524033950000000"))).to.be.fulfilled
        const investorTokens = await poolRewards.tokens(investorTokenId)
        const investorRewardsClaimed = investorTokens["rewardsClaimed"]
        await expect(investorRewardsClaimed).to.bignumber.equal(new BN("1389314524033950000000"))

        // make sure the gfi transferred
        await expect(await gfi.balanceOf(investor)).to.bignumber.equal(new BN("1389314524033950000000"))

        // AnotherUser: claim just a few tokens
        await expect(poolRewards.withdraw(anotherUserTokenId, new BN("0389314524033950000000"))).to.be.fulfilled
        const anotherUserTokens = await poolRewards.tokens(anotherUserTokenId)
        const anotherUserRewardsClaimed = anotherUserTokens["rewardsClaimed"]
        await expect(anotherUserRewardsClaimed).to.bignumber.equal(new BN("0389314524033950000000"))
        await expect(await gfi.balanceOf(anotherUser)).to.bignumber.equal(new BN("0389314524033950000000"))

        // make sure anotherUser then has the remaining difference claimable
        expectedPoolTokenClaimableRewards = await poolRewards.poolTokenClaimableRewards(anotherUserTokenId)
        expect(new BN(expectedPoolTokenClaimableRewards)).to.bignumber.equal(new BN("1000000000000000000000"))
      })
    })
  })
})
