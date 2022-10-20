/* global web3 */
import {
  interestAprAsBN,
  TRANCHES,
  MAX_UINT,
  OWNER_ROLE,
  PAUSER_ROLE,
  ETHDecimals,
} from "../blockchain_scripts/deployHelpers"
import {CONFIG_KEYS} from "../blockchain_scripts/configKeys"
import hre from "hardhat"
const {deployments, artifacts} = hre
const CreditLine = artifacts.require("CreditLine")
import {
  advanceTime,
  expect,
  BN,
  getBalance,
  erc20Transfer,
  erc20Approve,
  expectAction,
  decimals,
  USDC_DECIMALS,
  SECONDS_PER_DAY,
  usdcVal,
  fiduTolerance,
  tolerance,
  decodeLogs,
  decodeAndGetFirstLog,
  ZERO,
  Numberish,
  fiduVal,
  HALF_CENT,
  getCurrentTimestamp,
  advanceAndMineBlock,
} from "./testHelpers"
import {expectEvent} from "@openzeppelin/test-helpers"
import {ecsign} from "ethereumjs-util"
import {getApprovalDigest, getWallet} from "./permitHelpers"
import {assertNonNullable} from "@goldfinch-eng/utils"
import {
  deployBaseFixture,
  deployUninitializedCreditLineFixture,
  deployUninitializedTranchedPoolFixture,
  deployTranchedPoolWithGoldfinchFactoryFixture,
} from "./util/fixtures"
import {DepositMade, InvestmentMadeInSenior, WithdrawalMade} from "../typechain/truffle/SeniorPool"
import {
  GoInstance,
  TestSeniorPoolCallerInstance,
  TestSeniorPoolInstance,
  TestUniqueIdentityInstance,
  WithdrawalRequestTokenInstance,
} from "../typechain/truffle"

import chai from "chai"
import {burn, mint} from "./uniqueIdentityHelpers"
chai.config.truncateThreshold = 0 // disable truncating

const TEST_TIMEOUT = 30_000
const TWO_WEEKS = SECONDS_PER_DAY.mul(new BN(14))

const simulateMaliciousTranchedPool = async (goldfinchConfig: any, person2: any): Promise<string> => {
  // Simulate someone deploying their own malicious TranchedPool using our contracts
  const {tranchedPool: unknownPool} = await deployUninitializedTranchedPoolFixture()
  const {creditLine} = await deployUninitializedCreditLineFixture()
  await creditLine.initialize(
    goldfinchConfig.address,
    person2,
    person2,
    usdcVal(1000),
    interestAprAsBN("0"),
    new BN(1),
    new BN(10),
    interestAprAsBN("0"),
    new BN(30)
  )
  await unknownPool.initialize(
    goldfinchConfig.address,
    person2,
    new BN(20),
    usdcVal(1000),
    interestAprAsBN("0"),
    new BN(1),
    new BN(10),
    interestAprAsBN("0"),
    new BN(30),
    new BN(0),
    []
  )
  await unknownPool.lockJuniorCapital({from: person2})

  return unknownPool.address
}

