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
import {
  advanceTime,
  expect,
  BN,
  getBalance,
  deployAllContracts,
  erc20Transfer,
  erc20Approve,
  expectAction,
  decimals,
  USDC_DECIMALS,
  SECONDS_PER_DAY,
  usdcVal,
  createPoolWithCreditLine,
  fiduTolerance,
  tolerance,
  decodeLogs,
} from "./testHelpers"
import {expectEvent} from "@openzeppelin/test-helpers"
import {ecsign} from "ethereumjs-util"
import {getApprovalDigest, getWallet} from "./permitHelpers"
import {assertNonNullable} from "../utils/type"
const WITHDRAWL_FEE_DENOMINATOR = new BN(200)

const simulateMaliciousTranchedPool = async (goldfinchConfig: any, person2: any): Promise<string> => {
  // Simulate someone deploying their own malicious TranchedPool using our contracts
  let accountant = await deployments.deploy("Accountant", {from: person2, args: []})
  let poolDeployResult = await deployments.deploy("TranchedPool", {
    from: person2,
    libraries: {["Accountant"]: accountant.address},
  })
  let unknownPool = await artifacts.require("TranchedPool").at(poolDeployResult.address)
  let creditLineResult = await deployments.deploy("CreditLine", {
    from: person2,
    libraries: {["Accountant"]: accountant.address},
  })
  let creditLine = await artifacts.require("CreditLine").at(creditLineResult.address)
  await creditLine.initialize(
    goldfinchConfig.address,
    person2,
    person2,
    usdcVal(1000),
    interestAprAsBN("0"),
    new BN(1),
    new BN(10),
    interestAprAsBN("0")
  )
  await unknownPool.initialize(
    goldfinchConfig.address,
    person2,
    new BN(20),
    usdcVal(1000),
    interestAprAsBN("0"),
    new BN(1),
    new BN(10),
    interestAprAsBN("0")
  )
  await unknownPool.lockJuniorCapital({from: person2})

  return unknownPool.address
}

