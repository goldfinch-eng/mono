/* global web3 artifacts */
const {expect, erc20Approve, usdcVal, expectAction, deployAllContracts, advanceTime} = require("./testHelpers.js")
const {interestAprAsBN} = require("../blockchain_scripts/deployHelpers")
const hre = require("hardhat")
const BN = require("bn.js")
const {deployments} = hre
const CreditLine = artifacts.require("CreditLine")
const TranchedPool = artifacts.require("TestTranchedPool")

describe("TranchedPool", () => {
  let owner, borrower, underwriter, goldfinchConfig, usdc, poolTokens, tranchedPool, creditDesk, creditLine
  let limit = usdcVal(500)
  let interestApr = interestAprAsBN("5.00")
  let paymentPeriodInDays = new BN(30)
  let termInDays = new BN(365)
  let lateFeeApr = new BN(0)

  const createPoolWithCreditLine = async (people = {}) => {
    const thisOwner = people.owner || owner
    const thisBorrower = people.borrower || borrower
    const thisUnderwriter = people.underwriter || underwriter

    if (!thisBorrower) {
      throw new Error("No borrower is set. Set one in a beforeEach, or pass it in explicitly")
    }

    if (!thisOwner) {
      throw new Error("No owner is set. Please set one in a beforeEach or pass it in explicitly")
    }

    await creditDesk.setUnderwriterGovernanceLimit(thisUnderwriter, limit.mul(new BN(5)))

    let result = await creditDesk.createPool(
      borrower,
      limit,
      interestApr,
      paymentPeriodInDays,
      termInDays,
      lateFeeApr,
      {from: underwriter}
    )
    let event = result.logs[result.logs.length - 1]
    let pool = await TranchedPool.at(event.args.pool)
    creditLine = await CreditLine.at(await pool.creditLine())

    await erc20Approve(usdc, pool.address, usdcVal(100000), [owner, borrower])

    return await artifacts.require("TestTranchedPool").at(pool.address)
  }

  beforeEach(async () => {
    // Pull in our unlocked accounts
    ;[owner, borrower, underwriter] = await web3.eth.getAccounts()
    ;({usdc, creditDesk, goldfinchConfig, poolTokens} = await deployAllContracts(deployments))
    await goldfinchConfig.bulkAddToGoList([owner, borrower, underwriter])
  })

  describe("initialization", async () => {
    it("sets the right defaults", async () => {
      tranchedPool = await createPoolWithCreditLine()

      const juniorTranche = await tranchedPool.juniorTranche()
      const seniorTranche = await tranchedPool.juniorTranche()
      expect(juniorTranche.principalSharePrice).to.bignumber.eq("1")
      expect(juniorTranche.interestSharePrice).to.bignumber.eq("0")
      expect(juniorTranche.principalDeposited).to.bignumber.eq("0")
      expect(juniorTranche.interestAPR).to.bignumber.eq("0")
      expect(juniorTranche.lockedAt).to.bignumber.eq("0")

      expect(seniorTranche.principalSharePrice).to.bignumber.eq("1")
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
        await tranchedPool.lockJuniorCapital({from: underwriter})
        expect(tranchedPool.deposit(2, usdcVal(10))).to.be.rejectedWith(/Tranche has been locked/)
      })

      it("fails for invalid tranches", async () => {
        expect(tranchedPool.deposit(0, usdcVal(10))).to.be.rejectedWith(/Unsupported tranche/)
      })

      it("updates the tranche info and mints the token", async () => {
        expect(await poolTokens.balanceOf(owner)).to.bignumber.eq("0")

        const response = await tranchedPool.deposit(2, usdcVal(10))
        const tokenId = response.logs[0].args.tokenId
        let juniorTranche = await tranchedPool.juniorTranche()
        let seniorTranche = await tranchedPool.seniorTranche()

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
          await tranchedPool.deposit(2, usdcVal(10))
          await tranchedPool.deposit(2, usdcVal(5))
          let juniorTranche = await tranchedPool.juniorTranche()
          let seniorTranche = await tranchedPool.seniorTranche()

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
        await tranchedPool.deposit(2, usdcVal(10))
        await tranchedPool.lockJuniorCapital({from: underwriter})
        await tranchedPool.lockPool({from: underwriter})
        expect(tranchedPool.deposit(1, usdcVal(10))).to.be.rejectedWith(/Tranche has been locked/)
      })

      it("fails for invalid tranches", async () => {
        expect(tranchedPool.deposit(3, usdcVal(10))).to.be.rejectedWith(/Unsupported tranche/)
      })

      it("updates the tranche info and mints the token", async () => {
        expect(await poolTokens.balanceOf(owner)).to.bignumber.eq("0")

        const response = await tranchedPool.deposit(1, usdcVal(10))
        const tokenId = response.logs[0].args.tokenId
        let juniorTranche = await tranchedPool.juniorTranche()
        let seniorTranche = await tranchedPool.seniorTranche()

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
          await tranchedPool.deposit(1, usdcVal(10))
          await tranchedPool.deposit(1, usdcVal(5))
          let juniorTranche = await tranchedPool.juniorTranche()
          let seniorTranche = await tranchedPool.seniorTranche()

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
        let response = await tranchedPool.deposit(2, usdcVal(10))
        const tokenId = response.logs[0].args.tokenId

        await tranchedPool.withdraw(tokenId, usdcVal(10))
        let juniorTranche = await tranchedPool.juniorTranche()
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
        let response = await tranchedPool.deposit(2, usdcVal(10))
        const tokenId = response.logs[0].args.tokenId

        await tranchedPool.lockJuniorCapital({from: underwriter})

        expect(tranchedPool.withdraw(tokenId, usdcVal(10))).to.be.rejectedWith(/Invalid redeem amount/)
      })

      it("lets you withdraw pro-rata share of payments", async () => {})
    })
  })
  describe("locking", async () => {
    beforeEach(async () => {
      tranchedPool = await createPoolWithCreditLine()
    })

    describe("junior tranche", async () => {
      it("locks the junior tranche", async () => {
        await tranchedPool.deposit(1, usdcVal(10))
        await expectAction(async () => tranchedPool.lockJuniorCapital({from: underwriter})).toChange([
          [async () => (await tranchedPool.juniorTranche()).lockedAt, {increase: true}],
          [async () => (await tranchedPool.juniorTranche()).principalSharePrice, {to: new BN(0)}],
        ])
      })

      it("does not allow locking twice", async () => {
        await tranchedPool.lockJuniorCapital({from: underwriter})
        expect(tranchedPool.lockJuniorCapital({from: underwriter})).to.be.rejectedWith(/already locked/)
      })
    })

    describe("senior tranche", async () => {
      it("locks the senior tranche", async () => {
        await tranchedPool.deposit(1, usdcVal(8))
        await tranchedPool.deposit(2, usdcVal(2))
        await tranchedPool.lockJuniorCapital({from: underwriter})
        await expectAction(async () => tranchedPool.lockPool({from: underwriter})).toChange([
          [async () => (await tranchedPool.seniorTranche()).lockedAt, {increase: true}],
          [async () => (await tranchedPool.seniorTranche()).principalSharePrice, {to: new BN(0)}],
          // Senior tranche is 80% of 5% (8$ out of 10$ in the pool)
          [async () => (await tranchedPool.seniorTranche()).interestAPR, {to: interestAprAsBN("4.00")}],
          // Junior tranche is 20% of 5% (2$ out of 10$ in the pool)
          [async () => (await tranchedPool.juniorTranche()).interestAPR, {to: interestAprAsBN("1.00")}],
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
        await tranchedPool.deposit(2, usdcVal(5))
        await tranchedPool.deposit(1, usdcVal(10))
        await tranchedPool.lockJuniorCapital({from: underwriter})
        await tranchedPool.lockPool({from: underwriter})

        await expectAction(async () => tranchedPool.drawdown(usdcVal(10))).toChange([
          [async () => usdc.balanceOf(borrower), {to: usdcVal(10)}],
        ])
      })
    })
  })

  describe("tranching", async () => {
    beforeEach(async () => {
      // 100$ creditline with 10% interest. Senior tranche gets 8% of the total interest, and junior tranche gets 2%
      interestApr = interestAprAsBN("10.00")
      tranchedPool = await createPoolWithCreditLine()
      await tranchedPool.deposit(2, usdcVal(80))
      await tranchedPool.deposit(1, usdcVal(20))
      await tranchedPool.lockJuniorCapital({from: underwriter})
      await tranchedPool.lockPool({from: underwriter})
      await tranchedPool.drawdown(usdcVal(100))
    })

    describe("when full payment is received", async () => {
      it("distributes across senior and junior tranches correctly", async () => {
        await advanceTime(tranchedPool, {days: 31})
        await tranchedPool.collectInterestAndPrincipal(borrower, usdcVal(10), usdcVal(0))
        expect(await creditLine.interestApr()).to.bignumber.eq(interestAprAsBN(10))
        expect(await creditLine.balance()).to.bignumber.eq(usdcVal(100))
        let juniorTranche = await tranchedPool.juniorTranche()
        let seniorTranche = await tranchedPool.seniorTranche()

        expect(juniorTranche.principalSharePrice).to.bignumber.eq("0")
        expect(seniorTranche.principalSharePrice).to.bignumber.eq("0")

        // TODO: Fix
        expect(juniorTranche.interestSharePrice).to.bignumber.not.eq("0")
        expect(seniorTranche.interestSharePrice).to.bignumber.not.eq("0")
      })
    })
  })
})
