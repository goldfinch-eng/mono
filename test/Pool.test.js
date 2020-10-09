const {chai, expect, decimals, BN, bigVal, getBalance} = require("./testHelpers.js")
let accounts
let owner
let person2
let person3
const Pool = artifacts.require("TestPool")
const ERC20 = artifacts.require("TestERC20")

describe("Pool", () => {
  let pool
  let erc20
  const mantissa = new BN(1e6)
  let depositAmount = new BN(4).mul(mantissa)
  let withdrawAmount = new BN(2).mul(mantissa)

  let makeDeposit = async (person, amount) => {
    amount = amount || depositAmount
    person = person || person2
    return await pool.deposit(String(amount), {from: person})
  }
  let makeWithdraw = async (person, amount) => {
    amount = amount || withdrawAmount
    person = person || person2
    return await pool.withdraw(amount, {from: person})
  }

  beforeEach(async () => {
    // Pull in our unlocked accounts
    accounts = await web3.eth.getAccounts()
    ;[owner, person2, person3] = accounts

    // Deploy the ERC20 and give people some balance to play with
    erc20 = await ERC20.new(new BN(100000).mul(mantissa), mantissa, {from: owner})
    await erc20.transfer(person2, new BN(10000).mul(mantissa), {from: owner})
    await erc20.transfer(person3, new BN(1000).mul(mantissa), {from: owner})

    // Deploy and initialize a Pool for this ERC20
    pool = await Pool.new({from: owner})
    pool.initialize(erc20.address, "USDC", mantissa, {from: owner})
    await pool.setTotalFundsLimit(new BN(100000).mul(mantissa))
    await pool.setTransactionLimit(new BN(100000).mul(mantissa))

    // Allow person2 to deposit some funds.
    await erc20.approve(pool.address, new BN(100000).mul(mantissa), {from: person2})
  })

  describe("Pool", () => {
    it("deployer is owner", async () => {
      expect(await pool.owner()).to.equal(owner)
    })
  })

  describe("Pausability", () => {
    describe("after pausing", async () => {
      beforeEach(async () => {
        await makeDeposit()
        await pool.pause()
      })
      it("disallows deposits", async () => {
        return expect(makeDeposit()).to.be.rejectedWith(/Pausable: paused/)
      })
      it("disallows withdrawing", async () => {
        return expect(makeWithdraw()).to.be.rejectedWith(/Pausable: paused/)
      })
      it("allows unpausing", async () => {
        await pool.unpause()
        return expect(makeDeposit()).to.be.fulfilled
      })
    })

    describe("actually pausing", async () => {
      it("should allow the owner to pause", async () => {
        return expect(pool.pause()).to.be.fulfilled
      })
      it("should disallow non-owner to pause", async () => {
        return expect(pool.pause({from: person2})).to.be.rejectedWith(/caller is not the owner/)
      })
    })
  })

  describe("deposit", () => {
    describe("before you have approved the pool to transfer funds on your behalf", async () => {
      it("should fail", async () => {
        const expectedErr = "VM Exception while processing transaction: revert ERC20: transfer amount exceeds allowance"
        return expect(makeDeposit(person3)).to.be.rejectedWith(expectedErr)
      })
    })

    describe("after you have approved the pool to transfer funds", async () => {
      let capitalProvider
      beforeEach(async () => {
        await erc20.approve(pool.address, new BN(100000).mul(mantissa), {from: person2})
        await erc20.approve(pool.address, new BN(100000).mul(mantissa), {from: owner})
        capitalProvider = person2
      })

      it("increases the pools balance of the ERC20 token when you call deposit", async () => {
        const balanceBefore = await getBalance(pool.address, erc20)
        await makeDeposit()
        const balanceAfter = await getBalance(pool.address, erc20)
        const delta = balanceAfter.sub(balanceBefore)
        expect(delta).to.bignumber.equal(depositAmount)
      })

      it("decreases the depositors balance of the ERC20 token when you call deposit", async () => {
        const balanceBefore = await getBalance(capitalProvider, erc20)
        await makeDeposit()
        const balanceAfter = await getBalance(capitalProvider, erc20)
        const delta = balanceBefore.sub(balanceAfter)
        expect(delta).to.bignumber.equal(depositAmount)
      })

      it("saves the sender in the depositor mapping", async () => {
        await makeDeposit()
        const shares = await pool.capitalProviders(person2)
        expect(shares.eq(depositAmount)).to.be.true
      })

      it("emits an event with the correct data", async () => {
        const result = await makeDeposit()
        const event = result.logs[0]

        expect(event.event).to.equal("DepositMade")
        expect(event.args.capitalProvider).to.equal(capitalProvider)
        expect(event.args.amount).to.bignumber.equal(depositAmount)
      })

      it("increases the totalShares, even when two different people deposit", async () => {
        const secondDepositAmount = new BN(1).mul(mantissa)
        await makeDeposit()
        await makeDeposit(owner, secondDepositAmount)
        const totalShares = await pool.totalShares()
        const totalDeposited = depositAmount.add(secondDepositAmount)
        expect(totalShares.eq(totalDeposited)).to.be.true
      })
    })
  })

  describe("getNumShares", () => {
    it("calculates correctly", async () => {
      const amount = 3000
      const mantissa = 1000
      const sharePrice = 2000
      const numShares = await pool._getNumShares(amount, mantissa, sharePrice)
      expect(numShares.toNumber()).to.equal(1500)
    })
  })

  describe("withdraw", () => {
    let capitalProvider
    beforeEach(async () => {
      await erc20.approve(pool.address, new BN(100000).mul(mantissa), {from: person2})
      await erc20.approve(pool.address, new BN(100000).mul(mantissa), {from: owner})
      capitalProvider = person2
    })

    it("withdraws value from the contract when you call withdraw", async () => {
      await makeDeposit()
      const balanceBefore = await getBalance(pool.address, erc20)
      await makeWithdraw()
      const balanceAfter = await getBalance(pool.address, erc20)
      const delta = balanceBefore.sub(balanceAfter)
      expect(delta.eq(withdrawAmount)).to.be.true
    })

    it("emits an event with the correct data", async () => {
      await makeDeposit()
      const result = await makeWithdraw()
      const event = result.logs[0]

      expect(event.event).to.equal("WithdrawalMade")
      expect(event.args.capitalProvider).to.equal(capitalProvider)
      expect(event.args.amount).to.bignumber.equal(withdrawAmount)
    })

    it("sends the amount back to the address", async () => {
      await makeDeposit()
      const addressValueBefore = await getBalance(person2, erc20)
      await makeWithdraw()
      const addressValueAfter = await getBalance(person2, erc20)
      const delta = addressValueAfter.sub(addressValueBefore)
      const expMin = withdrawAmount * 0.999
      const expMax = withdrawAmount * 1.001
      expect(delta.gt(expMin) && delta.gt(expMax)).to.be.true
    })

    it("reduces the shares by the withdraw amount", async () => {
      await makeDeposit()
      const sharesBefore = await pool.capitalProviders(person2)
      await makeWithdraw()
      const sharesAfter = await pool.capitalProviders(person2)
      const expectedShares = sharesBefore.sub(withdrawAmount)
      expect(sharesAfter.eq(expectedShares)).to.be.true
    })

    it("decreases the totalShares", async () => {
      await makeDeposit()
      const sharesBefore = await pool.totalShares()
      await makeWithdraw()
      const sharesAfter = await pool.totalShares()
      const expectedShares = sharesBefore.sub(withdrawAmount)
      expect(sharesAfter.eq(expectedShares)).to.be.true
    })

    it("prevents you from withdrawing more than you have", async () => {
      const expectedErr = /Amount requested is greater than what this address owns/
      return expect(makeWithdraw()).to.be.rejectedWith(expectedErr)
    })

    it("it lets you withdraw your exact total holdings", async () => {
      await makeDeposit(person2, 123)
      await makeWithdraw(person2, 123)
      const sharesAfter = await pool.capitalProviders(person2)
      expect(sharesAfter.toNumber()).to.equal(0)
    })
  })

  describe("collectInterestRepayment", async () => {
    beforeEach(async () => {
      await erc20.approve(pool.address, new BN(100000).mul(mantissa), {from: person2})
      await makeDeposit()
    })
    it("should emit an event with the right information", async () => {
      const amount = new BN(1).mul(mantissa)
      const response = await pool.collectInterestRepayment(person2, amount, {from: person2})
      const event = response.logs[0]
      expect(event.event).to.equal("InterestCollected")
      expect(event.args.payer).to.equal(person2)
      expect(event.args.amount).to.bignumber.equal(amount)
    })
  })

  describe("collectPrincipalRepayment", async () => {
    beforeEach(async () => {
      await erc20.approve(pool.address, new BN(100000).mul(mantissa), {from: person2})
      await makeDeposit()
    })
    it("should emit an event with the right information", async () => {
      const amount = new BN(1).mul(mantissa)
      const response = await pool.collectPrincipalRepayment(person2, amount, {from: person2})
      const event = response.logs[0]
      expect(event.event).to.equal("PrincipalCollected")
      expect(event.args.payer).to.equal(person2)
      expect(event.args.amount).to.bignumber.equal(amount)
    })
  })

  describe("transferFrom", async () => {
    it("should emit an event with the right information", async () => {
      const amount = new BN(1).mul(mantissa)
      const response = await pool.transferFrom(person2, pool.address, amount, {from: owner})
      const event = response.logs[0]
      expect(event.event).to.equal("TransferMade")
      expect(event.args.from).to.equal(person2)
      expect(event.args.to).to.equal(pool.address)
      expect(event.args.amount).to.bignumber.equal(amount)
    })
  })

  describe("hard limits", async () => {
    describe("totalFundsLimit", async () => {
      describe("setting the limit", async () => {
        let limit = new BN(1000)
        it("should fail if it isn't the owner", async () => {
          return expect(pool.setTotalFundsLimit(limit.mul(mantissa), {from: person2})).to.be.rejectedWith(
            /not the owner/
          )
        })

        it("should set the limit, and multiply what you pass up by the mantissa", async () => {
          await pool.setTotalFundsLimit(limit.mul(mantissa))
          const newLimit = await pool.totalFundsLimit()
          expect(newLimit).to.bignumber.equal(limit.mul(mantissa))
        })

        it("should fire an event", async () => {
          const result = await pool.setTotalFundsLimit(limit.mul(mantissa))

          const event = result.logs[0]

          expect(event.event).to.equal("LimitChanged")
          expect(event.args.owner).to.equal(owner)
          expect(event.args.limitType).to.bignumber.equal("totalFundsLimit")
          expect(event.args.amount).to.bignumber.equal(new BN(limit).mul(mantissa))
        })
      })

      describe("once it's set", async () => {
        let limit = new BN(5000)
        beforeEach(async () => {
          await pool.setTotalFundsLimit(limit.mul(mantissa))
          await pool.setTransactionLimit(limit.mul(new BN(2)).mul(mantissa))
        })

        it("should accept deposits before the limit is reached", async () => {
          return expect(makeDeposit(person2, new BN(1000).mul(mantissa))).to.be.fulfilled
        })

        it("should accept everything right up to the limit", async () => {
          return expect(makeDeposit(person2, new BN(limit).mul(mantissa))).to.be.fulfilled
        })

        it("should fail if you're over the limit", async () => {
          return expect(makeDeposit(person2, new BN(limit).add(new BN(1)).mul(mantissa))).to.be.rejectedWith(
            /put the Pool over the total limit/
          )
        })
      })
    })
    describe("transactionLimit", async () => {
      describe("setting the limit", async () => {
        let limit = new BN(1000)
        it("should fail if it isn't the owner", async () => {
          return expect(pool.setTransactionLimit(limit.mul(mantissa), {from: person2})).to.be.rejectedWith(
            /not the owner/
          )
        })

        it("should set the limit, and multiply what you pass up by the mantissa", async () => {
          await pool.setTransactionLimit(limit.mul(mantissa))
          const newLimit = await pool.transactionLimit()
          expect(newLimit).to.bignumber.equal(new BN(limit).mul(mantissa))
        })

        it("should fire an event", async () => {
          const result = await pool.setTransactionLimit(limit.mul(mantissa))

          const event = result.logs[0]

          expect(event.event).to.equal("LimitChanged")
          expect(event.args.owner).to.equal(owner)
          expect(event.args.limitType).to.bignumber.equal("transactionLimit")
          expect(event.args.amount).to.bignumber.equal(new BN(limit).mul(mantissa))
        })
      })

      describe("after setting it", async () => {
        let limit
        beforeEach(async () => {
          limit = new BN(1000)
          await pool.setTotalFundsLimit(limit.mul(new BN(10)).mul(mantissa))
          await pool.setTransactionLimit(limit.mul(mantissa))
        })

        it("should still allow transactions up to the limit", async () => {
          return expect(makeDeposit(person2, new BN(limit).mul(mantissa))).to.be.fulfilled
        })

        it("should block deposits over the limit", async () => {
          return expect(makeDeposit(person2, new BN(limit).add(new BN(1)).mul(mantissa))).to.be.rejectedWith(
            /Amount is over the per-transaction limit/
          )
        })

        it("should block withdrawals over the limit", async () => {
          await makeDeposit(person2, new BN(limit).mul(mantissa))
          await makeDeposit(person2, new BN(limit).mul(mantissa))

          return expect(makeWithdraw(person2, new BN(limit).add(new BN(1)).mul(mantissa))).to.be.rejectedWith(
            /Amount is over the per-transaction limit/
          )
        })
      })
    })
  })
})