describe("SeniorFund", () => {
  let accounts, owner, person2, person3, reserve, borrower

  let seniorFund, seniorFundStrategy, usdc, fidu, goldfinchConfig, tranchedPool, creditLine

  let interestApr = interestAprAsBN("5.00")
  let paymentPeriodInDays = new BN(30)
  let lateFeeApr = new BN(0)
  let limit = usdcVal(100000)
  let termInDays = new BN(365)
  let juniorFeePercent = new BN(20)
  let depositAmount = new BN(4).mul(USDC_DECIMALS)
  let withdrawAmount = new BN(2).mul(USDC_DECIMALS)
  const decimalsDelta = decimals.div(USDC_DECIMALS)

  let makeDeposit = async (person?: string, amount?: BN) => {
    amount = amount || depositAmount
    person = person || person2
    return await seniorFund.deposit(String(amount), {from: person})
  }
  let makeWithdraw = async (person?: string, usdcAmount?: BN) => {
    usdcAmount = usdcAmount || withdrawAmount
    person = person || person2
    return await seniorFund.withdraw(usdcAmount, {from: person})
  }

  let makeWithdrawInFidu = async (person, fiduAmount) => {
    return await seniorFund.withdrawInFidu(fiduAmount, {from: person})
  }

  const setupTest = deployments.createFixture(async ({deployments}) => {
    const {seniorFund, seniorFundStrategy, usdc, fidu, goldfinchFactory, goldfinchConfig, poolTokens} =
      await deployAllContracts(deployments)
    // A bit of setup for our test users
    await erc20Approve(usdc, seniorFund.address, usdcVal(100000), [person2])
    await erc20Transfer(usdc, [person2, person3], usdcVal(10000), owner)
    await goldfinchConfig.setTreasuryReserve(reserve)

    await goldfinchConfig.bulkAddToGoList([owner, person2, person3, reserve, seniorFund.address])
    ;({tranchedPool, creditLine} = await createPoolWithCreditLine({
      people: {owner, borrower},
      goldfinchFactory,
      limit,
      interestApr,
      paymentPeriodInDays,
      termInDays,
      lateFeeApr,
      juniorFeePercent: juniorFeePercent.toNumber(),
      usdc,
    }))

    return {usdc, seniorFund, seniorFundStrategy, tranchedPool, creditLine, fidu, goldfinchConfig, poolTokens}
  })

  beforeEach(async () => {
    // Pull in our unlocked accounts
    accounts = await web3.eth.getAccounts()
    ;[owner, person2, person3, reserve] = accounts
    borrower = person2
    ;({usdc, seniorFund, seniorFundStrategy, tranchedPool, creditLine, fidu, goldfinchConfig} = await setupTest())
  })

  describe("Access Controls", () => {
    it("sets the owner", async () => {
      expect(await seniorFund.hasRole(OWNER_ROLE, owner)).to.equal(true)
      expect(await seniorFund.getRoleAdmin(OWNER_ROLE)).to.equal(OWNER_ROLE)
    })

    it("sets the pauser", async () => {
      expect(await seniorFund.hasRole(PAUSER_ROLE, owner)).to.equal(true)
      expect(await seniorFund.getRoleAdmin(PAUSER_ROLE)).to.equal(OWNER_ROLE)
    })

    it("allows the owner to set new addresses as roles", async () => {
      expect(await seniorFund.hasRole(OWNER_ROLE, person2)).to.equal(false)
      await seniorFund.grantRole(OWNER_ROLE, person2, {from: owner})
      expect(await seniorFund.hasRole(OWNER_ROLE, person2)).to.equal(true)
    })

    it("should not allow anyone else to add an owner", async () => {
      return expect(seniorFund.grantRole(OWNER_ROLE, person2, {from: person3})).to.be.rejected
    })
  })

  describe("Pausability", () => {
    describe("after pausing", async () => {
      beforeEach(async () => {
        await makeDeposit()
        await seniorFund.pause()
        await goldfinchConfig.addToGoList(seniorFund.address)
      })

      it("disallows deposits", async () => {
        return expect(makeDeposit()).to.be.rejectedWith(/Pausable: paused/)
      })

      it("disallows withdrawing", async () => {
        return expect(makeWithdraw()).to.be.rejectedWith(/Pausable: paused/)
      })

      it("disallows invest", async () => {
        await expect(seniorFund.invest(tranchedPool.address)).to.be.rejectedWith(/Pausable: paused/)
      })

      it("disallows investJunior", async () => {
        await expect(seniorFund.investJunior(tranchedPool.address, new BN(100))).to.be.rejectedWith(/Pausable: paused/)
      })

      it("disallows redeem", async () => {
        return expect(seniorFund.redeem(tranchedPool.address)).to.be.rejectedWith(/Pausable: paused/)
      })

      it("disallows writedown", async () => {
        return expect(seniorFund.writedown(tranchedPool.address)).to.be.rejectedWith(/Pausable: paused/)
      })

      it("allows unpausing", async () => {
        await seniorFund.unpause()
        return expect(makeDeposit()).to.be.fulfilled
      })
    })

    describe("actually pausing", async () => {
      it("should allow the owner to pause", async () => {
        return expect(seniorFund.pause()).to.be.fulfilled
      })
      it("should disallow non-owner to pause", async () => {
        return expect(seniorFund.pause({from: person2})).to.be.rejectedWith(/Must have pauser role/)
      })
    })
  })

  describe("updateGoldfinchConfig", () => {
    describe("setting it", async () => {
      it("should allow the owner to set it", async () => {
        await goldfinchConfig.setAddress(CONFIG_KEYS.GoldfinchConfig, person2)
        return expectAction(() => seniorFund.updateGoldfinchConfig({from: owner})).toChange([
          [() => seniorFund.config(), {to: person2, bignumber: false}],
        ])
      })
      it("should disallow non-owner to set", async () => {
        return expect(seniorFund.updateGoldfinchConfig({from: person2})).to.be.rejectedWith(/Must have admin/)
      })
    })
  })

  describe("deposit", () => {
    describe("before you have approved the fund to transfer funds on your behalf", async () => {
      it("should fail", async () => {
        const expectedErr = "VM Exception while processing transaction: revert ERC20: transfer amount exceeds allowance"
        return expect(makeDeposit(person3)).to.be.rejectedWith(expectedErr)
      })
    })

    describe("after you have approved the fund to transfer funds", async () => {
      let capitalProvider
      beforeEach(async () => {
        await usdc.approve(seniorFund.address, new BN(100000).mul(USDC_DECIMALS), {from: person2})
        await usdc.approve(seniorFund.address, new BN(100000).mul(USDC_DECIMALS), {from: owner})
        capitalProvider = person2
      })

      it("increases the fund's balance of the ERC20 token when you call deposit", async () => {
        const balanceBefore = await getBalance(seniorFund.address, usdc)
        await makeDeposit()
        const balanceAfter = await getBalance(seniorFund.address, usdc)
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
        const event = result.logs[0]

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
      let capitalProviderAddress = person2.toLowerCase()
      let nonce = await usdc.nonces(capitalProviderAddress)
      let deadline = MAX_UINT
      let value = usdcVal(100)

      // Create signature for permit
      let digest = await getApprovalDigest({
        token: usdc,
        owner: capitalProviderAddress,
        spender: seniorFund.address.toLowerCase(),
        value,
        nonce,
        deadline,
      })
      let wallet = await getWallet(capitalProviderAddress)
      let {v, r, s} = ecsign(Buffer.from(digest.slice(2), "hex"), Buffer.from(wallet.privateKey.slice(2), "hex"))

      // Sanity check that deposit is correct
      await expectAction(() =>
        seniorFund.depositWithPermit(value, deadline, v, r, s, {
          from: capitalProviderAddress,
        })
      ).toChange([
        [() => getBalance(person2, usdc), {by: value.neg()}],
        [() => getBalance(seniorFund.address, usdc), {by: value}],
        [() => getBalance(person2, fidu), {by: value.mul(decimalsDelta)}],
      ])

      // Verify that permit creates allowance for amount only
      expect(await usdc.allowance(person2, seniorFund.address)).to.bignumber.eq("0")
    })
  })

  describe("getNumShares", () => {
    it("calculates correctly", async () => {
      const amount = 3000
      const sharePrice = await seniorFund.sharePrice()
      const numShares = await seniorFund._getNumShares(amount)
      expect(numShares).to.bignumber.equal(
        new BN(amount).mul(decimals.div(USDC_DECIMALS)).mul(decimals).div(sharePrice)
      )
    })
  })

  describe("withdraw", () => {
    let capitalProvider
    beforeEach(async () => {
      await usdc.approve(seniorFund.address, new BN(100000).mul(USDC_DECIMALS), {from: person2})
      await usdc.approve(seniorFund.address, new BN(100000).mul(USDC_DECIMALS), {from: owner})

      capitalProvider = person2
    })

    it("withdraws the correct amount of value from the contract when you call withdraw", async () => {
      await makeDeposit()
      const balanceBefore = await getBalance(seniorFund.address, usdc)
      await makeWithdraw()
      const balanceAfter = await getBalance(seniorFund.address, usdc)
      const delta = balanceBefore.sub(balanceAfter)
      expect(delta).to.bignumber.equal(withdrawAmount)
    })

    it("emits an event with the correct data", async () => {
      await makeDeposit()
      const result = await makeWithdraw()
      const event = result.logs[0]
      const reserveAmount = withdrawAmount.div(new BN(200))

      expect(event.event).to.equal("WithdrawalMade")
      expect(event.args.capitalProvider).to.equal(capitalProvider)
      expect(event.args.reserveAmount).to.bignumber.equal(reserveAmount)
      expect(event.args.userAmount).to.bignumber.equal(withdrawAmount.sub(reserveAmount))
    })

    it("should emit an event that the reserve received funds", async () => {
      await makeDeposit()
      const result = await makeWithdraw()
      const event = result.logs[1]

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
        [() => getBalance(seniorFund.address, usdc), {to: new BN(0)}], // Should have removed the full balance
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
        let limit = new BN(5000)
        beforeEach(async () => {
          await goldfinchConfig.setNumber(CONFIG_KEYS.TotalFundsLimit, limit.mul(USDC_DECIMALS))
          await goldfinchConfig.setNumber(CONFIG_KEYS.TransactionLimit, limit.mul(new BN(2)).mul(USDC_DECIMALS))
        })

        it("should accept deposits before the limit is reached", async () => {
          return expect(makeDeposit(person2, new BN(1000).mul(USDC_DECIMALS))).to.be.fulfilled
        })

        it("should accept everything right up to the limit", async () => {
          return expect(makeDeposit(person2, new BN(limit).mul(USDC_DECIMALS))).to.be.fulfilled
        })

        it("should fail if you're over the limit", async () => {
          return expect(makeDeposit(person2, new BN(limit).add(new BN(1)).mul(USDC_DECIMALS))).to.be.rejectedWith(
            /put the fund over the total limit/
          )
        })
      })
    })
  })

  describe("assets matching liabilities", async () => {
    describe("when there is a super tiny rounding error", async () => {
      it("should still work", async () => {
        // This share price will cause a rounding error of 1 atomic unit.
        var testSharePrice = new BN(String(1.23456789 * (ETHDecimals as any)))
        await seniorFund._setSharePrice(testSharePrice)

        return expect(makeDeposit(person2, new BN(2500).mul(USDC_DECIMALS))).to.be.fulfilled
      })
    })
  })

  describe("USDC Mantissa", async () => {
    it("should equal 1e6", async () => {
      expect(await seniorFund._usdcMantissa()).to.bignumber.equal(USDC_DECIMALS)
    })
  })

  describe("Fidu Mantissa", async () => {
    it("should equal 1e18", async () => {
      expect(await seniorFund._fiduMantissa()).to.bignumber.equal(decimals)
    })
  })

  describe("usdcToFidu", async () => {
    it("should equal 1e12", async () => {
      expect(await seniorFund._usdcToFidu(new BN(1))).to.bignumber.equal(new BN(1e12))
    })
  })

  describe("estimateInvestment", () => {
    let juniorInvestmentAmount = usdcVal(10000)

    beforeEach(async () => {
      await erc20Approve(usdc, seniorFund.address, usdcVal(100000), [owner])
      await makeDeposit(owner, usdcVal(100000))
      await goldfinchConfig.addToGoList(seniorFund.address)
      await tranchedPool.deposit(TRANCHES.Junior, juniorInvestmentAmount)
    })

    context("Pool is not valid", () => {
      it("reverts", async () => {
        const unknownPoolAddress = await simulateMaliciousTranchedPool(goldfinchConfig, person2)

        await expect(seniorFund.invest(unknownPoolAddress)).to.be.rejectedWith(/Pool must be valid/)
      })
    })

    it("should return the strategy's estimated investment", async () => {
      let investmentAmount = await seniorFundStrategy.estimateInvestment.call(seniorFund.address, tranchedPool.address)
      let estimate = await seniorFund.estimateInvestment(tranchedPool.address)
      await expect(estimate).to.bignumber.equal(investmentAmount)
    })
  })

  describe("invest", () => {
    let juniorInvestmentAmount = usdcVal(10000)

    beforeEach(async () => {
      await erc20Approve(usdc, seniorFund.address, usdcVal(100000), [owner])
      await makeDeposit(owner, usdcVal(100000))
      await goldfinchConfig.addToGoList(seniorFund.address)
      await tranchedPool.deposit(TRANCHES.Junior, juniorInvestmentAmount)
    })

    context("called by non-governance", async () => {
      it("should revert", async () => {
        return expect(seniorFund.invest(tranchedPool.address, {from: person2})).to.be.rejectedWith(/Must have admin/)
      })
    })

    context("Pool is not valid", () => {
      it("reverts", async () => {
        const unknownPoolAddress = await simulateMaliciousTranchedPool(goldfinchConfig, person2)

        await expect(seniorFund.invest(unknownPoolAddress)).to.be.rejectedWith(/Pool must be valid/)
      })
    })

    context("strategy amount is > 0", () => {
      it("should deposit amount into the senior tranche", async () => {
        // Make the strategy invest
        await tranchedPool.lockJuniorCapital({from: borrower})
        let investmentAmount = await seniorFundStrategy.invest(seniorFund.address, tranchedPool.address)

        await expectAction(async () => await seniorFund.invest(tranchedPool.address)).toChange([
          [async () => await getBalance(seniorFund.address, usdc), {by: investmentAmount.neg()}],
          [
            async () => new BN((await tranchedPool.getTranche(TRANCHES.Senior)).principalDeposited),
            {by: investmentAmount},
          ],
        ])
      })

      it("should emit an InvestmentMadeInSenior event", async () => {
        // Make the strategy invest
        await tranchedPool.lockJuniorCapital({from: borrower})
        let investmentAmount = await seniorFundStrategy.invest(seniorFund.address, tranchedPool.address)

        let receipt = await seniorFund.invest(tranchedPool.address)
        let event = receipt.logs[0]

        expect(event.event).to.equal("InvestmentMadeInSenior")
        expect(event.args.tranchedPool).to.equal(tranchedPool.address)
        expect(event.args.amount).to.bignumber.equal(investmentAmount)
      })

      it("should track the investment in the assets calculation", async () => {
        // Make the strategy invest
        await tranchedPool.lockJuniorCapital({from: borrower})
        let investmentAmount = await seniorFundStrategy.invest(seniorFund.address, tranchedPool.address)

        await expectAction(() => seniorFund.invest(tranchedPool.address)).toChange([
          [seniorFund.totalLoansOutstanding, {by: investmentAmount}],
          [() => getBalance(seniorFund.address, usdc), {by: investmentAmount.neg()}],
          [seniorFund.assets, {by: new BN(0)}], // loans outstanding + balance cancel out
        ])
      })
    })

    context("strategy amount is 0", async () => {
      it("reverts", async () => {
        // Junior tranche is still open, so investment amount should be 0
        let investmentAmount = await seniorFundStrategy.invest(seniorFund.address, tranchedPool.address)
        expect(investmentAmount).to.bignumber.equal(new BN(0))

        await expect(seniorFund.invest(tranchedPool.address)).to.be.rejectedWith(/amount must be positive/)
      })
    })
  })

  describe("investJunior", () => {
    const juniorInvestmentAmount = usdcVal(10000)
    const seniorPoolJuniorInvestmentAmount = usdcVal(30000)

    beforeEach(async () => {
      await erc20Approve(usdc, seniorFund.address, usdcVal(100000), [owner])
      await makeDeposit(owner, usdcVal(100000))
      await goldfinchConfig.addToGoList(seniorFund.address)
      await tranchedPool.deposit(TRANCHES.Junior, juniorInvestmentAmount)
    })

    context("called by non-governance", async () => {
      it("should revert", async () => {
        return expect(
          seniorFund.investJunior(tranchedPool.address, seniorPoolJuniorInvestmentAmount, {from: person2})
        ).to.be.rejectedWith(/Must have admin/)
      })
    })

    context("Pool is not valid", () => {
      it("reverts", async () => {
        const unknownPoolAddress = await simulateMaliciousTranchedPool(goldfinchConfig, person2)

        await expect(seniorFund.investJunior(unknownPoolAddress, seniorPoolJuniorInvestmentAmount)).to.be.rejectedWith(
          /Pool must be valid/
        )
      })
    })

    context("Pool's senior tranche is not empty", () => {
      it("reverts", async () => {
        await tranchedPool._setSeniorTranchePrincipalDeposited(new BN(1))
        const seniorTranche = await tranchedPool.getTranche(TRANCHES.Senior)
        expect(seniorTranche.principalDeposited).to.bignumber.equal(new BN(1))

        return expect(
          seniorFund.investJunior(tranchedPool.address, seniorPoolJuniorInvestmentAmount)
        ).to.be.rejectedWith(/SeniorFund cannot invest in tranched pool with non-empty senior tranche\./)
      })
    })

    context("Pool's junior tranche is locked", () => {
      it("reverts", async () => {
        const juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
        const seniorTranche = await tranchedPool.getTranche(TRANCHES.Senior)
        expect(juniorTranche.lockedUntil).to.bignumber.equal(new BN(0))
        expect(seniorTranche.lockedUntil).to.bignumber.equal(new BN(0))

        await tranchedPool.lockJuniorCapital({from: borrower})

        const juniorTranche2 = await tranchedPool.getTranche(TRANCHES.Junior)
        const seniorTranche2 = await tranchedPool.getTranche(TRANCHES.Senior)
        expect(juniorTranche2.lockedUntil).to.bignumber.gt(new BN(0))
        expect(seniorTranche2.lockedUntil).to.bignumber.equal(new BN(0))

        return expect(
          seniorFund.investJunior(tranchedPool.address, seniorPoolJuniorInvestmentAmount)
        ).to.be.rejectedWith(/Tranche has been locked/)
      })
    })

    context("amount is > 0", () => {
      it("should deposit amount into the junior tranche", async () => {
        await expectAction(
          async () => await seniorFund.investJunior(tranchedPool.address, seniorPoolJuniorInvestmentAmount),
          true
        ).toChange([
          [async () => await getBalance(seniorFund.address, usdc), {by: seniorPoolJuniorInvestmentAmount.neg()}],
          [
            async () => new BN((await tranchedPool.getTranche(TRANCHES.Junior)).principalDeposited),
            {by: seniorPoolJuniorInvestmentAmount},
          ],
        ])
      })

      it("should emit an InvestmentMadeInJunior event", async () => {
        let receipt = await seniorFund.investJunior(tranchedPool.address, seniorPoolJuniorInvestmentAmount)
        let event = receipt.logs[0]

        expect(event.event).to.equal("InvestmentMadeInJunior")
        expect(event.args.tranchedPool).to.equal(tranchedPool.address)
        expect(event.args.amount).to.bignumber.equal(seniorPoolJuniorInvestmentAmount)
      })

      it("should track the investment in the assets calculation", async () => {
        await expectAction(() =>
          seniorFund.investJunior(tranchedPool.address, seniorPoolJuniorInvestmentAmount)
        ).toChange([
          [seniorFund.totalLoansOutstanding, {by: seniorPoolJuniorInvestmentAmount}],
          [() => getBalance(seniorFund.address, usdc), {by: seniorPoolJuniorInvestmentAmount.neg()}],
          [seniorFund.assets, {by: new BN(0)}], // loans outstanding + balance cancel out
        ])
      })
    })

    context("amount is 0", async () => {
      it("reverts", async () => {
        await expect(seniorFund.investJunior(tranchedPool.address, new BN(0))).to.be.rejectedWith(
          /amount must be positive/
        )
      })
    })

    context("has already invested in junior tranche", async () => {
      it("allows investing in the junior tranche again", async () => {
        const juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
        expect(juniorTranche.principalDeposited).to.bignumber.equal(juniorInvestmentAmount)

        await seniorFund.investJunior(tranchedPool.address, seniorPoolJuniorInvestmentAmount)

        const juniorTranche2 = await tranchedPool.getTranche(TRANCHES.Junior)
        expect(juniorTranche2.principalDeposited).to.bignumber.equal(
          juniorInvestmentAmount.add(seniorPoolJuniorInvestmentAmount)
        )

        await seniorFund.investJunior(tranchedPool.address, seniorPoolJuniorInvestmentAmount)

        const juniorTranche3 = await tranchedPool.getTranche(TRANCHES.Junior)
        expect(juniorTranche3.principalDeposited).to.bignumber.equal(
          juniorInvestmentAmount.add(seniorPoolJuniorInvestmentAmount).add(seniorPoolJuniorInvestmentAmount)
        )
      })
    })
  })

  describe("redeem", async () => {
    let tokenAddress, reserveAddress, poolTokens
    let juniorInvestmentAmount = usdcVal(100)

    beforeEach(async () => {
      reserveAddress = await goldfinchConfig.getAddress(CONFIG_KEYS.TreasuryReserve)
      tokenAddress = await goldfinchConfig.getAddress(CONFIG_KEYS.PoolTokens)
      poolTokens = await artifacts.require("PoolTokens").at(tokenAddress)

      await erc20Approve(usdc, seniorFund.address, usdcVal(100000), [owner])
      await makeDeposit(owner, usdcVal(100000))
      await goldfinchConfig.addToGoList(seniorFund.address)

      await tranchedPool.deposit(TRANCHES.Junior, juniorInvestmentAmount)
    })

    context("called by non-governance", async () => {
      it("should revert", async () => {
        return expect(seniorFund.redeem(42, {from: person2})).to.be.rejectedWith(/Must have admin/)
      })
    })

    it("should redeem the maximum from the TranchedPool", async () => {
      // Make the senior fund invest
      await tranchedPool.lockJuniorCapital({from: borrower})
      await seniorFund.invest(tranchedPool.address)

      // Simulate repayment ensuring a full term has passed
      await tranchedPool.lockPool({from: borrower})
      await tranchedPool.drawdown(usdcVal(100), {from: borrower})
      await advanceTime({days: termInDays.toNumber()})
      let payAmount = usdcVal(105)
      await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
      await tranchedPool.pay(payAmount, {from: borrower})

      let tokenId = await poolTokens.tokenOfOwnerByIndex(seniorFund.address, 0)

      let balanceBefore = await usdc.balanceOf(seniorFund.address)
      let tokenInfoBefore = await poolTokens.getTokenInfo(tokenId)
      let originalReserveBalance = await getBalance(reserveAddress, usdc)

      await seniorFund.redeem(tokenId)

      let balanceAfter = await usdc.balanceOf(seniorFund.address)
      let tokenInfoAfter = await poolTokens.getTokenInfo(tokenId)
      let newReserveBalance = await getBalance(reserveAddress, usdc)

      let interestRedeemed = new BN(tokenInfoAfter.interestRedeemed).sub(new BN(tokenInfoBefore.interestRedeemed))
      let principalRedeemed = new BN(tokenInfoAfter.principalRedeemed).sub(new BN(tokenInfoBefore.principalRedeemed))

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
      // Make the senior fund invest
      await tranchedPool.lockJuniorCapital({from: borrower})
      await seniorFund.invest(tranchedPool.address)

      // Simulate repayment ensuring a full term has passed
      await tranchedPool.lockPool({from: borrower})
      await tranchedPool.drawdown(usdcVal(100), {from: borrower})
      await advanceTime({days: termInDays.toNumber()})
      let payAmount = usdcVal(105)
      await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
      await tranchedPool.pay(payAmount, {from: borrower})

      let tokenId = await poolTokens.tokenOfOwnerByIndex(seniorFund.address, 0)

      let tokenInfoBefore = await poolTokens.getTokenInfo(tokenId)
      let originalSharePrice = await seniorFund.sharePrice()

      await seniorFund.redeem(tokenId)

      let tokenInfoAfter = await poolTokens.getTokenInfo(tokenId)
      let newSharePrice = await seniorFund.sharePrice()

      let interestRedeemed = new BN(tokenInfoAfter.interestRedeemed).sub(new BN(tokenInfoBefore.interestRedeemed))

      let expectedSharePrice = interestRedeemed
        .mul(decimals.div(USDC_DECIMALS))
        .mul(decimals)
        .div(await fidu.totalSupply())
        .add(originalSharePrice)

      expect(newSharePrice).to.bignumber.gt(originalSharePrice)
      expect(newSharePrice).to.bignumber.equal(expectedSharePrice)
    })

    it("should emit events for interest, principal, and reserve", async () => {
      // Make the senior fund invest
      await tranchedPool.lockJuniorCapital({from: borrower})
      await seniorFund.invest(tranchedPool.address)

      // Simulate repayment ensuring a full term has passed
      await tranchedPool.lockPool({from: borrower})
      await tranchedPool.drawdown(usdcVal(100), {from: borrower})
      await advanceTime({days: termInDays.toNumber()})
      let payAmount = usdcVal(105)
      await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
      await tranchedPool.pay(payAmount, {from: borrower})

      let tokenId = await poolTokens.tokenOfOwnerByIndex(seniorFund.address, 0)

      let tokenInfoBefore = await poolTokens.getTokenInfo(tokenId)

      let receipt = await seniorFund.redeem(tokenId)

      let tokenInfoAfter = await poolTokens.getTokenInfo(tokenId)
      let interestRedeemed = new BN(tokenInfoAfter.interestRedeemed).sub(new BN(tokenInfoBefore.interestRedeemed))
      let principalRedeemed = new BN(tokenInfoAfter.principalRedeemed).sub(new BN(tokenInfoBefore.principalRedeemed))

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
    let juniorInvestmentAmount = usdcVal(20)

    beforeEach(async () => {
      await makeDeposit(person2, usdcVal(100))

      let juniorReceipt = await tranchedPool.deposit(TRANCHES.Junior, juniorInvestmentAmount)
      juniorTokenId = juniorReceipt.logs[0].args.tokenId
      await tranchedPool.lockJuniorCapital({from: borrower})
      let receipt = await seniorFund.invest(tranchedPool.address)
      let depositEvent = decodeLogs(receipt.receipt.rawLogs, tranchedPool, "DepositMade")[0]
      assertNonNullable(depositEvent)
      tokenId = depositEvent.args.tokenId
      await tranchedPool.lockPool({from: borrower})
      await tranchedPool.drawdown(usdcVal(100), {from: borrower})

      originalSharePrice = await seniorFund.sharePrice()
      originalTotalShares = await fidu.totalSupply()
    })

    context("called by non-governance", async () => {
      it("should revert", async () => {
        return expect(seniorFund.writedown(tokenId, {from: person2})).to.be.rejectedWith(/Must have admin/)
      })
    })

    context("before loan term ends", async () => {
      it("should write down the principal and distribute losses", async () => {
        // Assess for two periods of lateness
        const paymentPeriodInSeconds = paymentPeriodInDays.mul(SECONDS_PER_DAY)
        const twoPaymentPeriodsInSeconds = paymentPeriodInSeconds.mul(new BN(2))
        await advanceTime({seconds: twoPaymentPeriodsInSeconds})
        // So writedown is 2 periods late - 1 grace period / 4 max = 25%
        let expectedWritedown = usdcVal(80).div(new BN(4)) // 25% of 80 = 20

        await tranchedPool.assess()
        await expectAction(() => seniorFund.writedown(tokenId)).toChange([
          [seniorFund.totalWritedowns, {byCloseTo: expectedWritedown}],
          [seniorFund.assets, {byCloseTo: expectedWritedown.neg()}],
        ])

        var newSharePrice = await seniorFund.sharePrice()
        var delta = originalSharePrice.sub(newSharePrice)
        let normalizedWritedown = await seniorFund._usdcToFidu(expectedWritedown)
        var expectedDelta = normalizedWritedown.mul(decimals).div(originalTotalShares)

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
        let expectedWritedown = usdcVal(80).div(new BN(4)) // 25% of 80 = 20

        await tranchedPool.assess()
        await expectAction(() => seniorFund.writedown(tokenId)).toChange([
          [seniorFund.totalWritedowns, {byCloseTo: expectedWritedown}],
          [seniorFund.assets, {byCloseTo: expectedWritedown.neg()}],
        ])

        let sharePriceAfterAssess = await seniorFund.sharePrice()

        // Pay back half of one period
        let creditLine = await artifacts.require("CreditLine").at(await tranchedPool.creditLine())
        let interestOwed = await creditLine.interestOwed()
        let interestPaid = interestOwed.div(new BN(4)) // interestOwed is for 2 periods
        let expectedNewWritedown = expectedWritedown.div(new BN(2))
        await tranchedPool.pay(interestPaid, {from: borrower})

        await expectAction(() => seniorFund.writedown(tokenId)).toChange([
          [seniorFund.totalWritedowns, {byCloseTo: expectedWritedown.sub(expectedNewWritedown).neg()}],
          [seniorFund.assets, {byCloseTo: expectedWritedown.sub(expectedNewWritedown)}],
        ])

        var finalSharePrice = await seniorFund.sharePrice()
        var delta = originalSharePrice.sub(finalSharePrice)
        let normalizedWritedown = await seniorFund._usdcToFidu(expectedNewWritedown)
        var expectedDelta = normalizedWritedown.mul(decimals).div(originalTotalShares)

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
        let expectedWritedown = usdcVal(80).div(new BN(4)) // 25% of 80 = 20

        await tranchedPool.assess()
        await expectAction(() => seniorFund.writedown(tokenId)).toChange([
          [seniorFund.totalWritedowns, {byCloseTo: expectedWritedown}],
          [seniorFund.assets, {byCloseTo: expectedWritedown.neg()}],
        ])

        let sharePriceAfterAssess = await seniorFund.sharePrice()

        // Pay back all interest owed
        let creditLine = await artifacts.require("CreditLine").at(await tranchedPool.creditLine())
        let interestOwed = await creditLine.interestOwed()
        let interestPaid = interestOwed
        let expectedNewWritedown = new BN(0)
        await tranchedPool.pay(interestPaid, {from: borrower})

        await expectAction(() => seniorFund.writedown(tokenId)).toChange([
          [seniorFund.totalWritedowns, {to: new BN(0)}],
          [seniorFund.assets, {byCloseTo: expectedWritedown.sub(expectedNewWritedown)}],
        ])

        var finalSharePrice = await seniorFund.sharePrice()
        var delta = originalSharePrice.sub(finalSharePrice)

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
        let expectedWritedown = usdcVal(80).div(new BN(4)) // 25% of 80 = 20

        await tranchedPool.assess()
        let receipt = await seniorFund.writedown(tokenId)
        let event = decodeLogs(receipt.receipt.rawLogs, seniorFund, "PrincipalWrittenDown")[0]
        assertNonNullable(event)
        expect(event.args.tranchedPool).to.equal(tranchedPool.address)
        expect(event.args.amount).to.bignumber.closeTo(expectedWritedown, fiduTolerance)
      })
    })

    context("tokenId is not owned by senior fund", () => {
      it("reverts", async () => {
        await expect(seniorFund.writedown(juniorTokenId)).to.be.rejectedWith(
          /Only tokens owned by the senior fund can be written down/
        )
      })
    })
  })

  describe("calculateWritedown", async () => {
    let tokenId
    let juniorInvestmentAmount = usdcVal(20)

    beforeEach(async () => {
      await makeDeposit(person2, usdcVal(100))

      await tranchedPool.deposit(TRANCHES.Junior, juniorInvestmentAmount)
      await tranchedPool.lockJuniorCapital({from: borrower})
      let receipt = await seniorFund.invest(tranchedPool.address)
      let depositEvent = decodeLogs(receipt.receipt.rawLogs, tranchedPool, "DepositMade")[0]
      assertNonNullable(depositEvent)
      tokenId = depositEvent.args.tokenId
      await tranchedPool.lockPool({from: borrower})
      await tranchedPool.drawdown(usdcVal(100), {from: borrower})
    })

    it("returns writedown amount", async () => {
      const paymentPeriodInSeconds = paymentPeriodInDays.mul(SECONDS_PER_DAY)
      const twoPaymentPeriodsInSeconds = paymentPeriodInSeconds.mul(new BN(2))
      await advanceTime({seconds: twoPaymentPeriodsInSeconds.add(new BN(10000))})

      // So writedown is 2 periods late - 1 grace period / 4 max = 25%
      let expectedWritedown = usdcVal(80).div(new BN(4)) // 25% of 80 = ~20

      await tranchedPool.assess()
      let writedownAmount = await seniorFund.calculateWritedown(tokenId)

      expect(writedownAmount).to.bignumber.closeTo(expectedWritedown, tolerance)
    })
  })
})
