/* global web3 */
const {
  expect,
  usdcVal,
  expectAction,
  deployAllContracts,
  advanceTime,
  erc20Approve,
  erc20Transfer,
  getBalance,
  createPoolWithCreditLine: _createPoolWithCreditLine,
} = require("./testHelpers.js")
const {interestAprAsBN, TRANCHES} = require("../blockchain_scripts/deployHelpers")
const {expectEvent} = require("@openzeppelin/test-helpers")
const hre = require("hardhat")
const BN = require("bn.js")
const {deployments} = hre

describe("TranchedPool", () => {
  let owner,
    borrower,
    otherPerson,
    goldfinchConfig,
    usdc,
    poolTokens,
    tranchedPool,
    goldfinchFactory,
    creditLine,
    treasury
  let limit = usdcVal(10000)
  let interestApr = interestAprAsBN("5.00")
  let paymentPeriodInDays = new BN(30)
  let termInDays = new BN(365)
  let lateFeeApr = new BN(0)
  let juniorFeePercent = new BN(20)

  const createPoolWithCreditLine = async () => {
    ;({creditLine, tranchedPool} = await _createPoolWithCreditLine({
      people: {owner, borrower},
      goldfinchFactory,
      limit,
      interestApr,
      paymentPeriodInDays,
      termInDays,
      lateFeeApr,
      juniorFeePercent,
      usdc,
    }))
    return tranchedPool
  }

  beforeEach(async () => {
    // Pull in our unlocked accounts
    ;[owner, borrower, treasury, otherPerson] = await web3.eth.getAccounts()
    ;({usdc, goldfinchConfig, goldfinchFactory, poolTokens} = await deployAllContracts(deployments))
    await goldfinchConfig.bulkAddToGoList([owner, borrower, otherPerson])
    await goldfinchConfig.setTreasuryReserve(treasury)
    await erc20Transfer(usdc, [otherPerson], usdcVal(10000), owner)
    await erc20Transfer(usdc, [borrower], usdcVal(10000), owner)
  })

  describe("initialization", async () => {
    it("sets the right defaults", async () => {
      tranchedPool = await createPoolWithCreditLine()

      const juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
      const seniorTranche = await tranchedPool.getTranche(TRANCHES.Senior)
      expect(juniorTranche.principalSharePrice).to.bignumber.eq("1000000000000000000")
      expect(juniorTranche.interestSharePrice).to.bignumber.eq("0")
      expect(juniorTranche.principalDeposited).to.bignumber.eq("0")
      expect(juniorTranche.interestAPR).to.bignumber.eq("0")
      expect(juniorTranche.lockedAt).to.bignumber.eq("0")

      expect(seniorTranche.principalSharePrice).to.bignumber.eq("1000000000000000000")
      expect(seniorTranche.interestSharePrice).to.bignumber.eq("0")
      expect(seniorTranche.principalDeposited).to.bignumber.eq("0")
      expect(seniorTranche.interestAPR).to.bignumber.eq("0")
      expect(seniorTranche.lockedAt).to.bignumber.eq("0")

      expect(await tranchedPool.creditLine()).to.eq(creditLine.address)
    })
  })

  describe("deposit", async () => {
    beforeEach(async () => {
      tranchedPool = await createPoolWithCreditLine()
    })
    describe("junior tranche", async () => {
      it("does not allow deposits when pool is locked", async () => {
        await tranchedPool.lockJuniorCapital({from: borrower})
        await expect(tranchedPool.deposit(TRANCHES.Junior, usdcVal(10))).to.be.rejectedWith(/Tranche has been locked/)
      })

      it("fails for invalid tranches", async () => {
        await expect(tranchedPool.deposit(0, usdcVal(10))).to.be.rejectedWith(/Unsupported tranche/)
      })

      it("updates the tranche info and mints the token", async () => {
        expect(await poolTokens.balanceOf(owner)).to.bignumber.eq("0")

        const response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(10))
        const tokenId = response.logs[0].args.tokenId
        let juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
        let seniorTranche = await tranchedPool.getTranche(TRANCHES.Senior)

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
          let juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
          let seniorTranche = await tranchedPool.getTranche(TRANCHES.Senior)

          expect(juniorTranche.principalDeposited).to.bignumber.eq(usdcVal(15))
          expect(seniorTranche.principalDeposited).to.bignumber.eq("0")
          // TODO: Eventually should just be a single NFT
          expect(await poolTokens.balanceOf(owner)).to.bignumber.eq("2")
          expect(await usdc.balanceOf(tranchedPool.address)).to.bignumber.eq(usdcVal(15))
        })
      })
    })

    describe("senior tranche", async () => {
      it("does not allow deposits when pool is locked", async () => {
        await tranchedPool.deposit(TRANCHES.Junior, usdcVal(10))
        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})
        await expect(tranchedPool.deposit(TRANCHES.Senior, usdcVal(10))).to.be.rejectedWith(/Pool has been locked/)
      })

      it("fails for invalid tranches", async () => {
        await expect(tranchedPool.deposit(3, usdcVal(10))).to.be.rejectedWith(/Unsupported tranche/)
      })

      it("updates the tranche info and mints the token", async () => {
        expect(await poolTokens.balanceOf(owner)).to.bignumber.eq("0")

        const response = await tranchedPool.deposit(TRANCHES.Senior, usdcVal(10))
        const tokenId = response.logs[0].args.tokenId
        let juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
        let seniorTranche = await tranchedPool.getTranche(TRANCHES.Senior)

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
          let juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
          let seniorTranche = await tranchedPool.getTranche(TRANCHES.Senior)

          expect(juniorTranche.principalDeposited).to.bignumber.eq("0")
          expect(seniorTranche.principalDeposited).to.bignumber.eq(usdcVal(15))
          // TODO: Eventually should just be a single NFT
          expect(await poolTokens.balanceOf(owner)).to.bignumber.eq("2")
          expect(await usdc.balanceOf(tranchedPool.address)).to.bignumber.eq(usdcVal(15))
        })
      })
    })
  })
  describe("withdraw", async () => {
    beforeEach(async () => {
      tranchedPool = await createPoolWithCreditLine()
    })

    describe("validations", async () => {
      it("does not allow you to withdraw if you don't own the pool token")
      it("does not allow you to withdraw if pool token is from a different pool")
      it("does not allow you to withdraw if past the drawdown period")
      it("does not allow you to withdraw if no amount is available", async () => {})
    })

    describe("before the pool is locked", async () => {
      it("lets you withdraw everything you put in", async () => {
        let response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(10))
        const tokenId = response.logs[0].args.tokenId

        await tranchedPool.withdraw(tokenId, usdcVal(10))
        let juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
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
        let response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(10))
        const tokenId = response.logs[0].args.tokenId

        await tranchedPool.lockJuniorCapital({from: borrower})

        await expect(tranchedPool.withdraw(tokenId, usdcVal(10))).to.be.rejectedWith(/Invalid redeem amount/)
      })

      it("lets you withdraw pro-rata share of payments", async () => {
        // Total junior tranche investment is split between 2 people
        await erc20Approve(usdc, tranchedPool.address, usdcVal(100000), [otherPerson])
        await tranchedPool.deposit(TRANCHES.Junior, usdcVal(500), {from: otherPerson})
        let response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(500))
        const tokenId = response.logs[0].args.tokenId

        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})
        await tranchedPool.drawdown(usdcVal(1000), {from: borrower})
        await advanceTime(tranchedPool, {days: termInDays.toNumber()})
        let payAmount = usdcVal(1050)
        await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
        await tranchedPool.pay(payAmount, {from: borrower})

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

      it("emits an event", async () => {
        let response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(1000))
        const tokenId = response.logs[0].args.tokenId

        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})
        await tranchedPool.drawdown(usdcVal(1000), {from: borrower})
        await advanceTime(tranchedPool, {days: termInDays.toNumber()})
        let payAmount = usdcVal(1050)
        await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
        await tranchedPool.pay(payAmount, {from: borrower})

        // Total amount owed to junior:
        //   principal = 1000
        //   interest_accrued = 1000 * 0.05 = 50
        //   protocol_fee = interest_accrued * 0.1 = 5
        //   principal + interest_accrued - protocol_fee = 1045
        let receipt = await tranchedPool.withdraw(tokenId, usdcVal(1045))
        expectEvent(receipt, "WithdrawalMade", {
          owner: owner,
          tranche: new BN(TRANCHES.Junior),
          tokenId: tokenId,
          interestWithdrawn: usdcVal(45),
          principalWithdrawn: usdcVal(1000),
        })
      })
    })
  })

  describe("withdrawMax", async () => {
    beforeEach(async () => {
      tranchedPool = await createPoolWithCreditLine()
    })

    it("should withdraw the max", async () => {
      // Total junior tranche investment is split between 2 people
      await erc20Approve(usdc, tranchedPool.address, usdcVal(100000), [otherPerson])
      await tranchedPool.deposit(TRANCHES.Junior, usdcVal(500), {from: otherPerson})
      let response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(500))
      const tokenId = response.logs[0].args.tokenId

      await tranchedPool.lockJuniorCapital({from: borrower})
      await tranchedPool.lockPool({from: borrower})
      await tranchedPool.drawdown(usdcVal(1000), {from: borrower})
      let payAmount = usdcVal(1050)
      await advanceTime(tranchedPool, {days: termInDays.toNumber()})
      await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
      await tranchedPool.pay(payAmount, {from: borrower})

      // Total amount owed to junior:
      //   interest_accrued = 1000 * 0.05 = 50
      //   protocol_fee = interest_accrued * 0.1 = 5
      //   1000 + interest_accrued - protocol_fee = 1045
      // Amount owed to one of the junior investors:
      //   1045 / 2 = 522.5
      await expectAction(async () => tranchedPool.withdrawMax(tokenId)).toChange([
        [async () => await getBalance(owner, usdc), {by: usdcVal(52250).div(new BN(100))}],
      ])
      await expectAction(async () => tranchedPool.withdrawMax(tokenId)).toChange([
        [async () => await getBalance(owner, usdc), {by: usdcVal(0)}],
      ])
    })

    it("emits an event", async () => {
      let response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(1000))
      const tokenId = response.logs[0].args.tokenId

      await tranchedPool.lockJuniorCapital({from: borrower})
      await tranchedPool.lockPool({from: borrower})
      await tranchedPool.drawdown(usdcVal(1000), {from: borrower})
      await advanceTime(tranchedPool, {days: termInDays.toNumber()})
      let payAmount = usdcVal(1050)
      await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
      await tranchedPool.pay(payAmount, {from: borrower})

      // Total amount owed to junior:
      //   principal = 1000
      //   interest_accrued = 1000 * 0.05 = 50
      //   protocol_fee = interest_accrued * 0.1 = 5
      //   principal + interest_accrued - protocol_fee = 1045
      let receipt = await tranchedPool.withdrawMax(tokenId)
      expectEvent(receipt, "WithdrawalMade", {
        owner: owner,
        tranche: new BN(TRANCHES.Junior),
        tokenId: tokenId,
        interestWithdrawn: usdcVal(45),
        principalWithdrawn: usdcVal(1000),
      })
    })
  })

  describe("locking", async () => {
    beforeEach(async () => {
      tranchedPool = await createPoolWithCreditLine()
    })

    describe("junior tranche", async () => {
      it("locks the junior tranche", async () => {
        await tranchedPool.deposit(TRANCHES.Senior, usdcVal(10))
        await expectAction(async () => tranchedPool.lockJuniorCapital({from: borrower})).toChange([
          [async () => (await tranchedPool.getTranche(TRANCHES.Junior)).lockedAt, {increase: true}],
          [async () => (await tranchedPool.getTranche(TRANCHES.Junior)).principalSharePrice, {to: new BN(0)}],
        ])
      })

      it("does not allow locking twice", async () => {
        await tranchedPool.lockJuniorCapital({from: borrower})
        expect(tranchedPool.lockJuniorCapital({from: borrower})).to.be.rejectedWith(/already locked/)
      })
    })

    describe("senior tranche", async () => {
      it("locks the senior tranche", async () => {
        await tranchedPool.deposit(TRANCHES.Senior, usdcVal(8))
        await tranchedPool.deposit(TRANCHES.Junior, usdcVal(2))
        await tranchedPool.lockJuniorCapital({from: borrower})
        await expectAction(async () => tranchedPool.lockPool({from: borrower})).toChange([
          [async () => (await tranchedPool.getTranche(TRANCHES.Senior)).lockedAt, {increase: true}],
          [async () => (await tranchedPool.getTranche(TRANCHES.Senior)).principalSharePrice, {to: new BN(0)}],
          // Senior tranche is 80% of 5% (8$ out of 10$ in the pool)
          [async () => (await tranchedPool.getTranche(TRANCHES.Senior)).interestAPR, {to: interestAprAsBN("4.00")}],
          // Junior tranche is 20% of 5% (2$ out of 10$ in the pool)
          [async () => (await tranchedPool.getTranche(TRANCHES.Junior)).interestAPR, {to: interestAprAsBN("1.00")}],
          // Limit is total of senior and junior deposits
          [async () => creditLine.limit(), {to: usdcVal(10)}],
        ])
      })
    })
  })
  describe("drawdown", async () => {
    beforeEach(async () => {
      tranchedPool = await createPoolWithCreditLine()
    })

    describe("when pool is already locked", async () => {
      it("draws down the capital to the borrower", async () => {
        await tranchedPool.deposit(TRANCHES.Junior, usdcVal(5))
        await tranchedPool.deposit(TRANCHES.Senior, usdcVal(10))
        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})

        await expectAction(async () => tranchedPool.drawdown(usdcVal(10))).toChange([
          [async () => usdc.balanceOf(borrower), {by: usdcVal(10)}],
        ])
      })
    })
  })

  describe("tranching", async () => {
    beforeEach(async () => {
      // 100$ creditline with 10% interest. Senior tranche gets 8% of the total interest, and junior tranche gets 2%
      interestApr = interestAprAsBN("10.00")
      tranchedPool = await createPoolWithCreditLine()
    })

    it("calculates share price using term start time", async () => {
      await tranchedPool.deposit(TRANCHES.Junior, usdcVal(100))
      await tranchedPool.lockJuniorCapital({from: borrower})
      await tranchedPool.lockPool({from: borrower})

      // Start loan tern halfOfTerm days from now
      let halfOfTerm = termInDays.div(new BN(2))
      await advanceTime(tranchedPool, {days: halfOfTerm.toNumber()})
      await tranchedPool.drawdown(usdcVal(100), {from: borrower})

      // Advance termInDays total days from now
      await advanceTime(tranchedPool, {days: halfOfTerm.add(new BN(1)).toNumber()})
      await tranchedPool.pay(usdcVal(5), {from: borrower})

      let juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
      const juniorInterestAmount = await tranchedPool.sharePriceToUsdc(
        juniorTranche.interestSharePrice,
        juniorTranche.principalDeposited
      )

      // Should be around half of full term's interest, since the drawdown happened 6 months
      // from this payment:
      // ~$4.43 (rather than ~$5, since interest is accrued at last second of prior period)
      expect(juniorInterestAmount).to.bignumber.eq(new BN("4438356"))
      expect(await usdc.balanceOf(treasury)).to.bignumber.eq(new BN("493150"))
    })

    context("only junior investment", async () => {
      it("still works", async () => {
        await tranchedPool.deposit(TRANCHES.Junior, usdcVal(100))
        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})
        await tranchedPool.drawdown(usdcVal(100), {from: borrower})

        // Ensure a full term has passed
        await advanceTime(tranchedPool, {days: termInDays.toNumber()})
        await tranchedPool.pay(usdcVal(110), {from: borrower})

        let juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
        let seniorTranche = await tranchedPool.getTranche(TRANCHES.Senior)

        const juniorInterestAmount = await tranchedPool.sharePriceToUsdc(
          juniorTranche.interestSharePrice,
          juniorTranche.principalDeposited
        )
        const juniorPrincipalAmount = await tranchedPool.sharePriceToUsdc(
          juniorTranche.principalSharePrice,
          juniorTranche.principalDeposited
        )
        const seniorInterestAmount = await tranchedPool.sharePriceToUsdc(
          seniorTranche.interestSharePrice,
          seniorTranche.principalDeposited
        )
        const seniorPrincipalAmount = await tranchedPool.sharePriceToUsdc(
          seniorTranche.principalSharePrice,
          seniorTranche.principalDeposited
        )

        expect(seniorInterestAmount).to.bignumber.eq(new BN(0))
        expect(seniorPrincipalAmount).to.bignumber.eq(new BN(0))
        expect(juniorInterestAmount).to.bignumber.eq(usdcVal(9))
        expect(juniorPrincipalAmount).to.bignumber.eq(usdcVal(100))
        expect(await usdc.balanceOf(treasury)).to.bignumber.eq(usdcVal(1))
      })
    })

    describe("when full payment is received", async () => {
      beforeEach(async () => {
        await tranchedPool.deposit(TRANCHES.Junior, usdcVal(20))
        await tranchedPool.deposit(TRANCHES.Senior, usdcVal(80))
        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})
        await tranchedPool.drawdown(usdcVal(100), {from: borrower})
      })

      it("distributes across senior and junior tranches correctly", async () => {
        // Ensure a full term has passed
        await advanceTime(tranchedPool, {days: termInDays.toNumber()})

        usdc.transfer(borrower, usdcVal(10), {from: owner}) // Transfer money for interest payment
        expect(await usdc.balanceOf(treasury)).to.bignumber.eq("0")

        await tranchedPool.collectInterestAndPrincipal(borrower, usdcVal(10), usdcVal(100))
        expect(await creditLine.interestApr()).to.bignumber.eq(interestAprAsBN(10))
        expect(await creditLine.balance()).to.bignumber.eq(usdcVal(100))
        let juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
        let seniorTranche = await tranchedPool.getTranche(TRANCHES.Senior)

        const juniorInterestAmount = await tranchedPool.sharePriceToUsdc(
          juniorTranche.interestSharePrice,
          juniorTranche.principalDeposited
        )
        const juniorPrincipalAmount = await tranchedPool.sharePriceToUsdc(
          juniorTranche.principalSharePrice,
          juniorTranche.principalDeposited
        )
        const seniorInterestAmount = await tranchedPool.sharePriceToUsdc(
          seniorTranche.interestSharePrice,
          seniorTranche.principalDeposited
        )
        const seniorPrincipalAmount = await tranchedPool.sharePriceToUsdc(
          seniorTranche.principalSharePrice,
          seniorTranche.principalDeposited
        )

        // 100$ loan, with 10% interest. 80% senior and 20% junior. Junior fee of 20%. Reserve fee of 10%
        // Senior share of interest 8$. Net interest = 8 * (junior fee percent + reserve fee percent) = 5.6
        // Junior share of interest 2$. Net interest = 2 + (8 * junior fee percent) - (2 * reserve fee percent) = 3.4
        // Protocol fee = 1$. Total = 5.6 + 3.4 + 1 = 10
        expect(seniorInterestAmount).to.bignumber.eq(usdcVal(56).div(new BN(10)))
        expect(seniorPrincipalAmount).to.bignumber.eq(usdcVal(80))
        expect(juniorInterestAmount).to.bignumber.eq(usdcVal(34).div(new BN(10)))
        expect(juniorPrincipalAmount).to.bignumber.eq(usdcVal(20))
        expect(await usdc.balanceOf(treasury)).to.bignumber.eq(usdcVal(1))
      })
    })
  })
})
