/* global web3 */
import {
  expect,
  usdcVal,
  expectAction,
  deployAllContracts,
  advanceTime,
  erc20Approve,
  erc20Transfer,
  getBalance,
  tolerance,
  createPoolWithCreditLine as _createPoolWithCreditLine,
  SECONDS_PER_DAY,
  UNIT_SHARE_PRICE,
  ZERO,
  decodeLogs,
  getFirstLog,
} from "./testHelpers"
import {interestAprAsBN, TRANCHES, MAX_UINT, OWNER_ROLE, PAUSER_ROLE} from "../blockchain_scripts/deployHelpers"
import {expectEvent, time} from "@openzeppelin/test-helpers"
import hre from "hardhat"
import BN from "bn.js"
const {deployments, artifacts} = hre
import {ecsign} from "ethereumjs-util"
const CreditLine = artifacts.require("CreditLine")
import {getApprovalDigest, getWallet} from "./permitHelpers"
import {CreditLineInstance, TranchedPoolInstance, PoolRewardsInstance} from "../typechain/truffle"
import {JuniorTrancheLocked, DepositMade} from "../typechain/truffle/TranchedPool"
import {CONFIG_KEYS} from "../blockchain_scripts/configKeys"
import {assertNonNullable} from "@goldfinch-eng/utils"

const RESERVE_FUNDS_COLLECTED_EVENT = "ReserveFundsCollected"
const PAYMENT_APPLIED_EVENT = "PaymentApplied"
const EXPECTED_JUNIOR_CAPITAL_LOCKED_EVENT_ARGS = ["0", "1", "__length__", "lockedUntil", "pool"]

const expectPaymentRelatedEventsEmitted = (
  receipt: unknown,
  borrowerAddress: unknown,
  tranchedPool: TranchedPoolInstance,
  amounts: {
    interest: BN
    principal: BN
    remaining: BN
    reserve: BN
  }
) => {
  expectEvent(receipt, RESERVE_FUNDS_COLLECTED_EVENT, {
    from: tranchedPool.address,
    amount: amounts.reserve,
  })
  expectEvent(receipt, PAYMENT_APPLIED_EVENT, {
    payer: borrowerAddress,
    pool: tranchedPool.address,
    interestAmount: amounts.interest,
    principalAmount: amounts.principal,
    remainingAmount: amounts.remaining,
    reserveAmount: amounts.reserve,
  })
}
const expectPaymentRelatedEventsNotEmitted = (receipt: unknown) => {
  expectEvent.notEmitted(receipt, RESERVE_FUNDS_COLLECTED_EVENT)
  expectEvent.notEmitted(receipt, PAYMENT_APPLIED_EVENT)
}

