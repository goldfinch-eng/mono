import hre from "hardhat"
const {deployments, artifacts, web3} = hre
import {
  expect,
  BN,
  advanceTime,
  usdcVal,
  erc20Transfer,
  expectAction,
  SECONDS_PER_DAY,
  decodeLogs,
  getFirstLog,
  Numberish,
} from "./testHelpers"
import {expectEvent} from "@openzeppelin/test-helpers"
import {OWNER_ROLE, PAUSER_ROLE, interestAprAsBN} from "../blockchain_scripts/deployHelpers"
import {CONFIG_KEYS} from "../blockchain_scripts/configKeys"
import {time} from "@openzeppelin/test-helpers"
import {deployBaseFixture} from "./util/fixtures"

let accounts, owner, person2, person3, goldfinchConfig

describe("CreditLine", () => {
  let borrower
  const limit = usdcVal(500)
  const interestApr = interestAprAsBN("5.00")
  const paymentPeriodInDays = new BN(30)
  const lateFeeApr = new BN(0)
  const principalGracePeriod = new BN(185)
  let termEndTime, termInDays
  let usdc
  let creditLine
  const interestOwed = 5
  const principalOwed = 3
  const balance = 10

  async function collectPayment(cl, amount) {
    await usdc.transfer(cl.address, String(usdcVal(amount)), {from: owner})
  }

  const createAndSetCreditLineAttributes = async (
    {
      balance,
      interestOwed,
      principalOwed,
      nextDueTime,
    }: {balance: Numberish; interestOwed: Numberish; principalOwed: Numberish; nextDueTime?: Numberish},
    people: {owner?: string; borrower?: string} = {}
  ) => {
    const thisOwner = people.owner || owner
    const thisBorrower = people.borrower || borrower

    if (!thisBorrower) {
      throw new Error("No borrower is set. Set one in a beforeEach, or pass it in explicitly")
    }

    if (!thisOwner) {
      throw new Error("No owner is set. Please set one in a beforeEach or pass it in explicitly")
    }

    const currentTime = await time.latest()

    // These defaults are pretty arbitrary
    termInDays = 360
    const _nextDueTime = nextDueTime ?? currentTime.add(SECONDS_PER_DAY.mul(paymentPeriodInDays))
    const lastFullPaymentTime = BN.min(new BN(_nextDueTime), currentTime)
    const termInSeconds = SECONDS_PER_DAY.mul(new BN(termInDays))
    termEndTime = currentTime.add(termInSeconds)

    const accountant = await deployments.deploy("Accountant", {from: thisOwner, gasLimit: 4000000, args: []})
    const creditLineDeployment = await deployments.deploy("TestCreditLine", {
      from: thisOwner,
      gasLimit: 4000000,
      libraries: {["Accountant"]: accountant.address},
    })
    const creditLine = await artifacts.require("TestCreditLine").at(creditLineDeployment.address)
    await creditLine.initialize(
      goldfinchConfig.address,
      thisOwner,
      thisBorrower,
      limit,
      interestApr,
      paymentPeriodInDays,
      termInDays,
      lateFeeApr,
      principalGracePeriod,
      {from: thisOwner}
    )

    await Promise.all([
      creditLine.setBalance(usdcVal(balance), {from: thisOwner}),
      creditLine.setInterestOwed(usdcVal(interestOwed), {from: thisOwner}),
      creditLine.setPrincipalOwed(usdcVal(principalOwed), {from: thisOwner}),
      creditLine.setLastFullPaymentTime(lastFullPaymentTime, {from: thisOwner}),
      creditLine.setNextDueTime(_nextDueTime, {from: thisOwner}),
      creditLine.setTermEndTime(termEndTime, {from: thisOwner}),
    ])

    return creditLine
  }

  const setupTest = deployments.createFixture(async ({deployments}) => {
    const {usdc, fidu, goldfinchConfig} = await deployBaseFixture()

    await erc20Transfer(usdc, [person2], usdcVal(1000), owner)
    await goldfinchConfig.bulkAddToGoList(accounts)

    return {usdc, fidu, goldfinchConfig}
  })

  beforeEach(async () => {
    accounts = await web3.eth.getAccounts()
    ;[owner, person2, person3] = accounts
    ;({usdc, goldfinchConfig} = await setupTest())

    borrower = person3

    creditLine = await createAndSetCreditLineAttributes({
      balance: balance,
      interestOwed: interestOwed,
      principalOwed: principalOwed,
    })
  })

  describe("Access Controls", () => {
    it("sets the owner", async () => {
      expect(await creditLine.hasRole(OWNER_ROLE, owner)).to.equal(true)
      expect(await creditLine.getRoleAdmin(OWNER_ROLE)).to.equal(OWNER_ROLE)
    })

    it("sets the pauser", async () => {
      expect(await creditLine.hasRole(PAUSER_ROLE, owner)).to.equal(true)
      expect(await creditLine.getRoleAdmin(PAUSER_ROLE)).to.equal(OWNER_ROLE)
    })

    it("allows the owner to set new addresses as roles", async () => {
      expect(await creditLine.hasRole(OWNER_ROLE, person2)).to.equal(false)
      await creditLine.grantRole(OWNER_ROLE, person2, {from: owner})
      expect(await creditLine.hasRole(OWNER_ROLE, person2)).to.equal(true)
    })

    it("should not allow anyone else to add an owner", async () => {
      return expect(creditLine.grantRole(OWNER_ROLE, person2, {from: person3})).to.be.rejected
    })
  })

  describe("Pausability", () => {
    describe("actually pausing", async () => {
      it("should allow the owner to pause", async () => {
        return expect(creditLine.pause()).to.be.fulfilled
      })
      it("should disallow non-owner to pause", async () => {
        return expect(creditLine.pause({from: person2})).to.be.rejectedWith(/Must have pauser role/)
      })
    })
  })

  describe("updateGoldfinchConfig", () => {
    describe("setting it", async () => {
      it("should allow the owner to set it", async () => {
        await goldfinchConfig.setAddress(CONFIG_KEYS.GoldfinchConfig, person2)
        return expectAction(() => creditLine.updateGoldfinchConfig({from: owner})).toChange([
          [() => creditLine.config(), {to: person2, bignumber: false}],
        ])
      })

      it("should disallow non-owner to set", async () => {
        return expect(creditLine.updateGoldfinchConfig({from: person2})).to.be.rejectedWith(/Must have admin/)
      })

      it("emits an event", async () => {
        const newConfig = await deployments.deploy("GoldfinchConfig", {from: owner})

        await goldfinchConfig.setAddress(CONFIG_KEYS.GoldfinchConfig, newConfig.address)
        const tx = await creditLine.updateGoldfinchConfig()
        const logs = decodeLogs(tx.receipt.rawLogs, creditLine, "GoldfinchConfigUpdated")
        const firstLog = getFirstLog(logs)
        expect(firstLog.event).to.equal("GoldfinchConfigUpdated")
        expect(firstLog.args.who).to.match(new RegExp(tx.receipt.from, "i"))
        expect(firstLog.args.configAddress).to.match(new RegExp(newConfig.address, "i"))
      })
    })
  })

  describe("assess", async () => {
    let currentTime
    beforeEach(async () => {
      currentTime = await time.latest()
    })

    describe("when there is exactly enough collectedPaymentBalance", async () => {
      it("should successfully process the payment and correctly update all attributes", async () => {
        await collectPayment(creditLine, 8)
        await creditLine.setNextDueTime(currentTime)

        await creditLine.assess()

        const expectedNextDueTime = (await creditLine.paymentPeriodInDays())
          .mul(await creditLine.SECONDS_PER_DAY())
          .add(currentTime)

        expect(await creditLine.balance()).to.bignumber.equal(usdcVal(7))
        expect(await creditLine.interestOwed()).to.bignumber.equal("0")
        expect(await creditLine.principalOwed()).to.bignumber.equal("0")
        expect(await creditLine.lastFullPaymentTime()).to.bignumber.equal(currentTime)
        const actualNextDueTime = await creditLine.nextDueTime()
        expect(await creditLine.lastFullPaymentTime()).to.bignumber.lt(actualNextDueTime)
        expect(actualNextDueTime).to.bignumber.closeTo(expectedNextDueTime, actualNextDueTime.div(new BN(100))) // 1% tolerance;
      })

      describe("when you are multiple periods behind", async () => {
        it("should update the nextDueTime to the closest period in time", async () => {
          await collectPayment(creditLine, 8)
          await creditLine.setNextDueTime(currentTime)

          const paymentPeriodInDays = await creditLine.paymentPeriodInDays()
          const secondsPerDay = await creditLine.SECONDS_PER_DAY()
          const secondsPerPeriod = paymentPeriodInDays.mul(secondsPerDay)

          // Set it as if you are multiple periods behind, ie. time is 2 periods in the future.
          const timestampForTest = currentTime.add(secondsPerPeriod.mul(new BN(2)))
          await advanceTime({toSecond: timestampForTest})

          // Assess!
          await creditLine.assess()

          // Should shift it one additional second past the one where it's currently set.
          const expectedNextDueTime = currentTime.add(secondsPerPeriod.mul(new BN(3)))

          expect(await creditLine.nextDueTime()).to.bignumber.equal(expectedNextDueTime)
        })
      })

      describe("When you assess multiple periods after the termEndTime", async () => {
        it("should not set the nextDueTime past the termEndTime", async () => {
          await collectPayment(creditLine, 8)
          await creditLine.setNextDueTime(currentTime)

          const termInDays = await creditLine.termInDays()
          const paymentPeriodInDays = await creditLine.paymentPeriodInDays()
          const secondsPerDay = await creditLine.SECONDS_PER_DAY()
          const secondsPerTerm = termInDays.mul(secondsPerDay)
          const secondsPerPeriod = paymentPeriodInDays.mul(SECONDS_PER_DAY)

          // Set it as if you one period past the termEndTime
          const timestampForTest = currentTime.add(secondsPerTerm.add(secondsPerPeriod).add(new BN(1)))
          await advanceTime({toSecond: timestampForTest})

          // Assess!
          await creditLine.assess()

          // Should cap it at the termEndTime
          const expectedNextDueTime = await creditLine.termEndTime()

          expect(await creditLine.nextDueTime()).to.bignumber.equal(expectedNextDueTime)
        })
      })

      describe("idempotency", async () => {
        it("should keep the nextDueTime and termEndTime what it is if you call it twice", async () => {
          await collectPayment(creditLine, 8)
          await creditLine.setNextDueTime(currentTime)

          const originaltermEndTime = await creditLine.termEndTime()
          await creditLine.assess()

          const expectedNextDueTime = (await creditLine.paymentPeriodInDays())
            .mul(await creditLine.SECONDS_PER_DAY())
            .add(currentTime)
          const actualNextDueTime = await creditLine.nextDueTime()
          const expectedInterestOwed = await creditLine.interestOwed()
          const expectedPrincipalOwed = await creditLine.principalOwed()
          const expectedLastFullPaymentTime = await creditLine.lastFullPaymentTime()
          expect(actualNextDueTime).to.bignumber.closeTo(expectedNextDueTime, actualNextDueTime.div(new BN(100))) // 1% tolerance;

          await creditLine.assess()

          const actualNextDueTimeAgain = await creditLine.nextDueTime()
          const actualtermEndTime = await creditLine.termEndTime()
          const actualInterestOwed = await creditLine.interestOwed()
          const actualPrincipalOwed = await creditLine.principalOwed()
          const actualLastFullPaymentTime = await creditLine.lastFullPaymentTime()

          expect(actualNextDueTimeAgain).to.bignumber.equal(actualNextDueTime) // No tolerance. Should be exact.
          expect(actualtermEndTime).to.bignumber.equal(originaltermEndTime)
          expect(actualInterestOwed).to.bignumber.equal(expectedInterestOwed)
          expect(actualPrincipalOwed).to.bignumber.equal(expectedPrincipalOwed)
          expect(actualLastFullPaymentTime).to.bignumber.equal(expectedLastFullPaymentTime)
        })

        it("does not accrue principal twice after term end time", async () => {
          // Assume interest is paid
          await creditLine.setInterestOwed(usdcVal(0), {from: owner})
          await creditLine.setPrincipalOwed(usdcVal(0), {from: owner})

          const termInDays = await creditLine.termInDays()
          const paymentPeriodInDays = await creditLine.paymentPeriodInDays()
          const secondsPerDay = await creditLine.SECONDS_PER_DAY()
          const secondsPerTerm = termInDays.mul(secondsPerDay)
          const secondsPerPeriod = paymentPeriodInDays.mul(SECONDS_PER_DAY)

          // Set it as if you one period past the termEndTime
          const timestampForTest = currentTime.add(secondsPerTerm.add(secondsPerPeriod).add(new BN(1)))
          await advanceTime({toSecond: timestampForTest})

          expect(await creditLine.principalOwed()).to.bignumber.eq(usdcVal(0))
          expect(await creditLine.interestOwed()).to.bignumber.eq(usdcVal(0))

          await creditLine.assess()

          const principalOwed = await creditLine.principalOwed()
          expect(principalOwed).to.bignumber.eq(await creditLine.balance())

          await creditLine.assess()

          // Should not accrue principal twice
          expect(await creditLine.principalOwed()).to.bignumber.eq(principalOwed)
        })
      })
    })

    describe("when there is only enough to pay interest", async () => {
      it("should pay interest first", async () => {
        await collectPayment(creditLine, 5)
        await creditLine.setNextDueTime(currentTime)

        await creditLine.assess()

        expect(await creditLine.interestOwed()).to.bignumber.equal("0")
        expect(await creditLine.principalOwed()).to.bignumber.equal(usdcVal(principalOwed))
        expect(await creditLine.lastFullPaymentTime()).to.bignumber.equal(currentTime)
      })
    })

    describe("when there is not enough to pay interest", async () => {
      it("should pay interest first but not update lastFullPaymentTime", async () => {
        const interestPaid = 3
        await collectPayment(creditLine, interestPaid)
        await creditLine.setNextDueTime(currentTime)

        const originalLastPaidTime = await creditLine.lastFullPaymentTime()

        await creditLine.assess()

        expect(await creditLine.interestOwed()).to.bignumber.equal(usdcVal(interestOwed).sub(usdcVal(interestPaid)))
        expect(await creditLine.principalOwed()).to.bignumber.equal(usdcVal(principalOwed))
        expect(await creditLine.lastFullPaymentTime()).to.bignumber.equal(originalLastPaidTime)
      })
    })

    describe("when there is more collectedPayment than total amount owed", async () => {
      it("should apply the remaining towards the principal", async () => {
        const paymentAmount = 10
        await collectPayment(creditLine, paymentAmount)
        await creditLine.setNextDueTime(currentTime)

        await creditLine.assess()

        const paymentRemaining = usdcVal(paymentAmount).sub(usdcVal(interestOwed)).sub(usdcVal(principalOwed))
        const expectedBalance = usdcVal(balance).sub(usdcVal(principalOwed)).sub(paymentRemaining)
        expect(await creditLine.balance()).to.bignumber.equal(expectedBalance)
        expect(await creditLine.interestOwed()).to.bignumber.equal("0")
        expect(await creditLine.principalOwed()).to.bignumber.equal(usdcVal("0"))
      })
    })
  })

  describe("termStartTime", async () => {
    it("is correct", async () => {
      expect(await creditLine.termStartTime()).to.bignumber.equal(
        termEndTime.sub(SECONDS_PER_DAY.mul(new BN(termInDays)))
      )
    })
  })

  describe("updateGoldfinchConfig", () => {
    it("emits an event", async () => {
      const newConfig = await deployments.deploy("GoldfinchConfig", {from: owner})
      await goldfinchConfig.setGoldfinchConfig(newConfig.address)
      const tx = await creditLine.updateGoldfinchConfig({from: owner})
      expectEvent(tx, "GoldfinchConfigUpdated", {
        who: owner,
        configAddress: newConfig.address,
      })
    })
  })
})
