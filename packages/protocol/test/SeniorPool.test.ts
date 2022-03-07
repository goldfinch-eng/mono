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
import {
  DepositMade,
  InvestmentMadeInSenior,
  ReserveFundsCollected,
  WithdrawalMade,
} from "../typechain/truffle/SeniorPool"
import {TestSeniorPoolInstance} from "../typechain/truffle"
const WITHDRAWL_FEE_DENOMINATOR = new BN(200)

const TEST_TIMEOUT = 30_000

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
  let accounts, owner, person2, person3, reserve, borrower

  let seniorPool: TestSeniorPoolInstance, seniorPoolFixedStrategy, usdc, fidu, goldfinchConfig, tranchedPool, creditLine

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
      seniorPoolFixedStrategy,
      usdc,
      fidu,
      goldfinchFactory,
      goldfinchConfig,
      poolTokens,
    } = await deployBaseFixture()
    // A bit of setup for our test users
    await erc20Approve(usdc, _seniorPool.address, usdcVal(100000), [person2])
    await erc20Transfer(usdc, [person2, person3], usdcVal(10000), owner)
    await goldfinchConfig.setTreasuryReserve(reserve)

    await goldfinchConfig.bulkAddToGoList([owner, person2, person3, reserve, _seniorPool.address])
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

    return {
      usdc,
      seniorPool: _seniorPool as TestSeniorPoolInstance,
      seniorPoolFixedStrategy,
      tranchedPool,
      creditLine,
      fidu,
      goldfinchConfig,
      poolTokens,
    }
  })

  beforeEach(async () => {
    // Pull in our unlocked accounts
    accounts = await web3.eth.getAccounts()
    ;[owner, person2, person3, reserve] = accounts
    borrower = person2
    ;({usdc, seniorPool, seniorPoolFixedStrategy, tranchedPool, creditLine, fidu, goldfinchConfig} = await setupTest())
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

      it("disallows invest", async () => {
        await expect(seniorPool.invest(tranchedPool.address)).to.be.rejectedWith(/Pausable: paused/)
      })

      it("disallows redeem", async () => {
        return expect(seniorPool.redeem(tranchedPool.address)).to.be.rejectedWith(/Pausable: paused/)
      })

      it("disallows writedown", async () => {
        return expect(seniorPool.writedown(tranchedPool.address)).to.be.rejectedWith(/Pausable: paused/)
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
        return expect(seniorPool.pause({from: person2})).to.be.rejectedWith(/Must have pauser role/)
      })
    })
  })

  describe("updateGoldfinchConfig", () => {
    describe("setting it", async () => {
      it("should allow the owner to set it", async () => {
        await goldfinchConfig.setAddress(CONFIG_KEYS.GoldfinchConfig, person2)
        return expectAction(() => seniorPool.updateGoldfinchConfig({from: owner})).toChange([
          [() => seniorPool.config(), {to: person2, bignumber: false}],
        ])
      })
      it("should disallow non-owner to set", async () => {
        return expect(seniorPool.updateGoldfinchConfig({from: person2})).to.be.rejectedWith(/Must have admin/)
      })

      it("should emit an event", async () => {
        const newConfig = await deployments.deploy("GoldfinchConfig", {from: owner})

        await goldfinchConfig.setGoldfinchConfig(newConfig.address)
        const tx = await seniorPool.updateGoldfinchConfig({from: owner})
        expectEvent(tx, "GoldfinchConfigUpdated", {
          who: owner,
          configAddress: newConfig.address,
        })
      })
    })
  })

  describe("deposit", () => {
    describe("before you have approved the senior pool to transfer funds on your behalf", async () => {
      it("should fail", async () => {
        const expectedErr = /transfer amount exceeds allowance/
        return expect(makeDeposit(person3)).to.be.rejectedWith(expectedErr)
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
    it("deposits with permit", async () => {
      const capitalProviderAddress = person2.toLowerCase()
      const nonce = await usdc.nonces(capitalProviderAddress)
      const deadline = MAX_UINT
      const value = usdcVal(100)

      // Create signature for permit
      const digest = await getApprovalDigest({
        token: usdc,
        owner: capitalProviderAddress,
        spender: seniorPool.address.toLowerCase(),
        value,
        nonce,
        deadline,
      })
      const wallet = await getWallet(capitalProviderAddress)
      assertNonNullable(wallet)
      const {v, r, s} = ecsign(Buffer.from(digest.slice(2), "hex"), Buffer.from(wallet.privateKey.slice(2), "hex"))

      // Sanity check that deposit is correct
      await expectAction(() =>
        (seniorPool as any).depositWithPermit(value, deadline, v, r, s, {
          from: capitalProviderAddress,
        })
      ).toChange([
        [() => getBalance(person2, usdc), {by: value.neg()}],
        [() => getBalance(seniorPool.address, usdc), {by: value}],
        [() => getBalance(person2, fidu), {by: value.mul(decimalsDelta)}],
      ])

      // Verify that permit creates allowance for amount only
      expect(await usdc.allowance(person2, seniorPool.address)).to.bignumber.eq("0")
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
      expect(event.args.reserveAmount).to.bignumber.equal(reserveAmount)
      expect(event.args.userAmount).to.bignumber.equal(withdrawAmount.sub(reserveAmount))
    })

    it("should emit an event that the reserve received funds", async () => {
      await makeDeposit()
      const result = await makeWithdraw()
      const event = decodeAndGetFirstLog<ReserveFundsCollected>(
        result.receipt.rawLogs,
        seniorPool,
        "ReserveFundsCollected"
      )

      expect(event.event).to.equal("ReserveFundsCollected")
      expect(event.args.user).to.equal(capitalProvider)
      expect(event.args.amount).to.bignumber.equal(withdrawAmount.div(WITHDRAWL_FEE_DENOMINATOR))
    })

    it("sends the amount back to the address, accounting for fees", async () => {
      await makeDeposit()
      const addressValueBefore = await getBalance(person2, usdc)
      await makeWithdraw()
      const addressValueAfter = await getBalance(person2, usdc)
      const expectedFee = withdrawAmount.div(WITHDRAWL_FEE_DENOMINATOR)
      const delta = addressValueAfter.sub(addressValueBefore)
      expect(delta).bignumber.equal(withdrawAmount.sub(expectedFee))
    })

    it("should send the fees to the reserve address", async () => {
      await makeDeposit()
      const reserveBalanceBefore = await getBalance(reserve, usdc)
      await makeWithdraw()
      const reserveBalanceAfter = await getBalance(reserve, usdc)
      const expectedFee = withdrawAmount.div(WITHDRAWL_FEE_DENOMINATOR)
      const delta = reserveBalanceAfter.sub(reserveBalanceBefore)
      expect(delta).bignumber.equal(expectedFee)
    })

    context("address has ZAPPER_ROLE", async () => {
      it("should not take protocol fees", async () => {
        await seniorPool.initZapperRole()
        await seniorPool.grantRole(await seniorPool.ZAPPER_ROLE(), person2)

        await makeDeposit(person2)
        const reserveBalanceBefore = await getBalance(reserve, usdc)
        await makeWithdraw(person2)
        const reserveBalanceAfter = await getBalance(reserve, usdc)
        const delta = reserveBalanceAfter.sub(reserveBalanceBefore)
        expect(delta).bignumber.equal(new BN(0))
      })
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
  })

  describe("hard limits", async () => {
    describe("totalFundsLimit", async () => {
      describe("once it's set", async () => {
        const limit = new BN(5000)
        const testSetup = deployments.createFixture(async () => {
          await goldfinchConfig.setNumber(CONFIG_KEYS.TotalFundsLimit, limit.mul(USDC_DECIMALS))
          await goldfinchConfig.setNumber(CONFIG_KEYS.TransactionLimit, limit.mul(new BN(2)).mul(USDC_DECIMALS))
        })

        beforeEach(async () => {
          await testSetup()
        })

        it("should accept deposits before the limit is reached", async () => {
          return expect(makeDeposit(person2, new BN(1000).mul(USDC_DECIMALS))).to.be.fulfilled
        })

        it("should accept everything right up to the limit", async () => {
          return expect(makeDeposit(person2, new BN(limit).mul(USDC_DECIMALS))).to.be.fulfilled
        })

        it("should fail if you're over the limit", async () => {
          return expect(makeDeposit(person2, new BN(limit).add(new BN(1)).mul(USDC_DECIMALS))).to.be.rejectedWith(
            /put the senior pool over the total limit/
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

  describe("invest", () => {
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
  })

  describe("redeem", async () => {
    let tokenAddress, reserveAddress, poolTokens
    const juniorInvestmentAmount = usdcVal(100)

    beforeEach(async () => {
      reserveAddress = await goldfinchConfig.getAddress(CONFIG_KEYS.TreasuryReserve)
      tokenAddress = await goldfinchConfig.getAddress(CONFIG_KEYS.PoolTokens)
      poolTokens = await artifacts.require("PoolTokens").at(tokenAddress)

      await erc20Approve(usdc, seniorPool.address, usdcVal(100000), [owner])
      await makeDeposit(owner, usdcVal(100000))
      await goldfinchConfig.addToGoList(seniorPool.address)

      await tranchedPool.deposit(TRANCHES.Junior, juniorInvestmentAmount)
    })

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

  context("initZapperRole", async () => {
    it("is only callable by admin", async () => {
      await expect(seniorPool.initZapperRole({from: person2})).to.be.rejectedWith(/Must have admin role/)
      await expect(seniorPool.initZapperRole({from: owner})).to.be.fulfilled
    })

    it("initializes ZAPPER_ROLE", async () => {
      await expect(seniorPool.grantRole(await seniorPool.ZAPPER_ROLE(), person2, {from: owner})).to.be.rejectedWith(
        /sender must be an admin to grant/
      )
      await seniorPool.initZapperRole({from: owner})
      // Owner has OWNER_ROLE and can therefore grant ZAPPER_ROLE
      await expect(seniorPool.grantRole(await seniorPool.ZAPPER_ROLE(), person2, {from: owner})).to.be.fulfilled
    })
  })
})