describe("SeniorPool", () => {
  let accounts, owner, person2, person3, person4, reserve, borrower

  let seniorPool: TestSeniorPoolInstance,
    seniorPoolCaller: TestSeniorPoolCallerInstance,
    seniorPoolFixedStrategy,
    usdc,
    fidu,
    goldfinchConfig,
    tranchedPool,
    creditLine,
    uniqueIdentity: TestUniqueIdentityInstance,
    withdrawalRequestToken: WithdrawalRequestTokenInstance,
    go: GoInstance
  let epochsInitializedAt: BN

  const interestApr = interestAprAsBN("5.00")
  const paymentPeriodInDays = new BN(30)
  const lateFeeApr = new BN(0)
  const limit = usdcVal(100000)
  const termInDays = new BN(365)
  const juniorFeePercent = new BN(20)
  const depositAmount = new BN(4).mul(USDC_DECIMALS)
  const withdrawAmount = new BN(2).mul(USDC_DECIMALS)
  const decimalsDelta = decimals.div(USDC_DECIMALS)

  const makeDeposit = async (person?: string, amount?: BN) => {
    amount = amount || depositAmount
    person = person || person2
    return await seniorPool.deposit(String(amount), {from: person})
  }
  const makeWithdraw = async (person?: string, usdcAmount?: BN) => {
    usdcAmount = usdcAmount || withdrawAmount
    person = person || person2
    return await seniorPool.withdraw(usdcAmount, {from: person})
  }

  const makeWithdrawInFidu = async (person, fiduAmount) => {
    return await seniorPool.withdrawInFidu(fiduAmount, {from: person})
  }

  const setupTest = deployments.createFixture(async ({deployments}) => {
    const {
      seniorPool: _seniorPool,
      seniorPoolCaller,
      seniorPoolFixedStrategy,
      usdc,
      fidu,
      goldfinchFactory,
      goldfinchConfig,
      poolTokens,
      uniqueIdentity,
      withdrawalRequestToken,
      go,
    } = await deployBaseFixture()
    // A bit of setup for our test users
    await erc20Approve(fidu, _seniorPool.address, fiduVal(100_000_000), [person2, person3, owner])
    await erc20Approve(usdc, _seniorPool.address, usdcVal(100_000_000), [person2, person3, owner])
    await erc20Transfer(usdc, [person2, person3, person4], usdcVal(100_000), owner)
    await goldfinchConfig.setTreasuryReserve(reserve)

    await goldfinchConfig.bulkAddToGoList([owner, person2, person3, person4, reserve, _seniorPool.address])
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({tranchedPool, creditLine} = await deployTranchedPoolWithGoldfinchFactoryFixture({
      borrower,
      usdcAddress: usdc.address,
      limit,
      interestApr,
      paymentPeriodInDays,
      termInDays,
      lateFeeApr,
      juniorFeePercent,
      id: "TranchedPool",
    }))

    const firstEpochEndsAt = new BN((await (_seniorPool as TestSeniorPoolInstance).epochAt("0")).endsAt)
    epochsInitializedAt = firstEpochEndsAt

    return {
      usdc,
      seniorPool: _seniorPool as TestSeniorPoolInstance,
      seniorPoolCaller,
      seniorPoolFixedStrategy,
      tranchedPool,
      creditLine,
      fidu,
      goldfinchConfig,
      poolTokens,
      uniqueIdentity,
      withdrawalRequestToken,
      go,
    }
  })

  beforeEach(async () => {
    // Pull in our unlocked accounts
    accounts = await web3.eth.getAccounts()
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;[owner, person2, person3, reserve, person4] = accounts
    borrower = person2
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({
      usdc,
      seniorPool,
      seniorPoolCaller,
      seniorPoolFixedStrategy,
      tranchedPool,
      creditLine,
      fidu,
      goldfinchConfig,
      uniqueIdentity,
      withdrawalRequestToken,
      go,
    } = await setupTest())
  })

  describe("Access Controls", () => {
    it("sets the owner", async () => {
      expect(await seniorPool.hasRole(OWNER_ROLE, owner)).to.equal(true)
      expect(await seniorPool.getRoleAdmin(OWNER_ROLE)).to.equal(OWNER_ROLE)
    })

    it("sets the pauser", async () => {
      expect(await seniorPool.hasRole(PAUSER_ROLE, owner)).to.equal(true)
      expect(await seniorPool.getRoleAdmin(PAUSER_ROLE)).to.equal(OWNER_ROLE)
    })

    it("allows the owner to set new addresses as roles", async () => {
      expect(await seniorPool.hasRole(OWNER_ROLE, person2)).to.equal(false)
      await seniorPool.grantRole(OWNER_ROLE, person2, {from: owner})
      expect(await seniorPool.hasRole(OWNER_ROLE, person2)).to.equal(true)
    })

    it("should not allow anyone else to add an owner", async () => {
      return expect(seniorPool.grantRole(OWNER_ROLE, person2, {from: person3})).to.be.rejected
    })
  })

  describe("Pausability", () => {
    describe("after pausing", async () => {
      const testSetup = deployments.createFixture(async () => {
        await makeDeposit()
        await seniorPool.pause()
        await goldfinchConfig.addToGoList(seniorPool.address)
      })

      beforeEach(async () => {
        await testSetup()
      })

      it("disallows deposits", async () => {
        return expect(makeDeposit()).to.be.rejectedWith(/Pausable: paused/)
      })

      it("disallows withdrawing", async () => {
        return expect(makeWithdraw()).to.be.rejectedWith(/Pausable: paused/)
      })

      it("disallows withdrawing in FIDU", async () => {
        return expect(makeWithdrawInFidu(person2, fiduVal(100))).to.be.rejectedWith(/Pausable: paused/)
      })

      it("disallows invest", async () => {
        await expect(seniorPool.invest(tranchedPool.address)).to.be.rejectedWith(/Pausable: paused/)
      })

      it("disallows redeem", async () => {
        return expect(seniorPool.redeem(tranchedPool.address)).to.be.rejectedWith(/Pausable: paused/)
      })

      it("disallows writedown", async () => {
        return expect(seniorPool.writedown(tranchedPool.address)).to.be.rejectedWith(/Pausable: paused/)
      })

      it("disallows withdrawal requests", async () => {
        await expect(seniorPool.requestWithdrawal(usdcVal(100), {from: person2})).to.be.rejectedWith(/Pausable: paused/)
      })

      it("disallows adding to a withdrawal request", async () => {
        await expect(seniorPool.addToWithdrawalRequest(usdcVal(100), "1", {from: person2})).to.be.rejectedWith(
          /Pausable: paused/
        )
      })

      it("disallows cancelling a withdrawal request", async () => {
        await expect(seniorPool.cancelWithdrawalRequest(usdcVal(100), {from: person2})).to.be.rejectedWith(
          /Pausable: paused/
        )
      })

      it("disallows claiming a withdrawal request", async () => {
        await expect(seniorPool.claimWithdrawalRequest("1", {from: person2})).to.be.rejectedWith(/Pausable: paused/)
      })

      it("allows unpausing", async () => {
        await seniorPool.unpause()
        return expect(makeDeposit()).to.be.fulfilled
      })
    })

    describe("actually pausing", async () => {
      it("should allow the owner to pause", async () => {
        return expect(seniorPool.pause()).to.be.fulfilled
      })
      it("should disallow non-owner to pause", async () => {
        return expect(seniorPool.pause({from: person2})).to.be.rejectedWith(/NA/)
      })
    })
  })

  describe("deposit", () => {
    describe("before you have approved the senior pool to transfer funds on your behalf", async () => {
      it("should fail", async () => {
        await expect(makeDeposit(person4)).to.be.rejectedWith(/transfer amount exceeds allowance/)
      })
    })

    describe("after you have approved the senior pool to transfer funds", async () => {
      let capitalProvider

      const testSetup = deployments.createFixture(async () => {
        await usdc.approve(seniorPool.address, new BN(100000).mul(USDC_DECIMALS), {from: person2})
        await usdc.approve(seniorPool.address, new BN(100000).mul(USDC_DECIMALS), {from: owner})
        capitalProvider = person2
      })

      beforeEach(async () => {
        await testSetup()
      })

      it("increases usdcAvailable", async () => {
        await expectAction(() => makeDeposit(person2, usdcVal(10_000))).toChange([
          [seniorPool.usdcAvailable, {by: usdcVal(10_000)}],
        ])
      })

      describe("epoch checkpointing", () => {
        it("liquidates if an epoch ended after the last checkpoint", async () => {
          await makeDeposit(person2, usdcVal(10_000))
          await seniorPool.requestWithdrawal(fiduVal(4000), {from: person2})
          // This deposit will trigger liquidation. We have $10K USDC avaialable - 4K/1.00 = $4K fidu requested
          // So $6K uscdAvailable left over. Depositing $1K more results in $7K usdc available
          await advanceTime({days: 14})
          await expectAction(() => makeDeposit(person2, usdcVal(1000))).toChange([
            [seniorPool.usdcAvailable, {to: usdcVal(7000)}],
          ])
          const liquidatedEpoch = await seniorPool.epochAt("1")
          expect(liquidatedEpoch.fiduLiquidated).to.bignumber.eq(fiduVal(4000))
          expect(liquidatedEpoch.usdcAllocated).to.bignumber.eq(usdcVal(4000))
        })
        it("liquidates if multiple epochs ended after the last checkpoint", async () => {
          await makeDeposit(person2, usdcVal(10_000))
          await seniorPool.requestWithdrawal(fiduVal(4_000), {from: person2})
          // This deposit will trigger liquidation. We have $10K USDC avaialable - 4K/1.00 = $4K fidu requested
          // So $6K uscdAvailable left over. Depositing $1K more results in $7K usdc available
          await advanceTime({days: 28})
          await expectAction(() => makeDeposit(person2, usdcVal(1000))).toChange([
            [seniorPool.usdcAvailable, {to: usdcVal(7000)}],
          ])
          const liquidatedEpoch = await seniorPool.epochAt("1")
          expect(liquidatedEpoch.fiduLiquidated).to.bignumber.eq(fiduVal(4000))
          expect(liquidatedEpoch.usdcAllocated).to.bignumber.eq(usdcVal(4000))
          // endsAt should be stretched to 1 month
          const prevEpoch = await seniorPool.epochAt("0")
          const expectedEndsAt = new BN(prevEpoch.endsAt).add(SECONDS_PER_DAY.mul(new BN(28)))
          expect(liquidatedEpoch.endsAt).to.bignumber.eq(expectedEndsAt)
        })
      })

      it("increases the senior pool's balance of the ERC20 token when you call deposit", async () => {
        const balanceBefore = await getBalance(seniorPool.address, usdc)
        await makeDeposit()
        const balanceAfter = await getBalance(seniorPool.address, usdc)
        const delta = balanceAfter.sub(balanceBefore)
        expect(delta).to.bignumber.equal(depositAmount)
      })

      it("decreases the depositors balance of the ERC20 token when you call deposit", async () => {
        const balanceBefore = await getBalance(capitalProvider, usdc)
        await makeDeposit()
        const balanceAfter = await getBalance(capitalProvider, usdc)
        const delta = balanceBefore.sub(balanceAfter)
        expect(delta).to.bignumber.equal(depositAmount)
      })

      it("gives the depositor the correct amount of Fidu", async () => {
        await makeDeposit()
        const fiduBalance = await getBalance(person2, fidu)
        expect(fiduBalance).to.bignumber.equal(depositAmount.mul(decimalsDelta))
      })

      it("tracks other accounting correctly on Fidu", async () => {
        const totalSupplyBefore = await fidu.totalSupply()
        await makeDeposit()
        const totalSupplyAfter = await fidu.totalSupply()
        expect(totalSupplyAfter.sub(totalSupplyBefore)).to.bignumber.equal(depositAmount.mul(decimalsDelta))
      })

      it("emits an event with the correct data", async () => {
        const result = await makeDeposit()
        const event = decodeAndGetFirstLog<DepositMade>(result.receipt.rawLogs, seniorPool, "DepositMade")

        expect(event.event).to.equal("DepositMade")
        expect(event.args.capitalProvider).to.equal(capitalProvider)
        expect(event.args.amount).to.bignumber.equal(depositAmount)
        expect(event.args.shares).to.bignumber.equal(depositAmount.mul(decimalsDelta))
      })

      it("increases the totalShares, even when two different people deposit", async () => {
        const secondDepositAmount = new BN(1).mul(USDC_DECIMALS)
        await makeDeposit()
        await makeDeposit(owner, secondDepositAmount)
        const totalShares = await fidu.totalSupply()
        const totalDeposited = depositAmount.mul(decimalsDelta).add(secondDepositAmount.mul(decimalsDelta))
        expect(totalShares).to.bignumber.equal(totalDeposited)
      })
    })
  })

  describe("depositWithPermit", async () => {
    async function getSignature(user: string, value: Numberish) {
      const nonce = await usdc.nonces(user)
      const deadline = MAX_UINT
      const digest = await getApprovalDigest({
        token: usdc,
        owner: user,
        spender: seniorPool.address.toLowerCase(),
        value,
        nonce,
        deadline,
      })
      const wallet = await getWallet(user)
      assertNonNullable(wallet)
      return ecsign(Buffer.from(digest.slice(2), "hex"), Buffer.from(wallet.privateKey.slice(2), "hex"))
    }

    it("deposits with permit", async () => {
      const {v, r, s} = await getSignature(person2.toLowerCase(), usdcVal(100))
      await expectAction(() =>
        (seniorPool as any).depositWithPermit(usdcVal(100), MAX_UINT, v, r, s, {
          from: person2,
        })
      ).toChange([
        [() => getBalance(person2, usdc), {by: usdcVal(100).neg()}],
        [() => getBalance(seniorPool.address, usdc), {by: usdcVal(100)}],
        [() => getBalance(person2, fidu), {by: usdcVal(100).mul(decimalsDelta)}],
      ])

      // Verify that permit creates allowance for amount only
      expect(await usdc.allowance(person2, seniorPool.address)).to.bignumber.eq("0")
    })

    it("increases usdcAvailable by deposited amount", async () => {
      const {v, r, s} = await getSignature(person2, usdcVal(100))
      await expectAction(() =>
        (seniorPool as any).depositWithPermit(usdcVal(100), MAX_UINT, v, r, s, {from: person2})
      ).toChange([[seniorPool.usdcAvailable, {by: usdcVal(100)}]])
    })

    describe("epoch checkpointing", () => {
      it("liquidates if an epoch ended after the last checkpoint", async () => {
        await makeDeposit(person2, usdcVal(1000))
        await seniorPool.requestWithdrawal(fiduVal(200), {from: person2})

        await advanceTime({days: 14})
        const {v, r, s} = await getSignature(person2, usdcVal(100))
        await expectAction(() =>
          (seniorPool as any).depositWithPermit(usdcVal(100), MAX_UINT, v, r, s, {from: person2})
        ).toChange([[seniorPool.usdcAvailable, {to: usdcVal(900)}]])

        const liquidatedEpoch = await seniorPool.epochAt("1")
        expect(liquidatedEpoch.fiduLiquidated).to.bignumber.eq(fiduVal(200))
        expect(liquidatedEpoch.usdcAllocated).to.bignumber.eq(usdcVal(200))
      })
      it("liquidates if liquidates if multiple epochs ended after the last checkpoint", async () => {
        await makeDeposit(person2, usdcVal(1000))
        await seniorPool.requestWithdrawal(fiduVal(200), {from: person2})

        await advanceTime({days: 28})
        const {v, r, s} = await getSignature(person2, usdcVal(100))
        await expectAction(() =>
          (seniorPool as any).depositWithPermit(usdcVal(100), MAX_UINT, v, r, s, {from: person2})
        ).toChange([[seniorPool.usdcAvailable, {to: usdcVal(900)}]])

        const liquidatedEpoch = await seniorPool.epochAt("1")
        expect(liquidatedEpoch.fiduLiquidated).to.bignumber.eq(fiduVal(200))
        expect(liquidatedEpoch.usdcAllocated).to.bignumber.eq(usdcVal(200))
        // endsAt should be stretched to 1 month
        const prevEpoch = await seniorPool.epochAt("0")
        const expectedEndsAt = new BN(prevEpoch.endsAt).add(SECONDS_PER_DAY.mul(new BN(28)))
        expect(liquidatedEpoch.endsAt).to.bignumber.eq(expectedEndsAt)
      })
    })
  })

  describe("getNumShares", () => {
    it("calculates correctly", async () => {
      const amount = 3000
      const sharePrice = await seniorPool.sharePrice()
      const numShares = await seniorPool._getNumShares(amount)
      expect(numShares).to.bignumber.equal(
        new BN(amount).mul(decimals.div(USDC_DECIMALS)).mul(decimals).div(sharePrice)
      )
    })
  })

  describe("withdraw", () => {
    let capitalProvider

    const testSetup = deployments.createFixture(async () => {
      await usdc.approve(seniorPool.address, new BN(100000).mul(USDC_DECIMALS), {from: person2})
      await usdc.approve(seniorPool.address, new BN(100000).mul(USDC_DECIMALS), {from: owner})

      capitalProvider = person2
      await seniorPool.grantRole(await seniorPool.ZAPPER_ROLE(), capitalProvider, {from: owner})
    })

    beforeEach(async () => {
      await testSetup()
    })

    it("withdraws the correct amount of value from the contract when you call withdraw", async () => {
      await makeDeposit()
      const balanceBefore = await getBalance(seniorPool.address, usdc)
      await makeWithdraw()
      const balanceAfter = await getBalance(seniorPool.address, usdc)
      const delta = balanceBefore.sub(balanceAfter)
      expect(delta).to.bignumber.equal(withdrawAmount)
    })

    it("emits an event with the correct data", async () => {
      await makeDeposit()
      const result = await makeWithdraw()
      const event = decodeAndGetFirstLog<WithdrawalMade>(result.receipt.rawLogs, seniorPool, "WithdrawalMade")
      const reserveAmount = withdrawAmount.div(new BN(200))

      expect(event.event).to.equal("WithdrawalMade")
      expect(event.args.capitalProvider).to.equal(capitalProvider)
      expect(event.args.reserveAmount).to.bignumber.equal(ZERO)
      expect(event.args.userAmount).to.bignumber.equal(withdrawAmount)
    })

    it("sends the amount back to the address, accounting for fees", async () => {
      await makeDeposit()
      const addressValueBefore = await getBalance(person2, usdc)
      await makeWithdraw()
      const addressValueAfter = await getBalance(person2, usdc)
      const expectedFee = ZERO
      const delta = addressValueAfter.sub(addressValueBefore)
      expect(delta).bignumber.equal(withdrawAmount.sub(expectedFee))
    })

    it("reduces your shares of fidu", async () => {
      await makeDeposit()
      const balanceBefore = await getBalance(person2, fidu)
      await makeWithdraw()
      const balanceAfter = await getBalance(person2, fidu)
      const expectedShares = balanceBefore.sub(withdrawAmount.mul(decimals).div(USDC_DECIMALS))
      expect(balanceAfter).to.bignumber.equal(expectedShares)
    })

    it("decreases the totalSupply of Fidu", async () => {
      await makeDeposit()
      const sharesBefore = await fidu.totalSupply()
      await makeWithdraw()
      const sharesAfter = await fidu.totalSupply()
      const expectedShares = sharesBefore.sub(withdrawAmount.mul(decimals.div(USDC_DECIMALS)))
      expect(sharesAfter).to.bignumber.equal(expectedShares)
    })

    it("lets you withdraw in fidu terms", async () => {
      await makeDeposit()
      const fiduBalance = await getBalance(person2, fidu)
      expect(fiduBalance).to.bignumber.gt(new BN("0"))

      await expectAction(() => {
        return makeWithdrawInFidu(person2, fiduBalance)
      }).toChange([
        [() => getBalance(person2, usdc), {byCloseTo: usdcVal(4)}], // Not exactly the same as input due to fees
        [() => getBalance(person2, fidu), {to: new BN(0)}], // All fidu deducted
        [() => getBalance(seniorPool.address, usdc), {to: new BN(0)}], // Should have removed the full balance
        [() => fidu.totalSupply(), {by: fiduBalance.neg()}], // Fidu has been burned
      ])
    })

    it("prevents you from withdrawing more than you have", async () => {
      const expectedErr = /Amount requested is greater than what this address owns/
      await expect(makeWithdraw()).to.be.rejectedWith(expectedErr)
      await expect(makeWithdrawInFidu(person2, withdrawAmount)).to.be.rejectedWith(expectedErr)
    })

    it("it lets you withdraw your exact total holdings", async () => {
      await makeDeposit(person2, new BN("123"))
      await makeWithdraw(person2, new BN("123"))
      const sharesAfter = await getBalance(person2, fidu)
      expect(sharesAfter.toNumber()).to.equal(0)
    })

    describe("authorization", () => {
      it("rejects caller without ZAPPER_ROLE", async () => {
        await seniorPool.deposit(usdcVal(100), {from: person3})
        await expect(seniorPool.withdraw(usdcVal(100), {from: person3})).to.be.rejectedWith(/Not Zapper/)
        await expect(seniorPool.withdrawInFidu(fiduVal(100), {from: person3})).to.be.rejectedWith(/Not Zapper/)
      })
    })
  })

  describe("requestWithdrawal", () => {
    describe("authorization", () => {
      let supportedIdTypes
      let expiresAt
      beforeEach(async () => {
        await goldfinchConfig.bulkRemoveFromGoList([person2], {from: owner})
        expiresAt = (await getCurrentTimestamp()).add(SECONDS_PER_DAY)
        // Add one supported UID type that is NOT eligible to interact with the senior pool
        const seniorPoolIds = await go.getSeniorPoolIdTypes()
        supportedIdTypes = [...seniorPoolIds, new BN(5)]
        await uniqueIdentity.setSupportedUIDTypes(
          supportedIdTypes,
          supportedIdTypes.map(() => true),
          {from: owner}
        )
      })
      describe("when caller == tx.origin", () => {
        it("works when caller go-listed", async () => {
          await goldfinchConfig.bulkAddToGoList([person2], {from: owner})
          await makeDeposit(person2, usdcVal(100))
          await expectAction(() => seniorPool.requestWithdrawal(fiduVal(100), {from: person2})).toChange([
            [() => fidu.balanceOf(person2), {by: fiduVal(100).neg()}],
          ])
        })
        it("works when caller has senior-pool UID", async () => {
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, person2)
          await makeDeposit(person2, usdcVal(100))
          await expectAction(() => seniorPool.requestWithdrawal(fiduVal(100), {from: person2})).toChange([
            [() => fidu.balanceOf(person2), {by: fiduVal(100).neg()}],
          ])
        })
        it("reverts when caller has non-senior-pool UID", async () => {
          await mint(hre, uniqueIdentity, new BN(5), expiresAt, new BN(0), owner, undefined, person2)
          await expect(seniorPool.requestWithdrawal(fiduVal(100), {from: person2})).to.be.rejectedWith(/NA/)
        })
        it("reverts when caller has no UID and not go-listed", async () => {
          await expect(seniorPool.requestWithdrawal(fiduVal(100), {from: person2})).to.be.rejectedWith(/NA/)
        })
      })
      describe("when caller != tx.origin", () => {
        it("works when tx.origin has senior-pool UID and caller is ERC1155 approved", async () => {
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, person2)
          await uniqueIdentity.setApprovalForAll(seniorPoolCaller.address, true, {from: person2})
          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await seniorPoolCaller.deposit(usdcVal(100), {from: person2})
          await expectAction(() => seniorPoolCaller.requestWithdrawal(fiduVal(100), {from: person2})).toChange([
            [() => fidu.balanceOf(seniorPoolCaller.address), {by: fiduVal(100).neg()}],
          ])
        })

        it("reverts when tx.origin has non-senior-pool UID and caller is ERC1155 approved", async () => {
          await mint(hre, uniqueIdentity, new BN(5), expiresAt, new BN(0), owner, undefined, person2)
          await uniqueIdentity.setApprovalForAll(seniorPoolCaller.address, true, {from: person2})
          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await expect(seniorPoolCaller.requestWithdrawal(fiduVal(100), {from: person2})).to.be.rejectedWith(/NA/)
        })

        // TODO - we cannot mint to seniorPoolCaller until UniqueIdentity's mintTo functionality is merged in
        // TODO - when we add sybil resistance
        it.skip("reverts when tx.origin has senior-pool UID and caller has senior-pool UID", async () => {
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, person2)
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, seniorPoolCaller.address)
          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await seniorPoolCaller.deposit(usdcVal(100), {from: person2})
          await expect(seniorPoolCaller.requestWithdrawal(fiduVal(100), {from: person2})).to.be.rejectedWith(
            /Ambiguous/
          )
        })

        // TODO - when we add sybil resistance
        it.skip("reverts when tx.origin has senior-pool UID and caller go-listed", async () => {
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, person2)
          await goldfinchConfig.bulkAddToGoList([seniorPoolCaller.address])
          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await seniorPoolCaller.deposit(usdcVal(100), {from: person2})
          await expect(seniorPoolCaller.requestWithdrawal(fiduVal(100), {from: person2})).to.be.rejectedWith(
            /Ambiguous/
          )
        })

        it("reverts when tx.origin has senior-pool UID and caller has nothing", async () => {
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, person2)
          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await expect(seniorPoolCaller.requestWithdrawal(fiduVal(100), {from: person2})).to.be.rejectedWith(/NA/)
        })

        // TODO - we cannot mint to seniorPoolCaller until UniqueIdentity's mintTo functionality is merged in
        // TODO - when we add sybil resistance
        it.skip("works when tx.origin has nothing and caller has senior-pool UID", async () => {
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, seniorPoolCaller.address)
          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await seniorPoolCaller.deposit(usdcVal(100), {from: person2})
          await expectAction(() => seniorPoolCaller.requestWithdrawal(fiduVal(100), {from: person2})).toChange([
            [() => fidu.balanceOf(seniorPoolCaller.address), {by: fiduVal(100).neg()}],
          ])
        })

        // TODO - we cannot mint to seniorPoolCaller until UniqueIdentity's mintTo functionality is merged in
        // TODO - when we add sybil resistance
        it.skip("reverts when tx.origin has nothing and caller has non-senior-pool UID", async () => {
          await mint(hre, uniqueIdentity, new BN(5), expiresAt, new BN(0), owner, undefined, seniorPoolCaller.address)
          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await expect(seniorPoolCaller.requestWithdrawal(fiduVal(100), {from: person2})).to.be.rejectedWith(
            /Unauthorized/
          )
        })

        it("works when tx.origin has nothing and caller is go-listed", async () => {
          await goldfinchConfig.bulkAddToGoList([seniorPoolCaller.address], {from: owner})
          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await seniorPoolCaller.deposit(usdcVal(100), {from: person2})
          await expectAction(() => seniorPoolCaller.requestWithdrawal(fiduVal(100), {from: person2})).toChange([
            [() => fidu.balanceOf(seniorPoolCaller.address), {by: fiduVal(100).neg()}],
          ])
        })
      })
    })

    describe("when the user has approved the contract to take custody of their assets", () => {
      it("succeeds", async () => {
        // Deposit and then request to withdraw
        await makeDeposit(person2, usdcVal(5000))
        await expectAction(() => seniorPool.requestWithdrawal(fiduVal(5000), {from: person2})).toChange([
          [() => fidu.balanceOf(seniorPool.address), {by: fiduVal(5000)}],
          [() => fidu.balanceOf(person2), {by: fiduVal(5000).neg()}],
        ])

        const withdrawal = await seniorPool.withdrawalRequest("1")
        expect(withdrawal.epochCursor).to.equal("1")
        expect(withdrawal.fiduRequested).to.bignumber.to.equal(fiduVal(5000))

        // Epoch 0 should have 500 requested and $500 in
        const epoch = await seniorPool.currentEpoch()
        expect(epoch.fiduRequested).to.bignumber.eq(fiduVal(5000))
      })

      it("reverts if caller has an outstanding request", async () => {
        await seniorPool.deposit(usdcVal(100), {from: person2})
        await seniorPool.requestWithdrawal(fiduVal(100), {from: person2})
        await expect(seniorPool.requestWithdrawal(fiduVal(100), {from: person2})).to.be.rejectedWith(/Existing request/)
      })

      it("reverts if requested amount exceeds balance", async () => {
        await seniorPool.deposit(usdcVal(1000), {from: person2})
        await expect(seniorPool.requestWithdrawal(fiduVal(1001), {from: person2})).to.be.rejectedWith(
          /SafeERC20: low-level call failed/
        )
      })

      it("emits an event", async () => {
        await seniorPool.deposit(usdcVal(1000), {from: person2})

        const res = await seniorPool.requestWithdrawal(fiduVal(1000), {from: person2})
        expectEvent(res, "WithdrawalRequested", {
          operator: person2,
          uidHolder: "0x0000000000000000000000000000000000000000",
          fiduRequested: fiduVal(1000),
        })
      })

      it("mints a request token", async () => {
        await seniorPool.deposit(usdcVal(1000), {from: person2})
        await expectAction(() => seniorPool.requestWithdrawal(fiduVal(1000), {from: person2})).toChange([
          [() => withdrawalRequestToken.balanceOf(person2), {by: new BN(1)}],
        ])
      })
    })
  })

  describe("addToWithdrawalRequest", () => {
    beforeEach(async () => {
      await seniorPool.deposit(usdcVal(4000), {from: person2})

      // Invest in a pool to suck up the liquidity
      await tranchedPool.deposit(TRANCHES.Junior, usdcVal(1000), {from: owner})
      await tranchedPool.lockJuniorCapital({from: borrower})
      await seniorPool.invest(tranchedPool.address)

      await seniorPool.requestWithdrawal(fiduVal(3500), {from: person2})
    })

    describe("when caller is tokenOwner", () => {
      it("adds fidu to the epoch's and request's fiduRequested", async () => {
        await expectAction(() => seniorPool.addToWithdrawalRequest(fiduVal(500), "1", {from: person2})).toChange([
          [() => fidu.balanceOf(seniorPool.address), {by: fiduVal(500)}],
          [() => fidu.balanceOf(person2), {by: fiduVal(500).neg()}],
          [async () => new BN((await seniorPool.currentEpoch()).fiduRequested), {by: fiduVal(500)}],
          [async () => new BN((await seniorPool.withdrawalRequest("1")).fiduRequested), {by: fiduVal(500)}],
        ])
      })

      it("reverts when amount > caller's FIDU balance", async () => {
        await expect(seniorPool.addToWithdrawalRequest(fiduVal(5000), "1", {from: person2})).to.be.rejectedWith(
          /SafeERC20: low-level call failed/
        )
      })
    })

    describe("when caller not tokenOwner", () => {
      it("reverts", async () => {
        await expect(seniorPool.addToWithdrawalRequest(fiduVal(500), "1", {from: person3})).to.be.rejectedWith(/NA/)
      })
    })

    describe("authorization", () => {
      let supportedIdTypes
      let expiresAt
      beforeEach(async () => {
        await goldfinchConfig.bulkRemoveFromGoList([person2], {from: owner})
        expiresAt = (await getCurrentTimestamp()).add(SECONDS_PER_DAY)
        // Add one supported UID type that is NOT eligible to interact with the senior pool
        const seniorPoolIds = await go.getSeniorPoolIdTypes()
        supportedIdTypes = [...seniorPoolIds, new BN(5)]
        await uniqueIdentity.setSupportedUIDTypes(
          supportedIdTypes,
          supportedIdTypes.map(() => true),
          {from: owner}
        )
      })
      describe("when caller == tx.origin", () => {
        it("works when caller go-listed", async () => {
          await goldfinchConfig.bulkAddToGoList([person2], {from: owner})
          await expect(seniorPool.addToWithdrawalRequest(fiduVal(100), "1", {from: person2})).to.be.fulfilled
        })
        it("works when caller has senior-pool UID", async () => {
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, person2)
          await expect(seniorPool.addToWithdrawalRequest(fiduVal(100), "1", {from: person2})).to.be.fulfilled
        })
        it("reverts when caller has non-senior-pool UID", async () => {
          await mint(hre, uniqueIdentity, new BN(5), expiresAt, new BN(0), owner, undefined, person2)
          await expect(seniorPool.addToWithdrawalRequest(fiduVal(100), "1", {from: person2})).to.be.rejectedWith(/NA/)
        })
        it("reverts when caller has no UID and not go-listed", async () => {
          await expect(seniorPool.addToWithdrawalRequest(fiduVal(100), "1", {from: person2})).to.be.rejectedWith(/NA/)
        })
      })
      describe("when caller != tx.origin", () => {
        it("works when tx.origin has senior-pool UID and caller is ERC1155 approved", async () => {
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, person2)
          await uniqueIdentity.setApprovalForAll(seniorPoolCaller.address, true, {from: person2})
          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await seniorPoolCaller.deposit(usdcVal(100), {from: person2})
          await seniorPoolCaller.requestWithdrawal(fiduVal(50), {from: person2})
          await expect(seniorPoolCaller.addToWithdrawalRequest(fiduVal(50), "2", {from: person2})).to.be.fulfilled
        })

        it("reverts when tx.origin has non-senior-pool UID and caller is ERC1155 approved", async () => {
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, person2)
          await uniqueIdentity.setApprovalForAll(seniorPoolCaller.address, true, {from: person2})
          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await seniorPoolCaller.deposit(usdcVal(100), {from: person2})
          await seniorPoolCaller.requestWithdrawal(fiduVal(50), {from: person2})

          await burn(hre, uniqueIdentity, person2, new BN(1), expiresAt, new BN(1), owner, undefined, person2)
          await mint(hre, uniqueIdentity, new BN(5), expiresAt, new BN(2), owner, undefined, person2)
          await expect(seniorPoolCaller.addToWithdrawalRequest(fiduVal(50), "2", {from: person2})).to.be.rejectedWith(
            /NA/
          )
        })

        // TODO - we cannot mint to seniorPoolCaller until UniqueIdentity's mintTo functionality is merged in
        // TODO - when we add sybil resistance
        it.skip("reverts when tx.origin has senior-pool UID and caller has senior-pool UID", async () => {
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, person2)
          await uniqueIdentity.setApprovalForAll(seniorPoolCaller.address, true, {from: person2})

          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await seniorPoolCaller.deposit(usdcVal(100), {from: person2})
          await seniorPoolCaller.requestWithdrawal(fiduVal(50), {from: person2})

          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, seniorPoolCaller.address)
          await expect(seniorPoolCaller.addToWithdrawalRequest(fiduVal(50), "2", {from: person2})).to.be.rejectedWith(
            /Ambiguous/
          )
        })

        // TODO - when we add sybil resistance
        it.skip("reverts when tx.origin has senior-pool UID and caller go-listed", async () => {
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, person2)
          await uniqueIdentity.setApprovalForAll(seniorPoolCaller.address, true, {from: person2})

          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await seniorPoolCaller.deposit(usdcVal(100), {from: person2})
          await seniorPoolCaller.requestWithdrawal(fiduVal(50), {from: person2})

          await uniqueIdentity.setApprovalForAll(seniorPoolCaller.address, false, {from: person2})
          await goldfinchConfig.bulkAddToGoList([seniorPoolCaller.address])
          await expect(seniorPoolCaller.addToWithdrawalRequest(fiduVal(100), "2", {from: person2})).to.be.rejectedWith(
            /Ambiguous/
          )
        })

        it("reverts when tx.origin has senior-pool UID and caller has nothing", async () => {
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, person2)
          await uniqueIdentity.setApprovalForAll(seniorPoolCaller.address, true, {from: person2})

          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await seniorPoolCaller.deposit(usdcVal(100), {from: person2})
          await seniorPoolCaller.requestWithdrawal(fiduVal(50), {from: person2})
          await uniqueIdentity.setApprovalForAll(seniorPoolCaller.address, false, {from: person2})
          await expect(seniorPoolCaller.addToWithdrawalRequest(fiduVal(50), "2", {from: person2})).to.be.rejectedWith(
            /NA/
          )
        })

        // TODO - we cannot mint to seniorPoolCaller until UniqueIdentity's mintTo functionality is merged in
        // TODO - when we add sybil resistance
        it.skip("works when tx.origin has nothing and caller has senior-pool UID", async () => {
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, seniorPoolCaller.address)
          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await seniorPoolCaller.deposit(usdcVal(100), {from: person2})
          await seniorPoolCaller.requestWithdrawal(fiduVal(50), {from: person2})
          await expect(seniorPoolCaller.addToWithdrawalRequest(fiduVal(50), "2", {from: person2})).to.be.fulfilled
        })

        // TODO - we cannot mint to seniorPoolCaller until UniqueIdentity's mintTo functionality is merged in
        // TODO - when we add sybil resistance
        it.skip("reverts when tx.origin has nothing and caller has non-senior-pool UID", async () => {
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, seniorPoolCaller.address)
          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await seniorPoolCaller.deposit(usdcVal(100), {from: person2})
          await seniorPoolCaller.requestWithdrawal(fiduVal(50), {from: person2})

          await burn(
            hre,
            uniqueIdentity,
            seniorPoolCaller.address,
            new BN(1),
            expiresAt,
            new BN(1),
            owner,
            undefined,
            seniorPoolCaller.address
          )
          await mint(hre, uniqueIdentity, new BN(5), expiresAt, new BN(2), owner, undefined, seniorPoolCaller.address)
          await expect(seniorPoolCaller.addToWithdrawalRequest(fiduVal(50), "2", {from: person2})).to.be.rejectedWith(
            /Unauthorized/
          )
        })

        it("works when tx.origin has nothing and caller is go-listed", async () => {
          await goldfinchConfig.bulkAddToGoList([seniorPoolCaller.address], {from: owner})
          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await seniorPoolCaller.deposit(usdcVal(100), {from: person2})
          await seniorPoolCaller.requestWithdrawal(fiduVal(50), {from: person2})
          await expect(seniorPoolCaller.addToWithdrawalRequest(fiduVal(50), "2", {from: person2})).to.be.fulfilled
        })
      })
    })

    describe("authorization", () => {
      beforeEach(async () => {
        await goldfinchConfig.bulkRemoveFromGoList([person2], {from: owner})
        const seniorPoolIds = await go.getSeniorPoolIdTypes()
        const supportedIdTypes = [...seniorPoolIds, new BN(5)]
        await uniqueIdentity.setSupportedUIDTypes(
          supportedIdTypes,
          supportedIdTypes.map(() => true),
          {from: owner}
        )
      })
      it("works when caller has senior-pool UID", async () => {
        const expiresAt = (await getCurrentTimestamp()).add(SECONDS_PER_DAY)
        await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, person2)
        await expect(seniorPool.addToWithdrawalRequest(fiduVal(500), "1", {from: person2})).to.be.fulfilled
      })
      it("works when caller go-listed", async () => {
        await goldfinchConfig.bulkAddToGoList([person2], {from: owner})
        await expect(seniorPool.addToWithdrawalRequest(fiduVal(500), "1", {from: person2})).to.be.fulfilled
      })
      it("reverts when caller not go-listed and doesn't have senior pool UID", async () => {
        await expect(seniorPool.addToWithdrawalRequest(fiduVal(500), "1", {from: person2})).to.be.rejectedWith(/NA/)
      })
    })
  })

  describe("cancelWithdrawalRequest", () => {
    let request1, request2
    beforeEach(async () => {
      await seniorPool.deposit(usdcVal(1000), {from: person2})
      await seniorPool.requestWithdrawal(fiduVal(1000), {from: person2})
      request1 = await seniorPool.withdrawalRequest("1")

      await seniorPool.deposit(usdcVal(3000), {from: person3})
      await seniorPool.requestWithdrawal(fiduVal(3000), {from: person3})
      request2 = await seniorPool.withdrawalRequest("2")
    })

    describe("authorization", () => {
      let expiresAt
      beforeEach(async () => {
        await goldfinchConfig.bulkRemoveFromGoList([person2], {from: owner})
        expiresAt = (await getCurrentTimestamp()).add(SECONDS_PER_DAY)
        // Add one supported UID type that is NOT eligible to interact with the senior pool
        const seniorPoolIds = await go.getSeniorPoolIdTypes()
        const supportedIdTypes = [...seniorPoolIds, new BN(5)]
        await uniqueIdentity.setSupportedUIDTypes(
          supportedIdTypes,
          supportedIdTypes.map(() => true),
          {from: owner}
        )
      })
      describe("when caller == tx.origin", () => {
        it("works when caller go-listed", async () => {
          await goldfinchConfig.bulkAddToGoList([person2], {from: owner})
          await expect(seniorPool.cancelWithdrawalRequest("1", {from: person2})).to.be.fulfilled
        })
        it("works when caller has senior-pool UID", async () => {
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, person2)
          await expect(seniorPool.cancelWithdrawalRequest("1", {from: person2})).to.be.fulfilled
        })
        it("reverts when caller has non-senior-pool UID", async () => {
          await mint(hre, uniqueIdentity, new BN(5), expiresAt, new BN(0), owner, undefined, person2)
          await expect(seniorPool.cancelWithdrawalRequest("1", {from: person2})).to.be.rejectedWith(/NA/)
        })
        it("reverts when caller has no UID and not go-listed", async () => {
          await expect(seniorPool.cancelWithdrawalRequest("1", {from: person2})).to.be.rejectedWith(/NA/)
        })
      })
      describe("when caller != tx.origin", () => {
        it("works when tx.origin has senior-pool UID and caller is ERC1155 approved", async () => {
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, person2)
          await uniqueIdentity.setApprovalForAll(seniorPoolCaller.address, true, {from: person2})
          await erc20Transfer(usdc, [seniorPoolCaller.address], usdcVal(100), person2)
          await seniorPoolCaller.deposit(usdcVal(100), {from: person2})
          await seniorPoolCaller.requestWithdrawal(fiduVal(100), {from: person2})
          await expect(seniorPoolCaller.cancelWithdrawalRequest("3", {from: person2})).to.be.fulfilled
        })

        it("reverts when tx.origin has non-senior-pool UID and caller is ERC1155 approved", async () => {
          await mint(hre, uniqueIdentity, new BN(5), expiresAt, new BN(0), owner, undefined, person2)
          await uniqueIdentity.setApprovalForAll(seniorPoolCaller.address, true, {from: person2})
          await expect(seniorPoolCaller.cancelWithdrawalRequest("3", {from: person2})).to.be.rejectedWith(/NA/)
        })

        // TODO - we cannot mint to seniorPoolCaller until UniqueIdentity's mintTo functionality is merged in
        // TODO - when we add sybil resistance
        it.skip("reverts when tx.origin has senior-pool UID and caller has senior-pool UID", async () => {
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, person2)
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, seniorPoolCaller.address)
          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await expect(seniorPoolCaller.cancelWithdrawalRequest("3", {from: person2})).to.be.rejectedWith(/Ambiguous/)
        })

        // TODO - when we add sybil resistance
        it.skip("reverts when tx.origin has senior-pool UID and caller go-listed", async () => {
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, person2)
          await goldfinchConfig.bulkAddToGoList([seniorPoolCaller.address])
          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await expect(seniorPoolCaller.cancelWithdrawalRequest("3", {from: person2})).to.be.rejectedWith(/Ambiguous/)
        })

        it("reverts when tx.origin has senior-pool UID and caller has nothing", async () => {
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, person2)
          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await expect(seniorPoolCaller.cancelWithdrawalRequest("3", {from: person2})).to.be.rejectedWith(/NA/)
        })

        // TODO - we cannot mint to seniorPoolCaller until UniqueIdentity's mintTo functionality is merged in
        // TODO - when we add sybil resistance
        it.skip("works when tx.origin has nothing and caller has senior-pool UID", async () => {
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, seniorPoolCaller.address)
          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await seniorPoolCaller.deposit(usdcVal(100), {from: person2})
          await seniorPoolCaller.requestWithdrawal(fiduVal(100), {from: person2})
          await expect(seniorPoolCaller.cancelWithdrawalRequest("3", {from: person2})).to.be.fulfilled
        })

        // TODO - we cannot mint to seniorPoolCaller until UniqueIdentity's mintTo functionality is merged in
        // TODO - when we add sybil resistance
        it.skip("reverts when tx.origin has nothing and caller has non-senior-pool UID", async () => {
          await mint(hre, uniqueIdentity, new BN(5), expiresAt, new BN(0), owner, undefined, seniorPoolCaller.address)
          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await expect(seniorPoolCaller.cancelWithdrawalRequest("3", {from: person2})).to.be.rejectedWith(
            /Unauthorized/
          )
        })

        it("works when tx.origin has nothing and caller is go-listed", async () => {
          await goldfinchConfig.bulkAddToGoList([seniorPoolCaller.address], {from: owner})
          console.log("senior pool caller " + seniorPoolCaller.address)
          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await seniorPoolCaller.deposit(usdcVal(100), {from: person2})
          await seniorPoolCaller.requestWithdrawal(fiduVal(100), {from: person2})
          await expect(seniorPoolCaller.cancelWithdrawalRequest("3", {from: person2})).to.be.fulfilled
        })
      })
    })

    describe("in the same epoch as the request", () => {
      it("should succeed", async () => {
        // First user cancels their request
        await expectAction(() => seniorPool.cancelWithdrawalRequest("1", {from: person2})).toChange([
          [() => fidu.balanceOf(person2), {by: fiduVal(1000).mul(new BN(9990)).div(new BN(10_000))}],
          [() => fidu.balanceOf(reserve), {by: fiduVal(1000).mul(new BN(10)).div(new BN(10_000))}],
          [() => fidu.balanceOf(seniorPool.address), {by: fiduVal(-1000)}],
        ])

        let epoch = await seniorPool.currentEpoch()
        // Epoch's fidu requested should no longer include request 1's fidu requested
        expect(epoch.fiduRequested).to.eq(request2.fiduRequested)
        // Token was burned
        expect(await withdrawalRequestToken.balanceOf(person2)).to.bignumber.eq(ZERO)
        // Request is empty now
        let request = await seniorPool.withdrawalRequest("1")
        expect(request.epochCursor).to.bignumber.eq(ZERO)
        expect(request.fiduRequested).to.bignumber.eq(ZERO)

        // Second user cancels their request
        await expectAction(() => seniorPool.cancelWithdrawalRequest("2", {from: person3})).toChange([
          [() => fidu.balanceOf(person3), {by: fiduVal(3000).mul(new BN(9990)).div(new BN(10_000))}],
          [() => fidu.balanceOf(reserve), {by: fiduVal(3000).mul(new BN(10)).div(new BN(10_000))}],
          [() => fidu.balanceOf(seniorPool.address), {by: fiduVal(-3000)}],
        ])

        epoch = await seniorPool.currentEpoch()
        // Epoch's fidu requested should now be 0
        expect(epoch.fiduRequested).to.eq("0")
        // Token was burned
        expect(await withdrawalRequestToken.balanceOf(person3)).to.bignumber.eq(ZERO)
        // Request is empty now
        request = await seniorPool.withdrawalRequest("2")
        expect(request.epochCursor).to.bignumber.eq(ZERO)
        expect(request.fiduRequested).to.bignumber.eq(ZERO)
      })
    })

    describe("in a later epoch from the request", () => {
      it.skip("should succeed if I have withdrawn up to the current epoch", async () => {
        // Invest in a pool to suck up the liquidity
        await tranchedPool.deposit(TRANCHES.Junior, usdcVal(1000), {from: owner})
        await tranchedPool.lockJuniorCapital({from: borrower})
        await seniorPool.invest(tranchedPool.address)
        // Someone else deposits in the senior pool
        await seniorPool.deposit(usdcVal(500), {from: owner})

        // Advance to next epoch
        await advanceTime({days: 14})

        // Execute withdrawal
        await expectAction(() => seniorPool.claimWithdrawalRequest("1", {from: person2})).toChange([
          [() => usdc.balanceOf(person2), {by: amountLessFee(usdcVal(125))}],
          [() => usdc.balanceOf(seniorPool.address), {by: usdcVal(125).neg()}],
          // 500 FIDU was burned as the result of the $500 deposit, plus
          [() => fidu.balanceOf(seniorPool.address), {by: fiduVal(500).neg()}],
        ])

        // Cancel request
        // They have 875 fidu remaining. Subtracting 10 bps from that is 9990/10_000 * 875
        await expectAction(() => seniorPool.cancelWithdrawalRequest("1", {from: person2})).toChange([
          [() => fidu.balanceOf(person2), {by: fiduVal(875).mul(new BN(9990)).div(new BN(10_000))}],
          [() => fidu.balanceOf(reserve), {by: fiduVal(875).mul(new BN(10)).div(new BN(10_000))}],
        ])
        const currentEpoch = await seniorPool.currentEpoch()
        // Epoch's fidu requested should now be 3000
        expect(currentEpoch.fiduRequested).to.bignumber.eq(fiduVal(3500 - 875))
        // Token was burned
        expect(await withdrawalRequestToken.balanceOf(person2)).to.bignumber.eq(ZERO)
        // Request is empty now
        const request = await seniorPool.withdrawalRequest("1")
        expect(request.epochCursor).to.bignumber.eq(ZERO)
        expect(request.fiduRequested).to.bignumber.eq(ZERO)
      })
    })

    it("should emit WithdrawalCanceled", async () => {
      const tx = await seniorPool.cancelWithdrawalRequest("1", {from: person2})
      expectEvent(tx, "WithdrawalCanceled", {
        operator: person2,
        uidHolder: "0x0000000000000000000000000000000000000000",
        fiduCanceled: fiduVal(1000),
      })
    })

    it("should emit ReserveSharesCollected", async () => {
      await goldfinchConfig.setNumber(CONFIG_KEYS.SeniorPoolWithdrawalCancelationFeeBps, 50, {from: owner})
      console.log(feeAmount(usdcVal(1000)))
      const tx = await seniorPool.cancelWithdrawalRequest("1", {from: person2})
      expectEvent(tx, "ReserveSharesCollected", {
        user: person2,
        amount: feeAmount(fiduVal(1000)),
      })
    })
  })

  function amountLessFee(amount: BN) {
    return amount.mul(new BN(995)).div(new BN(1000))
  }

  function feeAmount(amount: BN) {
    return amount.mul(new BN(5)).div(new BN(1000))
  }

  describe("previewWithdrawal", () => {
    let request1, request2
    beforeEach(async () => {
      await seniorPool.deposit(usdcVal(1000), {from: person2})
      await seniorPool.requestWithdrawal(fiduVal(1000), {from: person2})
      request1 = await seniorPool.withdrawalRequest("1")

      await seniorPool.deposit(usdcVal(3000), {from: person3})
      await seniorPool.requestWithdrawal(fiduVal(3000), {from: person3})
      request2 = await seniorPool.withdrawalRequest("2")

      // Invest in a pool to suck up liquidity
      await tranchedPool.deposit(TRANCHES.Junior, usdcVal(1000), {from: owner})
      await tranchedPool.lockJuniorCapital({from: borrower})
      await seniorPool.invest(tranchedPool.address)
    })

    it("returns 0 in the very first epoch", async () => {
      expect(await seniorPool.previewWithdrawal("1")).to.bignumber.eq(ZERO)
    })

    it("caps amount at requestAmount if usdcIn > fiduRequested", async () => {
      // Make a $10K deposit in epoch 0, then advance to epoch 1
      await seniorPool.deposit(usdcVal(10_000), {from: owner})
      await advanceAndMineBlock({days: 14})

      // Preview withdrawal should return each user's respective total requested amount
      expect(await seniorPool.previewWithdrawal("1")).to.bignumber.eq(usdcVal(1000))
      expect(await seniorPool.previewWithdrawal("2")).to.bignumber.eq(usdcVal(3000))
    })

    it("returns the sum of my pro-rata shares when those shares exceed the pro-rata minimum", async () => {
      // Make a $500 deposit in epoch 0
      await seniorPool.deposit(usdcVal(500), {from: owner})

      // Make a $350 deposit in epoch 1
      await advanceTime({days: 14})
      await seniorPool.deposit(usdcVal(350))

      // Advance to epoch 3
      await advanceAndMineBlock({days: 28})

      // In Epoch 0 we had $500 in and $4000 requested, so 12.5% fulfilled
      let expectedUsdcEpoch0 = usdcVal(1000).mul(new BN(125)).div(new BN(1000))
      // In Epoch 1 we had $350 in and $3500 requested, so 10% fulfilled
      let expectedUsdcEpoch1 = usdcVal(1000).sub(expectedUsdcEpoch0).mul(new BN(10)).div(new BN(100))
      // No liquidity entered in the second epoch
      let expectedUsdcEpoch2 = ZERO
      let expectedUsdc = expectedUsdcEpoch0.add(expectedUsdcEpoch1).add(expectedUsdcEpoch2)
      expect(await seniorPool.previewWithdrawal("1")).to.bignumber.eq(expectedUsdc)

      expectedUsdcEpoch0 = usdcVal(3000).mul(new BN(125)).div(new BN(1000))
      expectedUsdcEpoch1 = usdcVal(3000).sub(expectedUsdcEpoch0).mul(new BN(10)).div(new BN(100))
      expectedUsdcEpoch2 = ZERO
      expectedUsdc = expectedUsdcEpoch0.add(expectedUsdcEpoch1).add(expectedUsdcEpoch2)
      expect(await seniorPool.previewWithdrawal("2")).to.bignumber.eq(expectedUsdc)
    })

    it("returns 0 after I execute a withdrawal", async () => {
      // Make a $500 deposit in epoch 0
      await seniorPool.deposit(usdcVal(500), {from: owner})

      // Advance to epoch 1 and execute withdrawals
      await advanceTime({days: 14})
      await seniorPool.claimWithdrawalRequest("1", {from: person2})
      expect(await seniorPool.previewWithdrawal("1")).to.bignumber.eq(ZERO)

      await seniorPool.claimWithdrawalRequest("2", {from: person3})
      expect(await seniorPool.previewWithdrawal("2")).to.bignumber.eq(ZERO)
    })
  })

  describe("claimWithdrawalRequest", () => {
    let request1, request2
    beforeEach(async () => {
      await seniorPool.deposit(usdcVal(1000), {from: person2})
      await seniorPool.requestWithdrawal(fiduVal(1000), {from: person2})
      request1 = await seniorPool.withdrawalRequest("1")

      await seniorPool.deposit(usdcVal(3000), {from: person3})
      await seniorPool.requestWithdrawal(fiduVal(3000), {from: person3})
      request2 = await seniorPool.withdrawalRequest("2")
    })

    it("no-ops if I withdraw early", async () => {
      const requestBefore = await seniorPool.withdrawalRequest("1")
      await seniorPool.claimWithdrawalRequest("1", {from: person2})
      const requestAfter = await seniorPool.withdrawalRequest("1")
      expect(requestAfter).to.deep.eq(requestBefore)
    })

    it("withdraws up to the current epoch", async () => {
      // Invest in a pool to suck up the liquidity
      await tranchedPool.deposit(TRANCHES.Junior, usdcVal(1000), {from: owner})
      await tranchedPool.lockJuniorCapital({from: borrower})
      await seniorPool.invest(tranchedPool.address)

      // Make a $500 deposit in epoch 0
      await seniorPool.deposit(usdcVal(500), {from: owner})

      // Make a $350 deposit in epoch 1
      await advanceTime({days: 14})
      await seniorPool.deposit(usdcVal(350), {from: owner})

      // Make a $1000 deposit in epoch 2
      await advanceTime({days: 14})
      await seniorPool.deposit(usdcVal(1000), {from: owner})

      // Withdraw in epoch 3
      await advanceTime({days: 14})
      // In Epoch 0 we had $500 in and $4000 requested, so 12.5% fulfilled
      // In Epoch 1 we had $350 in and $3500 requested, so 10% fulfilled
      // In Epoch 2 we had $1000 in and $3150 requested, so 31.746031746% fulfilled
      const person2UsdcEpoch0 = usdcVal(1000).mul(new BN(125)).div(new BN(1000))
      const person3UsdcEpoch0 = usdcVal(3000).mul(new BN(125)).div(new BN(1000))

      const person2UsdcEpoch1 = usdcVal(1000).sub(person2UsdcEpoch0).mul(new BN(10)).div(new BN(100))
      const person3UsdcEpoch1 = usdcVal(3000).sub(person3UsdcEpoch0).mul(new BN(10)).div(new BN(100))

      const person2UsdcEpoch2 = usdcVal(1000)
        .sub(person2UsdcEpoch0)
        .sub(person2UsdcEpoch1)
        .mul(new BN(31746031746))
        .div(new BN(100_000_000_000))
      const person3UsdcEpoch2 = usdcVal(3000)
        .sub(person3UsdcEpoch0)
        .sub(person3UsdcEpoch1)
        .mul(new BN(31746031746))
        .div(new BN(100_000_000_000))

      // PERSON 2 WITHDRAWS
      const person2TotalUsdc = person2UsdcEpoch0.add(person2UsdcEpoch1).add(person2UsdcEpoch2)
      await expectAction(() => seniorPool.claimWithdrawalRequest("1", {from: person2})).toChange([
        // BALANCES
        [() => usdc.balanceOf(seniorPool.address), {byCloseTo: person2TotalUsdc.neg(), threshold: HALF_CENT}],
        [() => usdc.balanceOf(person2), {byCloseTo: amountLessFee(person2TotalUsdc), threshold: HALF_CENT}],
        [() => usdc.balanceOf(reserve), {byCloseTo: feeAmount(person2TotalUsdc), threshold: HALF_CENT}],
        // Epoch 2 is the only one which hasn't been checkpointed. $1000 of usdcIn at a share price of 1 results in 1000 fidu burned
        [() => fidu.balanceOf(seniorPool.address), {byCloseTo: fiduVal(1000).neg()}],
        // WITHDRAWAL REQUEST
        [
          async () => (await seniorPool.withdrawalRequest("1")).fiduRequested,
          {to: fiduVal(537.5).add(fiduVal(1).div(new BN(2)))},
        ],
      ])

      // PERSON3 WITHDRAWS
      const person3TotalUsdc = person3UsdcEpoch0.add(person3UsdcEpoch1).add(person3UsdcEpoch2)
      await expectAction(() => seniorPool.claimWithdrawalRequest("2", {from: person3})).toChange([
        // BALANCES
        [() => usdc.balanceOf(seniorPool.address), {byCloseTo: person3TotalUsdc.neg(), threshold: HALF_CENT}],
        [() => usdc.balanceOf(person3), {byCloseTo: amountLessFee(person3TotalUsdc), threshold: HALF_CENT}],
        [() => usdc.balanceOf(reserve), {byCloseTo: feeAmount(person3TotalUsdc), threshold: HALF_CENT}],
        [() => fidu.balanceOf(seniorPool.address), {unchanged: true}],
      ])
      expect((await seniorPool.withdrawalRequest("2")).fiduRequested).to.bignumber.eq(
        fiduVal(1612).add(fiduVal(1).div(new BN(2)))
      )

      // CURRENT EPOCH
      expect((await seniorPool.currentEpoch()).fiduRequested).to.bignumber.eq(fiduVal(2150))
    })

    it("should clear my position when the clearing epoch is in the past", async () => {
      // If withdrawing up to epoch[i] clears out my position and I wait until some epoch[i + j] (j >= 1)
      // to execute the withdrawal, then the withdraw should still work and I should not get any usdc from
      // epoch[i+1]...epoch[i+j]

      // Invest in a pool to suck up the liquidity
      await tranchedPool.deposit(TRANCHES.Junior, usdcVal(1000), {from: owner})
      await tranchedPool.lockJuniorCapital({from: borrower})
      await seniorPool.invest(tranchedPool.address)

      // Make a $500 deposit in epoch 0
      await seniorPool.deposit(usdcVal(500), {from: owner})

      // Advance to epoch 2
      await advanceTime({days: 28})
      await seniorPool.deposit(usdcVal(1500), {from: owner})

      // Advance to epoch 3 - this will be enough for positions to be cleared out
      await advanceTime({days: 14})
      await seniorPool.deposit(usdcVal(2500), {from: owner})

      // Advance to epoch 4 - make another deposit
      await advanceTime({days: 14})
      await seniorPool.deposit(usdcVal(10_000))

      // Advance to epoch 5 - make no deposits
      await advanceTime({days: 14})

      // Now execute the withdrawal request for person2
      await expectAction(() => seniorPool.claimWithdrawalRequest("1", {from: person2})).toChange([
        // BALANCES
        [() => usdc.balanceOf(seniorPool.address), {by: usdcVal(1000).neg()}],
        [() => usdc.balanceOf(person2), {by: amountLessFee(usdcVal(1000))}],
        [() => usdc.balanceOf(reserve), {by: feeAmount(usdcVal(1000))}],
        // WITHDRAWAL REQUEST
        [() => withdrawalRequestToken.balanceOf(person2), {to: ZERO}],
      ])

      // Execute the withdrawal request for person3
      await expectAction(() => seniorPool.claimWithdrawalRequest("2", {from: person3})).toChange([
        // BALANCES
        [() => usdc.balanceOf(seniorPool.address), {by: usdcVal(3000).neg()}],
        [() => usdc.balanceOf(person3), {by: amountLessFee(usdcVal(3000))}],
        [() => usdc.balanceOf(reserve), {by: feeAmount(usdcVal(3000))}],
        // WITHDRAWAL REQUEST
        [() => withdrawalRequestToken.balanceOf(person3), {to: ZERO}],
      ])

      expect(await seniorPool.usdcAvailable()).to.bignumber.eq(usdcVal(10_500))
    })

    it("should clear my position if there is enough liquidity", async () => {
      // person2 and person3's deposits are still in the senior pool. If no other actions are taken before the end
      // of the epoch then it will be available for both of them to withdraw and clear their positions
      await advanceTime({days: 14})

      await expectAction(() => seniorPool.claimWithdrawalRequest("2", {from: person3})).toChange([
        // BALANCES
        [() => usdc.balanceOf(seniorPool.address), {by: usdcVal(3000).neg()}],
        [() => usdc.balanceOf(person3), {by: amountLessFee(usdcVal(3000))}],
        [() => usdc.balanceOf(reserve), {by: feeAmount(usdcVal(3000))}],
        // WITHDRAWAL REQUEST
        [() => withdrawalRequestToken.balanceOf(person3), {to: ZERO}],
      ])

      await expectAction(() => seniorPool.claimWithdrawalRequest("1", {from: person2})).toChange([
        // BALANCES
        [() => usdc.balanceOf(seniorPool.address), {to: ZERO}],
        [() => usdc.balanceOf(person2), {by: amountLessFee(usdcVal(1000))}],
        [() => usdc.balanceOf(reserve), {by: feeAmount(usdcVal(1000))}],
        // WITHDRAWAL REQUEST
        [() => withdrawalRequestToken.balanceOf(person2), {to: ZERO}],
      ])

      // Requests are empty
      let request = await seniorPool.withdrawalRequest("1")
      expect(request.epochCursor).to.bignumber.eq(ZERO)
      expect(request.fiduRequested).to.bignumber.eq(ZERO)
      request = await seniorPool.withdrawalRequest("2")
      expect(request.epochCursor).to.bignumber.eq(ZERO)
      expect(request.fiduRequested).to.bignumber.eq(ZERO)

      // Current epoch
      expect((await seniorPool.currentEpoch()).fiduRequested).to.bignumber.eq(ZERO)
    })

    it("uses the share price for each epoch to reduce the request amount", async () => {
      // Suck up liquidity by investing in a tranched pool
      await tranchedPool.deposit(TRANCHES.Junior, usdcVal(1000), {from: owner})
      await tranchedPool.lockJuniorCapital({from: borrower})
      await seniorPool.invest(tranchedPool.address)

      // Borrower draws down
      await tranchedPool.drawdown(usdcVal(5000), {from: borrower})

      // $500 deposit comes in at share price 1.00
      await seniorPool.deposit(usdcVal(500), {from: owner})

      // Advance to when first payment on tranched pool is due (epoch 2)
      await advanceTime({days: 30})
      await tranchedPool.assess()
      const paymentAmount = await creditLine.interestOwed()
      await tranchedPool.pay(paymentAmount)
      // Share price should go up as a result of redemption
      const poolBalanceBeforeRedemption = await usdc.balanceOf(seniorPool.address)
      await expectAction(() => seniorPool.redeem("2")).toChange([
        [seniorPool.sharePrice, {increase: true}],
        [() => usdc.balanceOf(seniorPool.address), {increase: true}],
      ])
      const seniorInterest = (await usdc.balanceOf(seniorPool.address)).sub(poolBalanceBeforeRedemption)

      // Add another deposit such that there are $200 total usdcIn for epoch 2
      await seniorPool.deposit(usdcVal(200).sub(seniorInterest))
      const epoch2SharePrice = await seniorPool.sharePrice()

      // We are now in epoch3
      await advanceTime({days: 14})

      /*
      Epoch 1 sharePrice = 1000000000000000000, usdcIn = $500, epochFidu = 4000, user1TotalFidu = 1000, user1Usdc = $500 * 1000/4000 = $125, user1Fidu = $125/1.00 = 125
      Epoch 2 sharePrice = 1000000000000000000, usdcIn = $0, epochFidu = 4000 - $500/1.00 = 3500, user1TotalFidu = 875, user1Usdc = $0, user1Fidu = 0
      Epoch 3 sharePrice = 1002876712250000000, usdcIn = $200, epochFidu = 3500, user1TotalFidu = 875, user1Usdc = $200 * 875/3500 = $50, user1Fidu = $50/1.002876712250000000 = $49.856576974275036

      */

      // Do user 1
      let expectedUserUsdcEpoch0 = usdcVal(125)
      let expectedUserFiduEpoch0 = fiduVal(125)
      let expectedUserUsdcEpoch1 = ZERO
      let expectedUserFiduEpoch1 = ZERO
      let expectedUserUsdcEpoch2 = usdcVal(50)
      let expectedUserFiduEpoch2 = await seniorPool.__getNumShares(usdcVal(50), epoch2SharePrice)
      let expectedUsdcReceived = expectedUserUsdcEpoch0.add(expectedUserUsdcEpoch1).add(expectedUserUsdcEpoch2)
      let expectedFiduBurned = expectedUserFiduEpoch0.add(expectedUserFiduEpoch1).add(expectedUserFiduEpoch2)

      await expectAction(() => seniorPool.claimWithdrawalRequest("1", {from: person2})).toChange([
        [() => usdc.balanceOf(seniorPool.address), {by: expectedUsdcReceived.neg()}],
        [() => usdc.balanceOf(person2), {by: amountLessFee(expectedUsdcReceived)}],
      ])
      let request = await seniorPool.withdrawalRequest("1")
      expect(request.fiduRequested).to.bignumber.eq(fiduVal(1000).sub(expectedFiduBurned))

      // Now do user 2
      expectedUserUsdcEpoch0 = usdcVal(375)
      expectedUserFiduEpoch0 = fiduVal(375)
      expectedUserUsdcEpoch1 = ZERO
      expectedUserFiduEpoch1 = ZERO
      expectedUserUsdcEpoch2 = usdcVal(150)
      expectedUserFiduEpoch2 = await seniorPool.__getNumShares(usdcVal(150), epoch2SharePrice)
      expectedUsdcReceived = expectedUserUsdcEpoch0.add(expectedUserUsdcEpoch1).add(expectedUserUsdcEpoch2)
      expectedFiduBurned = expectedUserFiduEpoch0.add(expectedUserFiduEpoch1).add(expectedUserFiduEpoch2)

      await expectAction(() => seniorPool.claimWithdrawalRequest("2", {from: person3})).toChange([
        [() => usdc.balanceOf(seniorPool.address), {by: expectedUsdcReceived.neg()}],
        [() => usdc.balanceOf(person3), {by: amountLessFee(expectedUsdcReceived)}],
      ])
      request = await seniorPool.withdrawalRequest("2")
      // imprecision in the epoch equity calculation can mean this is off by one
      expect(request.fiduRequested).to.bignumber.closeTo(fiduVal(3000).sub(expectedFiduBurned), "1")
    })

    describe("authorization", () => {
      let supportedIdTypes
      let expiresAt
      beforeEach(async () => {
        await goldfinchConfig.bulkRemoveFromGoList([person2], {from: owner})
        expiresAt = (await getCurrentTimestamp()).add(SECONDS_PER_DAY)
        // Add one supported UID type that is NOT eligible to interact with the senior pool
        const seniorPoolIds = await go.getSeniorPoolIdTypes()
        supportedIdTypes = [...seniorPoolIds, new BN(5)]
        await uniqueIdentity.setSupportedUIDTypes(
          supportedIdTypes,
          supportedIdTypes.map(() => true),
          {from: owner}
        )
      })
      describe("when caller == tx.origin", () => {
        it("works when caller go-listed", async () => {
          await goldfinchConfig.bulkAddToGoList([person2], {from: owner})
          await advanceTime({days: 14})
          await expect(seniorPool.claimWithdrawalRequest("1", {from: person2})).to.be.fulfilled
        })
        it("works when caller has senior-pool UID", async () => {
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, person2)
          await advanceTime({days: 14})
          await expect(seniorPool.claimWithdrawalRequest("1", {from: person2})).to.be.fulfilled
        })
        it("reverts when caller has non-senior-pool UID", async () => {
          await mint(hre, uniqueIdentity, new BN(5), expiresAt, new BN(0), owner, undefined, person2)
          await advanceTime({days: 14})
          await expect(seniorPool.claimWithdrawalRequest("1", {from: person2})).to.be.rejectedWith(/NA/)
        })
        it("reverts when caller has no UID and not go-listed", async () => {
          await advanceTime({days: 14})
          await expect(seniorPool.claimWithdrawalRequest("1", {from: person2})).to.be.rejectedWith(/NA/)
        })
      })
      describe("when caller != tx.origin", () => {
        it("works when tx.origin has senior-pool UID and caller is ERC1155 approved", async () => {
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, person2)
          await uniqueIdentity.setApprovalForAll(seniorPoolCaller.address, true, {from: person2})
          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await seniorPoolCaller.deposit(usdcVal(100), {from: person2})
          await seniorPoolCaller.requestWithdrawal(fiduVal(100), {from: person2})
          await advanceTime({days: 14})
          await expect(seniorPoolCaller.claimWithdrawalRequest("3", {from: person2})).to.be.fulfilled
        })

        it("reverts when tx.origin has non-senior-pool UID and caller is ERC1155 approved", async () => {
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, person2)
          await uniqueIdentity.setApprovalForAll(seniorPoolCaller.address, true, {from: person2})
          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await seniorPoolCaller.deposit(usdcVal(100), {from: person2})
          await seniorPoolCaller.requestWithdrawal(fiduVal(100), {from: person2})

          // Burn their senior-pool enabled UID and mint them a non-senior-pool UID
          await burn(hre, uniqueIdentity, person2, new BN(1), expiresAt, new BN(1), owner, undefined)
          await mint(hre, uniqueIdentity, new BN(5), expiresAt, new BN(2), owner, undefined, person2)

          await advanceTime({days: 14})
          await expect(seniorPoolCaller.claimWithdrawalRequest("3", {from: person2})).to.be.rejectedWith(/NA/)
        })

        // TODO - we cannot mint to seniorPoolCaller until UniqueIdentity's mintTo functionality is merged in
        // TODO - when we add sybil resistance
        it.skip("reverts when tx.origin has senior-pool UID and caller has senior-pool UID", async () => {
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, person2)
          await uniqueIdentity.setApprovalForAll(seniorPoolCaller.address, true, {from: person2})
          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await seniorPoolCaller.deposit(usdcVal(100), {from: person2})
          await seniorPoolCaller.requestWithdrawal(fiduVal(100), {from: person2})

          // Now mint the seniorPoolCaller a valid UID
          await uniqueIdentity.setApprovalForAll(seniorPoolCaller.address, false, {from: person2})
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, seniorPoolCaller.address)
          await advanceTime({days: 14})
          await expect(seniorPoolCaller.claimWithdrawalRequest("3", {from: person2})).to.be.rejectedWith(/Ambiguous/)
        })

        // TODO - when we add sybil resistance
        it.skip("reverts when tx.origin has senior-pool UID and caller go-listed", async () => {
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, person2)
          await uniqueIdentity.setApprovalForAll(seniorPoolCaller.address, true, {from: person2})
          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await seniorPoolCaller.deposit(usdcVal(100), {from: person2})
          await seniorPoolCaller.requestWithdrawal(fiduVal(100))

          // Now add seniorPoolCaller to go list
          await uniqueIdentity.setApprovalForAll(seniorPoolCaller.address, false, {from: person2})
          await goldfinchConfig.bulkAddToGoList([seniorPoolCaller.address])
          await expect(seniorPoolCaller.claimWithdrawalRequest("3", {from: person2})).to.be.rejectedWith(/Ambiguous/)
        })

        it("reverts when tx.origin has senior-pool UID and caller has nothing", async () => {
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, person2)
          await uniqueIdentity.setApprovalForAll(seniorPoolCaller.address, true, {from: person2})
          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await seniorPoolCaller.deposit(usdcVal(100), {from: person2})
          await seniorPoolCaller.requestWithdrawal(fiduVal(100), {from: person2})

          // Now remove approval
          await uniqueIdentity.setApprovalForAll(seniorPoolCaller.address, false, {from: person2})
          await advanceTime({days: 14})
          await expect(seniorPoolCaller.claimWithdrawalRequest("3", {from: person2})).to.be.rejectedWith(/NA/)
        })

        // TODO - we cannot mint to seniorPoolCaller until UniqueIdentity's mintTo functionality is merged in
        // TODO - when we add sybil resistance
        it.skip("works when tx.origin has nothing and caller has senior-pool UID", async () => {
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, seniorPoolCaller.address)
          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await seniorPoolCaller.deposit(usdcVal(100), {from: person2})
          await seniorPoolCaller.requestWithdrawal(fiduVal(100), {from: person2})
          await advanceTime({days: 14})
          await expect(seniorPoolCaller.claimWithdrawalRequest("3", {from: person2})).to.be.fulfilled
        })

        // TODO - we cannot mint to seniorPoolCaller until UniqueIdentity's mintTo functionality is merged in
        // TODO - when we add sybil resistance
        it.skip("reverts when tx.origin has nothing and caller has non-senior-pool UID", async () => {
          await mint(hre, uniqueIdentity, new BN(1), expiresAt, new BN(0), owner, undefined, seniorPoolCaller.address)
          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await seniorPoolCaller.deposit(usdcVal(100), {from: person2})
          await seniorPoolCaller.requestWithdrawal(fiduVal(100), {from: person2})

          // Burn the seniorPoolCaller's UID and mint them a non senior pool UID
          await burn(hre, uniqueIdentity, seniorPoolCaller.address, new BN(1), expiresAt, new BN(1), owner, undefined)
          await mint(hre, uniqueIdentity, new BN(5), expiresAt, new BN(2), owner, undefined, seniorPoolCaller.address)
          await advanceTime({days: 14})
          await expect(seniorPoolCaller.claimWithdrawalRequest("3", {from: person2})).to.be.rejectedWith(/Unauthorized/)
        })

        it("works when tx.origin has nothing and caller is go-listed", async () => {
          await goldfinchConfig.bulkAddToGoList([seniorPoolCaller.address], {from: owner})
          await usdc.transfer(seniorPoolCaller.address, usdcVal(100), {from: person2})
          await seniorPoolCaller.deposit(usdcVal(100), {from: person2})
          await seniorPoolCaller.requestWithdrawal(fiduVal(100), {from: person2})

          await advanceTime({days: 14})
          await expect(seniorPoolCaller.claimWithdrawalRequest("3", {from: person2})).to.be.fulfilled
        })
      })
    })
  })

  describe("pool assets", () => {
    let request1, request2, assetsBeforeAllocation
    beforeEach(async () => {
      await seniorPool.deposit(usdcVal(1000), {from: person2})
      await seniorPool.requestWithdrawal(fiduVal(1000), {from: person2})
      request1 = await seniorPool.withdrawalRequest("1")

      await seniorPool.deposit(usdcVal(3000), {from: person3})
      await seniorPool.requestWithdrawal(fiduVal(3000), {from: person3})
      request2 = await seniorPool.withdrawalRequest("2")

      // Invest in a pool to suck up liquidity
      await tranchedPool.deposit(TRANCHES.Junior, usdcVal(1000), {from: owner})
      await tranchedPool.lockJuniorCapital({from: borrower})
      await seniorPool.invest(tranchedPool.address)
    })

    const depositAmounts = [
      // Shortfall
      usdcVal(500),
      // Enough to fulfill all withdrawal demand
      usdcVal(10_000),
    ]

    depositAmounts.forEach((depositAmount) => {
      describe(`when ${depositAmount} usdc is allocated for withdrawals`, () => {
        beforeEach(async () => {
          await seniorPool.deposit(depositAmount, {from: owner})
          assetsBeforeAllocation = await seniorPool.assets()
        })

        it("should decrease asset value by amount allocated", async () => {
          await advanceAndMineBlock({days: 14})

          // Even though checkpointed hasn't happened, the $500 deposit should no longer be included
          expect(await seniorPool.assets()).to.bignumber.eq(
            assetsBeforeAllocation.sub(BN.min(depositAmount, usdcVal(4000)))
          )

          // Make a deposit, which will trigger the checkpoint
          await seniorPool.deposit(usdcVal(1))

          // Verify $500 still not included in the asset count, event though it sits in the contract
          expect(await seniorPool.assets()).to.bignumber.eq(
            assetsBeforeAllocation.add(usdcVal(1)).sub(BN.min(depositAmount, usdcVal(4000)))
          )
        })

        it("should not change when a user withdraws", async () => {
          await advanceTime({days: 14})

          await seniorPool.claimWithdrawalRequest("1", {from: person2})
          await seniorPool.claimWithdrawalRequest("2", {from: person3})

          expect(await seniorPool.assets()).to.bignumber.eq(
            assetsBeforeAllocation.sub(BN.min(depositAmount, usdcVal(4000)))
          )
        })
      })
    })
  })

  describe("assets matching liabilities", async () => {
    describe("when there is a super tiny rounding error", async () => {
      it("should still work", async () => {
        // This share price will cause a rounding error of 1 atomic unit.
        const testSharePrice = new BN(String(1.23456789 * (ETHDecimals as any)))
        await seniorPool._setSharePrice(testSharePrice)

        return expect(makeDeposit(person2, new BN(2500).mul(USDC_DECIMALS))).to.be.fulfilled
      })
    })
  })

  describe("USDC Mantissa", async () => {
    it("should equal 1e6", async () => {
      expect(await seniorPool.usdcMantissa()).to.bignumber.equal(USDC_DECIMALS)
    })
  })

  describe("Fidu Mantissa", async () => {
    it("should equal 1e18", async () => {
      expect(await seniorPool.fiduMantissa()).to.bignumber.equal(decimals)
    })
  })

  describe("usdcToFidu", async () => {
    it("should equal 1e12", async () => {
      expect(await seniorPool.usdcToFidu(new BN(1))).to.bignumber.equal(new BN(1e12))
    })
  })

  describe("estimateInvestment", () => {
    const juniorInvestmentAmount = usdcVal(10000)
    const testSetup = deployments.createFixture(async () => {
      await erc20Approve(usdc, seniorPool.address, usdcVal(100000), [owner])
      await makeDeposit(owner, usdcVal(100000))
      await goldfinchConfig.addToGoList(seniorPool.address)
      await tranchedPool.deposit(TRANCHES.Junior, juniorInvestmentAmount)
    })

    beforeEach(async () => {
      await testSetup()
    })

    context("Pool is not valid", () => {
      it("reverts", async () => {
        const unknownPoolAddress = await simulateMaliciousTranchedPool(goldfinchConfig, person2)

        await expect(seniorPool.invest(unknownPoolAddress)).to.be.rejectedWith(/Pool must be valid/)
      }).timeout(TEST_TIMEOUT)
    })

    it("should return the strategy's estimated investment", async () => {
      expect(await goldfinchConfig.getAddress(CONFIG_KEYS.SeniorPoolStrategy)).to.equal(seniorPoolFixedStrategy.address)
      const investmentAmount = await seniorPoolFixedStrategy.estimateInvestment.call(
        seniorPool.address,
        tranchedPool.address
      )
      const estimate = await seniorPool.estimateInvestment(tranchedPool.address)
      await expect(estimate).to.bignumber.equal(investmentAmount)
    })
  })

  // TODO - verify if this function is necessary
  async function getCurrentEpoch() {
    const epoch = await seniorPool.currentEpoch()
    return {
      id: new BN(epoch.id),
      endsAt: new BN(epoch.endsAt),
      fiduRequested: new BN(epoch.fiduRequested),
      fiduLiquidated: new BN(epoch.fiduLiquidated),
      usdcAllocated: new BN(epoch.usdcAllocated),
    }
  }

  describe("invest", () => {
    const juniorInvestmentAmount = usdcVal(10_000)

    const testSetup = deployments.createFixture(async () => {
      await erc20Approve(usdc, seniorPool.address, usdcVal(100_000), [owner])
      await makeDeposit(owner, usdcVal(100_000))
      await goldfinchConfig.addToGoList(seniorPool.address)
      await tranchedPool.deposit(TRANCHES.Junior, juniorInvestmentAmount)
    })

    beforeEach(async () => {
      await testSetup()
    })

    context("called by non-governance", async () => {
      it("should not revert", async () => {
        return expect(seniorPool.invest(tranchedPool.address, {from: person2})).to.not.be.rejectedWith(
          /Must have admin role to perform this action/i
        )
      })
    })

    context("Pool is not valid", () => {
      it("reverts", async () => {
        const unknownPoolAddress = await simulateMaliciousTranchedPool(goldfinchConfig, person2)

        await expect(seniorPool.invest(unknownPoolAddress)).to.be.rejectedWith(/Pool must be valid/)
      }).timeout(TEST_TIMEOUT)
    })

    context("Pool's senior tranche is not empty", () => {
      it("allows investing in the senior tranche", async () => {
        await tranchedPool._setSeniorTranchePrincipalDeposited(new BN(1))
        const seniorTranche = await tranchedPool.getTranche(TRANCHES.Senior)
        expect(seniorTranche.principalDeposited).to.bignumber.equal(new BN(1))

        await tranchedPool.lockJuniorCapital({from: borrower})
        expect(await goldfinchConfig.getAddress(CONFIG_KEYS.SeniorPoolStrategy)).to.equal(
          seniorPoolFixedStrategy.address
        )
        const investmentAmount = await seniorPoolFixedStrategy.invest(seniorPool.address, tranchedPool.address)

        await seniorPool.invest(tranchedPool.address)

        const seniorTranche2 = await tranchedPool.getTranche(TRANCHES.Senior)
        expect(seniorTranche2.principalDeposited).to.bignumber.equal(investmentAmount.add(new BN(1)))
      })
    })

    context("strategy amount is > 0", () => {
      it("should deposit amount into the senior tranche", async () => {
        // Make the strategy invest
        await tranchedPool.lockJuniorCapital({from: borrower})
        expect(await goldfinchConfig.getAddress(CONFIG_KEYS.SeniorPoolStrategy)).to.equal(
          seniorPoolFixedStrategy.address
        )
        const investmentAmount = await seniorPoolFixedStrategy.invest(seniorPool.address, tranchedPool.address)

        await expectAction(async () => await seniorPool.invest(tranchedPool.address)).toChange([
          [async () => await getBalance(seniorPool.address, usdc), {by: investmentAmount.neg()}],
          [
            async () => new BN((await tranchedPool.getTranche(TRANCHES.Senior)).principalDeposited),
            {by: investmentAmount},
          ],
        ])
      })

      it("should emit an InvestmentMadeInSenior event", async () => {
        // Make the strategy invest
        await tranchedPool.lockJuniorCapital({from: borrower})
        expect(await goldfinchConfig.getAddress(CONFIG_KEYS.SeniorPoolStrategy)).to.equal(
          seniorPoolFixedStrategy.address
        )
        const investmentAmount = await seniorPoolFixedStrategy.invest(seniorPool.address, tranchedPool.address)

        const receipt = await seniorPool.invest(tranchedPool.address)
        const event = decodeAndGetFirstLog<InvestmentMadeInSenior>(
          receipt.receipt.rawLogs,
          seniorPool,
          "InvestmentMadeInSenior"
        )

        expect(event.event).to.equal("InvestmentMadeInSenior")
        expect(event.args.tranchedPool).to.equal(tranchedPool.address)
        expect(event.args.amount).to.bignumber.equal(investmentAmount)
      })

      it("should track the investment in the assets calculation", async () => {
        // Make the strategy invest
        await tranchedPool.lockJuniorCapital({from: borrower})
        expect(await goldfinchConfig.getAddress(CONFIG_KEYS.SeniorPoolStrategy)).to.equal(
          seniorPoolFixedStrategy.address
        )
        const investmentAmount = await seniorPoolFixedStrategy.invest(seniorPool.address, tranchedPool.address)

        await expectAction(() => seniorPool.invest(tranchedPool.address)).toChange([
          [seniorPool.totalLoansOutstanding, {by: investmentAmount}],
          [() => getBalance(seniorPool.address, usdc), {by: investmentAmount.neg()}],
          [seniorPool.assets, {by: new BN(0)}], // loans outstanding + balance cancel out
        ])
      })
    })

    context("strategy amount is 0", async () => {
      it("reverts", async () => {
        // Junior tranche is still open, so investment amount should be 0
        expect(await goldfinchConfig.getAddress(CONFIG_KEYS.SeniorPoolStrategy)).to.equal(
          seniorPoolFixedStrategy.address
        )
        const investmentAmount = await seniorPoolFixedStrategy.invest(seniorPool.address, tranchedPool.address)
        expect(investmentAmount).to.bignumber.equal(new BN(0))

        await expect(seniorPool.invest(tranchedPool.address)).to.be.rejectedWith(/amount must be positive/)
      })
    })

    context("strategy amount exceeds tranched pool's limit", async () => {
      it("allows investing in the senior tranche", async () => {
        // NOTE: This test is a relic from when we considered prohibiting an investment
        // amount that exceeded the tranched pool's limit, but then decided we didn't want
        // to prohibit that, so that we are able to maintain the leverage ratio in a case
        // where the juniors take "more than their share".

        const expectedMaxLimit = usdcVal(100000)
        const creditLine = await CreditLine.at(await tranchedPool.creditLine())
        expect(await creditLine.maxLimit()).to.bignumber.equal(expectedMaxLimit)

        await tranchedPool.lockJuniorCapital({from: borrower})
        expect(await goldfinchConfig.getAddress(CONFIG_KEYS.SeniorPoolStrategy)).to.equal(
          seniorPoolFixedStrategy.address
        )
        const investmentAmount = await seniorPoolFixedStrategy.invest(seniorPool.address, tranchedPool.address)

        const reducedLimit = investmentAmount.sub(new BN(1))
        await tranchedPool._setLimit(reducedLimit)
        expect(await creditLine.limit()).to.bignumber.equal(reducedLimit)

        await seniorPool.invest(tranchedPool.address)

        const seniorTranche = await tranchedPool.getTranche(TRANCHES.Senior)
        expect(seniorTranche.principalDeposited).to.bignumber.equal(investmentAmount)
      })
    })

    describe("epoch checkpointing", () => {
      beforeEach(async () => {
        await tranchedPool.lockJuniorCapital({from: borrower})
      })
      describe("in the current epoch", () => {
        it("decreases usdcIn by investment amount", async () => {
          await expectAction(() => seniorPool.invest(tranchedPool.address)).toChange([
            [seniorPool.usdcAvailable, {by: usdcVal(40_000).neg()}],
          ])
        })
      })
      describe("when the last epoch hasn't been checkpointed", () => {
        it("decreases usdcIn by investment amount", async () => {
          await advanceAndMineBlock({days: 14})
          await expectAction(() => seniorPool.invest(tranchedPool.address)).toChange([
            [seniorPool.usdcAvailable, {by: usdcVal(40_000).neg()}],
          ])
        })
      })
      describe("when multiple epochs haven't been checkpointed", () => {
        it("decreases usdcIn by investment amount", async () => {
          await advanceAndMineBlock({days: 28})
          await expectAction(() => seniorPool.invest(tranchedPool.address)).toChange([
            [seniorPool.usdcAvailable, {by: usdcVal(40_000).neg()}],
          ])
        })
      })
      it("cannot invest more than usdc available", async () => {
        // By requesting to withdary 80_000 FIDU = $80K, there will only be 20K left to invest in the next epoch
        await seniorPool.requestWithdrawal(fiduVal(80_000), {from: owner})
        await advanceTime({days: 14})

        // The 4x leverage strategy tries to invest $40k but this exceeds usdc in
        await expect(seniorPool.invest(tranchedPool.address)).to.be.rejectedWith(/not enough usdc/)
      })
    })
  })

  describe("epochDuration", () => {
    it("can be set by admin", async () => {
      await expectAction(() => seniorPool.setEpochDuration(SECONDS_PER_DAY, {from: owner})).toChange([
        [seniorPool.epochDuration, {to: SECONDS_PER_DAY}],
      ])
    })
    it("cannot be set by non-admin", async () => {
      await expect(seniorPool.setEpochDuration(SECONDS_PER_DAY, {from: person2})).to.be.rejectedWith(
        /Must have admin role to perform this action/
      )
    })
    it("returns the duration", async () => {
      expect(await seniorPool.epochDuration()).to.bignumber.eq(TWO_WEEKS)
    })
    it("emits and event", async () => {
      const receipt = await seniorPool.setEpochDuration(SECONDS_PER_DAY, {from: owner})
      expectEvent(receipt, "EpochDurationChanged", {
        to: SECONDS_PER_DAY,
      })
    })
  })

  describe("redeem", async () => {
    let tokenAddress, reserveAddress, poolTokens
    const juniorInvestmentAmount = usdcVal(100)

    beforeEach(async () => {
      reserveAddress = await goldfinchConfig.getAddress(CONFIG_KEYS.TreasuryReserve)
      tokenAddress = await goldfinchConfig.getAddress(CONFIG_KEYS.PoolTokens)
      poolTokens = await artifacts.require("PoolTokens").at(tokenAddress)

      await erc20Approve(usdc, seniorPool.address, usdcVal(100_000), [owner])
      await makeDeposit(owner, usdcVal(100_000))
      await goldfinchConfig.addToGoList(seniorPool.address)

      await tranchedPool.deposit(TRANCHES.Junior, juniorInvestmentAmount)
    })

    async function getPoolTokenInfo(tokenId) {
      const tokenInfo = await poolTokens.getTokenInfo(tokenId)
      return {
        ...tokenInfo,
        tranche: new BN(tokenInfo.tranche),
        principalAmount: new BN(tokenInfo.principalAmount),
        principalRedeemed: new BN(tokenInfo.principalRedeemed),
        interestRedeemed: new BN(tokenInfo.interestRedeemed),
      }
    }

    it("should redeem the maximum from the TranchedPool", async () => {
      // Make the senior pool invest
      await tranchedPool.lockJuniorCapital({from: borrower})
      await seniorPool.invest(tranchedPool.address)

      // Simulate repayment ensuring a full term has passed
      await tranchedPool.lockPool({from: borrower})
      await tranchedPool.drawdown(usdcVal(100), {from: borrower})
      await advanceTime({days: termInDays.toNumber()})
      const payAmount = usdcVal(105)
      await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
      await tranchedPool.pay(payAmount, {from: borrower})

      const tokenId = await poolTokens.tokenOfOwnerByIndex(seniorPool.address, 0)

      const balanceBefore = await usdc.balanceOf(seniorPool.address)
      const tokenInfoBefore = await poolTokens.getTokenInfo(tokenId)
      const originalReserveBalance = await getBalance(reserveAddress, usdc)

      await seniorPool.redeem(tokenId)

      const balanceAfter = await usdc.balanceOf(seniorPool.address)
      const tokenInfoAfter = await poolTokens.getTokenInfo(tokenId)
      const newReserveBalance = await getBalance(reserveAddress, usdc)

      const interestRedeemed = new BN(tokenInfoAfter.interestRedeemed).sub(new BN(tokenInfoBefore.interestRedeemed))
      const principalRedeemed = new BN(tokenInfoAfter.principalRedeemed).sub(new BN(tokenInfoBefore.principalRedeemed))

      // Junior contributed 100$, senior levered by 4x (400$). Total limit 500$. Since
      // everything was paid back, senior can redeem full amount.
      expect(principalRedeemed).to.bignumber.equal(usdcVal(400))
      // $5 of interest * (4/5) * (1 - (0.2 + 0.1)) = $2.8 where 0.2 is juniorFeePercent and 0.1 is protocolFee
      expect(interestRedeemed).to.bignumber.equal(new BN(2.8 * USDC_DECIMALS.toNumber()))

      expect(balanceAfter).to.bignumber.gte(balanceBefore)
      expect(balanceAfter.sub(balanceBefore)).to.bignumber.equal(interestRedeemed.add(principalRedeemed))
      expect(newReserveBalance).to.bignumber.eq(originalReserveBalance)
    })

    it("should adjust the share price accounting for new interest redeemed", async () => {
      // Make the senior pool invest
      await tranchedPool.lockJuniorCapital({from: borrower})
      await seniorPool.invest(tranchedPool.address)

      // Simulate repayment ensuring a full term has passed
      await tranchedPool.lockPool({from: borrower})
      await tranchedPool.drawdown(usdcVal(100), {from: borrower})
      await advanceTime({days: termInDays.toNumber()})
      const payAmount = usdcVal(105)
      await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
      await tranchedPool.pay(payAmount, {from: borrower})

      const tokenId = await poolTokens.tokenOfOwnerByIndex(seniorPool.address, 0)

      const tokenInfoBefore = await poolTokens.getTokenInfo(tokenId)
      const originalSharePrice = await seniorPool.sharePrice()

      await seniorPool.redeem(tokenId)

      const tokenInfoAfter = await poolTokens.getTokenInfo(tokenId)
      const newSharePrice = await seniorPool.sharePrice()

      const interestRedeemed = new BN(tokenInfoAfter.interestRedeemed).sub(new BN(tokenInfoBefore.interestRedeemed))

      const expectedSharePrice = interestRedeemed
        .mul(decimals.div(USDC_DECIMALS))
        .mul(decimals)
        .div(await fidu.totalSupply())
        .add(originalSharePrice)

      expect(newSharePrice).to.bignumber.gt(originalSharePrice)
      expect(newSharePrice).to.bignumber.equal(expectedSharePrice)
    })

    it("should emit events for interest, principal, and reserve", async () => {
      // Make the senior pool invest
      await tranchedPool.lockJuniorCapital({from: borrower})
      await seniorPool.invest(tranchedPool.address)

      // Simulate repayment ensuring a full term has passed
      await tranchedPool.lockPool({from: borrower})
      await tranchedPool.drawdown(usdcVal(100), {from: borrower})
      await advanceTime({days: termInDays.toNumber()})
      const payAmount = usdcVal(105)
      await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
      await tranchedPool.pay(payAmount, {from: borrower})

      const tokenId = await poolTokens.tokenOfOwnerByIndex(seniorPool.address, 0)

      const tokenInfoBefore = await poolTokens.getTokenInfo(tokenId)

      const receipt = await seniorPool.redeem(tokenId)

      const tokenInfoAfter = await poolTokens.getTokenInfo(tokenId)
      const interestRedeemed = new BN(tokenInfoAfter.interestRedeemed).sub(new BN(tokenInfoBefore.interestRedeemed))
      const principalRedeemed = new BN(tokenInfoAfter.principalRedeemed).sub(new BN(tokenInfoBefore.principalRedeemed))

      expectEvent(receipt, "InterestCollected", {
        payer: tranchedPool.address,
        amount: interestRedeemed,
      })

      expectEvent(receipt, "PrincipalCollected", {
        payer: tranchedPool.address,
        amount: principalRedeemed,
      })

      // No reserve funds should be collected for a regular redeem
      expectEvent.notEmitted(receipt, "ReserveFundsCollected")
    })

    describe("epoch checkpointing", () => {
      let tokenId
      let usdcAvailableBeforeRedeem
      beforeEach(async () => {
        // Epoch 0: Make the senior pool invest
        await tranchedPool.lockJuniorCapital({from: borrower})
        await seniorPool.invest(tranchedPool.address)
        tokenId = await poolTokens.tokenOfOwnerByIndex(seniorPool.address, 0)
        await tranchedPool.lockPool({from: borrower})
        await tranchedPool.drawdown(usdcVal(100), {from: borrower})

        // Epoch 2: First tranchedpool payment is due
        await advanceTime({days: 30})
        await tranchedPool.assess()
        await tranchedPool.pay(await creditLine.totalInterestAccrued())

        usdcAvailableBeforeRedeem = await seniorPool.usdcAvailable()
      })
      describe("in the current epoch", () => {
        it("increases usdcAvailable by redemption amount", async () => {
          // Epoch 2: Redeem
          await seniorPool.redeem(tokenId)
          const tokenInfo = await getPoolTokenInfo(tokenId)
          const seniorPoolUsdcRedeemed = tokenInfo.interestRedeemed.add(tokenInfo.principalRedeemed)
          expect((await seniorPool.usdcAvailable()).sub(usdcAvailableBeforeRedeem)).to.bignumber.eq(
            seniorPoolUsdcRedeemed
          )
        })
      })
      describe("when the last epoch hasn't been checkpointed", async () => {
        it("increases usdcIn by redemption amount", async () => {
          // Epoch 3: Redeem
          await advanceAndMineBlock({days: 14})
          await seniorPool.redeem(tokenId)
          const tokenInfo = await getPoolTokenInfo(tokenId)
          const seniorPoolUsdcRedeemed = tokenInfo.interestRedeemed.add(tokenInfo.principalRedeemed)
          expect((await seniorPool.usdcAvailable()).sub(usdcAvailableBeforeRedeem)).to.bignumber.eq(
            seniorPoolUsdcRedeemed
          )
        })
      })
      describe("when multiple epochs haven't been checkpointed", async () => {
        it("increases usdcIn by redemption amount", async () => {
          // Epoch 4: Redeem
          await advanceAndMineBlock({days: 28})
          await seniorPool.redeem(tokenId)
          const tokenInfo = await getPoolTokenInfo(tokenId)
          const seniorPoolUsdcRedeemed = tokenInfo.interestRedeemed.add(tokenInfo.principalRedeemed)
          expect((await seniorPool.usdcAvailable()).sub(usdcAvailableBeforeRedeem)).to.bignumber.eq(
            seniorPoolUsdcRedeemed
          )
        })
      })
    })
  })

  describe("writedown", async () => {
    let originalSharePrice, originalTotalShares
    let tokenId, juniorTokenId
    const juniorInvestmentAmount = usdcVal(20)

    const testSetup = deployments.createFixture(async () => {
      await makeDeposit(person2, usdcVal(100))

      const juniorReceipt = await tranchedPool.deposit(TRANCHES.Junior, juniorInvestmentAmount)
      juniorTokenId = juniorReceipt.logs[0].args.tokenId
      await tranchedPool.lockJuniorCapital({from: borrower})
      const receipt = await seniorPool.invest(tranchedPool.address)
      const depositEvent = decodeLogs(receipt.receipt.rawLogs, tranchedPool, "DepositMade")[0]
      assertNonNullable(depositEvent)
      tokenId = depositEvent.args.tokenId
      await tranchedPool.lockPool({from: borrower})
      await tranchedPool.drawdown(usdcVal(100), {from: borrower})

      originalSharePrice = await seniorPool.sharePrice()
      originalTotalShares = await fidu.totalSupply()
    })

    beforeEach(async () => {
      await testSetup()
    })

    describe("epoch checkpointing", () => {
      const paymentPeriodInSeconds = paymentPeriodInDays.mul(SECONDS_PER_DAY)
      const twoPaymentPeriodsInSeconds = paymentPeriodInSeconds.mul(new BN(2))
      let epochBeforeWritedown, postWritedownSharePrice
      beforeEach(async () => {
        // Assess for two periods of lateness
        await advanceTime({seconds: twoPaymentPeriodsInSeconds})
        // Deposit to trigger a checkpoint
        await seniorPool.deposit(usdcVal(1), {from: owner})
        epochBeforeWritedown = await getCurrentEpoch()
        // Writedown
        await expectAction(() => seniorPool.writedown(tokenId)).toChange([[seniorPool.sharePrice, {decrease: true}]])
        postWritedownSharePrice = await seniorPool.sharePrice()
      })
      describe("in the current epoch", () => {
        it("does not affect the current epoch", async () => {
          // Should not have affected the epoch
          expect(epochBeforeWritedown).to.deep.eq(await getCurrentEpoch())
        })
      })
      describe("when the last epoch hasn't been checkpointed", () => {
        it.skip("locks in the last epoch at pre-writedown share price", async () => {
          // TODO: fix this test
          await advanceAndMineBlock({days: 14})
          // Deposit to trigger a checkpoint and then get the previous epoch
          await seniorPool.deposit(usdcVal(1), {from: owner})
          const writedownEpoch = await seniorPool.epochAt((await getCurrentEpoch()).id.sub(new BN(1)))
        })
      })
      describe("when multiple epochs haven't been checkpointed", () => {
        it.skip("locks in those epoch's share prices at pre-writedown share price", async () => {
          // TODO: fix this test
          await advanceAndMineBlock({days: 28})
          // Deposit to trigger a checkpoint and then get the previous epoch
          await seniorPool.deposit(usdcVal(1), {from: owner})
          let writedownEpoch = await seniorPool.epochAt((await getCurrentEpoch()).id.sub(new BN(2)))
          writedownEpoch = await seniorPool.epochAt((await getCurrentEpoch()).id.sub(new BN(1)))
        })
      })
    })

    context("called by non-governance", async () => {
      it("should not revert", async () => {
        expect(seniorPool.writedown(tokenId, {from: person2})).to.not.be.rejected
      })
    })

    context("before loan term ends", async () => {
      it("should write down the principal and distribute losses", async () => {
        // Assess for two periods of lateness
        const paymentPeriodInSeconds = paymentPeriodInDays.mul(SECONDS_PER_DAY)
        const twoPaymentPeriodsInSeconds = paymentPeriodInSeconds.mul(new BN(2))
        await advanceTime({seconds: twoPaymentPeriodsInSeconds})
        // So writedown is 2 periods late - 1 grace period / 4 max = 25%
        const expectedWritedown = usdcVal(80).div(new BN(4)) // 25% of 80 = 20

        await tranchedPool.assess()
        await expectAction(() => seniorPool.writedown(tokenId)).toChange([
          [seniorPool.totalWritedowns, {byCloseTo: expectedWritedown}],
          [seniorPool.assets, {byCloseTo: expectedWritedown.neg()}],
        ])

        const newSharePrice = await seniorPool.sharePrice()
        const delta = originalSharePrice.sub(newSharePrice)
        const normalizedWritedown = await seniorPool.usdcToFidu(expectedWritedown)
        const expectedDelta = normalizedWritedown.mul(decimals).div(originalTotalShares)

        expect(delta).to.be.bignumber.closeTo(expectedDelta, fiduTolerance)
        expect(newSharePrice).to.be.bignumber.lt(originalSharePrice)
        expect(newSharePrice).to.be.bignumber.closeTo(originalSharePrice.sub(delta), fiduTolerance)
      })

      it("should decrease the write down amount if partially paid back", async () => {
        // Assess for two periods of lateness
        const paymentPeriodInSeconds = paymentPeriodInDays.mul(SECONDS_PER_DAY)
        const twoPaymentPeriodsInSeconds = paymentPeriodInSeconds.mul(new BN(2))
        await advanceTime({seconds: twoPaymentPeriodsInSeconds})
        // Writedown is 2 periods late - 1 grace period / 4 max = 25%
        const expectedWritedown = usdcVal(80).div(new BN(4)) // 25% of 80 = 20

        await tranchedPool.assess()
        await expectAction(() => seniorPool.writedown(tokenId)).toChange([
          [seniorPool.totalWritedowns, {byCloseTo: expectedWritedown}],
          [seniorPool.assets, {byCloseTo: expectedWritedown.neg()}],
        ])

        const sharePriceAfterAssess = await seniorPool.sharePrice()

        // Pay back half of one period
        const creditLine = await artifacts.require("CreditLine").at(await tranchedPool.creditLine())
        const interestOwed = await creditLine.interestOwed()
        const interestPaid = interestOwed.div(new BN(4)) // interestOwed is for 2 periods
        const expectedNewWritedown = expectedWritedown.div(new BN(2))
        await tranchedPool.pay(interestPaid, {from: borrower})

        await expectAction(() => seniorPool.writedown(tokenId)).toChange([
          [seniorPool.totalWritedowns, {byCloseTo: expectedWritedown.sub(expectedNewWritedown).neg()}],
          [seniorPool.assets, {byCloseTo: expectedWritedown.sub(expectedNewWritedown)}],
        ])

        const finalSharePrice = await seniorPool.sharePrice()
        const delta = originalSharePrice.sub(finalSharePrice)
        const normalizedWritedown = await seniorPool.usdcToFidu(expectedNewWritedown)
        const expectedDelta = normalizedWritedown.mul(decimals).div(originalTotalShares)

        expect(delta).to.be.bignumber.closeTo(expectedDelta, fiduTolerance)
        // Share price must go down after the initial write down, and then up after partially paid back
        expect(sharePriceAfterAssess).to.be.bignumber.lt(originalSharePrice)
        expect(finalSharePrice).to.be.bignumber.gt(sharePriceAfterAssess)
        expect(finalSharePrice).to.be.bignumber.closeTo(originalSharePrice.sub(delta), fiduTolerance)
      })

      it("should apply USDC in the credit line before writedown", async () => {
        // We expect the senior pool to assess the pool before writing it down. This prevents
        // accidentally writing down a pool that has received a payment that is still unapplied

        // Two periods of lateness
        const paymentPeriodInSeconds = paymentPeriodInDays.mul(SECONDS_PER_DAY)
        const twoPaymentPeriodsInSeconds = paymentPeriodInSeconds.mul(new BN(2))
        await advanceTime({seconds: twoPaymentPeriodsInSeconds})
        // Send payment directly to the credit line
        erc20Transfer(usdc, [creditLine.address], usdcVal(100), borrower)
        await expectAction(() => seniorPool.writedown(tokenId)).toChange([
          [seniorPool.totalWritedowns, {unchanged: true}],
          [seniorPool.assets, {unchanged: true}],
        ])
      })

      it("should reset the writedowns to 0 if fully paid back", async () => {
        // Assess for two periods of lateness
        const paymentPeriodInSeconds = paymentPeriodInDays.mul(SECONDS_PER_DAY)
        const twoPaymentPeriodsInSeconds = paymentPeriodInSeconds.mul(new BN(2))
        await advanceTime({seconds: twoPaymentPeriodsInSeconds})
        // Writedown is 2 periods late - 1 grace period / 4 max = 25%
        const expectedWritedown = usdcVal(80).div(new BN(4)) // 25% of 80 = 20

        await tranchedPool.assess()
        await expectAction(() => seniorPool.writedown(tokenId)).toChange([
          [seniorPool.totalWritedowns, {byCloseTo: expectedWritedown}],
          [seniorPool.assets, {byCloseTo: expectedWritedown.neg()}],
        ])

        const sharePriceAfterAssess = await seniorPool.sharePrice()

        // Pay back all interest owed
        const creditLine = await artifacts.require("CreditLine").at(await tranchedPool.creditLine())
        const interestOwed = await creditLine.interestOwed()
        const interestPaid = interestOwed
        const expectedNewWritedown = new BN(0)
        await tranchedPool.pay(interestPaid, {from: borrower})

        await expectAction(() => seniorPool.writedown(tokenId)).toChange([
          [seniorPool.totalWritedowns, {to: new BN(0)}],
          [seniorPool.assets, {byCloseTo: expectedWritedown.sub(expectedNewWritedown)}],
        ])

        const finalSharePrice = await seniorPool.sharePrice()
        const delta = originalSharePrice.sub(finalSharePrice)

        expect(delta).to.be.bignumber.equal(new BN(0))
        // Share price must go down after the initial write down, and then back up to original after fully repaid
        expect(sharePriceAfterAssess).to.be.bignumber.lt(originalSharePrice)
        expect(finalSharePrice).to.be.bignumber.gt(sharePriceAfterAssess)
        expect(finalSharePrice).to.be.bignumber.equal(originalSharePrice)
      })

      it("should emit an event", async () => {
        // Assess for two periods of lateness
        const paymentPeriodInSeconds = paymentPeriodInDays.mul(SECONDS_PER_DAY)
        const twoPaymentPeriodsInSeconds = paymentPeriodInSeconds.mul(new BN(2))
        await advanceTime({seconds: twoPaymentPeriodsInSeconds})
        // So writedown is 2 periods late - 1 grace period / 4 max = 25%
        const expectedWritedown = usdcVal(80).div(new BN(4)) // 25% of 80 = 20

        await tranchedPool.assess()
        const receipt = await seniorPool.writedown(tokenId)
        const event = decodeLogs(receipt.receipt.rawLogs, seniorPool, "PrincipalWrittenDown")[0]
        assertNonNullable(event)
        expect(event.args.tranchedPool).to.equal(tranchedPool.address)
        expect(event.args.amount).to.bignumber.closeTo(expectedWritedown, fiduTolerance)
      })
    })

    context("after termEndTime", () => {
      beforeEach(async () => {
        // Advance to the end of the loan while making on-time payments
        while (!(await creditLine.nextDueTime()).eq(await creditLine.termEndTime())) {
          await advanceTime({toSecond: await creditLine.nextDueTime()})
          await tranchedPool.assess()
          const interestOwed = await creditLine.interestOwed()
          await tranchedPool.pay(interestOwed, {from: borrower})
        }
        await advanceTime({toSecond: await creditLine.termEndTime()})
        await tranchedPool.assess()
      })
      it("should have daysLate proportional to days after termEndTime + totalOwed / totalOwedPerDay", async () => {
        // At term end time we're not yet past the grace period so the writedown amount should be 0
        await expectAction(() => seniorPool.writedown(tokenId)).toChange([
          [() => seniorPool.writedownsByPoolToken(tokenId), {unchanged: true}],
        ])

        // Advance two payment period past term end time.
        await advanceTime({
          toSecond: (await creditLine.termEndTime()).add(paymentPeriodInDays.mul(new BN(2)).mul(SECONDS_PER_DAY)),
        })

        // 60 days past termEndTime + ~1 days late on (interestOwed + principalOwed) / (interestOwedPerDay and principalOwedPerDay)
        // ~= 61 - 30 / 4 = 26%
        const expectedWritedown = usdcVal(80).mul(new BN(26)).div(new BN(100))

        await expectAction(() => seniorPool.writedown(tokenId)).toChange([
          [seniorPool.totalWritedowns, {byCloseTo: expectedWritedown}],
          [seniorPool.assets, {byCloseTo: expectedWritedown.neg()}],
        ])
      })
    })

    context("tokenId is not owned by senior pool", () => {
      it("reverts", async () => {
        await expect(seniorPool.writedown(juniorTokenId)).to.be.rejectedWith(
          /Only tokens owned by the senior pool can be written down/
        )
      })
    })
  })

  describe("calculateWritedown", async () => {
    let tokenId
    const juniorInvestmentAmount = usdcVal(20)
    const testSetup = deployments.createFixture(async () => {
      await makeDeposit(person2, usdcVal(100))

      await tranchedPool.deposit(TRANCHES.Junior, juniorInvestmentAmount)
      await tranchedPool.lockJuniorCapital({from: borrower})
      const receipt = await seniorPool.invest(tranchedPool.address)
      const depositEvent = decodeLogs(receipt.receipt.rawLogs, tranchedPool, "DepositMade")[0]
      assertNonNullable(depositEvent)
      tokenId = depositEvent.args.tokenId
      await tranchedPool.lockPool({from: borrower})
      await tranchedPool.drawdown(usdcVal(100), {from: borrower})
    })

    beforeEach(async () => {
      await testSetup()
    })

    it("returns writedown amount", async () => {
      const paymentPeriodInSeconds = paymentPeriodInDays.mul(SECONDS_PER_DAY)
      const twoPaymentPeriodsInSeconds = paymentPeriodInSeconds.mul(new BN(2))
      await advanceTime({seconds: twoPaymentPeriodsInSeconds.add(new BN(10000))})

      // So writedown is 2 periods late - 1 grace period / 4 max = 25%
      const expectedWritedown = usdcVal(80).div(new BN(4)) // 25% of 80 = ~20

      await tranchedPool.assess()
      const writedownAmount = await seniorPool.calculateWritedown(tokenId)

      expect(writedownAmount).to.bignumber.closeTo(expectedWritedown, tolerance)
    })
  })
})