describe.only("TranchedPool", () => {
  let owner,
    borrower,
    otherPerson,
    goldfinchConfig,
    usdc,
    poolTokens,
    goldfinchFactory,
    creditLine,
    treasury,
    poolRewards: PoolRewardsInstance,
    tranchedPool: TranchedPoolInstance
  const limit = usdcVal(1000)
  let interestApr = interestAprAsBN("5.00")
  const paymentPeriodInDays = new BN(30)
  let termInDays = new BN(365)
  const lateFeeApr = new BN(0)
  const juniorFeePercent = new BN(20)

  const createPoolWithCreditLine = async ({interestApr = interestAprAsBN("5.00"), termInDays = new BN(365)}) => {
    return await _createPoolWithCreditLine({
      people: {owner, borrower},
      goldfinchFactory,
      limit,
      interestApr,
      paymentPeriodInDays,
      termInDays,
      lateFeeApr,
      juniorFeePercent,
      usdc,
    })
  }

  const testSetup = deployments.createFixture(async ({deployments}) => {
    // Just to be crystal clear
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({usdc, goldfinchConfig, goldfinchFactory, poolTokens, poolRewards} = await deployAllContracts(deployments))
    await goldfinchConfig.bulkAddToGoList([owner, borrower, otherPerson])
    await goldfinchConfig.setTreasuryReserve(treasury)
    await erc20Transfer(usdc, [otherPerson], usdcVal(10000), owner)
    await erc20Transfer(usdc, [borrower], usdcVal(10000), owner)
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({tranchedPool, creditLine} = await createPoolWithCreditLine({}))
  })

  const getTrancheAmounts = async (trancheInfo) => {
    const interestAmount = await tranchedPool.sharePriceToUsdc(
      trancheInfo.interestSharePrice,
      trancheInfo.principalDeposited
    )
    const principalAmount = await tranchedPool.sharePriceToUsdc(
      trancheInfo.principalSharePrice,
      trancheInfo.principalDeposited
    )
    return [interestAmount, principalAmount]
  }

  beforeEach(async () => {
    // Pull in our unlocked accounts
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;[owner, borrower, treasury, otherPerson] = await web3.eth.getAccounts()
    await testSetup()
  })

  describe("initialization", async () => {
    it("sets the right defaults", async () => {
      const juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
      const seniorTranche = await tranchedPool.getTranche(TRANCHES.Senior)
      expect(juniorTranche.principalSharePrice).to.bignumber.eq(UNIT_SHARE_PRICE)
      expect(juniorTranche.interestSharePrice).to.bignumber.eq("0")
      expect(juniorTranche.principalDeposited).to.bignumber.eq("0")
      expect(juniorTranche.lockedUntil).to.bignumber.eq("0")

      expect(seniorTranche.principalSharePrice).to.bignumber.eq(UNIT_SHARE_PRICE)
      expect(seniorTranche.interestSharePrice).to.bignumber.eq("0")
      expect(seniorTranche.principalDeposited).to.bignumber.eq("0")
      expect(seniorTranche.lockedUntil).to.bignumber.eq("0")

      expect(await tranchedPool.creditLine()).to.eq(creditLine.address)
    })
  })

  describe("migrateCreditLine", async () => {
    it("should create a new creditline", async () => {
      const creditLine = await CreditLine.at(await tranchedPool.creditLine())
      await expectAction(async () =>
        tranchedPool.migrateCreditLine(
          await creditLine.borrower(),
          await creditLine.limit(),
          await creditLine.interestApr(),
          await creditLine.paymentPeriodInDays(),
          await creditLine.termInDays(),
          await creditLine.lateFeeApr()
        )
      ).toChange([[tranchedPool.creditLine, {beDifferent: true}]])
    })

    it("should allow governance, but not the borrower to migrate", async () => {
      const creditLine = await CreditLine.at(await tranchedPool.creditLine())
      await expect(
        tranchedPool.migrateCreditLine(
          await creditLine.borrower(),
          await creditLine.limit(),
          await creditLine.interestApr(),
          await creditLine.paymentPeriodInDays(),
          await creditLine.termInDays(),
          await creditLine.lateFeeApr(),
          {from: owner}
        )
      ).to.be.fulfilled

      await expect(
        tranchedPool.migrateCreditLine(
          await creditLine.borrower(),
          await creditLine.limit(),
          await creditLine.interestApr(),
          await creditLine.paymentPeriodInDays(),
          await creditLine.termInDays(),
          await creditLine.lateFeeApr(),
          {from: borrower}
        )
      ).to.be.rejectedWith(/Must have admin role/)
    })

    it("should set new values you send it", async () => {
      const maxLimit = usdcVal(1234)
      const borrower = otherPerson
      const interestApr = interestAprAsBN("12.3456")
      const paymentPeriodInDays = new BN(123)
      const termInDays = new BN(321)
      const lateFeeApr = interestAprAsBN("0.9783")

      await expectAction(async () =>
        tranchedPool.migrateCreditLine(borrower, maxLimit, interestApr, paymentPeriodInDays, termInDays, lateFeeApr)
      ).toChange([
        [tranchedPool.maxLimit, {to: maxLimit}],
        [tranchedPool.borrower, {to: borrower, bignumber: false}],
        [tranchedPool.interestApr, {to: interestApr}],
        [tranchedPool.paymentPeriodInDays, {to: paymentPeriodInDays}],
        [tranchedPool.termInDays, {to: termInDays}],
        [tranchedPool.lateFeeApr, {to: lateFeeApr}],
      ])
    })

    it("should copy over the accounting vars", async () => {
      const originalCl = await CreditLine.at(await tranchedPool.creditLine())
      const amount = usdcVal(15)
      await usdc.transfer(originalCl.address, amount, {from: otherPerson})
      const originalBalance = await originalCl.balance()

      // Drawdown so that the credit line has a balance
      await tranchedPool.deposit(TRANCHES.Junior, usdcVal(1000))
      await tranchedPool.lockJuniorCapital({from: borrower})
      await tranchedPool.drawdown(usdcVal(1000), {from: borrower})

      tranchedPool.migrateCreditLine(borrower, limit, interestApr, paymentPeriodInDays, termInDays, lateFeeApr)
      const newCl = await CreditLine.at(await tranchedPool.creditLine())

      expect(originalBalance).to.bignumber.eq(await newCl.balance())
      expect(await originalCl.termEndTime()).to.bignumber.eq(await newCl.termEndTime())
      expect(await originalCl.nextDueTime()).to.bignumber.eq(await newCl.nextDueTime())
    })

    it("should send any funds to the new creditline, and close out the old", async () => {
      const creditLine = await CreditLine.at(await tranchedPool.creditLine())
      const amount = usdcVal(15)
      await usdc.transfer(creditLine.address, amount, {from: otherPerson})

      // Drawdown so that the credit line has a balance
      await tranchedPool.deposit(TRANCHES.Junior, usdcVal(1000))
      await tranchedPool.lockJuniorCapital({from: borrower})
      await tranchedPool.drawdown(usdcVal(1000), {from: borrower})

      await expectAction(async () =>
        tranchedPool.migrateCreditLine(borrower, limit, interestApr, paymentPeriodInDays, termInDays, lateFeeApr)
      ).toChange([
        [creditLine.balance, {to: new BN(0)}],
        [creditLine.limit, {to: new BN(0)}],
        [() => getBalance(creditLine.address, usdc), {to: new BN(0)}],
      ])
      // New creditline should have the usdc
      expect(await getBalance(await tranchedPool.creditLine(), usdc)).to.bignumber.eq(amount)
    })

    it("should reassign the LOCKER_ROLE to the new borrower", async () => {
      const newBorrower = otherPerson
      await tranchedPool.migrateCreditLine(newBorrower, limit, interestApr, paymentPeriodInDays, termInDays, lateFeeApr)
      const lockerRole = await tranchedPool.LOCKER_ROLE()

      expect(await tranchedPool.hasRole(lockerRole, newBorrower)).to.be.true
      expect(await tranchedPool.hasRole(lockerRole, borrower)).to.be.false
    })
  })

  describe("emergency shutdown", async () => {
    it("should pause the pool and sweep funds", async () => {
      const amount = usdcVal(10)
      await usdc.transfer(tranchedPool.address, amount, {from: owner})
      await usdc.transfer(creditLine.address, amount, {from: owner})
      await expectAction(tranchedPool.emergencyShutdown).toChange([
        [tranchedPool.paused, {to: true, bignumber: false}],
        [() => getBalance(tranchedPool.address, usdc), {to: ZERO}],
        [() => getBalance(creditLine.address, usdc), {to: ZERO}],
        [() => getBalance(treasury, usdc), {by: amount.mul(new BN(2))}],
      ])
    })
    it("should emit an event", async () => {
      const txn = await tranchedPool.emergencyShutdown()
      expectEvent(txn, "EmergencyShutdown", {pool: tranchedPool.address})
    })

    it("can only be called by governance", async () => {
      await expect(tranchedPool.emergencyShutdown({from: otherPerson})).to.be.rejectedWith(/Must have admin role/)
    })
  })

  describe("setLimit", async () => {
    const newLimit = new BN(500)
    beforeEach(async () => {
      await createPoolWithCreditLine({})
    })
    it("can only be called by governance", async () => {
      await expect(tranchedPool.setLimit(newLimit, {from: otherPerson})).to.be.rejectedWith(/Must have admin role/)
    })
    it("should update the TranchedPool limit", async () => {
      await expectAction(() => tranchedPool.setLimit(newLimit)).toChange([[tranchedPool.limit, {to: newLimit}]])
    })
  })

  describe("migrateAndSetNewCreditLine", async () => {
    let otherCreditLine: string
    beforeEach(async () => {
      const {creditLine} = await createPoolWithCreditLine({})
      otherCreditLine = creditLine.address
    })
    it("should set the new creditline", async () => {
      await expectAction(() => tranchedPool.migrateAndSetNewCreditLine(otherCreditLine)).toChange([
        [tranchedPool.creditLine, {to: otherCreditLine, bignumber: false}],
      ])
    })
    it("can only be called by governance", async () => {
      await expect(tranchedPool.migrateAndSetNewCreditLine(otherCreditLine, {from: borrower})).to.be.rejectedWith(
        /Must have admin role/
      )
    })
    it("should close out the old creditline", async () => {
      const creditLine = await CreditLine.at(await tranchedPool.creditLine())
      await tranchedPool.migrateAndSetNewCreditLine(otherCreditLine)
      expect(await creditLine.balance()).to.bignumber.eq(new BN(0))
    })
  })

  describe("deposit", async () => {
    describe("junior tranche", async () => {
      it("does not allow deposits when pool is locked", async () => {
        await tranchedPool.lockJuniorCapital({from: borrower})
        await expect(tranchedPool.deposit(TRANCHES.Junior, usdcVal(10))).to.be.rejectedWith(/Tranche has been locked/)
      })

      it("does not allow 0 value deposits", async () => {
        await expect(tranchedPool.deposit(TRANCHES.Junior, usdcVal(0))).to.be.rejectedWith(
          /Must deposit more than zero/
        )
      })

      it("fails for invalid tranches", async () => {
        await expect(tranchedPool.deposit(0, usdcVal(10))).to.be.rejectedWith(/Unsupported tranche/)
      })

      it("updates the tranche info and mints the token", async () => {
        expect(await poolTokens.balanceOf(owner)).to.bignumber.eq("0")

        const response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(10))
        const logs = decodeLogs<DepositMade>(response.receipt.rawLogs, tranchedPool, "DepositMade")
        const firstLog = getFirstLog(logs)
        const tokenId = firstLog.args.tokenId
        const juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
        const seniorTranche = await tranchedPool.getTranche(TRANCHES.Senior)

        expect(juniorTranche.principalDeposited).to.bignumber.eq(usdcVal(10))
        expect(seniorTranche.principalDeposited).to.bignumber.eq("0")

        expect(await poolTokens.balanceOf(owner)).to.bignumber.eq("1")
        expect(await usdc.balanceOf(tranchedPool.address)).to.bignumber.eq(usdcVal(10))

        const tokenInfo = await poolTokens.getTokenInfo(tokenId)
        expect(tokenInfo.principalAmount).to.bignumber.eq(usdcVal(10))
        expect(tokenInfo.tranche).to.bignumber.eq("2")
        expect(tokenInfo.principalRedeemed).to.bignumber.eq("0")
        expect(tokenInfo.interestRedeemed).to.bignumber.eq("0")
      })

      describe("multiple deposits", async () => {
        it("Keeps track of them correctly", async () => {
          await tranchedPool.deposit(TRANCHES.Junior, usdcVal(10))
          await tranchedPool.deposit(TRANCHES.Junior, usdcVal(5))
          const juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
          const seniorTranche = await tranchedPool.getTranche(TRANCHES.Senior)

          expect(juniorTranche.principalDeposited).to.bignumber.eq(usdcVal(15))
          expect(seniorTranche.principalDeposited).to.bignumber.eq("0")
          // TODO: Eventually should just be a single NFT
          expect(await poolTokens.balanceOf(owner)).to.bignumber.eq("2")
          expect(await usdc.balanceOf(tranchedPool.address)).to.bignumber.eq(usdcVal(15))
        })
      })
    })

    describe("senior tranche", async () => {
      context("when locking the pool", () => {
        it("emits junior and senior locking events", async () => {
          const startingTimeInSeconds = new BN(1e10)
          const drawdownTimePeriod = await goldfinchConfig.getNumber(CONFIG_KEYS.DrawdownPeriodInSeconds)
          const expectedLockedUntil = startingTimeInSeconds.add(drawdownTimePeriod)
          await tranchedPool.lockJuniorCapital({from: owner}) // needs to be locked before we can lock the pool

          // because we're making an assertion based on a time calculation, we
          // need to advance the blockchain to a known point in time
          await advanceTime({toSecond: startingTimeInSeconds})
          const tx = await tranchedPool.lockPool({from: owner})
          expectEvent(tx, "JuniorTrancheLocked", {
            pool: tranchedPool.address,
            lockedUntil: expectedLockedUntil,
          })
          expectEvent(tx, "SeniorTrancheLocked", {
            pool: tranchedPool.address,
            lockedUntil: expectedLockedUntil,
          })
        })
      })

      it("does not allow deposits when pool is locked", async () => {
        await tranchedPool.deposit(TRANCHES.Junior, usdcVal(10))
        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})
        await expect(tranchedPool.deposit(TRANCHES.Senior, usdcVal(10))).to.be.rejectedWith(/Tranche has been locked/)
      })

      it("fails for invalid tranches", async () => {
        await expect(tranchedPool.deposit(3, usdcVal(10))).to.be.rejectedWith(/Unsupported tranche/)
      })

      it("does not allow 0 value deposits", async () => {
        await expect(tranchedPool.deposit(TRANCHES.Senior, usdcVal(0))).to.be.rejectedWith(
          /Must deposit more than zero/
        )
      })

      it("updates the tranche info and mints the token", async () => {
        expect(await poolTokens.balanceOf(owner)).to.bignumber.eq("0")

        const response = await tranchedPool.deposit(TRANCHES.Senior, usdcVal(10))
        const logs = decodeLogs<DepositMade>(response.receipt.rawLogs, tranchedPool, "DepositMade")
        const firstLog = getFirstLog(logs)
        const tokenId = firstLog.args.tokenId
        const juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
        const seniorTranche = await tranchedPool.getTranche(TRANCHES.Senior)

        expect(juniorTranche.principalDeposited).to.bignumber.eq("0")
        expect(seniorTranche.principalDeposited).to.bignumber.eq(usdcVal(10))

        expect(await poolTokens.balanceOf(owner)).to.bignumber.eq("1")
        expect(await usdc.balanceOf(tranchedPool.address)).to.bignumber.eq(usdcVal(10))

        const tokenInfo = await poolTokens.getTokenInfo(tokenId)
        expect(tokenInfo.principalAmount).to.bignumber.eq(usdcVal(10))
        expect(tokenInfo.tranche).to.bignumber.eq("1")
        expect(tokenInfo.principalRedeemed).to.bignumber.eq("0")
        expect(tokenInfo.interestRedeemed).to.bignumber.eq("0")
      })

      describe("multiple deposits", async () => {
        it("Keeps track of them correctly", async () => {
          await tranchedPool.deposit(TRANCHES.Senior, usdcVal(10))
          await tranchedPool.deposit(TRANCHES.Senior, usdcVal(5))
          const juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
          const seniorTranche = await tranchedPool.getTranche(TRANCHES.Senior)

          expect(juniorTranche.principalDeposited).to.bignumber.eq("0")
          expect(seniorTranche.principalDeposited).to.bignumber.eq(usdcVal(15))
          // TODO: Eventually should just be a single NFT
          expect(await poolTokens.balanceOf(owner)).to.bignumber.eq("2")
          expect(await usdc.balanceOf(tranchedPool.address)).to.bignumber.eq(usdcVal(15))
        })
      })
    })
  })

  describe("depositWithPermit", async () => {
    it("deposits using permit", async () => {
      const otherPersonAddress = otherPerson.toLowerCase()
      const tranchedPoolAddress = tranchedPool.address.toLowerCase()
      const nonce = await usdc.nonces(otherPersonAddress)
      const deadline = MAX_UINT
      const value = usdcVal(100)

      // Create signature for permit
      const digest = await getApprovalDigest({
        token: usdc,
        owner: otherPersonAddress,
        spender: tranchedPoolAddress,
        value,
        nonce,
        deadline,
      })
      const wallet = await getWallet(otherPersonAddress)
      assertNonNullable(wallet)
      const {v, r, s} = ecsign(Buffer.from(digest.slice(2), "hex"), Buffer.from(wallet.privateKey.slice(2), "hex"))

      const receipt = await (tranchedPool as any).depositWithPermit(TRANCHES.Junior, value, deadline, v, r, s, {
        from: otherPersonAddress,
      })

      // Verify deposit was correct
      const logs = decodeLogs<DepositMade>(receipt.receipt.rawLogs, tranchedPool, "DepositMade")
      const firstLog = getFirstLog(logs)
      const tokenId = firstLog.args.tokenId
      const juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
      const seniorTranche = await tranchedPool.getTranche(TRANCHES.Senior)

      expect(juniorTranche.principalDeposited).to.bignumber.eq(usdcVal(100))
      expect(seniorTranche.principalDeposited).to.bignumber.eq("0")

      expect(await poolTokens.balanceOf(otherPersonAddress)).to.bignumber.eq("1")
      expect(await usdc.balanceOf(tranchedPool.address)).to.bignumber.eq(usdcVal(100))

      const tokenInfo = await poolTokens.getTokenInfo(tokenId)
      expect(tokenInfo.principalAmount).to.bignumber.eq(usdcVal(100))
      expect(tokenInfo.tranche).to.bignumber.eq(TRANCHES.Junior.toString())
      expect(tokenInfo.principalRedeemed).to.bignumber.eq("0")
      expect(tokenInfo.interestRedeemed).to.bignumber.eq("0")

      // Verify that permit creates allowance for amount only
      expect(await usdc.allowance(otherPersonAddress, tranchedPoolAddress)).to.bignumber.eq("0")
    })
  })

  describe("availableToWithdraw", async () => {
    it("returns redeemable interest and principal", async () => {
      // Total junior tranche investment is split between 2 people
      await erc20Approve(usdc, tranchedPool.address, usdcVal(100000), [otherPerson])
      await tranchedPool.deposit(TRANCHES.Junior, usdcVal(500), {from: otherPerson})
      const response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(500))
      const logs = decodeLogs<DepositMade>(response.receipt.rawLogs, tranchedPool, "DepositMade")
      const firstLog = getFirstLog(logs)
      const tokenId = firstLog.args.tokenId

      await tranchedPool.lockJuniorCapital({from: borrower})

      // Should be zero while tranche is locked
      let {0: interestRedeemable, 1: principalRedeemable} = await tranchedPool.availableToWithdraw(tokenId)
      expect(interestRedeemable).to.bignumber.equal(new BN(0))
      expect(principalRedeemable).to.bignumber.equal(new BN(0))

      await tranchedPool.lockPool({from: borrower})
      await tranchedPool.drawdown(usdcVal(1000), {from: borrower})
      const payAmount = usdcVal(1050)
      await advanceTime({days: termInDays.toNumber()})
      await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])

      const receipt = await tranchedPool.pay(payAmount, {from: borrower})
      expectPaymentRelatedEventsEmitted(receipt, borrower, tranchedPool, {
        interest: usdcVal(50),
        principal: usdcVal(1000),
        remaining: new BN(0),
        reserve: usdcVal(5),
      })

      // Total amount owed to junior:
      //   interest_accrued = 1000 * 0.05 = 50
      //   protocol_fee = interest_accrued * 0.1 = 5
      //   1000 + interest_accrued - protocol_fee = 1045
      // Amount owed to one of the junior investors:
      //   1045 / 2 = 522.5
      ;({0: interestRedeemable, 1: principalRedeemable} = await tranchedPool.availableToWithdraw(tokenId))
      expect(interestRedeemable).to.bignumber.equal(usdcVal(2250).div(new BN(100)))
      expect(principalRedeemable).to.bignumber.equal(usdcVal(500))
    })
  })

  describe("withdraw", async () => {
    describe("validations", async () => {
      it("does not allow you to withdraw if you don't own the pool token", async () => {
        const receipt = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(10), {from: owner})
        const logs = decodeLogs<DepositMade>(receipt.receipt.rawLogs, tranchedPool, "DepositMade")
        const firstLog = getFirstLog(logs)
        const tokenId = firstLog.args.tokenId

        await expect(tranchedPool.withdraw(tokenId, usdcVal(10), {from: otherPerson})).to.be.rejectedWith(
          /Only the token owner is allowed/
        )
        await expect(tranchedPool.withdrawMax(tokenId, {from: otherPerson})).to.be.rejectedWith(
          /Only the token owner is allowed/
        )
      })
      it("does not allow you to withdraw if pool token is from a different pool", async () => {
        await tranchedPool.deposit(TRANCHES.Junior, usdcVal(10), {from: owner})
        const {tranchedPool: otherTranchedPool} = await createPoolWithCreditLine({})

        const otherReceipt = await otherTranchedPool.deposit(TRANCHES.Junior, usdcVal(10), {from: owner})
        const logs = decodeLogs<DepositMade>(otherReceipt.receipt.rawLogs, otherTranchedPool, "DepositMade")
        const firstLog = getFirstLog(logs)
        const otherTokenId = firstLog.args.tokenId

        await expect(tranchedPool.withdraw(otherTokenId, usdcVal(10), {from: owner})).to.be.rejectedWith(
          /Only the token's pool can redeem/
        )
      })
      it("does not allow you to withdraw if no amount is available", async () => {
        const receipt = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(10), {from: owner})
        const logs = decodeLogs<DepositMade>(receipt.receipt.rawLogs, tranchedPool, "DepositMade")
        const firstLog = getFirstLog(logs)
        const tokenId = firstLog.args.tokenId

        await expect(tranchedPool.withdrawMax(tokenId, {from: owner})).to.be.fulfilled
        await expect(tranchedPool.withdraw(tokenId, usdcVal(10), {from: owner})).to.be.rejectedWith(
          /Invalid redeem amount/
        )
      })

      it("does not allow you to withdraw zero amounts", async () => {
        const receipt = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(10), {from: owner})
        const logs = decodeLogs<DepositMade>(receipt.receipt.rawLogs, tranchedPool, "DepositMade")
        const firstLog = getFirstLog(logs)
        const tokenId = firstLog.args.tokenId

        await expect(tranchedPool.withdraw(tokenId, usdcVal(0), {from: owner})).to.be.rejectedWith(
          /Must withdraw more than zero/
        )
      })
    })

    describe("before the pool is locked", async () => {
      it("lets you withdraw everything you put in", async () => {
        const response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(10))
        const logs = decodeLogs<DepositMade>(response.receipt.rawLogs, tranchedPool, "DepositMade")
        const firstLog = getFirstLog(logs)
        const tokenId = firstLog.args.tokenId

        await tranchedPool.withdraw(tokenId, usdcVal(10))
        const juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
        expect(juniorTranche.principalDeposited).to.bignumber.eq("0")
        expect(await usdc.balanceOf(tranchedPool.address)).to.bignumber.eq("0")

        const tokenInfo = await poolTokens.getTokenInfo(tokenId)
        expect(tokenInfo.principalAmount).to.bignumber.eq(usdcVal(10))
        expect(tokenInfo.principalRedeemed).to.bignumber.eq(usdcVal(10))
        expect(tokenInfo.interestRedeemed).to.bignumber.eq("0")
      })
    })

    describe("after the pool is locked", async () => {
      it("does not let you withdraw if no payments have come back", async () => {
        const response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(10))
        const logs = decodeLogs<DepositMade>(response.receipt.rawLogs, tranchedPool, "DepositMade")
        const firstLog = getFirstLog(logs)
        const tokenId = firstLog.args.tokenId

        await tranchedPool.lockJuniorCapital({from: borrower})

        await expect(tranchedPool.withdraw(tokenId, usdcVal(10))).to.be.rejectedWith(/Tranche is locked/)
      })

      it("lets you withdraw pro-rata share of payments", async () => {
        // Total junior tranche investment is split between 2 people
        await erc20Approve(usdc, tranchedPool.address, usdcVal(100000), [otherPerson])
        await tranchedPool.deposit(TRANCHES.Junior, usdcVal(500), {from: otherPerson})
        const response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(500))
        const logs = decodeLogs<DepositMade>(response.receipt.rawLogs, tranchedPool, "DepositMade")
        const firstLog = getFirstLog(logs)
        const tokenId = firstLog.args.tokenId

        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})
        await tranchedPool.drawdown(usdcVal(1000), {from: borrower})
        await advanceTime({days: termInDays.toNumber()})
        const payAmount = usdcVal(1050)
        await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])

        const receipt = await tranchedPool.pay(payAmount, {from: borrower})
        expectPaymentRelatedEventsEmitted(receipt, borrower, tranchedPool, {
          interest: usdcVal(50),
          principal: usdcVal(1000),
          remaining: new BN(0),
          reserve: usdcVal(5),
        })

        // Total amount owed to junior:
        //   interest_accrued = 1000 * 0.05 = 50
        //   protocol_fee = interest_accrued * 0.1 = 5
        //   1000 + interest_accrued - protocol_fee = 1045
        // Amount owed to one of the junior investors:
        //   1045 / 2 = 522.5
        await expectAction(async () => tranchedPool.withdraw(tokenId, usdcVal(52250).div(new BN(100)))).toChange([
          [async () => await getBalance(owner, usdc), {by: usdcVal(52250).div(new BN(100))}],
        ])
        // After withdrawing the max, the junior investor should not be able to withdraw more
        await expect(tranchedPool.withdraw(tokenId, usdcVal(10))).to.be.rejectedWith(/Invalid redeem amount/)
      })

      it("emits a WithdrawalMade event", async () => {
        const response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(1000))
        const logs = decodeLogs<DepositMade>(response.receipt.rawLogs, tranchedPool, "DepositMade")
        const firstLog = getFirstLog(logs)
        const tokenId = firstLog.args.tokenId

        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})
        await tranchedPool.drawdown(usdcVal(1000), {from: borrower})
        await advanceTime({days: termInDays.toNumber()})
        const payAmount = usdcVal(1050)
        await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])

        const receipt = await tranchedPool.pay(payAmount, {from: borrower})
        expectPaymentRelatedEventsEmitted(receipt, borrower, tranchedPool, {
          interest: usdcVal(50),
          principal: usdcVal(1000),
          remaining: new BN(0),
          reserve: usdcVal(5),
        })

        // Total amount owed to junior:
        //   principal = 1000
        //   interest_accrued = 1000 * 0.05 = 50
        //   protocol_fee = interest_accrued * 0.1 = 5
        //   principal + interest_accrued - protocol_fee = 1045
        const txn = await tranchedPool.withdraw(tokenId, usdcVal(1045))
        expectEvent(txn, "WithdrawalMade", {
          owner: owner,
          tranche: new BN(TRANCHES.Junior),
          tokenId: tokenId,
          interestWithdrawn: usdcVal(45),
          principalWithdrawn: usdcVal(1000),
        })
      })
    })

    it("does not allow you to withdraw during the drawdown period", async () => {
      let response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(10))
      const logs = decodeLogs<DepositMade>(response.receipt.rawLogs, tranchedPool, "DepositMade")
      const firstLog = getFirstLog(logs)
      const juniorTokenId = firstLog.args.tokenId

      await tranchedPool.lockJuniorCapital({from: borrower})

      await expect(tranchedPool.withdraw(juniorTokenId, usdcVal(10))).to.be.rejectedWith(/Tranche is locked/)

      response = await tranchedPool.deposit(TRANCHES.Senior, usdcVal(40))
      const logs2 = decodeLogs<DepositMade>(response.receipt.rawLogs, tranchedPool, "DepositMade")
      const firstLog2 = getFirstLog(logs2)
      const seniorTokenId = firstLog2.args.tokenId
      await tranchedPool.lockPool({from: borrower})

      await expect(tranchedPool.withdraw(seniorTokenId, usdcVal(10))).to.be.rejectedWith(/Tranche is locked/)

      await tranchedPool.drawdown(usdcVal(25), {from: borrower})

      advanceTime({days: 2})

      // After the drawdown period, each tranche can withdraw unused capital
      await expectAction(async () => tranchedPool.withdrawMax(juniorTokenId)).toChange([
        [async () => await getBalance(owner, usdc), {by: usdcVal(5)}],
      ])
      await expectAction(async () => tranchedPool.withdrawMax(seniorTokenId)).toChange([
        [async () => await getBalance(owner, usdc), {by: usdcVal(20)}],
      ])
    })
  })

  describe("withdrawMultiple", async () => {
    let firstToken, secondToken, thirdTokenFromDifferentUser

    beforeEach(async () => {
      let response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(100))
      let logs = decodeLogs<DepositMade>(response.receipt.rawLogs, tranchedPool, "DepositMade")
      firstToken = getFirstLog(logs).args.tokenId

      response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(400))
      logs = decodeLogs<DepositMade>(response.receipt.rawLogs, tranchedPool, "DepositMade")
      secondToken = getFirstLog(logs).args.tokenId

      await erc20Approve(usdc, tranchedPool.address, usdcVal(100000), [otherPerson])
      response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(500), {from: otherPerson})
      logs = decodeLogs<DepositMade>(response.receipt.rawLogs, tranchedPool, "DepositMade")
      thirdTokenFromDifferentUser = getFirstLog(logs).args.tokenId

      await tranchedPool.lockJuniorCapital({from: borrower})
      await tranchedPool.lockPool({from: borrower})
      await tranchedPool.drawdown(usdcVal(500), {from: borrower})
      // Move past drawdown window
      await advanceTime({days: 5})
      // Mine a block so the timestamp takes effect for view functions
      await hre.ethers.provider.send("evm_mine", [])
    })

    describe("validations", async () => {
      it("reverts if any token id is not owned by the sender", async () => {
        await expect(
          tranchedPool.withdrawMultiple([firstToken, thirdTokenFromDifferentUser], [usdcVal(50), usdcVal(200)])
        ).to.be.rejectedWith(/Only the token owner/)
      })

      it("reverts if any amount exceeds withdrawable amount for that token", async () => {
        await expect(
          tranchedPool.withdrawMultiple([firstToken, secondToken], [usdcVal(50), usdcVal(250)])
        ).to.be.rejectedWith(/Invalid redeem amount/)
      })

      it("reverts if array lengths don't match", async () => {
        await expect(
          tranchedPool.withdrawMultiple([firstToken, thirdTokenFromDifferentUser], [usdcVal(50)])
        ).to.be.rejectedWith(/same length/)
      })
    })

    it("should withdraw from multiple token ids simultaneously", async () => {
      await expectAction(async () =>
        tranchedPool.withdrawMultiple([firstToken, secondToken], [usdcVal(50), usdcVal(200)])
      ).toChange([
        [async () => await getBalance(owner, usdc), {by: usdcVal(250)}],
        [async () => (await tranchedPool.availableToWithdraw(firstToken))[1], {to: usdcVal(0)}],
        [async () => (await tranchedPool.availableToWithdraw(secondToken))[1], {to: usdcVal(0)}],
      ])
    })
  })

  describe("withdrawMax", async () => {
    it("should withdraw the max", async () => {
      // Total junior tranche investment is split between 2 people
      await erc20Approve(usdc, tranchedPool.address, usdcVal(100000), [otherPerson])
      await tranchedPool.deposit(TRANCHES.Junior, usdcVal(500), {from: otherPerson})
      const response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(500))
      const logs = decodeLogs<DepositMade>(response.receipt.rawLogs, tranchedPool, "DepositMade")
      const firstLog = getFirstLog(logs)
      const tokenId = firstLog.args.tokenId

      await tranchedPool.lockJuniorCapital({from: borrower})
      await tranchedPool.lockPool({from: borrower})
      await tranchedPool.drawdown(usdcVal(1000), {from: borrower})
      const payAmount = usdcVal(1050)
      await advanceTime({days: termInDays.toNumber()})
      await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])

      const receipt = await tranchedPool.pay(payAmount, {from: borrower})
      expectPaymentRelatedEventsEmitted(receipt, borrower, tranchedPool, {
        interest: usdcVal(50),
        principal: usdcVal(1000),
        remaining: new BN(0),
        reserve: usdcVal(5),
      })

      // Total amount owed to junior:
      //   interest_accrued = 1000 * 0.05 = 50
      //   protocol_fee = interest_accrued * 0.1 = 5
      //   1000 + interest_accrued - protocol_fee = 1045
      // Amount owed to one of the junior investors:
      //   1045 / 2 = 522.5
      await expectAction(async () => tranchedPool.withdrawMax(tokenId)).toChange([
        [async () => await getBalance(owner, usdc), {by: usdcVal(52250).div(new BN(100))}],
      ])
      // Nothing left to withdraw
      await expect(tranchedPool.withdrawMax(tokenId)).to.be.rejectedWith(/Must withdraw more than zero/)
    })

    it("emits a WithdrawalMade event", async () => {
      const response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(1000))
      const logs = decodeLogs<DepositMade>(response.receipt.rawLogs, tranchedPool, "DepositMade")
      const firstLog = getFirstLog(logs)
      const tokenId = firstLog.args.tokenId

      await tranchedPool.lockJuniorCapital({from: borrower})
      await tranchedPool.lockPool({from: borrower})
      await tranchedPool.drawdown(usdcVal(1000), {from: borrower})
      await advanceTime({days: termInDays.toNumber()})
      const payAmount = usdcVal(1050)
      await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])

      const receipt = await tranchedPool.pay(payAmount, {from: borrower})
      expectPaymentRelatedEventsEmitted(receipt, borrower, tranchedPool, {
        interest: usdcVal(50),
        principal: usdcVal(1000),
        remaining: new BN(0),
        reserve: usdcVal(5),
      })

      // Total amount owed to junior:
      //   principal = 1000
      //   interest_accrued = 1000 * 0.05 = 50
      //   protocol_fee = interest_accrued * 0.1 = 5
      //   principal + interest_accrued - protocol_fee = 1045
      const receipt2 = await tranchedPool.withdrawMax(tokenId)
      expectEvent(receipt2, "WithdrawalMade", {
        owner: owner,
        tranche: new BN(TRANCHES.Junior),
        tokenId: tokenId,
        interestWithdrawn: usdcVal(45),
        principalWithdrawn: usdcVal(1000),
      })
    })

    describe("when deposits are over the limit", async () => {
      it("lets you withdraw the unused amounts", async () => {
        const juniorDeposit = limit
        const seniorDeposit = limit.mul(new BN(4))
        let response = await tranchedPool.deposit(TRANCHES.Junior, juniorDeposit)
        const logs = decodeLogs<DepositMade>(response.receipt.rawLogs, tranchedPool, "DepositMade")
        const firstLog = getFirstLog(logs)
        const juniorTokenId = firstLog.args.tokenId
        response = await tranchedPool.deposit(TRANCHES.Senior, seniorDeposit)
        const logs2 = decodeLogs<DepositMade>(response.receipt.rawLogs, tranchedPool, "DepositMade")
        const firstLog2 = getFirstLog(logs2)
        const seniorTokenId = firstLog2.args.tokenId
        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})

        expect(await creditLine.limit()).to.bignumber.eq(limit)

        await expectAction(async () => tranchedPool.drawdown(limit, {from: borrower})).toChange([
          [() => creditLine.balance(), {to: limit}],
          [() => usdc.balanceOf(borrower), {by: limit}],
          [() => usdc.balanceOf(tranchedPool.address), {to: limit.mul(new BN(4))}], // 5x limit was deposited. 4x still remaining
        ])

        advanceTime({days: termInDays.toNumber()})

        // Only 20% of the capital was used, so remaining 80% should be available for drawdown
        await expectAction(async () => tranchedPool.withdrawMax(juniorTokenId)).toChange([
          [() => getBalance(owner, usdc), {by: juniorDeposit.mul(new BN(80)).div(new BN(100))}],
        ])
        await expectAction(async () => tranchedPool.withdrawMax(seniorTokenId)).toChange([
          [() => getBalance(owner, usdc), {by: seniorDeposit.mul(new BN(80)).div(new BN(100))}],
        ])

        // Fully pay off the loan
        const receipt = await tranchedPool.pay(limit.add(limit.mul(new BN(5)).div(new BN(100))), {from: borrower})
        expectPaymentRelatedEventsEmitted(receipt, borrower, tranchedPool, {
          interest: usdcVal(50),
          principal: usdcVal(1000),
          remaining: new BN(0),
          reserve: usdcVal(5),
        })

        // Remaining 20% of principal should be withdrawn
        const receipt2 = await tranchedPool.withdrawMax(juniorTokenId)
        expectEvent(receipt2, "WithdrawalMade", {
          tranche: new BN(TRANCHES.Junior),
          tokenId: juniorTokenId,
          principalWithdrawn: juniorDeposit.mul(new BN(20)).div(new BN(100)),
        })

        const receipt3 = await tranchedPool.withdrawMax(seniorTokenId)
        expectEvent(receipt3, "WithdrawalMade", {
          tranche: new BN(TRANCHES.Senior),
          tokenId: seniorTokenId,
          principalWithdrawn: seniorDeposit.mul(new BN(20)).div(new BN(100)),
        })
      })
    })
  })

  describe("access controls", () => {
    const LOCKER_ROLE = web3.utils.keccak256("LOCKER_ROLE")
    it("sets the owner to governance", async () => {
      expect(await tranchedPool.hasRole(OWNER_ROLE, owner)).to.equal(true)
      expect(await tranchedPool.hasRole(OWNER_ROLE, borrower)).to.equal(false)
      expect(await tranchedPool.getRoleAdmin(OWNER_ROLE)).to.equal(OWNER_ROLE)
    })

    it("sets the pauser to governance", async () => {
      expect(await tranchedPool.hasRole(PAUSER_ROLE, owner)).to.equal(true)
      expect(await tranchedPool.hasRole(PAUSER_ROLE, borrower)).to.equal(false)
      expect(await tranchedPool.getRoleAdmin(PAUSER_ROLE)).to.equal(OWNER_ROLE)
    })

    it("sets the locker to borrower and governance", async () => {
      expect(await tranchedPool.hasRole(LOCKER_ROLE, borrower)).to.equal(true)
      expect(await tranchedPool.hasRole(LOCKER_ROLE, owner)).to.equal(true)
      expect(await tranchedPool.hasRole(LOCKER_ROLE, otherPerson)).to.equal(false)
      expect(await tranchedPool.getRoleAdmin(LOCKER_ROLE)).to.equal(OWNER_ROLE)
    })

    it("allows the owner to set new addresses as roles", async () => {
      expect(await tranchedPool.hasRole(OWNER_ROLE, otherPerson)).to.equal(false)
      await tranchedPool.grantRole(OWNER_ROLE, otherPerson, {from: owner})
      expect(await tranchedPool.hasRole(OWNER_ROLE, otherPerson)).to.equal(true)
    })

    it("should not allow anyone else to add an owner", async () => {
      return expect(tranchedPool.grantRole(OWNER_ROLE, otherPerson, {from: borrower})).to.be.rejected
    })
  })

  describe("pausability", () => {
    describe("after pausing", async () => {
      let tokenId: BN

      beforeEach(async () => {
        const receipt = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(10))
        const logs = decodeLogs<DepositMade>(receipt.receipt.rawLogs, tranchedPool, "DepositMade")
        const firstLog = getFirstLog(logs)
        tokenId = firstLog.args.tokenId

        await tranchedPool.pause()
      })

      it("disallows deposits", async () => {
        await expect(tranchedPool.deposit(TRANCHES.Junior, usdcVal(10))).to.be.rejectedWith(/Pausable: paused/)

        const nonce = await usdc.nonces(owner)
        const deadline = MAX_UINT
        const digest = await getApprovalDigest({
          token: usdc,
          owner: owner,
          spender: tranchedPool.address,
          value: usdcVal(10),
          nonce,
          deadline,
        })
        const wallet = await getWallet(owner)
        assertNonNullable(wallet)
        const {v, r, s} = ecsign(Buffer.from(digest.slice(2), "hex"), Buffer.from(wallet.privateKey.slice(2), "hex"))
        await expect(
          (tranchedPool as any).depositWithPermit(TRANCHES.Junior, usdcVal(10), deadline, v, r, s)
        ).to.be.rejectedWith(/Pausable: paused/)
      })

      it("disallows withdrawing", async () => {
        await expect(tranchedPool.withdraw(tokenId, usdcVal(5))).to.be.rejectedWith(/Pausable: paused/)
        await expect(tranchedPool.withdrawMax(tokenId)).to.be.rejectedWith(/Pausable: paused/)
        await expect(tranchedPool.withdrawMultiple([tokenId], [usdcVal(5)])).to.be.rejectedWith(/Pausable: paused/)
      })

      it("disallows drawdown", async () => {
        await expect(tranchedPool.drawdown(usdcVal(10), {from: borrower})).to.be.rejectedWith(/Pausable: paused/)
      })

      it("disallows pay", async () => {
        await expect(tranchedPool.pay(usdcVal(10), {from: borrower})).to.be.rejectedWith(/Pausable: paused/)
      })

      it("disallows assess", async () => {
        await expect(tranchedPool.assess({from: borrower})).to.be.rejectedWith(/Pausable: paused/)
      })

      it("disallows lockJuniorCapital", async () => {
        await expect(tranchedPool.lockJuniorCapital({from: borrower})).to.be.rejectedWith(/Pausable: paused/)
      })

      it("disallows lockPool", async () => {
        await expect(tranchedPool.lockPool({from: borrower})).to.be.rejectedWith(/Pausable: paused/)
      })

      it("allows unpausing", async () => {
        await tranchedPool.unpause()
        await expect(tranchedPool.withdraw(tokenId, usdcVal(10))).to.be.fulfilled
        await expect(tranchedPool.deposit(TRANCHES.Junior, usdcVal(10))).to.be.fulfilled
        await expect(tranchedPool.lockJuniorCapital()).to.be.fulfilled
        await expect(tranchedPool.lockPool()).to.be.fulfilled
        await expect(tranchedPool.drawdown(usdcVal(10), {from: borrower})).to.be.fulfilled
        await expect(tranchedPool.pay(usdcVal(10), {from: borrower})).to.be.fulfilled
      })
    })

    describe("actually pausing", async () => {
      it("should allow the owner to pause", async () => {
        await expect(tranchedPool.pause({from: owner})).to.be.fulfilled
      })
      it("should disallow non-owner to pause", async () => {
        await expect(tranchedPool.pause({from: borrower})).to.be.rejectedWith(/Must have pauser role/)
      })
    })
  })

  describe("locking", async () => {
    describe("junior tranche", async () => {
      describe("as the borrower", async () => {
        it("locks the junior tranche", async () => {
          const actor = borrower
          await tranchedPool.deposit(TRANCHES.Senior, usdcVal(10))
          const oneDayFromNow = (await time.latest()).add(SECONDS_PER_DAY)
          await expectAction(async () => {
            const receipt = await tranchedPool.lockJuniorCapital({from: actor})

            const logs = decodeLogs<JuniorTrancheLocked>(receipt.receipt.rawLogs, tranchedPool, "JuniorTrancheLocked")
            const firstLog = getFirstLog(logs)
            expect(Object.keys(firstLog.args).sort()).to.eql(EXPECTED_JUNIOR_CAPITAL_LOCKED_EVENT_ARGS)
            expect(firstLog.args.pool).to.equal(tranchedPool.address)
            expect(firstLog.args.lockedUntil).to.be.bignumber.closeTo(oneDayFromNow, new BN(5))

            return receipt
          }).toChange([
            [async () => (await tranchedPool.getTranche(TRANCHES.Junior)).lockedUntil, {increase: true}],
            [async () => (await tranchedPool.getTranche(TRANCHES.Junior)).principalSharePrice, {unchanged: true}],
          ])
          // Should be locked upto approximately 1 day from now (plus or minus a few seconds)
          expect((await tranchedPool.getTranche(TRANCHES.Junior)).lockedUntil).to.be.bignumber.closeTo(
            oneDayFromNow,
            new BN(5)
          )
        })
      })

      describe("as the owner", async () => {
        it("locks the junior tranche", async () => {
          await tranchedPool.deposit(TRANCHES.Senior, usdcVal(10))
          const oneDayFromNow = (await time.latest()).add(SECONDS_PER_DAY)
          await expectAction(async () => {
            const receipt = await tranchedPool.lockJuniorCapital({from: borrower})

            const logs = decodeLogs<JuniorTrancheLocked>(receipt.receipt.rawLogs, tranchedPool, "JuniorTrancheLocked")
            const firstLog = getFirstLog(logs)
            expect(Object.keys(firstLog.args).sort()).to.eql(EXPECTED_JUNIOR_CAPITAL_LOCKED_EVENT_ARGS)
            expect(firstLog.args.pool).to.equal(tranchedPool.address)
            expect(firstLog.args.lockedUntil).to.be.bignumber.closeTo(oneDayFromNow, new BN(5))

            return receipt
          }).toChange([
            [async () => (await tranchedPool.getTranche(TRANCHES.Junior)).lockedUntil, {increase: true}],
            [async () => (await tranchedPool.getTranche(TRANCHES.Junior)).principalSharePrice, {unchanged: true}],
          ])
          // Should be locked upto approximately 1 day from now (plus or minus a few seconds)
          expect((await tranchedPool.getTranche(TRANCHES.Junior)).lockedUntil).to.be.bignumber.closeTo(
            oneDayFromNow,
            new BN(5)
          )
        })
      })

      describe("as someone else", async () => {
        it("does not lock", async () => {
          const actor = otherPerson
          await tranchedPool.deposit(TRANCHES.Senior, usdcVal(10))
          await expect(tranchedPool.lockJuniorCapital({from: actor})).to.be.rejectedWith(/Must have locker role/)
        })
      })

      it("does not allow locking twice", async () => {
        await tranchedPool.lockJuniorCapital({from: borrower})
        await expect(tranchedPool.lockJuniorCapital({from: borrower})).to.be.rejectedWith(/already locked/)
      })
    })

    describe("senior tranche", async () => {
      beforeEach(async () => {
        await tranchedPool.deposit(TRANCHES.Senior, usdcVal(8))
        await tranchedPool.deposit(TRANCHES.Junior, usdcVal(2))
        await tranchedPool.lockJuniorCapital({from: borrower})
      })

      describe("as the borrower", async () => {
        it("locks the senior tranche", async () => {
          const actor = borrower

          const oneDayFromNow = (await time.latest()).add(SECONDS_PER_DAY)

          await expectAction(async () => tranchedPool.lockPool({from: actor})).toChange([
            [async () => (await tranchedPool.getTranche(TRANCHES.Senior)).lockedUntil, {increase: true}],
            [async () => (await tranchedPool.getTranche(TRANCHES.Senior)).principalSharePrice, {unchanged: true}],
            // Limit is total of senior and junior deposits
            [async () => creditLine.limit(), {to: usdcVal(10)}],
          ])

          const seniorLockedUntil = (await tranchedPool.getTranche(TRANCHES.Senior)).lockedUntil
          expect(seniorLockedUntil).to.be.bignumber.closeTo(oneDayFromNow, new BN(5))
          // Junior is also locked to the same time
          expect((await tranchedPool.getTranche(TRANCHES.Junior)).lockedUntil).to.be.bignumber.eq(seniorLockedUntil)
        })
      })

      describe("as the owner", async () => {
        it("locks the senior tranche", async () => {
          const actor = owner
          const oneDayFromNow = (await time.latest()).add(SECONDS_PER_DAY)

          await expectAction(async () => tranchedPool.lockPool({from: actor})).toChange([
            [async () => (await tranchedPool.getTranche(TRANCHES.Senior)).lockedUntil, {increase: true}],
            [async () => (await tranchedPool.getTranche(TRANCHES.Senior)).principalSharePrice, {unchanged: true}],
            // Limit is total of senior and junior deposits
            [async () => creditLine.limit(), {to: usdcVal(10)}],
          ])
          const seniorLockedUntil = (await tranchedPool.getTranche(TRANCHES.Senior)).lockedUntil
          expect(seniorLockedUntil).to.be.bignumber.closeTo(oneDayFromNow, new BN(5))
          // Junior is also locked to the same time
          expect((await tranchedPool.getTranche(TRANCHES.Junior)).lockedUntil).to.be.bignumber.eq(seniorLockedUntil)
        })
      })

      describe("as someone else", async () => {
        it("does not lock", async () => {
          const actor = otherPerson
          await expect(tranchedPool.lockPool({from: actor})).to.be.rejectedWith(/Must have locker role/)
        })
      })
    })
  })
  describe("drawdown", async () => {
    describe("when deposits are over the limit", async () => {
      it("does not adjust the limit up", async () => {
        await tranchedPool.deposit(TRANCHES.Junior, limit.mul(new BN(2)))
        await tranchedPool.deposit(TRANCHES.Senior, limit.mul(new BN(4)))
        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})

        expect(await creditLine.limit()).to.bignumber.eq(limit)
      })
    })

    describe("when deposits are under the limit", async () => {
      it("adjusts the limit down", async () => {
        await tranchedPool.deposit(TRANCHES.Junior, usdcVal(2))
        await tranchedPool.deposit(TRANCHES.Senior, usdcVal(8))
        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})

        expect(await creditLine.limit()).to.bignumber.eq(usdcVal(10))
        expect(await creditLine.limit()).to.bignumber.lt(limit)
      })
    })

    describe("when pool is already locked", async () => {
      beforeEach(async () => {
        await tranchedPool.deposit(TRANCHES.Junior, usdcVal(2))
        await tranchedPool.deposit(TRANCHES.Senior, usdcVal(8))
        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})
      })

      describe("validations", async () => {
        it("does not allow drawing down more than the limit", async () => {
          await expect(tranchedPool.drawdown(usdcVal(20))).to.be.rejectedWith(/Cannot drawdown more than whats available/)
        })

        it("does not allow drawing down when payments are late", async () => {
          await tranchedPool.drawdown(usdcVal(5))
          await advanceTime({days: paymentPeriodInDays.mul(new BN(3))})
          await expect(tranchedPool.drawdown(usdcVal(5))).to.be.rejectedWith(
            /Cannot drawdown when payments are past due/
          )
        })
      })

      context("locking drawdowns", async () => {
        it("governance can lock and unlock drawdowns", async () => {
          await expect(tranchedPool.drawdown(usdcVal(1))).to.be.fulfilled
          const pauseTxn = await tranchedPool.pauseDrawdowns()
          expectEvent(pauseTxn, "DrawdownsPaused", {pool: tranchedPool.address})
          await expect(tranchedPool.drawdown(usdcVal(1))).to.be.rejectedWith(/Drawdowns are currently paused/)
          const unpauseTxn = await tranchedPool.unpauseDrawdowns()
          expectEvent(unpauseTxn, "DrawdownsUnpaused", {pool: tranchedPool.address})
          await expect(tranchedPool.drawdown(usdcVal(1))).to.be.fulfilled
        })

        it("only governance can toggle it", async () => {
          await expect(tranchedPool.pauseDrawdowns({from: borrower})).to.be.rejectedWith(/Must have admin role/)
          await expect(tranchedPool.unpauseDrawdowns({from: borrower})).to.be.rejectedWith(/Must have admin role/)
        })
      })

      it("draws down the capital to the borrower", async () => {
        await expectAction(async () => tranchedPool.drawdown(usdcVal(10))).toChange([
          [async () => usdc.balanceOf(borrower), {by: usdcVal(10)}],
        ])
      })

      it("emits an event", async () => {
        const receipt = await tranchedPool.drawdown(usdcVal(10))
        expectEvent(receipt, "DrawdownMade", {borrower: borrower, amount: usdcVal(10)})
      })

      it("it updates the creditline accounting variables", async () => {
        await expectAction(async () => tranchedPool.drawdown(usdcVal(10))).toChange([
          [async () => creditLine.balance(), {by: usdcVal(10)}],
          [async () => creditLine.lastFullPaymentTime(), {increase: true}],
          [async () => creditLine.nextDueTime(), {increase: true}],
          [async () => creditLine.interestAccruedAsOf(), {increase: true}],
        ])
      })

      it("supports multiple drawdowns", async () => {
        await expectAction(async () => tranchedPool.drawdown(usdcVal(7))).toChange([
          [async () => creditLine.balance(), {by: usdcVal(7)}],
          [async () => creditLine.lastFullPaymentTime(), {increase: true}],
          [async () => creditLine.nextDueTime(), {increase: true}],
          [async () => creditLine.interestAccruedAsOf(), {increase: true}],
        ])

        await expectAction(async () => tranchedPool.drawdown(usdcVal(3))).toChange([
          [async () => creditLine.balance(), {by: usdcVal(3)}],
          [async () => creditLine.lastFullPaymentTime(), {unchanged: true}],
          [async () => creditLine.nextDueTime(), {unchanged: true}],
          [async () => creditLine.interestAccruedAsOf(), {unchanged: true}],
        ])
      })

      it("sets the principal share price to be proportional to the amount drawn down", async () => {
        let juniorPrincipalAmount, seniorPrincipalAmount
        ;[, juniorPrincipalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Junior))
        ;[, seniorPrincipalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Senior))

        // Before any drawdown, the share price should be 1 to reflect the full amounts deposited
        expect(juniorPrincipalAmount).to.bignumber.eq(usdcVal(2))
        expect(seniorPrincipalAmount).to.bignumber.eq(usdcVal(8))

        await tranchedPool.drawdown(usdcVal(5))
        ;[, juniorPrincipalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Junior))
        ;[, seniorPrincipalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Senior))

        expect(juniorPrincipalAmount).to.bignumber.eq(usdcVal(1)) // 50% of 2$
        expect(seniorPrincipalAmount).to.bignumber.eq(usdcVal(4)) // 50% of 8$

        await tranchedPool.drawdown(usdcVal(5))
        ;[, juniorPrincipalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Junior))
        ;[, seniorPrincipalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Senior))
        expect(juniorPrincipalAmount).to.bignumber.eq(usdcVal(0)) // 0% of 2$
        expect(seniorPrincipalAmount).to.bignumber.eq(usdcVal(0)) // 0% of 8$
      })
    })
  })

  describe("tranching", async () => {
    let tranchedPool, creditLine
    beforeEach(async () => {
      // 100$ creditline with 10% interest. Senior tranche gets 8% of the total interest, and junior tranche gets 2%
      interestApr = interestAprAsBN("10.00")
      termInDays = new BN(365)
      ;({tranchedPool, creditLine} = await createPoolWithCreditLine({interestApr, termInDays}))
    })

    it("calculates share price using term start time", async () => {
      await tranchedPool.deposit(TRANCHES.Junior, usdcVal(100))
      await tranchedPool.lockJuniorCapital({from: borrower})
      await tranchedPool.lockPool({from: borrower})

      // Start loan term halfOfTerm days from now
      const halfOfTerm = termInDays.div(new BN(2))
      await advanceTime({days: halfOfTerm.toNumber()})
      await tranchedPool.drawdown(usdcVal(100), {from: borrower})

      // Advance termInDays total days from now
      await advanceTime({days: halfOfTerm.add(new BN(1)).toNumber()})

      const expectedJuniorInterest = new BN("4438356")
      const expectedProtocolFee = new BN("493150")
      const expectedTotalInterest = expectedJuniorInterest.add(expectedProtocolFee)

      const receipt = await tranchedPool.pay(usdcVal(5), {from: borrower})
      expectPaymentRelatedEventsEmitted(receipt, borrower, tranchedPool, {
        interest: expectedTotalInterest,
        principal: usdcVal(5).sub(expectedTotalInterest),
        remaining: new BN(0),
        reserve: expectedProtocolFee,
      })

      const juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
      const juniorInterestAmount = await tranchedPool.sharePriceToUsdc(
        juniorTranche.interestSharePrice,
        juniorTranche.principalDeposited
      )

      // Should be around half of full term's interest, since the drawdown happened 6 months
      // from this payment:
      // ~$4.43 (rather than ~$5, since interest is accrued at last second of prior period)
      expect(juniorInterestAmount).to.bignumber.eq(expectedJuniorInterest)
      expect(await usdc.balanceOf(treasury)).to.bignumber.eq(expectedProtocolFee)
    })

    context("only junior investment", async () => {
      it("still works", async () => {
        await tranchedPool.deposit(TRANCHES.Junior, usdcVal(100))
        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})
        await tranchedPool.drawdown(usdcVal(100), {from: borrower})

        // Ensure a full term has passed
        await advanceTime({days: termInDays.toNumber()})
        const receipt = await tranchedPool.pay(usdcVal(110), {from: borrower})
        expectPaymentRelatedEventsEmitted(receipt, borrower, tranchedPool, {
          interest: usdcVal(10),
          principal: usdcVal(100),
          remaining: new BN(0),
          reserve: usdcVal(1),
        })

        const juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
        const seniorTranche = await tranchedPool.getTranche(TRANCHES.Senior)

        const [juniorInterestAmount, juniorPrincipalAmount] = await getTrancheAmounts(juniorTranche)
        const [seniorInterestAmount, seniorPrincipalAmount] = await getTrancheAmounts(seniorTranche)

        expect(seniorInterestAmount).to.bignumber.eq(new BN(0))
        expect(seniorPrincipalAmount).to.bignumber.eq(new BN(0))
        expect(juniorInterestAmount).to.bignumber.eq(usdcVal(9))
        expect(juniorPrincipalAmount).to.bignumber.eq(usdcVal(100))
        expect(await usdc.balanceOf(treasury)).to.bignumber.eq(usdcVal(1))
      })
    })

    context("junior and senior are invested", async () => {
      beforeEach(async () => {
        usdc.transfer(borrower, usdcVal(15), {from: owner}) // Transfer money for interest payment
        expect(await usdc.balanceOf(treasury)).to.bignumber.eq("0")

        await tranchedPool.deposit(TRANCHES.Junior, usdcVal(20))
        await tranchedPool.deposit(TRANCHES.Senior, usdcVal(80))
        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})
        await tranchedPool.drawdown(usdcVal(100), {from: borrower})
      })

      describe("when full payment is received", async () => {
        it("distributes across senior and junior tranches correctly", async () => {
          // Ensure a full term has passed
          await advanceTime({days: termInDays.toNumber()})

          const receipt = await tranchedPool.pay(usdcVal(10).add(usdcVal(100)), {from: borrower})
          expectPaymentRelatedEventsEmitted(receipt, borrower, tranchedPool, {
            interest: usdcVal(10),
            principal: usdcVal(100),
            remaining: new BN(0),
            reserve: usdcVal(1),
          })

          expect(await creditLine.interestApr()).to.bignumber.eq(interestAprAsBN("10"))

          // 100$ loan, with 10% interest. 80% senior and 20% junior. Junior fee of 20%. Reserve fee of 10%
          // Senior share of interest 8$. Net interest = 8 * (100 - junior fee percent + reserve fee percent) = 5.6
          // Junior share of interest 2$. Net interest = 2 + (8 * junior fee percent) - (2 * reserve fee percent) = 3.4
          // Protocol fee = 1$. Total = 5.6 + 3.4 + 1 = 10
          let interestAmount, principalAmount
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Senior))
          expect(interestAmount).to.bignumber.eq(usdcVal(56).div(new BN(10)))
          expect(principalAmount).to.bignumber.eq(usdcVal(80))
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Junior))
          expect(interestAmount).to.bignumber.eq(usdcVal(34).div(new BN(10)))
          expect(principalAmount).to.bignumber.eq(usdcVal(20))

          expect(await usdc.balanceOf(treasury)).to.bignumber.eq(usdcVal(1))
        })

        it("distributes across senior and junior tranches correctly for multiple payments", async () => {
          // Advance to the half way point
          const halfway = SECONDS_PER_DAY.mul(termInDays).div(new BN(2))
          await advanceTime({seconds: halfway.toNumber()})

          // Principal payment should be 0, while interest payment should be slightly less than half. This
          // is because interest is accrued from the most recent nextDueTime rather than the current timestamp.
          // 180.0 / 365 * 10 = 4.93150684931506 (180 because we round to the most recent time in paymentPeriodInDays)
          const interestPayment = new BN("4931506")
          const expectedProtocolFee = interestPayment.div(new BN(10))
          const receipt = await tranchedPool.pay(interestPayment, {from: borrower})
          expectPaymentRelatedEventsEmitted(receipt, borrower, tranchedPool, {
            interest: interestPayment,
            principal: new BN(0),
            remaining: new BN(0),
            reserve: expectedProtocolFee,
          })

          let seniorInterestAmount, seniorPrincipalAmount, juniorInterestAmount, juniorPrincipalAmount
          ;[seniorInterestAmount, seniorPrincipalAmount] = await getTrancheAmounts(
            await tranchedPool.getTranche(TRANCHES.Senior)
          )
          expect(seniorInterestAmount).to.bignumber.eq(new BN("2761643"))
          expect(seniorPrincipalAmount).to.bignumber.eq(usdcVal(0))
          ;[juniorInterestAmount, juniorPrincipalAmount] = await getTrancheAmounts(
            await tranchedPool.getTranche(TRANCHES.Junior)
          )
          expect(juniorInterestAmount).to.bignumber.eq(new BN("1676713"))
          expect(juniorPrincipalAmount).to.bignumber.eq(usdcVal(0))

          expect(await usdc.balanceOf(treasury)).to.bignumber.eq(expectedProtocolFee)

          // Now advance to the end of the loan period and collect interest again, now the numbers should match the full
          //amounts in the previous test

          await advanceTime({seconds: halfway.toNumber()})
          // Collect the remaining interest and the principal
          const interestPayment2 = new BN("5068493")
          const expectedProtocolFee2 = interestPayment2.div(new BN(10))
          const receipt2 = await tranchedPool.pay(interestPayment2.add(usdcVal(100)), {from: borrower})
          expectPaymentRelatedEventsEmitted(receipt2, borrower, tranchedPool, {
            interest: interestPayment2,
            principal: usdcVal(100),
            remaining: new BN(0),
            reserve: expectedProtocolFee2,
          })
          ;[seniorInterestAmount, seniorPrincipalAmount] = await getTrancheAmounts(
            await tranchedPool.getTranche(TRANCHES.Senior)
          )
          expect(seniorInterestAmount).to.bignumber.closeTo(usdcVal(56).div(new BN(10)), tolerance)
          expect(seniorPrincipalAmount).to.bignumber.eq(usdcVal(80))
          ;[juniorInterestAmount, juniorPrincipalAmount] = await getTrancheAmounts(
            await tranchedPool.getTranche(TRANCHES.Junior)
          )
          expect(juniorInterestAmount).to.bignumber.closeTo(usdcVal(34).div(new BN(10)), tolerance)
          expect(juniorPrincipalAmount).to.bignumber.eq(usdcVal(20))

          const expectedTotalProtocolFee = expectedProtocolFee.add(expectedProtocolFee2)
          expect(usdcVal(1)).to.bignumber.closeTo(expectedTotalProtocolFee, tolerance)
          expect(await usdc.balanceOf(treasury)).to.bignumber.eq(expectedTotalProtocolFee)
        })
      })

      describe("when there is an interest shortfall", async () => {
        it("distributes to the senior tranche first before the junior", async () => {
          // Ensure a full term has passed
          await advanceTime({days: termInDays.toNumber()})

          const interestPayment = usdcVal(6)
          const expectedProtocolFee = interestPayment.div(new BN(10))
          const receipt = await tranchedPool.pay(interestPayment)
          expectPaymentRelatedEventsEmitted(receipt, borrower, tranchedPool, {
            interest: interestPayment,
            principal: new BN(0),
            remaining: new BN(0),
            reserve: expectedProtocolFee,
          })

          let interestAmount, principalAmount
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Senior))
          // Senior interest amount should be 5.6, but we deducted 0.6$ of protocol fee first,
          // so they only received 5.4
          expect(interestAmount).to.bignumber.eq(usdcVal(54).div(new BN(10)))
          // No principal payment until interest is received
          expect(principalAmount).to.bignumber.eq(usdcVal(0))
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Junior))
          expect(interestAmount).to.bignumber.eq(usdcVal(0).div(new BN(10)))
          expect(principalAmount).to.bignumber.eq(usdcVal(0))

          // 10% of 6$ of interest collected
          expect(await usdc.balanceOf(treasury)).to.bignumber.eq(usdcVal(6).div(new BN(10)))

          // Second partial payment. Senior is made whole first and then junior is paid for subsequent interest
          // payments
          const interestPayment2 = usdcVal(3)
          const expectedProtocolFee2 = interestPayment2.div(new BN(10))
          const receipt2 = await tranchedPool.pay(interestPayment2)
          expectPaymentRelatedEventsEmitted(receipt2, borrower, tranchedPool, {
            interest: interestPayment2,
            principal: new BN(0),
            remaining: new BN(0),
            reserve: expectedProtocolFee2,
          })
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Senior))
          // Senior interest filled upto 5.6
          expect(interestAmount).to.bignumber.eq(usdcVal(56).div(new BN(10)))
          // No principal available yet
          expect(principalAmount).to.bignumber.eq(usdcVal(0))
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Junior))
          // Should be 3.4$, but we only have 2.5$ available (of 3$, 0.2 went to fill the principal interest, and 0.3 to the fee)
          expect(interestAmount).to.bignumber.eq(usdcVal(25).div(new BN(10)))
          // Still no principal available for the junior
          expect(principalAmount).to.bignumber.eq(usdcVal(0))

          // 0.6$ (from previous interest collection) + 0.3$ => 0.9$
          let expectedTotalProtocolFee = expectedProtocolFee.add(expectedProtocolFee2)
          expect(usdcVal(9).div(new BN(10))).to.bignumber.eq(expectedTotalProtocolFee)
          expect(await usdc.balanceOf(treasury)).to.bignumber.eq(expectedTotalProtocolFee)

          // Final interest payment and first principal payment. Interest is fully paid, and senior gets all of
          // the principal
          const interestPayment3 = usdcVal(1)
          const expectedProtocolFee3 = interestPayment3.div(new BN(10))
          const receipt3 = await tranchedPool.pay(interestPayment3.add(usdcVal(10)))
          expectPaymentRelatedEventsEmitted(receipt3, borrower, tranchedPool, {
            interest: interestPayment3,
            principal: usdcVal(10),
            remaining: new BN(0),
            reserve: expectedProtocolFee3,
          })
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Senior))
          // Interest unchanged, gets the entire principal portion
          expect(interestAmount).to.bignumber.eq(usdcVal(56).div(new BN(10)))
          expect(principalAmount).to.bignumber.eq(usdcVal(10))
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Junior))
          // Full 3.4 of interest, but no principal yet
          expect(interestAmount).to.bignumber.eq(usdcVal(34).div(new BN(10)))
          expect(principalAmount).to.bignumber.eq(usdcVal(0))

          // 1$ of total interest collected
          expectedTotalProtocolFee = expectedTotalProtocolFee.add(expectedProtocolFee3)
          expect(usdcVal(1)).to.bignumber.eq(expectedTotalProtocolFee)
          expect(await usdc.balanceOf(treasury)).to.bignumber.eq(expectedTotalProtocolFee)

          const receipt4 = await tranchedPool.pay(usdcVal(90))
          expectPaymentRelatedEventsEmitted(receipt4, borrower, tranchedPool, {
            interest: new BN(0),
            principal: usdcVal(90),
            remaining: new BN(0),
            reserve: new BN(0),
          })
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Senior))
          // Interest still unchanged, principal is fully paid off
          expect(interestAmount).to.bignumber.eq(usdcVal(56).div(new BN(10)))
          expect(principalAmount).to.bignumber.eq(usdcVal(80))
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Junior))
          // Interest unchanged, principal also fully paid
          expect(interestAmount).to.bignumber.eq(usdcVal(34).div(new BN(10)))
          expect(principalAmount).to.bignumber.eq(usdcVal(20))

          // No additional fees collected (payments were all principal)
          expect(await usdc.balanceOf(treasury)).to.bignumber.eq(expectedTotalProtocolFee)
        })
      })

      describe("when there is extra interest", async () => {
        // This test is the same as the interest shortfall test, except we'll do it in two payments, and there's an
        // extra 1$ of interest in the last payment
        it("distributes the extra interest solely to the junior", async () => {
          // Ensure a full term has passed
          await advanceTime({days: termInDays.toNumber()})

          const interestPayment = usdcVal(10)
          const expectedProtocolFee = interestPayment.div(new BN(10))
          const receipt = await tranchedPool.pay(interestPayment.add(usdcVal(99)))
          expectPaymentRelatedEventsEmitted(receipt, borrower, tranchedPool, {
            interest: interestPayment,
            principal: usdcVal(99),
            remaining: new BN(0),
            reserve: expectedProtocolFee,
          })

          let interestAmount, principalAmount
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Senior))
          // Senior interest and principal fully paid
          expect(interestAmount).to.bignumber.eq(usdcVal(56).div(new BN(10)))
          expect(principalAmount).to.bignumber.eq(usdcVal(80))
          // Junior interest fully paid, last 1$ of principal still outstanding
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Junior))
          expect(interestAmount).to.bignumber.eq(usdcVal(34).div(new BN(10)))
          expect(principalAmount).to.bignumber.eq(usdcVal(19))

          // Full 1$ protocol fee (10% of 10$ of total interest) collected
          expect(usdcVal(1)).to.bignumber.eq(expectedProtocolFee)
          expect(await usdc.balanceOf(treasury)).to.bignumber.eq(expectedProtocolFee)

          // 1$ of junior principal remaining, but any additional payment on top of that goes to junior interest
          const interestPayment2 = usdcVal(1)
          const expectedProtocolFee2 = interestPayment2.div(new BN(10))
          const receipt2 = await tranchedPool.pay(interestPayment2.add(usdcVal(1)))
          expectPaymentRelatedEventsEmitted(receipt2, borrower, tranchedPool, {
            interest: new BN(0),
            principal: usdcVal(1),
            remaining: interestPayment2,
            reserve: expectedProtocolFee2,
          })
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Senior))
          // Unchanged
          expect(interestAmount).to.bignumber.eq(usdcVal(56).div(new BN(10)))
          expect(principalAmount).to.bignumber.eq(usdcVal(80))
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Junior))
          // Additional 0.9 of interest (1$ - 10% protocol fee)
          expect(interestAmount).to.bignumber.eq(usdcVal(43).div(new BN(10)))
          // Principal unchanged, we don't expect any new principal back
          expect(principalAmount).to.bignumber.eq(usdcVal(20))

          // Additional 0.1$ of interest collected
          const expectedTotalProtocolFee = expectedProtocolFee.add(expectedProtocolFee2)
          expect(usdcVal(11).div(new BN(10))).to.bignumber.eq(expectedTotalProtocolFee)
          expect(await usdc.balanceOf(treasury)).to.bignumber.eq(expectedTotalProtocolFee)
        })
      })

      describe("early repayments", async () => {
        it("should apply the additional principal payment according to the leverage ratio", async () => {
          // Advance to the half way point
          const halfway = SECONDS_PER_DAY.mul(termInDays).div(new BN(2))
          await advanceTime({seconds: halfway.toNumber()})

          // Principal payment should be split by leverage ratio, while interest payment should be slightly less than half. This
          // is because interest is accrued from the most recent nextDueTime rather than the current timestamp.
          const expectedSeniorInterest = new BN("2761643")
          const expectedJuniorInterest = new BN("1676713")
          const expectedProtocolFee = new BN("493150")
          const totalPartialInterest = expectedSeniorInterest.add(expectedJuniorInterest).add(expectedProtocolFee)
          // 180.0 / 365 * 10 = 4.93150684931506 (180 because we round to the most recent time in paymentPeriodInDays)
          expect(totalPartialInterest).to.bignumber.eq(new BN("4931506"))

          const receipt = await tranchedPool.pay(usdcVal(50).add(totalPartialInterest), {from: borrower})
          expectPaymentRelatedEventsEmitted(receipt, borrower, tranchedPool, {
            interest: totalPartialInterest,
            principal: usdcVal(50),
            remaining: new BN(0),
            reserve: expectedProtocolFee,
          })

          let seniorInterestAmount, seniorPrincipalAmount, juniorInterestAmount, juniorPrincipalAmount
          ;[seniorInterestAmount, seniorPrincipalAmount] = await getTrancheAmounts(
            await tranchedPool.getTranche(TRANCHES.Senior)
          )
          expect(seniorInterestAmount).to.bignumber.eq(expectedSeniorInterest)
          expect(seniorPrincipalAmount).to.bignumber.eq(usdcVal(40))
          ;[juniorInterestAmount, juniorPrincipalAmount] = await getTrancheAmounts(
            await tranchedPool.getTranche(TRANCHES.Junior)
          )
          expect(juniorInterestAmount).to.bignumber.eq(expectedJuniorInterest)
          expect(juniorPrincipalAmount).to.bignumber.eq(usdcVal(10))

          expect(await usdc.balanceOf(treasury)).to.bignumber.eq(expectedProtocolFee)

          // Now advance to the end of the loan period and collect interest again. Now the total interest owed should
          // be the interested accrued above * 1.5 (i.e. with a 100$ drawdown and 10% interest, we accrue 5$ for the
          // first 6 months. And since we pay back 50% of principal in the middle, we accrued additional 50% of the 5$,
          // for a total of 7.5$ of interest at the end)

          await advanceTime({seconds: halfway.toNumber()})

          const receipt2 = await tranchedPool.assess()
          expectPaymentRelatedEventsNotEmitted(receipt2)

          // 185.0 / 365 * 5 = 2.5342465753424657 (185 because that's the number of days left in the term for interest to accrue)
          const remainingInterest = new BN("2534246")
          const expectedProtocolFee2 = remainingInterest.div(new BN(10))
          expect(await creditLine.interestOwed()).to.bignumber.eq(remainingInterest)
          expect(await creditLine.principalOwed()).to.bignumber.eq(usdcVal(50))

          // Collect the remaining interest and the principal
          const receipt3 = await tranchedPool.pay(usdcVal(50).add(remainingInterest), {from: borrower})
          expectPaymentRelatedEventsEmitted(receipt3, borrower, tranchedPool, {
            interest: remainingInterest,
            principal: usdcVal(50),
            remaining: new BN(0),
            reserve: expectedProtocolFee2,
          })
          ;[seniorInterestAmount, seniorPrincipalAmount] = await getTrancheAmounts(
            await tranchedPool.getTranche(TRANCHES.Senior)
          )
          // We would normally expect 7.5$ of total interest (10% interest on 100$ for 182.5 days and 10% interest on
          // 50$ for 182.5 days). But because we round to the nearest nextDueTime in the past, these amounts are slightly
          // less: we collected 10% interest on 100$ for 180 days and 10% interest on 50$ for 185 days. So total
          // interest collected is 7.465753424657534 rather than 7.5

          // Senior = 7.465753424657534 * (leverage ratio of 0.8) * (1- junior fee of 20% - protocol fee of 10%) = 4.18
          expect(seniorInterestAmount).to.bignumber.closeTo(usdcVal(418).div(new BN(100)), tolerance)
          expect(seniorPrincipalAmount).to.bignumber.eq(usdcVal(80))
          ;[juniorInterestAmount, juniorPrincipalAmount] = await getTrancheAmounts(
            await tranchedPool.getTranche(TRANCHES.Junior)
          )
          // Junior = 7.465753424657534 - senior interest - 10% protocol fee = 2.5383561643835613
          expect(juniorInterestAmount).to.bignumber.closeTo(usdcVal(2538).div(new BN(1000)), tolerance)
          expect(juniorPrincipalAmount).to.bignumber.eq(usdcVal(20))

          // Total protocol fee should be 10% of total interest
          const expectedTotalProtocolFee = expectedProtocolFee.add(expectedProtocolFee2)
          const totalInterest = totalPartialInterest.add(remainingInterest)
          expect(totalInterest.div(new BN(10))).to.bignumber.closeTo(expectedTotalProtocolFee, tolerance)
          expect(await usdc.balanceOf(treasury)).to.bignumber.eq(expectedTotalProtocolFee)
        })
      })

      describe("Calls PoolRewards", () => {
        it("Updates accRewardsPerPrincipalDollar", async () => {
          // Ensure a full term has passed
          await advanceTime({days: termInDays.toNumber()})
          let accRewardsPerPrincipalDollar = await poolRewards.pools(tranchedPool.address)
          expect(accRewardsPerPrincipalDollar).to.bignumber.equal(new BN(0))

          const receipt = await tranchedPool.pay(usdcVal(10).add(usdcVal(100)), {from: borrower})
          expectPaymentRelatedEventsEmitted(receipt, borrower, tranchedPool, {
            interest: usdcVal(10),
            principal: usdcVal(100),
            remaining: new BN(0),
            reserve: usdcVal(1),
          })

          expect(await creditLine.interestApr()).to.bignumber.eq(interestAprAsBN("10"))

          // 100$ loan, with 10% interest. 80% senior and 20% junior. Junior fee of 20%. Reserve fee of 10%
          // Senior share of interest 8$. Net interest = 8 * (100 - junior fee percent + reserve fee percent) = 5.6
          // Junior share of interest 2$. Net interest = 2 + (8 * junior fee percent) - (2 * reserve fee percent) = 3.4
          // Protocol fee = 1$. Total = 5.6 + 3.4 + 1 = 10
          let interestAmount, principalAmount
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Senior))
          expect(interestAmount).to.bignumber.eq(usdcVal(56).div(new BN(10)))
          expect(principalAmount).to.bignumber.eq(usdcVal(80))
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Junior))
          expect(interestAmount).to.bignumber.eq(usdcVal(34).div(new BN(10)))
          expect(principalAmount).to.bignumber.eq(usdcVal(20))

          expect(await usdc.balanceOf(treasury)).to.bignumber.eq(usdcVal(1))

          accRewardsPerPrincipalDollar = await poolRewards.pools(tranchedPool.address)
          expect(accRewardsPerPrincipalDollar).to.not.equal(new BN(0))
        })
      })
    })
  })

  describe.only("multiple drawdowns", async () => {
    let tranchedPool : TranchedPoolInstance, creditLine : CreditLineInstance
    beforeEach(async () => {
      interestApr = interestAprAsBN("10.00")
      termInDays = new BN(365)
      ;({ tranchedPool, creditLine } = await createPoolWithCreditLine({ interestApr, termInDays }))
    })

    async function depositAndGetTokenId(pool: TranchedPoolInstance, tranche, value): Promise<BN> {
      const receipt = await pool.deposit(tranche, value)
      const logs = decodeLogs<DepositMade>(receipt.receipt.rawLogs, tranchedPool, "DepositMade")
      return getFirstLog(logs).args.tokenId
    }

    async function expectAvailable(tokenId: BN, expectedInterestInUSD: string, expectedPrincipalInUSD: string) {
      const {"0": actualInterest, "1": actualPrincipal} = await tranchedPool.availableToWithdraw(tokenId)
      const halfCent = usdcVal(1).div(new BN(200))
      expect(actualInterest).to.bignumber.closeTo(new BN(parseFloat(expectedInterestInUSD) * 1e6), halfCent)
      expect(actualPrincipal).to.bignumber.closeTo(new BN(parseFloat(expectedPrincipalInUSD) * 1e6), halfCent)
    }

    it("distributes interest correctly across different drawdowns", async () => {
      let seniorInfo, juniorInfo
      const firstTrancheJunior = await depositAndGetTokenId(tranchedPool, TRANCHES.Junior, usdcVal(20))
      await tranchedPool.lockJuniorCapital({from: borrower})
      const firstTrancheSenior = await depositAndGetTokenId(tranchedPool, TRANCHES.Senior, usdcVal(80))
      await tranchedPool.lockPool({from: borrower})

      await tranchedPool.drawdown(usdcVal(100), {from: borrower})

      // Advance a quarter way through, and pay back what's owed. Then
      const halfOfTerm = termInDays.div(new BN(2))
      await advanceTime({days: halfOfTerm.toNumber() + 1})

      const expectedNetInterest = new BN("4438356")
      const expectedProtocolFee = new BN("493150")
      const expectedTotalInterest = expectedNetInterest.add(expectedProtocolFee)

      const receipt = await tranchedPool.pay(usdcVal(5), {from: borrower})
      expectPaymentRelatedEventsEmitted(receipt, borrower, tranchedPool, {
        interest: expectedTotalInterest,
        principal: new BN(68494),
        remaining: new BN(0),
        reserve: expectedProtocolFee,
      })
      await expectAvailable(firstTrancheJunior, "1.675", "0.01")
      await expectAvailable(firstTrancheSenior, "2.76", "0.05")

      seniorInfo = await tranchedPool.getTranche(TRANCHES.Senior)
      expect(await tranchedPool.sharePriceToUsdc(seniorInfo.interestSharePrice, seniorInfo.principalDeposited)).to.bignumber.eq(new BN(2761643))


      await tranchedPool.unlockPool({from: borrower})

      const secondTrancheJunior = await depositAndGetTokenId(tranchedPool, 4, usdcVal(60))
      await tranchedPool.lockJuniorCapital({from: borrower})
      const secondTrancheSenior = await depositAndGetTokenId(tranchedPool, 3, usdcVal(240))
      await tranchedPool.lockPool({from: borrower})

      await tranchedPool.drawdown(usdcVal(300), {from: borrower})

      // This won't be same, because when share price increased we didn't
      seniorInfo = await tranchedPool.getTranche(TRANCHES.Senior)
      expect(await tranchedPool.sharePriceToUsdc(seniorInfo.interestSharePrice, seniorInfo.principalDeposited)).to.bignumber.eq(new BN(2761643))


      await advanceTime({days: halfOfTerm.toNumber() + 1})
      await hre.ethers.provider.send("evm_mine", [])

      // Available to withdraw for initial depositors should not change
      await expectAvailable(firstTrancheJunior, "1.675", "0.01")
      await expectAvailable(firstTrancheSenior, "2.76", "0.05")

      const secondReceipt = await tranchedPool.pay(usdcVal(420), {from: borrower})
      expectPaymentRelatedEventsEmitted(secondReceipt, borrower, tranchedPool, {
        interest: new BN(20023919),
        principal: new BN(400000000).sub(new BN(68494)),
        remaining: new BN(44575),
        reserve: new BN(2006847),
      })
      expect(await creditLine.balance()).to.bignumber.eq("0")

      await expectAvailable(firstTrancheJunior, "3.400", "20.00")
      await expectAvailable(firstTrancheSenior, "5.553", "80.00")
      // TODO: This should be 5.10 and 8.4?
      await expectAvailable(secondTrancheJunior, "5.171", "60.00")
      await expectAvailable(secondTrancheSenior, "8.375", "240.00")
    })

    describe("when there is a shortfall", async () => {
      it("distributes the payment across all senior tranches first before junior", async () => {
        const firstTrancheJunior = await depositAndGetTokenId(tranchedPool, TRANCHES.Junior, usdcVal(20))
        await tranchedPool.lockJuniorCapital({from: borrower})
        const firstTrancheSenior = await depositAndGetTokenId(tranchedPool, TRANCHES.Senior, usdcVal(80))
        await tranchedPool.lockPool({from: borrower})

        await tranchedPool.drawdown(usdcVal(100), {from: borrower})

        // Advance a quarter way through, and pay back what's owed. Then
        const halfOfTerm = termInDays.div(new BN(2))
        await advanceTime({days: halfOfTerm.toNumber() + 1})

        await tranchedPool.pay(usdcVal(5), {from: borrower})
        await expectAvailable(firstTrancheJunior, "1.675", "0.01")
        await expectAvailable(firstTrancheSenior, "2.76", "0.05")

        await tranchedPool.unlockPool({from: borrower})

        const secondTrancheJunior = await depositAndGetTokenId(tranchedPool, 4, usdcVal(60))
        await tranchedPool.lockJuniorCapital({from: borrower})
        const secondTrancheSenior = await depositAndGetTokenId(tranchedPool, 3, usdcVal(240))
        await tranchedPool.lockPool({from: borrower})
        await tranchedPool.drawdown(usdcVal(300), {from: borrower})

        await advanceTime({days: halfOfTerm.toNumber() + 1})
        await hre.ethers.provider.send("evm_mine", [])

        // Pay 10$ of interest. This should go entirely to both senior tranche's interest
        await tranchedPool.pay(usdcVal(10), {from: borrower})

        // First tranche: Junior is unchanged. Senior receives it's share of interest
        await expectAvailable(firstTrancheJunior, "1.675", "0.01")
        await expectAvailable(firstTrancheSenior, "5.011", "0.05")
        // Second tranche: Junior doesn't receive anything yet. Senior receives it's share of interest. No principal yet
        await expectAvailable(secondTrancheJunior, "0", "0")
        await expectAvailable(secondTrancheSenior, "6.75", "0")

        // Pay remaining interest and partial interest payment
        await tranchedPool.pay(usdcVal(110), {from: borrower})
        // First tranche: Junior receives remaining interest, no principal. Senior receives it's share of principal
        await expectAvailable(firstTrancheJunior, "3.390", "0.01")
        await expectAvailable(firstTrancheSenior, "5.553", "25.04")

        // await expectAvailable(firstTrancheJunior, new BN(3390246), new BN(13698))
        // await expectAvailable(firstTrancheSenior, new BN(5553492), new BN(25048815))
        // Second tranche: Junior receives remaining interest, no principal. Senior receives it's share of principal
        await expectAvailable(secondTrancheJunior, "5.140", "0")
        await expectAvailable(secondTrancheSenior, "8.375", "74.99")

        // await expectAvailable(secondTrancheJunior, new BN(5140597), new BN(0))
        // await expectAvailable(secondTrancheSenior, new BN(8375547), new BN(74982060))

        // pay off remaining
        await tranchedPool.pay(usdcVal(300), {from: borrower})
        expect(await creditLine.balance()).to.bignumber.eq("0")
        // Everyone made whole
        await expectAvailable(firstTrancheJunior, "3.399", "20.00")
        await expectAvailable(firstTrancheSenior, "5.553", "80.00")
        await expectAvailable(secondTrancheJunior, "5.171", "60.00")
        await expectAvailable(secondTrancheSenior, "8.375", "240.00")
      })
    })

    describe("when the principal was drawn down disproportionately", async () => {
      it("distributes interest according to ratio of principal deployed", async () => {
        const firstTrancheJunior = await depositAndGetTokenId(tranchedPool, TRANCHES.Junior, usdcVal(40))
        await tranchedPool.lockJuniorCapital({from: borrower})
        const firstTrancheSenior = await depositAndGetTokenId(tranchedPool, TRANCHES.Senior, usdcVal(160))
        await tranchedPool.lockPool({from: borrower})

        await tranchedPool.drawdown(usdcVal(100), {from: borrower})

        // Advance a quarter way through, and pay back what's owed. Then
        const halfOfTerm = termInDays.div(new BN(2))
        await advanceTime({days: halfOfTerm.toNumber() + 1})

        await tranchedPool.pay(usdcVal(5), {from: borrower})
        await expectAvailable(firstTrancheJunior, "1.675", "20.01")
        await expectAvailable(firstTrancheSenior, "2.76", "80.05")

        await tranchedPool.unlockPool({from: borrower})
        const secondTrancheJunior = await depositAndGetTokenId(tranchedPool, 4, usdcVal(60))
        await tranchedPool.lockJuniorCapital({from: borrower})
        const secondTrancheSenior = await depositAndGetTokenId(tranchedPool, 3, usdcVal(240))
        await tranchedPool.lockPool({from: borrower})

        await tranchedPool.drawdown(usdcVal(300), {from: borrower})

        await advanceTime({days: halfOfTerm.toNumber() + 1})
        await hre.ethers.provider.send("evm_mine", [])

        // Available to withdraw for initial depositors should not change
        await expectAvailable(firstTrancheJunior, "1.675", "20.01")
        await expectAvailable(firstTrancheSenior, "2.76", "80.05")

        await tranchedPool.pay(usdcVal(420), {from: borrower})
        expect(await creditLine.balance()).to.bignumber.eq("0")

        await expectAvailable(firstTrancheJunior, "3.399", "40.00")
        await expectAvailable(firstTrancheSenior, "5.553", "160.00")
        await expectAvailable(secondTrancheJunior, "5.171", "60.00")
        await expectAvailable(secondTrancheSenior, "8.375", "240.00")
      })
    })
  })

  describe("updateGoldfinchConfig", async () => {
    describe("setting it", async () => {
      it("emits an event", async () => {
        const newConfig = await deployments.deploy("GoldfinchConfig", {from: owner})

        await goldfinchConfig.setGoldfinchConfig(newConfig.address)
        const tx = await tranchedPool.updateGoldfinchConfig({from: owner})
        expectEvent(tx, "GoldfinchConfigUpdated", {
          who: owner,
          configAddress: newConfig.address,
        })
      })
    })
  })
})
